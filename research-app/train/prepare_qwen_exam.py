"""Reconstruct the exact previous 97-question exam; never download NLI weights."""
import collections
import hashlib
import json
import os
import pathlib

import independent_exam_data as data


def main():
    from huggingface_hub import HfApi
    root = pathlib.Path(__file__).parent
    reference = json.loads((root / 'qwen_exam_reference.json').read_text())
    manifest = json.loads((root / 'independent_exam_manifest.json').read_text())
    rows, hashes = data.build('exam-source-cache')
    for source, expected in reference['audit']['source_hashes'].items():
        if hashes[source] != expected:
            raise ValueError('Source changed: ' + source)
    if {q['id'] for q in rows} != set(manifest['questions']):
        raise ValueError('Frozen source selection changed')
    for q in rows:
        canonical = json.dumps({k: q[k] for k in ('id', 'passage', 'question', 'options', 'answer')},
                               ensure_ascii=False, sort_keys=True, separators=(',', ':'))
        if hashlib.sha256(canonical.encode()).hexdigest() != manifest['questions'][q['id']]['sha256']:
            raise ValueError('Question changed: ' + q['id'])
    by_id = {q['id']: q for q in rows}
    rows = [by_id[qid] for qid in reference['question_ids']]
    fingerprint = hashlib.sha256(json.dumps(rows, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
    groups = dict(collections.Counter(q['group'] for q in rows))
    if len(rows) != 97 or fingerprint != reference['fingerprint'] or groups != reference['groups']:
        raise ValueError('Exam differs from the previous 97-question examination')
    repo = 'Qwen/Qwen3-4B'
    revision = HfApi().model_info(repo).sha
    run_id = os.environ['GITHUB_RUN_ID']
    models = [{'name': 'qwen3-4b-before-training', 'repo': repo, 'revision': revision}]
    target = pathlib.Path('exam-private')
    target.mkdir(exist_ok=True)
    exam = {'run_id': run_id, 'questions': rows, 'fingerprint': fingerprint,
            'audit': reference['audit'], 'models': models}
    (target / 'exam.json').write_text(json.dumps(exam, ensure_ascii=False))
    (target / 'round.txt').write_text(run_id)
    report = pathlib.Path('exam-report')
    report.mkdir(exist_ok=True)
    provenance = {**reference, 'run_id': run_id, 'models': models}
    (report / 'exam-audit.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2))
    print(f'Exact previous exam verified: {len(rows)} questions, fingerprint {fingerprint}', flush=True)
    print(f'Pinned model: {repo}@{revision}', flush=True)


if __name__ == '__main__':
    main()
