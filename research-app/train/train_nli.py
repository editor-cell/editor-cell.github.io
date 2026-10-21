"""Fine-tunes the NLI model (mDeBERTa) on the labelled examples and scores it before and after.

Examples: labels/*.jsonl (paragraph id, Turkish claim, English claim, label) over pool.json (the
paragraphs). The paragraph is the premise, the claim the hypothesis. A sixth of the paragraphs never
enter training (dev); the 26 paragraphs the models were first tried on (../nli-trial/cases.json)
are a second, separate test. A claim that recurs is kept at most three times, so the model cannot
learn a claim's answer by heart. Prints a score card; the run leaves it as notes.
Usage: train_nli.py [epochs] [learning rate]"""
import collections
import glob
import json
import os
import random
import sys
import time

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.environ.get("BASE_MODEL", "MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7")
EPOCHS = int(sys.argv[1]) if len(sys.argv) > 1 else 2
LR = float(sys.argv[2]) if len(sys.argv) > 2 else 1e-5
OUT = os.environ.get("OUT_DIR", os.path.join(HERE, "out"))
random.seed(13)
torch.manual_seed(13)

pool = {p["id"]: p for p in json.load(open(os.path.join(HERE, "pool.json"), encoding="utf-8"))}
labels = [json.loads(l) for f in sorted(glob.glob(os.path.join(HERE, "labels", "*.jsonl")))
          for l in open(f, encoding="utf-8") if l.strip()]
seen = collections.Counter()
examples = []
for e in labels:
    seen[e["en"]] += 1
    if seen[e["en"]] <= 3:
        examples.append(e)

ids = sorted({e["id"] for e in examples})
random.shuffle(ids)
dev_ids = set(ids[: len(ids) // 6])
train = [e for e in examples if e["id"] not in dev_ids]
dev = [e for e in examples if e["id"] in dev_ids]

tok = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForSequenceClassification.from_pretrained(MODEL)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
model.to(DEVICE)
print(f"::notice title=Training::running on {DEVICE}", flush=True)
name_to_id = {n.lower(): i for i, n in model.config.id2label.items()}
TO_NLI = {"SUPPORTS": "entailment", "CONTRADICTS": "contradiction", "UNRELATED": "neutral"}
FROM_NLI = {v: k for k, v in TO_NLI.items()}


def pairs(rows, langs=("en", "tr")):
    return [(pool[e["id"]]["text"], e[lang], e["label"]) for e in rows for lang in langs]


def predict(items):
    model.eval()
    out = []
    with torch.no_grad():
        for prem, hyp in items:
            enc = tok(prem, hyp, truncation="only_first", max_length=384, return_tensors="pt").to(DEVICE)
            p = torch.softmax(model(**enc).logits[0], -1)
            out.append(FROM_NLI[model.config.id2label[int(p.argmax())].lower()])
    return out


def score(rows, title):
    got = predict([(p, h) for p, h, _ in rows])
    want = [w for _, _, w in rows]
    ok = sum(g == w for g, w in zip(got, want))
    wrong_finding = sum(g != "UNRELATED" and g != w for g, w in zip(got, want))
    missed = sum(g == "UNRELATED" and w != "UNRELATED" for g, w in zip(got, want))
    return f"{title}: {ok}/{len(rows)} right, {wrong_finding} wrong findings (a paragraph put on the wrong side or brought in for nothing), {missed} missed", got


trial = json.load(open(os.path.join(HERE, "..", "nli-trial", "cases.json"), encoding="utf-8"))
trial_rows = []
for c in trial["cases"]:
    text = c["text"] if c["want"] != "KEPT OUT" else c["before"] + " " + c["text"] + " " + c["after"]
    trial_rows.append((text, trial["claims"][c["claim"]]["en"], "UNRELATED" if c["want"] == "KEPT OUT" else c["want"]))

notes = [f"{len(train)} training claims on {len({e['id'] for e in train})} paragraphs (English and Turkish), "
         f"{len(dev)} held-out claims on {len(dev_ids)} paragraphs; {EPOCHS} epochs at {LR}"]
before_dev, _ = score(pairs(dev, ("en",)), "held-out, before")
before_trial, _ = score(trial_rows, "first 26 paragraphs, before")
notes += [before_dev, before_trial]
print("\n".join(notes), flush=True)
print("::notice title=Before training::" + "%0A".join(notes), flush=True)

data = pairs(train)
opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.01)
steps = EPOCHS * ((len(data) + 7) // 8)
sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1.0, (s + 1) / (0.1 * steps)) * max(0.0, 1 - s / steps))
t0 = time.time()
step = 0


