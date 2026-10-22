"""A short trial, no training: does the model solve logic puzzles better when it looks at the clues a few at a
time? (Yavuz, 22 Oct 2026.)

For each statement the model reads the opening sentences (who lives in the building, the jobs) with every
group of one, two or three clues. What a smaller group of clues settles, all the clues settle too (a clue
added can only narrow the arrangements), so: if some group makes the model sure (above a threshold) that
the statement follows, the answer is SUPPORTS; if some group makes it sure that it is ruled out,
CONTRADICTS; otherwise the model's answer on the whole puzzle stands. Scored on the held-out levelled
puzzles (by level) and the earlier held-out puzzles, beside the plain answer on the whole puzzle.
Runs on Kaggle in place of kaggle_read.py (program=stepwise.py, focus=logic); uses fast_problems.py's
data preparation; leaves notes.txt and status.json."""
import itertools
import json
import os

import glob

_fp = (glob.glob("/kaggle/input/**/fast_problems.py", recursive=True)
       or [os.path.join(os.path.dirname(os.path.abspath(__file__)), "fast_problems.py")])[0]
_src = open(_fp, encoding="utf-8").read()
exec(_src[: _src.index("def first_epoch():")])  # data, model, predict(), pairs(), note()


def split(text):
    sents = [s.strip() for s in text.replace(". ", ".\n").split("\n") if s.strip()]
    head = [s for s in sents if " live in a building" in s or s.startswith("Each has a different job")]
    return " ".join(head), [s for s in sents if s not in head]


def probs(rows):
    model.eval()
    out = []
    with torch.no_grad():
        for i in range(0, len(rows), 64):
            part = rows[i:i + 64]
            enc = tok([p for p, _ in part], [h for _, h in part], truncation="only_first", max_length=384,
                      padding=True, return_tensors="pt").to(DEVICE)
            with torch.autocast(DEVICE, dtype=torch.float16, enabled=DEVICE == "cuda"):
                out += torch.softmax(model(**enc).logits.float(), -1).tolist()
    return out


E, C = name_to_id["entailment"], name_to_id["contradiction"]


def judge(rows, thresholds=(0.8, 0.9, 0.95, 0.99)):
    """rows: (premise, claim, want, level). Returns {name: [right?]} for the plain answer and each threshold."""
    whole = predict([(p, h, w) for p, h, w, _ in rows])
    groups, owner = [], []
    for k, (p, h, _, _) in enumerate(rows):
        head, clues = split(p)
        for size in (1, 2, 3):
            for g in itertools.combinations(clues, size):
                groups.append((head + " " + " ".join(g), h))
                owner.append(k)
    pr = probs(groups)
    best_e = [0.0] * len(rows)
    best_c = [0.0] * len(rows)
    for k, q in zip(owner, pr):
        best_e[k] = max(best_e[k], q[E])
        best_c[k] = max(best_c[k], q[C])
    res = {"whole puzzle at once": [g == w for g, (_, _, w, _) in zip(whole, rows)]}
    for t in thresholds:
        got = ["SUPPORTS" if best_e[k] > t else "CONTRADICTS" if best_c[k] > t else whole[k] for k in range(len(rows))]
        res[f"clues a few at a time, sure above {t}"] = [g == w for g, (_, _, w, _) in zip(got, rows)]
    return res, len(groups)


lev = [(e["premise"], e["en"], e["label"], e.get("level", 0)) for e in dev_prob_en]
res, n = judge(lev)
note(f"levelled held-out puzzles: {len(lev)} statements, {n} clue groups read")
for name, ok in res.items():
    by = []
    for lv in sorted({r[3] for r in lev}):
        idx = [i for i, r in enumerate(lev) if r[3] == lv]
        by.append(f"{lv}: {100 * sum(ok[i] for i in idx) / len(idx):.0f}%")
    note(f"{name}: {100 * sum(ok) / len(ok):.1f}% ({sum(ok)}/{len(ok)}); by level " + ", ".join(by))
old = [(e["premise"], e["en"], e["label"], 0) for e in dev_puz]
res, n = judge(old)
for name, ok in res.items():
    note(f"earlier held-out puzzles, {name}: {sum(ok)}/{len(ok)} ({100 * sum(ok) / len(ok):.1f}%)")
json.dump({"readings": 0, "ok": True}, open(os.path.join(WORK, "status.json"), "w"))
