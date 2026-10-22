"""A quick word-problem round on Kaggle's free graphics card (about half an hour): the model learns the
word problems (problems.py, ten levels), with our own paragraph, puzzle and form-and-meaning examples
alongside so it does not forget them. Trained in batches in half precision, as the Quran reading, not
one pair at a time as train_nli.py (which takes hours for the same data).

First epoch: the problems from level 1 to level 10, spread among the other examples; then everything
mixed. After every epoch the notes get: held-out problems (overall, by level, with the Turkish claim
and the Turkish text), held-out paragraphs, the first 26 paragraphs, held-out puzzles. The epoch best on
the held-out problems is kept; the paragraph scores are reported, not used to choose (Yavuz, 22 Oct
2026: no strict gate, the model the app uses is never touched by these rounds anyway).

Runs as the Kaggle script in place of kaggle_read.py (workflow input program=fast_problems.py); reads
the flat dataset (labels__*.jsonl, pool.json, cases.json, start__* for the model to start from) and
leaves out/, notes.txt and status.json for the workflow to collect.
Environment: EPOCHS (default 3), LR (default 2e-5)."""
import collections
import glob
import json
import os
import random
import shutil
import subprocess
import sys
import time

WORK = "/kaggle/working" if os.path.isdir("/kaggle/working") else os.path.abspath("work")
os.makedirs(WORK, exist_ok=True)
NOTES = os.path.join(WORK, "notes.txt")
EPOCHS = int(os.environ.get("EPOCHS", "3"))
LR = float(os.environ.get("LR", "2e-5"))
open(NOTES, "w").close()


def note(line):
    print(line, flush=True)
    with open(NOTES, "a", encoding="utf-8") as f:
        f.write(line + "\n")


found = glob.glob("/kaggle/input/**/pool.json", recursive=True) or [os.path.abspath("pool.json")]
inp = os.path.dirname(found[0])
START = os.path.join(WORK, "start")
for path in glob.glob(os.path.join(inp, "start__*")):
    os.makedirs(START, exist_ok=True)
    shutil.copy(path, os.path.join(START, os.path.basename(path)[len("start__"):]))
if os.path.exists(os.path.join(inp, "round.txt")):
    note("files of run " + open(os.path.join(inp, "round.txt")).read().strip())
BASE = START if os.path.exists(os.path.join(START, "config.json")) else "MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7"

subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "transformers", "sentencepiece", "protobuf", "tiktoken"], check=False)
import torch  # noqa: E402
from transformers import AutoModelForSequenceClassification, AutoTokenizer  # noqa: E402

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
random.seed(13)
torch.manual_seed(13)
note(f"device: {DEVICE}; starting from {'the earlier round' + chr(39) + 's model' if BASE == START else BASE}; {EPOCHS} epochs at {LR}")

# ---- the examples, held out exactly as train_nli.py holds them out -----------------------------------
pool = {p["id"]: p for p in json.load(open(os.path.join(inp, "pool.json"), encoding="utf-8"))}
labels = [json.loads(l) for f in sorted(glob.glob(os.path.join(inp, "labels__*.jsonl")))
          for l in open(f, encoding="utf-8") if l.strip()]
labels = [e for e in labels if e.get("kind") != "human"]
seen = collections.Counter()
examples = []
for e in labels:
    key = (e.get("premise", "") if e.get("kind") in ("puzzle", "meaning", "words", "human", "problem") else "", e["en"] or e["tr"])
    seen[key] += 1
    if seen[key] <= 3:
        examples.append(e)