def dev_key(rows):
    got = predict([(p, h) for p, h, _ in rows])
    want = [w for _, _, w in rows]
    ok = sum(g == w for g, w in zip(got, want))
    wrong = sum(g != "UNRELATED" and g != w for g, w in zip(got, want))
    return ok - wrong, ok, wrong


model.train()
with torch.no_grad():
    p0, h0, w0 = pairs(train[:1], ("en",))[0]
    e0 = tok(p0, h0, truncation="only_first", max_length=384, return_tensors="pt").to(DEVICE)
    l_train = model(**e0, labels=torch.tensor([name_to_id[TO_NLI[w0]]]).to(DEVICE)).loss.item()
    model.eval()
    l_eval = model(**e0, labels=torch.tensor([name_to_id[TO_NLI[w0]]]).to(DEVICE)).loss.item()
print(f"::notice title=First pair::loss in training mode {l_train:.3f}, in reading mode {l_eval:.3f}", flush=True)

# The model as it came is a candidate too: training is kept only if it does better on the held-out claims.
dev_rows = pairs(dev, ("en",))
best_key, ok0, wrong0 = dev_key(dev_rows)
best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
best_epoch = 0
for epoch in range(EPOCHS):
    random.shuffle(data)
    model.train()
    losses, skipped = [], 0
    # One pair at a time, eight pairs per update: no padding inside a batch, which is where the
    # first runs went to NaN (the untrained model, read one pair at a time, was fine).
    for i in range(0, len(data), 8):
        batch = data[i:i + 8]
        total, good = 0.0, 0
        for p, h, w in batch:
            enc = tok(p, h, truncation="only_first", max_length=384, return_tensors="pt").to(DEVICE)
            y = torch.tensor([name_to_id[TO_NLI[w]]]).to(DEVICE)
            loss = model(**enc, labels=y).loss
            if not torch.isfinite(loss):
                skipped += 1
                continue
            (loss / len(batch)).backward()
            total += loss.item()
            good += 1
        if good == 0:
            opt.zero_grad()
            continue
        grads_ok = all(torch.isfinite(q.grad).all() for q in model.parameters() if q.grad is not None)
        if not grads_ok:
            # A broken gradient must not reach the weights.
            opt.zero_grad()
            skipped += 1
            continue
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        sched.step()
        opt.zero_grad()
        losses.append(total / good)
        step += 1
        if step % 25 == 0:
            print(f"epoch {epoch + 1} step {step}/{steps} loss {losses[-1]:.3f} {time.time() - t0:.0f}s", flush=True)
    key, ok, wrong = dev_key(dev_rows)
    mean = sum(losses) / len(losses) if losses else float("nan")
    print(f"::notice title=Epoch {epoch + 1}::mean loss {mean:.3f}, {skipped} broken steps skipped; held-out {ok}/{len(dev_rows)} right, {wrong} wrong findings", flush=True)
    if key > best_key:
        best_key, best_epoch = key, epoch + 1
        best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
model.load_state_dict(best_state)
notes.append(f"kept the model after epoch {best_epoch} (0 = as it came, untrained)")

after_dev, _ = score(pairs(dev, ("en",)), "held-out, after")
after_dev_tr, _ = score(pairs(dev, ("tr",)), "held-out with the Turkish claim, after")
after_trial, got = score(trial_rows, "first 26 paragraphs, after")
notes += [after_dev, after_dev_tr, after_trial, f"training took {time.time() - t0:.0f}s"]
for c, g, (_, _, w) in zip(trial["cases"], got, trial_rows):
    notes.append(("ok" if g == w else "WRONG") + f" | {c['label']}: {g}, right {w}")
print("\n".join(notes))
print("::notice title=Training::" + "%0A".join(notes))
os.makedirs(OUT, exist_ok=True)
model.save_pretrained(OUT)
tok.save_pretrained(OUT)
if os.environ.get("HUB_REPO") and os.environ.get("HF_TOKEN") and best_epoch > 0:
    # Kept in a private model repository on the owner's Hugging Face account, for the phone to fetch later.
    model.push_to_hub(os.environ["HUB_REPO"], private=True, commit_message=notes[-len(trial_rows) - 2])
    tok.push_to_hub(os.environ["HUB_REPO"], private=True)
    print(f"::notice title=Saved::model saved to the private repository {os.environ['HUB_REPO']}")
