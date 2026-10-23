"""One short Qwen paragraph-only LoRA round, followed by the unchanged 97-question exam."""
import collections
import gc
import hashlib
import json
import pathlib
import random
import shutil
import subprocess
import sys
import time

LETTERS = 'ABCDE'


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def prompt(q, order=None, blank=False):
    order = list(range(5)) if order is None else order
    if sorted(order) != list(range(5)):
        raise ValueError('Invalid option permutation')
    passage = '' if blank else q['passage']
    options = '\n'.join(f'{LETTERS[i]}) {q["options"][j]}' for i, j in enumerate(order))
    if q['group'] == 'Turkish reading':
        return ('Aşağıdaki paragrafı okuyun ve soruyu cevaplayın. Yalnız doğru şıkkın harfini yazın.\n\n'
                f'Paragraf:\n{passage}\n\nSoru: {q["question"]}\n\n{options}\n\nCevap:')
    return ('Read the passage and answer the question. Reply with the letter of the correct option only.\n\n'
            f'Passage:\n{passage}\n\nQuestion: {q["question"]}\n\n{options}\n\nAnswer:')


def validate(profile, exam):
    if profile['run_id'] != exam['run_id'] or digest(exam['questions']) != profile['exam_fingerprint']:
        raise ValueError('Wrong examination or run')
    if len(exam['questions']) != 97 or exam['fingerprint'] != profile['exam_fingerprint']:
        raise ValueError('The previous 97 questions are required')
    if digest(profile['train']) != profile['train_fingerprint'] or digest(profile['dev']) != profile['dev_fingerprint']:
        raise ValueError('Training/development payload changed')
    for name in ('train', 'dev'):
        if len({q['id'] for q in profile[name]}) != len(profile[name]):
            raise ValueError('Duplicate reading question')
        for q in profile[name]:
            if q['group'] != 'English reading' or len(q['options']) != 5 or q['answer'] not in LETTERS:
                raise ValueError('Only English five-option reading questions may be trained')
    for a, b in ((profile['train'], profile['dev']), (profile['train'], exam['questions'])):
        if {q['passage'] for q in a} & {q['passage'] for q in b}:
            raise ValueError('Training passage overlaps an examination')
    state = profile['state']
    if state['base_repo'] != 'Qwen/Qwen3-4B' or (state['round'] > 0 and not state['adapter_repo']):
        raise ValueError('Current model missing; no original-model fallback')
    if not 0 < profile['request']['minutes'] <= 15:
        raise ValueError('Round must be at most 15 training minutes')


