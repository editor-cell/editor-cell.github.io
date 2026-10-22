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
# What the round is for: "problem" (word problems) or "logic" (logic_levels.py). The other kinds come along
# so they are not forgotten; with logic, a third of the word problems come along, and the logic puzzles,
# far fewer, are read three times an epoch.
FOCUS = os.environ.get("FOCUS", "problem")
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
if os.path.exists(os.path.join(inp, "focus.txt")):
    FOCUS = open(os.path.join(inp, "focus.txt")).read().strip() or FOCUS
# Rounds of a fixed length (Yavuz, 22 Oct 2026: fifteen minutes a round, one on top of another): training
# stops when MINUTES have passed since the start, whatever epoch it is in, and the scores are taken then.
MINUTES = 0.0
if os.path.exists(os.path.join(inp, "minutes.txt")):
    try:
        MINUTES = float(open(os.path.join(inp, "minutes.txt")).read().strip() or 0)
    except ValueError:
        MINUTES = 0.0
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
# a weights.txt like "2:4,1:0.5" says how many times the usual number of training steps a level gets
SUDOKU_WEIGHTS = {}
if os.path.exists(os.path.join(inp, "weights.txt")):
    SUDOKU_WEIGHTS = {int(a): float(b) for a, b in (kv.split(":") for kv in open(os.path.join(inp, "weights.txt")).read().strip().split(",") if kv)}
if FOCUS == "readhuman":
    EPOCHS = max(EPOCHS, 4)
    sys.path.insert(0, inp)
    subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "huggingface_hub", "pandas", "pyarrow"], check=False)
    import reading_human  # noqa: E402  (reading questions people wrote: RACE and Belebele)
    labels += reading_human.build(os.path.join(WORK, "reading-cache"))
    note("human-made reading questions (training / held-out) by level: " + str(reading_human.build.stats))
if FOCUS == "humanlogic":
    EPOCHS = max(EPOCHS, 6)
    sys.path.insert(0, inp)
    subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "huggingface_hub"], check=False)
    import logic_human  # noqa: E402  (logic questions people wrote: FOLIO and LogiQA 2.0)
    labels += logic_human.build(os.path.join(WORK, "humanlogic-cache"))
    note("human-made logic claims (training / held-out) by level: " + str(logic_human.build.stats))
if FOCUS == "sudoku":
    sys.path.insert(0, inp)
    subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "huggingface_hub"], check=False)
    import sudoku_methods  # noqa: E402  (the human techniques, step by step; sudoku.py fetches the published puzzles)
    labels += sudoku_methods.build(120, 15, os.path.join(WORK, "sudoku-cache"), weights=SUDOKU_WEIGHTS)
    note("sudoku steps made (training, held-out) by level: " + str(sudoku_methods.build_from.stats))
seen = collections.Counter()
examples = []
for e in labels:
    key = (e.get("premise", "") if e.get("kind") in ("puzzle", "meaning", "words", "human", "problem", "logic", "sudoku", "humanlogic", "readhuman") else "", e["en"] or e["tr"])
    seen[key] += 1
    if seen[key] <= 3:
        examples.append(e)
