"""Publish a completed paragraph adapter and advance only the current Qwen pointer."""
import base64
import json
import os
import pathlib
import shutil
import urllib.request

STATE_PATH = 'research-app/train/qwen_latest.json'


def collect(target, res, report):
    from huggingface_hub import HfApi
    profile = json.loads((target / 'qwen-round.json').read_text())
    exam = json.loads((target / 'exam.json').read_text())
    status = json.loads((res / 'status.json').read_text())
    result = json.loads((res / 'exam-result.json').read_text())
    training = json.loads((res / 'training.json').read_text())
    run_id = os.environ['GITHUB_RUN_ID']
    if (not status.get('ok') or status.get('evaluation_only') or status.get('run_id') != run_id
        or status.get('fingerprint') != profile['exam_fingerprint']
        or status.get('train_fingerprint') != profile['train_fingerprint']
        or not result.get('completed') or result['fingerprint'] != profile['exam_fingerprint']
        or result['run_id'] != run_id or training['run_id'] != run_id
        or training['optimizer_steps'] < 1 or not training['question_ids']):
        raise ValueError('Incomplete or mismatched trained result; no model published')
    if not set(training['question_ids']).issubset({q['id'] for q in profile['train']}):
        raise ValueError('Training included unauthorized questions')
    answers = result['models'][0]['answers']
    if ([a['id'] for a in answers] != [q['id'] for q in exam['questions']]
        or [a['gold'] for a in answers] != [q['answer'] for q in exam['questions']]
        or any(a.get('truncated') for a in answers)):
        raise ValueError('Post-training exam differs from the fixed 97 questions')
    for name in ('adapter_config.json', 'adapter_model.safetensors'):
        if not (res / 'out' / name).is_file():
            raise ValueError('Trained adapter file missing')
    token = os.environ['GITHUB_TOKEN']
    endpoint = 'https://api.github.com/repos/' + os.environ['GITHUB_REPOSITORY'] + '/contents/' + STATE_PATH
    headers = {'Authorization': 'Bearer '+token, 'Accept': 'application/vnd.github+json',
               'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28'}
    branch = os.environ['GITHUB_REF_NAME']
    with urllib.request.urlopen(urllib.request.Request(endpoint+'?ref='+branch, headers=headers), timeout=45) as response:
        remote = json.load(response)
    if json.loads(base64.b64decode(remote['content'])) != profile['state']:
        raise RuntimeError('A different round advanced Qwen; refusing to overwrite its state')
    api = HfApi()
    repo = api.whoami()['name'] + '/orbis-qwen3-4b-paragraph-' + run_id
    api.create_repo(repo, private=True, exist_ok=False)
    api.upload_folder(repo_id=repo, folder_path=str(res / 'out'),
                      commit_message='English paragraph-only LoRA round; fixed held-out examination')
    revision = api.model_info(repo).sha
    summary = result['models'][0]['summary']
    latest = {**profile['state'], 'adapter_repo': repo, 'adapter_revision': revision,
              'round': profile['state']['round'] + 1, 'training_run': run_id,
              'summary': summary, 'trained_question_ids': sorted(set(profile['state'].get('trained_question_ids', [])) | set(training['question_ids']))}
    status.update(private_checkpoint=repo, checkpoint_revision=revision, pointer_updated=False)
    (report / 'status.json').write_text(json.dumps(status, indent=2))
    shutil.copyfile(res / 'training.json', report / 'training.json')
    content = json.dumps(latest, ensure_ascii=False, indent=2)+'\n'
    payload = {'message': 'Advance Qwen to completed paragraph round '+str(latest['round']), 'branch': branch,
               'sha': remote['sha'], 'content': base64.b64encode(content.encode()).decode()}
    with urllib.request.urlopen(urllib.request.Request(endpoint, data=json.dumps(payload).encode(),
                                headers=headers, method='PUT'), timeout=45) as response:
        json.load(response)
    status['pointer_updated'] = True
    (report / 'status.json').write_text(json.dumps(status, indent=2))
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as f:
        f.write('## Qwen paragraf eğitimi\n\n')
        f.write(f'- Eğitim: {training["questions_seen"]} farklı İngilizce paragraf sorusu; {training["training_seconds"]/60:.1f} dakika.\n')
        for group, after in summary.items():
            before = profile['state']['summary'][group]
            f.write(f'- {group}: {before["correct"]}/{before["total"]} → {after["correct"]}/{after["total"]} (%{after["accuracy"]:.2f}).\n')
        f.write('- Sınavın 97 sorusu eğitimden ayrı tutuldu. Son eğitilmiş Qwen kaydedildi.\n')
    print('::notice title=Qwen saved::'+repo+'@'+revision, flush=True)