def run():
    work = pathlib.Path('/kaggle/working')
    work.mkdir(exist_ok=True)
    def note(message):
        print(message, flush=True)
        with (work / 'notes.txt').open('a') as f:
            f.write(message + '\n')
    paths = list(pathlib.Path('/kaggle/input').glob('**/qwen-round.json'))
    if len(paths) != 1:
        raise ValueError('Exactly one private round is required')
    inp = paths[0].parent
    profile = json.loads(paths[0].read_text())
    exam = json.loads((inp / 'exam.json').read_text())
    validate(profile, exam)
    state, request = profile['state'], profile['request']
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'transformers>=4.51,<5',
                    'peft>=0.17,<0.19', 'accelerate', 'bitsandbytes'], check=True)
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from peft import LoraConfig, get_peft_model, PeftModel, prepare_model_for_kbit_training
    if not torch.cuda.is_available():
        raise RuntimeError('No free GPU; refusing CPU training')
    seed = request['seed'] + state['round']
    torch.manual_seed(seed)
    rng = random.Random(seed)
    tok = AutoTokenizer.from_pretrained(state['base_repo'], revision=state['base_revision'])
    letters = [tok.encode(c, add_special_tokens=False) for c in LETTERS]
    if any(len(x) != 1 for x in letters) or len({x[0] for x in letters}) != 5:
        raise ValueError('Answer letters are not distinct single tokens')
    letter_ids = [x[0] for x in letters]
    def encode(q, order=None, blank=False):
        text = tok.apply_chat_template([{'role': 'user', 'content': prompt(q, order, blank)}],
                tokenize=False, add_generation_prompt=True, enable_thinking=False)
        return tok(text, add_special_tokens=False)['input_ids']
    def load_base():
        m = AutoModelForCausalLM.from_pretrained(state['base_repo'], revision=state['base_revision'],
            device_map={'': 0}, torch_dtype=torch.float16,
            quantization_config=BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type='nf4',
                bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True))
        m.config.use_cache = False
        return m
    model = prepare_model_for_kbit_training(load_base(), use_gradient_checkpointing=True)
    if state['adapter_repo']:
        start = work / 'current-adapter'
        start.mkdir(exist_ok=True)
        for name in ('adapter_config.json', 'adapter_model.safetensors'):
            shutil.copyfile(inp / ('start__' + name), start / name)
        model = PeftModel.from_pretrained(model, start, is_trainable=True)
    else:
        if state['round'] != 0:
            raise ValueError('Missing current adapter')
        model = get_peft_model(model, LoraConfig(r=8, lora_alpha=16, lora_dropout=0.05,
            task_type='CAUSAL_LM', target_modules=['q_proj', 'k_proj', 'v_proj', 'o_proj']))
    def scores(ids):
        x = torch.tensor([ids], device='cuda')
        return model(input_ids=x, attention_mask=torch.ones_like(x), logits_to_keep=1).logits[0, -1, letter_ids].float()
    params = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(params, lr=request['learning_rate'])
    model.train()
    completed = set(state.get('trained_question_ids', []))
    rows = [q for q in profile['train'] if q['id'] not in completed]
    rng.shuffle(rows)
    if not rows:
        raise ValueError('This reading pool has been exhausted; new human questions are required')
    note(f'TRAIN START: current round {state["round"]}, {len(rows)} unused English reading questions, {request["minutes"]} minutes')
    note('The 97-question exam is excluded from training; the original model is not re-evaluated.')
    begun = time.monotonic()
    seen, skipped, pending, steps, total_loss = [], [], 0, 0, 0.0
    accumulation = 8
    for q in rows:
        if time.monotonic() - begun >= request['minutes'] * 60:
            break
        order = list(range(5))
        rng.shuffle(order)
        ids = encode(q, order)
        if len(ids) > request['max_train_tokens']:
            skipped.append(q['id'])
            continue
        target = order.index(LETTERS.index(q['answer']))
        loss = torch.nn.functional.cross_entropy(scores(ids).unsqueeze(0), torch.tensor([target], device='cuda'))
        if not torch.isfinite(loss):
            raise ValueError('Non-finite training loss')
        (loss / accumulation).backward()
        total_loss += loss.item()
        seen.append(q['id'])
        pending += 1
        if pending == accumulation:
            torch.nn.utils.clip_grad_norm_(params, 1.0, error_if_nonfinite=True)
            optimizer.step()
            optimizer.zero_grad(set_to_none=True)
            pending = 0
            steps += 1
            if steps % 5 == 0:
                note(f'TRAIN: {len(seen)} questions, {steps} updates, {(time.monotonic()-begun)/60:.1f} minutes')
    if pending:
        for p in params:
            if p.grad is not None:
                p.grad.mul_(accumulation / pending)
        torch.nn.utils.clip_grad_norm_(params, 1.0, error_if_nonfinite=True)
        optimizer.step()
        optimizer.zero_grad(set_to_none=True)
        steps += 1
    duration = time.monotonic() - begun
    if not steps or not seen:
        raise ValueError('No training updates completed')
    out = work / 'out'
    model.save_pretrained(out)
    training = {'run_id': profile['run_id'], 'round': state['round']+1, 'questions_seen': len(seen),
                'question_ids': seen, 'skipped_for_length': skipped, 'optimizer_steps': steps,
                'training_seconds': duration, 'mean_loss': total_loss/len(seen),
                'train_fingerprint': profile['train_fingerprint'], 'exam_fingerprint': exam['fingerprint']}
    (work / 'training.json').write_text(json.dumps(training, indent=2))
    note(f'TRAIN COMPLETE: {len(seen)} different questions, {steps} updates, {duration/60:.1f} minutes')
    # Reload the saved adapter on the same inference precision used by the baseline.
    del optimizer, params, model, loss
    gc.collect()
    torch.cuda.empty_cache()
    model = PeftModel.from_pretrained(load_base(), out, is_trainable=False).eval()
    eval_deadline = time.monotonic() + 30*60
    def evaluate(questions, controls):
        answers, totals = [], collections.defaultdict(lambda: [0, 0, 0])
        with torch.inference_mode():
            for q in questions:
                if time.monotonic() > eval_deadline:
                    raise TimeoutError('Post-training examination timed out')
                ids = encode(q)
                if len(ids) > min(8192, model.config.max_position_embeddings):
                    raise ValueError('Examination truncation is forbidden')
                values = scores(ids)
                if not torch.isfinite(values).all():
                    raise ValueError('Non-finite examination scores')
                pick = LETTERS[int(values.argmax())]
                blank = LETTERS[int(scores(encode(q, blank=True)).argmax())] if controls else None
                for group in ('Overall', q['group']):
                    totals[group][0] += pick == q['answer']
                    totals[group][1] += 1
                    totals[group][2] += blank == q['answer']
                answers.append({'id': q['id'], 'group': q['group'], 'gold': q['answer'], 'prediction': pick,
                                'without_passage_prediction': blank, 'scores': values.tolist(),
                                'truncated': False, 'tokens': len(ids)})
        summary = {g: {'correct': v[0], 'total': v[1], 'accuracy': round(100*v[0]/v[1],2),
                       'without_passage_correct': v[2] if controls else None} for g,v in totals.items()}
        return summary, answers
    # Both are post-training reports only; neither selects a checkpoint or tunes hyperparameters.
    dev_summary, dev_answers = evaluate(profile['dev'], False)
    summary, answers = evaluate(exam['questions'], True)
    result = {'completed': True, 'evaluation_only': False, 'run_id': profile['run_id'],
              'fingerprint': exam['fingerprint'], 'groups': dict(collections.Counter(q['group'] for q in exam['questions'])),
              'before_recorded': state['summary'], 'training': training,
              'protocol': {'thinking': False, 'quantization': 'NF4 4-bit', 'scoring': 'A-E next-token logits', 'truncation': False},
              'models': [{'name': 'qwen3-4b-trained-round-'+str(state['round']+1), 'repo': state['base_repo'],
                          'revision': state['base_revision'], 'summary': summary, 'answers': answers}],
              'development': {'summary': dev_summary, 'answers': dev_answers}}
    (work / 'exam-result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    for group, score in summary.items():
        note(f'AFTER / {group}: {score["correct"]}/{score["total"]} ({score["accuracy"]:.2f}%)')
    (work / 'status.json').write_text(json.dumps({'ok': True, 'evaluation_only': False, 'run_id': profile['run_id'],
        'fingerprint': exam['fingerprint'], 'train_fingerprint': profile['train_fingerprint'],
        'questions_seen': len(seen), 'optimizer_steps': steps}))


if __name__ == '__main__':
    try:
        run()
    except Exception:
        import traceback
        path = pathlib.Path('/kaggle/working/notes.txt')
        if path.parent.exists():
            with path.open('a') as f:
                f.write(traceback.format_exc())
        raise