LATER = ("words", "human", "problem", "logic", "sudoku", "humanlogic", "readhuman")
ids = sorted({e["id"] for e in examples if e.get("kind") not in LATER})
random.shuffle(ids)
dev_ids = set(ids[: len(ids) // 6])
dev_ids |= {e["id"] for e in examples if e.get("kind") in ("words", "human") and e["id"] % 6 == 0}
dev_ids |= {e["id"] for e in examples if e.get("kind") in ("problem", "logic", "sudoku", "humanlogic", "readhuman") and e.get("dev")}
train = [e for e in examples if e["id"] not in dev_ids]
dev = [e for e in examples if e["id"] in dev_ids]


def pairs(rows, langs=("en", "tr")):
    return [(e.get("premise") or pool[e["id"]]["text"], e[lang], e["label"]) for e in rows for lang in langs if e.get(lang)]


dev_prob = [e for e in dev if e.get("kind") == FOCUS]
dev_wp = [e for e in dev if e.get("kind") == "problem" and e.get("premise_lang") != "tr"]
dev_logic = [e for e in dev if e.get("kind") == "logic"]
dev_prob_en = [e for e in dev_prob if e.get("premise_lang") != "tr"]
dev_prob_tr = [e for e in dev_prob if e.get("premise_lang") == "tr"]
dev_par = [e for e in dev if e.get("kind") not in ("puzzle", "meaning", "words", "human", "problem", "logic", "sudoku", "humanlogic", "readhuman")]
dev_puz = [e for e in dev if e.get("kind") == "puzzle"]
trial = json.load(open(os.path.join(inp, "cases.json"), encoding="utf-8"))
trial_rows = [((c["text"] if c["want"] != "KEPT OUT" else c["before"] + " " + c["text"] + " " + c["after"]),
               trial["claims"][c["claim"]]["en"], "UNRELATED" if c["want"] == "KEPT OUT" else c["want"]) for c in trial["cases"]]

probs = [(e.get("level", 0), x) for e in train if e.get("kind") == FOCUS for x in pairs([e])]
others = pairs([e for e in train if e.get("kind") != FOCUS and not (FOCUS == "logic" and e.get("kind") == "problem")
                and not (FOCUS == "humanlogic" and e.get("kind") == "logic")
                and not (FOCUS == "readhuman" and e.get("kind") not in ("puzzle", "meaning", "words", "human", "problem"))])  # my own puzzles stay out of a human-made round
if FOCUS == "logic":
    wp = pairs([e for e in train if e.get("kind") == "problem"])
    random.shuffle(wp)
    others += wp[: len(wp) // 3]
    probs = probs * (2 if len(probs) < 8000 else 1)
if FOCUS in ("sudoku", "humanlogic", "readhuman"):
    # A sample of everything else comes along, so fifteen minutes go mostly to the sudoku.
    random.shuffle(others)
    others = others[:3000]
note(f"training pairs an epoch: {len(probs)} from {FOCUS}, {len(others)} from our other examples; "
     f"held-out ({FOCUS}): {len(dev_prob_en)} claims, {len(dev_par)} paragraph claims, {len(dev_puz)} puzzle statements")

MAXLEN = 512 if FOCUS == "readhuman" else 384
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
                      max_length=MAXLEN, padding=True, return_tensors="pt").to(DEVICE)
            with torch.autocast(DEVICE, dtype=torch.float16, enabled=DEVICE == "cuda"):
                out += [ID_TO[g] for g in model(**enc).logits.argmax(-1).tolist()]
    model.train()
    return out


def right(rows):
    got = predict(rows)
    ok = [g == w or (w == "NOT_SUPPORTS" and g != "SUPPORTS") for g, (_, _, w) in zip(got, rows)]
    wrong = sum(g != "UNRELATED" and not r for g, r in zip(got, ok))
    return sum(ok), wrong


def exam(rows_dev):
    """Multiple-choice score: of the answers to a question, the most entailed one is the choice. -> (right, total, by level)"""
    model.eval()
    ps = []
    with torch.no_grad():
        for i in range(0, len(rows_dev), 16):
            part = rows_dev[i:i + 16]
            enc = tok([e["premise"] for e in part], [e["en"] for e in part], truncation="only_first", max_length=MAXLEN,
                      padding=True, return_tensors="pt").to(DEVICE)
            with torch.autocast(DEVICE, dtype=torch.float16, enabled=DEVICE == "cuda"):
                ps += torch.softmax(model(**enc).logits.float(), -1)[:, name_to_id["entailment"]].tolist()
    model.train()
    groups = collections.defaultdict(list)
    for e, p in zip(rows_dev, ps):
        groups[e["qid"]].append((p, e["label"] == "SUPPORTS", e.get("level", 0)))
    res = collections.defaultdict(lambda: [0, 0])
    for g in groups.values():
        lv = g[0][2]
        res[lv][1] += 1
        res[lv][0] += max(g)[1]
        res[0][1] += 1
        res[0][0] += max(g)[1]
    return res


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
    name = {"problem": "word problems", "logic": "levelled logic puzzles", "sudoku": "sudoku", "humanlogic": "human-made logic questions", "readhuman": "human-made reading questions"}.get(FOCUS, FOCUS)
    lines = [f"{when}: {name} held-out {acc:.1f}% ({ok}/{len(rows)}); with the Turkish claim "
             f"{100 * tr_c / max(1, len(rows)):.1f}%" + (f"; Turkish text {100 * tr_t / len(pairs(dev_prob_tr, ('tr',))):.1f}%" if dev_prob_tr else ""),
             f"{when}: by level " + ", ".join(by),
             f"{when}: paragraphs held-out {par}/{len(dev_par)} ({par_wrong} wrong findings); first 26 paragraphs "
             f"{tri}/{len(trial_rows)} ({tri_wrong} wrong findings); earlier puzzles {puz}/{len(dev_puz)}"]
    if FOCUS in ("sudoku", "humanlogic", "readhuman") and dev_logic:
        lr = pairs(dev_logic, ("en",))
        k, _ = right(lr)
        by = []
        for lv in sorted({e.get("level", 0) for e in dev_logic}):
            r = pairs([e for e in dev_logic if e.get("level", 0) == lv], ("en",))
            by.append(f"{lv}: {100 * right(r)[0] / len(r):.0f}%")
        lines.append(f"{when}: LOGIC EXAM (20 levels, 300 puzzles) {100 * k / len(lr):.1f}% ({k}/{len(lr)}); by level " + ", ".join(by))
    if FOCUS != "problem" and dev_wp:
        wr = pairs(dev_wp, ("en",))
        lines.append(f"{when}: word problems held-out {100 * right(wr)[0] / len(wr):.1f}%")
    if FOCUS == "readhuman":
        res = exam(dev_prob_en)
        names = {1: "RACE middle", 2: "RACE high", 3: "Belebele English", 4: "Belebele Turkish"}
        lines.append(f"{when}: READING EXAM (the right answer picked among four, 25% by chance): {100 * res[0][0] / res[0][1]:.1f}% "
                     f"({res[0][0]}/{res[0][1]} questions); " + ", ".join(f"{names[lv]} {100 * res[lv][0] / res[lv][1]:.0f}%" for lv in sorted(res) if lv))
        acc = 100 * res[0][0] / res[0][1]
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
              max_length=MAXLEN, padding=True, return_tensors="pt").to(DEVICE)
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
t_train = time.time()
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
out_of_time = False
for epoch in range(1, EPOCHS + 1):
    if out_of_time:
        break
    losses, skipped = [], 0
    for batch in (first_epoch() if epoch == 1 else mixed()):
        if MINUTES and time.time() - t0 > MINUTES * 60:
            out_of_time = True
            break
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
    note(f"epoch {epoch}{' (stopped at the time limit, ' + str(len(losses)) + ' batches in)' if out_of_time else ''}: "
         f"mean loss {sum(losses) / max(1, len(losses)):.3f}, {skipped} broken steps skipped, "
         f"{(time.time() - t0) / 60:.0f} minutes so far")
    acc = card(f"after epoch {epoch}")
    if acc > best_acc:
        best_acc, best_epoch = acc, epoch
        model.save_pretrained(out_dir)
        tok.save_pretrained(out_dir)
note(f"kept the model after epoch {best_epoch} (0 = as it came): {FOCUS} held-out {best_acc:.1f}%; "
     f"{(time.time() - t0) / 60:.0f} minutes in all")
shutil.rmtree(START, ignore_errors=True)
json.dump({"readings": 0, "ok": True, "epoch": best_epoch}, open(os.path.join(WORK, "status.json"), "w"))
