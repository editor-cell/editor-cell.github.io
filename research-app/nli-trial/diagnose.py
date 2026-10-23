"""Read-only diagnosis of the current trained checkpoint, including the reported false positive."""
import json
import sys
from pathlib import Path
import numpy as np
import onnxruntime as ort
from tokenizers import Tokenizer

root = Path(sys.argv[1])
tokenizer = Tokenizer.from_file(str(root / 'tokenizer.json'))
tokenizer.no_padding()
tokenizer.enable_truncation(1024, strategy='only_first')
options = ort.SessionOptions()
options.intra_op_num_threads = 2
session = ort.InferenceSession(str(root / 'model.onnx'), options, providers=['CPUExecutionProvider'])
labels = json.loads((root / 'encoding.json').read_text())['labels']
claims = ['obezite kalp krizi ihtimalini artırır', 'Obesity increases the risk of heart attacks.']
paragraphs = {
    'reported_who_underweight': 'Underweight - Weight is easy to measure; hence, this is the indicator for which most data have been collected in the past. The mortality risk is increased in children who are even mildly underweight, and the risk is even greater in severely underweight children.',
    'direct_support': 'Obesity increases the risk of heart attacks.',
    'direct_support_tr': 'Obezite kalp krizi ihtimalini artırır.',
    'direct_opposite': 'Obesity does not increase the risk of heart attacks.',
    'opposite_tr': 'Obezite kalp krizi ihtimalini artırmaz.',
    'different_outcome': 'Obesity increases the risk of knee pain.',
    'different_cause': 'Smoking increases the risk of heart attacks.',
    'unrelated': 'The library extended its opening hours to accommodate more readers.',
}
results = []
for name, paragraph in paragraphs.items():
    for claim in claims:
        enc = tokenizer.encode(paragraph, claim)
        values = {'input_ids': enc.ids, 'attention_mask': enc.attention_mask, 'token_type_ids': enc.type_ids}
        scores = session.run(None, {x.name: np.array([values[x.name]], dtype=np.int64) for x in session.get_inputs()})[0][0]
        probabilities = np.exp(scores - scores.max())
        probabilities /= probabilities.sum()
        row = {'case': name, 'claim': claim, 'paragraph': paragraph, 'logits': scores.tolist(),
               'probabilities': dict(zip(labels, probabilities.tolist())), 'winner': labels[int(scores.argmax())]}
        results.append(row)
        print(json.dumps(row, ensure_ascii=False), flush=True)
Path('reading-diagnosis.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
