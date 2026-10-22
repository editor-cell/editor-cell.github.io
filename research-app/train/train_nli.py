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
# A claim that a second teacher (hoca.py) labelled differently from us is left out until it is settled.
_agreed = os.path.join(HERE, "labels", "agreed.json")
DIFFER = set(json.load(open(_agreed))["differ"]) if os.path.exists(_agreed) else set()
labels = [json.loads(l) for f in sorted(glob.glob(os.path.join(HERE, "labels", "*.jsonl")))
          for n, l in enumerate(open(f, encoding="utf-8"))
          if l.strip() and f"{os.path.basename(f)[:-6]}-{n + 1:04d}" not in DIFFER]
seen = collections.Counter()
examples = []
for e in labels:
    # A claim that recurs is kept at most three times; a puzzle or form-meaning statement counts with
    # its own premise.
    key = (e.get("premise", "") if e.get("kind") in ("puzzle", "meaning", "words", "human", "problem") else "",
           e["en"] or e["tr"])
    seen[key] += 1
    if seen[key] <= 3:
        examples.append(e)

# The held-out paragraphs, puzzles and form-and-meaning examples are drawn as in every earlier round,
# from those kinds alone, so later kinds cannot change them and rounds stay comparable. Synonyms and
# human-made pairs hold out every sixth id; word problems hold out what problems.py marked
# (its own wording and numbers, never seen in training).
LATER = ("words", "human", "problem")
ids = sorted({e["id"] for e in examples if e.get("kind") not in LATER})
random.shuffle(ids)
dev_ids = set(ids[: len(ids) // 6])
dev_ids |= {e["id"] for e in examples if e.get("kind") in ("words", "human") and e["id"] % 6 == 0}
dev_ids |= {e["id"] for e in examples if e.get("kind") == "problem" and e.get("dev")}
train = [e for e in examples if e["id"] not in dev_ids]
dev = [e for e in examples if e["id"] in dev_ids]
# Held-out puzzles are scored on their own; the model is chosen on the paragraphs alone, so the
# puzzles can teach but cannot buy a model that reads paragraphs worse.
dev_puzzles = [e for e in dev if e.get("kind") == "puzzle"]
dev_meaning = [e for e in dev if e.get("kind") == "meaning"]
dev_words = [e for e in dev if e.get("kind") == "words"]
dev_human = [e for e in dev if e.get("kind") == "human"]
dev_problems = [e for e in dev if e.get("kind") == "problem"]
dev = [e for e in dev if e.get("kind") not in ("puzzle", "meaning", "words", "human", "problem")]


def problem_scores(when):
    en_prem = [e for e in dev_problems if e.get("premise_lang") != "tr"]
    tr_prem = [e for e in dev_problems if e.get("premise_lang") == "tr"]
    out = [score(pairs(en_prem, ("en",)), f"word problems held-out, English text and claim, {when}")[0],
           score(pairs(en_prem, ("tr",)), f"word problems held-out, English text and Turkish claim, {when}")[0],
           score(pairs(tr_prem, ("tr",)), f"word problems held-out, Turkish text and claim, {when}")[0]]
    levels = sorted({e.get("level", 0) for e in en_prem})
    if levels != [0]:
        # Level by level (English text and claim): where the model stops keeping up.
        parts = []
        for lv in levels:
            rows = pairs([e for e in en_prem if e.get("level", 0) == lv], ("en",))
            got = predict([(p, h) for p, h, _ in rows])
            parts.append(f"{lv}: {sum(g == w for g, (_, _, w) in zip(got, rows))}/{len(rows)}")
        out.append(f"word problems held-out by level, {when}: " + ", ".join(parts))
    return out


def problem_acc():
    rows = pairs([e for e in dev_problems if e.get("premise_lang") != "tr"], ("en",))
    if not rows:
        return None
    got = predict([(p, h) for p, h, _ in rows])
    return 100 * sum(g == w for g, (_, _, w) in zip(got, rows)) / len(rows)

tok = AutoTokenizer.from_pretrained(MODEL)
model = AutoModelForSequenceClassification.from_pretrained(MODEL)
# Newer libraries load a model in the precision it was saved in (here half precision). Reading is fine
# that way, but training in half precision without care breaks at the first update (Adam's tiny
# epsilon rounds to zero): the cause of the NaN in the first three runs. Train in full precision.
print(f"::notice title=Precision::loaded as {next(model.parameters()).dtype}, training in float32", flush=True)
model = model.float()
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
model.to(DEVICE)
print(f"::notice title=Training::running on {DEVICE}", flush=True)
name_to_id = {n.lower(): i for i, n in model.config.id2label.items()}
TO_NLI = {"SUPPORTS": "entailment", "CONTRADICTS": "contradiction", "UNRELATED": "neutral"}
FROM_NLI = {v: k for k, v in TO_NLI.items()}


def pairs(rows, langs=("en", "tr")):
    # A logic example may bring its own short text (a view set out and then rejected, say) in place
    # of the pooled paragraph it is filed under.
    # Human-made pairs (PAWS, Tatoeba) may carry a claim in one language only.
    return [(e.get("premise") or pool[e["id"]]["text"], e[lang], e["label"]) for e in rows for lang in langs if e.get(lang)]


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
    right = [g == w or (w == "NOT_SUPPORTS" and g != "SUPPORTS") for g, w in zip(got, want)]
    ok = sum(right)
    wrong_finding = sum(g != "UNRELATED" and not r for g, r in zip(got, right))
    missed = sum(g == "UNRELATED" and not r for g, r in zip(got, right))
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
if dev_puzzles:
    notes.append(score(pairs(dev_puzzles, ("en",)), "puzzles held-out, before")[0])
if dev_meaning:
    notes.append(score(pairs(dev_meaning, ("en",)), "form and meaning held-out, before")[0])
    notes.append(score(pairs(dev_meaning, ("tr",)), "form and meaning held-out with the Turkish claim, before")[0])
if dev_words:
    notes.append(score(pairs(dev_words, ("tr",)), "synonyms and homonyms held-out with the Turkish claim, before")[0])
if dev_human:
    notes.append(score(pairs(dev_human), "human-made pairs held-out (PAWS, Tatoeba), before")[0])
if dev_problems:
    notes += problem_scores("before")
print("\n".join(notes), flush=True)
print("::notice title=Before training::" + "%0A".join(notes), flush=True)

data = pairs(train)
# The first epoch goes through the word problems from level 1 to level 10 (Yavuz's plan: easy first,
# harder as the model learns), spread evenly among the other examples; later epochs mix everything.
_levelled = [(e.get("level", 0), x) for e in train if e.get("kind") == "problem" for x in pairs([e])]
_others = pairs([e for e in train if e.get("kind") != "problem"])


def first_epoch():
    rest = _others[:]
    random.shuffle(rest)
    probs = sorted(_levelled, key=lambda lx: (lx[0], random.random()))
    probs = [x for _, x in probs]
    if not probs:
        return rest
    out, k = [], 0
    for i, x in enumerate(rest):
        out.append(x)
        # After i of the others, as many problems as their share of the way through.
        while k < len(probs) and k < (i + 1) * len(probs) / len(rest):
            out.append(probs[k])
            k += 1
    return out + probs[k:]


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
    p0, h0, w0 = pairs([e for e in train if e["label"] in TO_NLI and e.get("en")][:1], ("en",))[0]
    e0 = tok(p0, h0, truncation="only_first", max_length=384, return_tensors="pt").to(DEVICE)
    l_train = model(**e0, labels=torch.tensor([name_to_id[TO_NLI[w0]]]).to(DEVICE)).loss.item()
    model.eval()
    l_eval = model(**e0, labels=torch.tensor([name_to_id[TO_NLI[w0]]]).to(DEVICE)).loss.item()
print(f"::notice title=First pair::loss in training mode {l_train:.3f}, in reading mode {l_eval:.3f}", flush=True)

# The model as it came is a candidate too. Without word problems, training is kept only if it does
# better on the held-out paragraph claims. With word problems (Yavuz, 22 Oct 2026: first the problems,
# above 90%), the paragraphs set a floor instead: an epoch may lose at most two held-out paragraph
# claims and add at most one wrong finding, and among those that keep to it the best on the held-out
# problems is kept. The first round with problems kept nothing: the paragraphs, already at 226/239,
# could not get better, so no epoch could ever win under the old rule.
dev_rows = pairs(dev, ("en",))
best_key, ok0, wrong0 = dev_key(dev_rows)
acc0 = problem_acc()
best_acc = acc0
best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
best_epoch = 0
for epoch in range(EPOCHS):
    if epoch == 0:
        data = first_epoch()
    else:
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
            if w == "NOT_SUPPORTS":
                # "Not the same judgment" may be a contradiction or only something else: teach only
                # that it is not support (the chance of support goes down), not which of the two.
                logp = torch.log_softmax(model(**enc).logits[0].float(), -1)
                loss = -torch.logsumexp(logp[[i for i in range(logp.shape[0]) if i != name_to_id["entailment"]]], 0)
            else:
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
    acc = problem_acc()
    line = (f"epoch {epoch + 1}: mean loss {mean:.3f}, {skipped} broken steps skipped; held-out paragraphs {ok}/{len(dev_rows)} right, "
            f"{wrong} wrong findings" + (f"; word problems held-out {acc:.1f}% right (before training {acc0:.1f}%)" if acc is not None else ""))
    print(f"::notice title=Epoch {epoch + 1}::{line}", flush=True)
    notes.append(line)
    if acc is not None:
        better = ok >= ok0 - 2 and wrong <= wrong0 + 1 and (acc, key) > (best_acc, best_key)
    else:
        better = key > best_key
    if better:
        best_acc = acc
        best_key, best_epoch = key, epoch + 1
        best_state = {k: v.detach().cpu().clone() for k, v in model.state_dict().items()}
model.load_state_dict(best_state)
notes.append(f"kept the model after epoch {best_epoch} (0 = as it came, untrained)")

after_dev, _ = score(pairs(dev, ("en",)), "held-out, after")
after_dev_tr, _ = score(pairs(dev, ("tr",)), "held-out with the Turkish claim, after")
after_trial, got = score(trial_rows, "first 26 paragraphs, after")
notes += [after_dev, after_dev_tr, after_trial]
if dev_puzzles:
    notes.append(score(pairs(dev_puzzles, ("en",)), "puzzles held-out, after")[0])
    notes.append(score(pairs(dev_puzzles, ("tr",)), "puzzles held-out with the Turkish statement, after")[0])
if dev_meaning:
    notes.append(score(pairs(dev_meaning, ("en",)), "form and meaning held-out, after")[0])
    notes.append(score(pairs(dev_meaning, ("tr",)), "form and meaning held-out with the Turkish claim, after")[0])
if dev_words:
    notes.append(score(pairs(dev_words, ("tr",)), "synonyms and homonyms held-out with the Turkish claim, after")[0])
if dev_human:
    notes.append(score(pairs(dev_human), "human-made pairs held-out (PAWS, Tatoeba), after")[0])
if dev_problems:
    notes += problem_scores("after")
notes.append(f"training took {time.time() - t0:.0f}s")
for c, g, (_, _, w) in zip(trial["cases"], got, trial_rows):
    notes.append(("ok" if g == w else "WRONG") + f" | {c['label']}: {g}, right {w}")
print("\n".join(notes))
print("::notice title=Training::" + "%0A".join(notes))
os.makedirs(OUT, exist_ok=True)
model.save_pretrained(OUT)
tok.save_pretrained(OUT)
if os.environ.get("HUB_REPO") and os.environ.get("HF_TOKEN") and best_epoch > 0:
    # Kept in a private model repository on the owner's Hugging Face account, for the phone to fetch later.
    model.push_to_hub(os.environ["HUB_REPO"], private=True, commit_message=(after_dev + "; " + after_trial)[:250])
    tok.push_to_hub(os.environ["HUB_REPO"], private=True)
    print(f"::notice title=Saved::model saved to the private repository {os.environ['HUB_REPO']}")
