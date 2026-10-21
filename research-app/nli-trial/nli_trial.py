"""Trial: NLI models (made to compare two texts) on the 26 paragraphs the language models were tried on.
The paragraph is the premise, the claim the hypothesis: entailment = SUPPORTS, contradiction =
CONTRADICTS, neutral = UNRELATED. Three ways: the claim in English, the claim in Turkish, and the
paragraph sentence by sentence (the most confident sentence decides). Prints a score card as notes
on the run. Usage: nli_trial.py <model id> <label>"""
import json
import re
import sys
import time

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

model_id, label = sys.argv[1], sys.argv[2]
data = json.load(open(__file__.replace("nli_trial.py", "cases.json"), encoding="utf-8"))
tok = AutoTokenizer.from_pretrained(model_id)
model = AutoModelForSequenceClassification.from_pretrained(model_id).eval()
names = {i: n.lower() for i, n in model.config.id2label.items()}
VERDICT = {"entailment": "SUPPORTS", "contradiction": "CONTRADICTS", "neutral": "UNRELATED"}
times = []


def probs(premise, hypothesis):
    t = time.time()
    enc = tok(premise, hypothesis, truncation="only_first", max_length=512, return_tensors="pt")
    with torch.no_grad():
        p = torch.softmax(model(**enc).logits[0], -1).tolist()
    times.append(time.time() - t)
    return {names[i]: v for i, v in enumerate(p)}


def verdict(p):
    return VERDICT[max(p, key=p.get)]


def by_sentence(text, hypothesis):
    best, best_p = "UNRELATED", 0.0
    for s in re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"“(])", text.strip()):
        p = probs(s, hypothesis)
        for k in ("entailment", "contradiction"):
            if p[k] > best_p and p[k] > max(p.values()) - 1e-9:
                best, best_p = VERDICT[k], p[k]
    return best


def right(answer, want):
    return answer in ("UNRELATED",) if want == "KEPT OUT" else answer == want


rows = []
for c in data["cases"]:
    claim = data["claims"][c["claim"]]
    text = c["text"]
    if c["want"] == "KEPT OUT":
        # Read with the sentence before and after it, as the document has it.
        text = c["before"] + " " + c["text"] + " " + c["after"]
    pe = probs(text, claim["en"])
    pt = probs(text, claim["tr"])
    rows.append((c["label"], verdict(pe), verdict(pt), by_sentence(text, claim["en"]), c["want"],
                 " ".join(f"{k[:3]} {v:.2f}" for k, v in pe.items())))

ways = [("English claim", 1), ("Turkish claim", 2), ("sentence by sentence", 3)]
score = ", ".join(f"{n} {sum(right(r[i], r[4]) for r in rows)}/{len(rows)}" for n, i in ways)
lines = [f"SCORE {score}; {1000 * sum(times) / len(times):.0f} ms per pair on the build machine"]
for r in rows:
    marks = " ".join("ok" if right(r[i], r[4]) else "WRONG" for _, i in ways)
    lines.append(f"{marks} | {r[0]}: English {r[1]}, Turkish {r[2]}, by sentence {r[3]}, right {r[4]} ({r[5]})")
print(f"::notice title={label} - score::" + "%0A".join(lines))
print("\n".join(lines))