LATER = ("words", "human", "problem")
ids = sorted({e["id"] for e in examples if e.get("kind") not in LATER})
random.shuffle(ids)
dev_ids = set(ids[: len(ids) // 6])
dev_ids |= {e["id"] for e in examples if e.get("kind") in ("words", "human") and e["id"] % 6 == 0}
dev_ids |= {e["id"] for e in examples if e.get("kind") == "problem" and e.get("dev")}
train = [e for e in examples if e["id"] not in dev_ids]
dev = [e for e in examples if e["id"] in dev_ids]


def pairs(rows, langs=("en", "tr")):
    return [(e.get("premise") or pool[e["id"]]["text"], e[lang], e["label"]) for e in rows for lang in langs if e.get(lang)]


dev_prob = [e for e in dev if e.get("kind") == "problem"]
dev_prob_en = [e for e in dev_prob if e.get("premise_lang") != "tr"]
dev_prob_tr = [e for e in dev_prob if e.get("premise_lang") == "tr"]
dev_par = [e for e in dev if e.get("kind") not in ("puzzle", "meaning", "words", "human", "problem")]
dev_puz = [e for e in dev if e.get("kind") == "puzzle"]
trial = json.load(open(os.path.join(inp, "cases.json"), encoding="utf-8"))
trial_rows = [((c["text"] if c["want"] != "KEPT OUT" else c["before"] + " " + c["text"] + " " + c["after"]),
               trial["claims"][c["claim"]]["en"], "UNRELATED" if c["want"] == "KEPT OUT" else c["want"]) for c in trial["cases"]]

probs = [(e.get("level", 0), x) for e in train if e.get("kind") == "problem" for x in pairs([e])]
others = pairs([e for e in train if e.get("kind") != "problem"])
note(f"training pairs an epoch: {len(probs)} from word problems, {len(others)} from our other examples; "
     f"held-out: {len(dev_prob_en)} problem claims, {len(dev_par)} paragraph claims, {len(dev_puz)} puzzle statements")

tok = AutoTokenizer.from_pretrained(BASE)
model = AutoModelForSequenceClassification.from_pretrained(BASE).float().to(DEVICE)
name_to_id = {n.lower(): i for i, n in model.config.id2label.items()}
TO_NLI = {"SUPPORTS": "entailment", "CONTRADICTS": "contradiction", "UNRELATED": "neutral"}
ID_TO = {name_to_id[v]: k for k, v in TO_NLI.items()}


def predict(rows):
    model.eval()
    out = []
    with torch.no_grad():
        for i in range(0, len(rows), 32):
            part = rows[i:i + 32]
            enc = tok([p for p, _, _ in part], [h for _, h, _ in part], truncation="only_first",
                      max_length=384, padding=True, return_tensors="pt").to(DEVICE)
            with torch.autocast(DEVICE, dtype=torch.float16, enabled=DEVICE == "cuda"):
                out += [ID_TO[g] for g in model(**enc).logits.argmax(-1).tolist()]
    model.train()
    return out


def right(rows):
    got = predict(rows)
    ok = [g == w or (w == "NOT_SUPPORTS" and g != "SUPPORTS") for g, (_, _, w) in zip(got, rows)]
    wrong = sum(g != "UNRELATED" and not r for g, r in zip(got, ok))
    return sum(ok), wrong


def card(when):
    rows = pairs(dev_prob_en, ("en",))
    ok, _ = right(rows)
    acc = 100 * ok / max(1, len(rows))
    by = []
    for lv in sorted({e.get("level", 0) for e in dev_prob_en}):
        r = pairs([e for e in dev_prob_en if e.get("level", 0) == lv], ("en",))
        k, _ = right(r)
        by.append(f"{lv}: {100 * k / len(r):.0f}%")
    tr_c, _ = right(pairs(dev_prob_en, ("tr",)))
    tr_t, _ = right(pairs(dev_prob_tr, ("tr",)))
    par, par_wrong = right(pairs(dev_par, ("en",)))
    tri, tri_wrong = right(trial_rows)
    puz, _ = right(pairs(dev_puz, ("en",)))
    lines = [f"{when}: word problems held-out {acc:.1f}% ({ok}/{len(rows)}); with the Turkish claim "
             f"{100 * tr_c / max(1, len(rows)):.1f}%; Turkish text {100 * tr_t / max(1, len(pairs(dev_prob_tr, ('tr',)))):.1f}%",
             f"{when}: by level " + ", ".join(by),
             f"{when}: paragraphs held-out {par}/{len(dev_par)} ({par_wrong} wrong findings); first 26 paragraphs "
             f"{tri}/{len(trial_rows)} ({tri_wrong} wrong findings); puzzles {puz}/{len(dev_puz)}"]
    for l in lines:
        note(l)
    return acc


def first_epoch():
    rest = others[:]
    random.shuffle(rest)
    ordered = [x for _, x in sorted(probs, key=lambda lx: (lx[0], random.random()))]
    out, k = [], 0
    for i, x in enumerate(rest):
        out.append(x)
        while k < len(ordered) and k < (i + 1) * len(ordered) / max(1, len(rest)):
            out.append(ordered[k])
            k += 1
    out += ordered[k:]
    # Batches of sixteen in that order; within each run of 256, like lengths go together.
    batches = []
    for i in range(0, len(out), 256):
        chunk = sorted(out[i:i + 256], key=lambda r: len(r[0]) + len(r[1]))
        part = [chunk[j:j + 16] for j in range(0, len(chunk), 16)]
        random.shuffle(part)
        batches += part
    return batches


def mixed():
    rows = others + [x for _, x in probs]
    random.shuffle(rows)
    out = []
    for i in range(0, len(rows), 800):
        chunk = sorted(rows[i:i + 800], key=lambda r: len(r[0]) + len(r[1]))
        out += [chunk[j:j + 16] for j in range(0, len(chunk), 16)]
    random.shuffle(out)
    return out


def loss_of(half):
    enc = tok([p for p, _, _ in half], [h for _, h, _ in half], truncation="only_first",
              max_length=384, padding=True, return_tensors="pt").to(DEVICE)
    with torch.autocast(DEVICE, dtype=torch.float16, enabled=DEVICE == "cuda"):
        logits = model(**enc).logits.float()
    logp = torch.log_softmax(logits, -1)
    terms = []
    for i, (_, _, w) in enumerate(half):
        if w == "NOT_SUPPORTS":
            keep = [j for j in range(logp.shape[1]) if j != name_to_id["entailment"]]
            terms.append(-torch.logsumexp(logp[i, keep], 0))
        else:
            terms.append(-logp[i, name_to_id[TO_NLI[w]]])
    return torch.stack(terms).mean()


t0 = time.time()
best_acc = card("before training")
best_epoch = 0
out_dir = os.path.join(WORK, "out")
model.save_pretrained(out_dir)
tok.save_pretrained(out_dir)
per_epoch = (len(probs) + len(others) + 15) // 16
total_steps = EPOCHS * per_epoch
opt = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=0.01)
sched = torch.optim.lr_scheduler.LambdaLR(opt, lambda s: min(1.0, (s + 1) / max(1, 0.06 * total_steps)) * max(0.05, 1 - s / total_steps))
scaler = torch.amp.GradScaler(enabled=DEVICE == "cuda")
model.train()
for epoch in range(1, EPOCHS + 1):
    losses, skipped = [], 0
    for batch in (first_epoch() if epoch == 1 else mixed()):
        total, broken = 0.0, False
        for half in (batch[:8], batch[8:]):
            if not half:
                continue
            loss = loss_of(half) * len(half) / len(batch)
            if not torch.isfinite(loss):
                broken = True
                break
            scaler.scale(loss).backward()
            total += loss.item()
        if broken:
            skipped += 1
            opt.zero_grad()
            continue
        scaler.unscale_(opt)
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        scaler.step(opt)
        scaler.update()
        sched.step()
        opt.zero_grad()
        losses.append(total)
    note(f"epoch {epoch}: mean loss {sum(losses) / max(1, len(losses)):.3f}, {skipped} broken steps skipped, "
         f"{(time.time() - t0) / 60:.0f} minutes so far")
    acc = card(f"after epoch {epoch}")
    if acc > best_acc:
        best_acc, best_epoch = acc, epoch
        model.save_pretrained(out_dir)
        tok.save_pretrained(out_dir)
note(f"kept the model after epoch {best_epoch} (0 = as it came): word problems held-out {best_acc:.1f}%; "
     f"{(time.time() - t0) / 60:.0f} minutes in all")
shutil.rmtree(START, ignore_errors=True)
json.dump({"readings": 0, "ok": True, "epoch": best_epoch}, open(os.path.join(WORK, "status.json"), "w"))
