"""Prepare published English reading questions, separated from the exact 97-question exam."""
import hashlib
import json
import os
import pathlib
import shutil

from independent_exam_data import overlap_audit
from paragraph_thousand import read_source, filtered, fingerprint, REVISION
from qwen_paragraph_round import prompt, digest


def main():
    from huggingface_hub import snapshot_download
    from transformers import AutoTokenizer
    import prepare_qwen_exam
    prepare_qwen_exam.main()
    root = pathlib.Path(__file__).parent
    state = json.loads((root / 'qwen_latest.json').read_text())
    request = json.loads((root / 'qwen_paragraph_request.json').read_text())
    if state['base_repo'] != 'Qwen/Qwen3-4B' or not state['base_revision']:
        raise ValueError('Unexpected current Qwen model')
    if not 0 < request['minutes'] <= 15 or request['language'] != 'English':
        raise ValueError('Only a short English reading round is authorized')
    if state['round'] > 0 and not (state['adapter_repo'] and state['adapter_revision']):
        raise ValueError('Trained adapter missing; original-model fallback is forbidden')
    exam = json.loads(pathlib.Path('exam-private/exam.json').read_text())
    if exam['fingerprint'] != state['exam_fingerprint']:
        raise ValueError('Independent examination changed')
    exam['models'] = [{'name': 'qwen3-4b-after-paragraph-round', 'repo': state['base_repo'],
                       'revision': state['base_revision']}]
    cache = pathlib.Path('qwen-source-cache')
    raw_train, train_hash = read_source('train', cache)
    raw_dev, dev_hash = read_source('val', cache)
    raw_test, test_hash = read_source('test', cache)
    known = json.loads((root / 'paragraph_thousand_manifest.json').read_text())['source_hashes']
    hashes = {'train': train_hash, 'val': dev_hash, 'test': test_hash}
    if any(hashes[k] != known[k] for k in hashes):
        raise ValueError('Published reading source changed')
    train, rejected_train = filtered(raw_train)
    dev, rejected_dev = filtered(raw_dev)
    protected = [q['passage'] for q in exam['questions']]
    train, train_overlap = overlap_audit(train, protected + [q['context'] for q in raw_dev + raw_test])
    # No passage from ANY eligible training question can enter development.
    dev, dev_overlap = overlap_audit(dev, protected + [q['passage'] for q in train] + [q['context'] for q in raw_test])
    tok = AutoTokenizer.from_pretrained(state['base_repo'], revision=state['base_revision'])
    def fits(q):
        text = tok.apply_chat_template([{'role': 'user', 'content': prompt(q)}], tokenize=False,
                                      add_generation_prompt=True, enable_thinking=False)
        return len(tok(text, add_special_tokens=False)['input_ids']) <= request['max_train_tokens']
    train = [q for q in train if fits(q)]
    dev = [q for q in dev if fits(q)]
    train.sort(key=lambda q: hashlib.sha256(('qwen-paragraph-train-v1:' + q['id']).encode()).hexdigest())
    dev.sort(key=lambda q: hashlib.sha256(('qwen-paragraph-dev-v1:' + q['id']).encode()).hexdigest())
    if len(train) < request['training_questions'] or len(dev) < request['development_questions']:
        raise ValueError(f'Insufficient eligible reading questions: train={len(train)}, dev={len(dev)}')
    train = train[:request['training_questions']]
    dev = dev[:request['development_questions']]
    for left, right in ((train, dev), (train, exam['questions']), (dev, exam['questions'])):
        if {q['passage'] for q in left} & {q['passage'] for q in right}:
            raise ValueError('Passage leakage')
    target = pathlib.Path('qwen-private')
    target.mkdir(exist_ok=True)
    if state['adapter_repo']:
        folder = pathlib.Path(snapshot_download(state['adapter_repo'], revision=state['adapter_revision'],
                              local_dir='qwen-current-adapter', allow_patterns=['adapter_config.json', 'adapter_model.safetensors']))
        for name in ('adapter_config.json', 'adapter_model.safetensors'):
            if not (folder / name).exists():
                raise ValueError('Current trained adapter is incomplete')
            shutil.copyfile(folder / name, target / ('start__' + name))
    audit = {'source_revision': REVISION, 'source_hashes': hashes,
             'train': {q['id']: fingerprint(q) for q in train}, 'dev': {q['id']: fingerprint(q) for q in dev},
             'train_overlap': train_overlap, 'dev_overlap': dev_overlap,
             'rejected_structure': {'train': rejected_train, 'dev': rejected_dev},
             'counts': {'train_questions': len(train), 'train_passages': len({q['passage'] for q in train}),
                        'dev_questions': len(dev), 'exam_questions': len(exam['questions'])}}
    profile = {'run_id': os.environ['GITHUB_RUN_ID'], 'state': state, 'request': request,
               'train': train, 'dev': dev, 'train_fingerprint': digest(train), 'dev_fingerprint': digest(dev),
               'exam_fingerprint': exam['fingerprint'], 'audit': audit}
    (target / 'qwen-round.json').write_text(json.dumps(profile, ensure_ascii=False))
    (target / 'exam.json').write_text(json.dumps(exam, ensure_ascii=False))
    (target / 'round.txt').write_text(profile['run_id'])
    report = pathlib.Path('qwen-report')
    report.mkdir(exist_ok=True)
    (report / 'data-audit.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2))
    shutil.copyfile('exam-report/exam-audit.json', report / 'exam-audit.json')
    print('English paragraph training ready: ' + json.dumps(audit['counts']), flush=True)
    print('Starting from current Qwen round ' + str(state['round']), flush=True)


if __name__ == '__main__':
    main()
