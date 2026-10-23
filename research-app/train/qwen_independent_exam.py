"""Evaluation only: Qwen3 4B on the exact historical 97 questions. No optimizer or checkpoint writes."""
import collections
import hashlib
import json
import pathlib
import subprocess
import sys
import time


def run():
    work = pathlib.Path('/kaggle/working')
    work.mkdir(exist_ok=True)
    def note(message):
        print(message, flush=True)
        with (work / 'notes.txt').open('a') as f:
            f.write(message + '\n')
    paths = list(pathlib.Path('/kaggle/input').glob('**/exam.json'))
    if len(paths) != 1:
        raise ValueError('Exactly one private exam is required')
    exam = json.loads(paths[0].read_text())
    fingerprint = hashlib.sha256(json.dumps(exam['questions'], sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    if len(exam['questions']) != 97 or fingerprint != exam['fingerprint']:
        raise ValueError('Frozen exam mismatch')
    if len(exam['models']) != 1 or exam['models'][0]['repo'] != 'Qwen/Qwen3-4B':
        raise ValueError('Only the requested Qwen3 4B may run')
    spec = exam['models'][0]
    note('Evaluation only: 97 fixed questions. No training or model upload.')
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', 'transformers>=4.51,<5',
                    'accelerate', 'bitsandbytes'], check=True)
    import torch
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    if not torch.cuda.is_available():
        raise RuntimeError('Free Kaggle GPU is unavailable')
    torch.manual_seed(0)
    tokenizer = AutoTokenizer.from_pretrained(spec['repo'], revision=spec['revision'])
    letter_tokens = [tokenizer.encode(c, add_special_tokens=False) for c in 'ABCDE']
    if any(len(ids) != 1 for ids in letter_tokens) or len({ids[0] for ids in letter_tokens}) != 5:
        raise ValueError('Answer letters must be five distinct single tokens')
    letter_ids = [ids[0] for ids in letter_tokens]
    model = AutoModelForCausalLM.from_pretrained(spec['repo'], revision=spec['revision'],
        device_map={'': 0}, torch_dtype=torch.float16,
        quantization_config=BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type='nf4',
            bnb_4bit_compute_dtype=torch.float16, bnb_4bit_use_double_quant=True)).eval()
    model.config.use_cache = False
    deadline = time.monotonic() + 25 * 60

    def predict(q, without_passage=False):
        if time.monotonic() > deadline:
            raise TimeoutError('Evaluation time budget exhausted')
        passage = '' if without_passage else q['passage']
        options = '\n'.join(f'{letter}) {option}' for letter, option in zip('ABCDE', q['options']))
        if q['group'] == 'Turkish reading':
            content = ('Aşağıdaki paragrafı okuyun ve soruyu cevaplayın. Yalnız doğru şıkkın harfini yazın.\n\n'
                       f'Paragraf:\n{passage}\n\nSoru: {q["question"]}\n\n{options}\n\nCevap:')
        else:
            content = ('Read the passage and answer the question. Reply with the letter of the correct option only.\n\n'
                       f'Passage:\n{passage}\n\nQuestion: {q["question"]}\n\n{options}\n\nAnswer:')
        text = tokenizer.apply_chat_template([{'role': 'user', 'content': content}], tokenize=False,
                    add_generation_prompt=True, enable_thinking=False)
        inputs = tokenizer(text, add_special_tokens=False, return_tensors='pt').to('cuda')
        length = inputs.input_ids.shape[1]
        if length > min(8192, model.config.max_position_embeddings):
            raise ValueError('Question exceeds context limit; refusing truncation: ' + q['id'])
        with torch.inference_mode():
            values = model(**inputs, logits_to_keep=1).logits[0, -1, letter_ids].float()
        if not torch.isfinite(values).all():
            raise ValueError('Non-finite answer scores: ' + q['id'])
        pick = int(values.argmax())
        return 'ABCDE'[pick], values.tolist(), length, int((values == values[pick]).sum()) > 1

    totals = collections.defaultdict(lambda: [0, 0, 0])
    answers = []
    for index, q in enumerate(exam['questions']):
        if len(q['options']) != 5 or q['answer'] not in 'ABCDE':
            raise ValueError('Invalid frozen question')
        pick, scores, length, tied = predict(q)
        blank, _, _, _ = predict(q, without_passage=True)
        for group in ('Overall', q['group']):
            totals[group][0] += pick == q['answer']
            totals[group][1] += 1
            totals[group][2] += blank == q['answer']
        answers.append({'id': q['id'], 'group': q['group'], 'gold': q['answer'], 'prediction': pick,
                        'without_passage_prediction': blank, 'scores': scores, 'tokens': length,
                        'truncated': False, 'tied': tied})
        if (index + 1) % 10 == 0:
            note(f'Completed {index + 1}/97 questions')
    summary = {g: {'correct': t[0], 'total': t[1], 'accuracy': round(100 * t[0] / t[1], 2),
                   'without_passage_correct': t[2]} for g, t in totals.items()}
    result = {'completed': True, 'evaluation_only': True, 'run_id': exam['run_id'],
              'fingerprint': fingerprint, 'audit': exam['audit'],
              'groups': dict(collections.Counter(q['group'] for q in exam['questions'])),
              'protocol': {'thinking': False, 'quantization': 'NF4 4-bit', 'scoring': 'A-E next-token logits',
                           'truncation': False},
              'models': [{**spec, 'summary': summary, 'answers': answers, 'truncated_questions': 0}]}
    (work / 'exam-result.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
    (work / 'status.json').write_text(json.dumps({'ok': True, 'evaluation_only': True, 'run_id': exam['run_id']}))
    for group, score in summary.items():
        note(f'Qwen3 4B / {group}: {score["correct"]}/{score["total"]} ({score["accuracy"]:.2f}%)')


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
