"""Logic puzzles in ten levels, easy to hard (Yavuz, 22 Oct 2026: 250 puzzles, 25 a level), worked out by
brute force as puzzles.py does: a statement true in every arrangement that fits the clues SUPPORTS, false
in every one CONTRADICTS, true in some UNRELATED. 10 held-out puzzles a level besides ("dev": true).

  1  two people, floors only, one clue that names a floor
  2  two people, floors only, one clue; the statement is about the other person (one step)
  3  three people, floors only, two clues naming or ruling out floors
  4  three people, floors only, comparisons (higher than, directly above)
  5  three people, floors and jobs, three plain clues
  6  three people, floors and jobs, with "either ... or" and job-floor clues
  7  three people, floors and jobs, with "if ... then" clues
  8  four people, floors only, four clues with comparisons
  9  four people, floors and jobs, four or five clues
  10 four people, floors and jobs, five or six clues of every kind
Writes labels/logic_levels.jsonl (kind "logic", with "level"). Usage: logic_levels.py"""
import itertools
import json
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "puzzles.py"), encoding="utf-8").read()
exec(src[: src.index("\nrows = []")].replace("COUNT = int(sys.argv[1]) if len(sys.argv) > 1 else 350", "COUNT = 0"))
rnd = random.Random(41)

FLOOR_KINDS = ["floor", "not_floor", "above", "directly_above"]
JOB_KINDS = ["job", "not_job", "job_floor", "job_above", "either_job"]
LEVELS = {
    1: dict(n=2, jobs=False, clues=(1, 1), kinds=["floor"], ifs=False),
    2: dict(n=2, jobs=False, clues=(1, 1), kinds=["floor", "not_floor"], ifs=False, other=True),
    3: dict(n=3, jobs=False, clues=(2, 2), kinds=["floor", "not_floor"], ifs=False),
    4: dict(n=3, jobs=False, clues=(2, 3), kinds=["above", "directly_above", "floor", "not_floor"], ifs=False),
    5: dict(n=3, jobs=True, clues=(3, 3), kinds=["floor", "not_floor", "job", "not_job"], ifs=False),
    6: dict(n=3, jobs=True, clues=(3, 4), kinds=FLOOR_KINDS + JOB_KINDS, ifs=False),
    7: dict(n=3, jobs=True, clues=(3, 4), kinds=FLOOR_KINDS + JOB_KINDS, ifs=True),
    8: dict(n=4, jobs=False, clues=(4, 4), kinds=FLOOR_KINDS, ifs=False),
    9: dict(n=4, jobs=True, clues=(4, 5), kinds=FLOOR_KINDS + JOB_KINDS, ifs=False),
    10: dict(n=4, jobs=True, clues=(5, 6), kinds=FLOOR_KINDS + JOB_KINDS, ifs=True),
}


def fact(cfg, people, jobs, n, kinds):
    while True:
        k = rnd.choice(kinds)
        p, q = rnd.sample(people, 2)
        if k in ("floor", "not_floor"):
            return (k, (p, rnd.randint(1, n)))
        if k in ("above", "directly_above"):
            return (k, (p, q))
        if not jobs:
            continue
        j, j2 = rnd.sample(jobs, 2)
        if k in ("job", "not_job"):
            return (k, (p, j))
        if k == "job_floor":
            return (k, (j, rnd.randint(1, n)))
        if k == "job_above":
            return (k, (j, j2))
        if k == "either_job":
            return (k, (p, q, j))


def premise(clues, people, jobs, n):
    if jobs:
        head = (f"{', '.join(people[:-1])} and {people[-1]} live in a building with {n} floors, one on each floor. "
                f"Each has a different job: {', '.join(jobs[:-1])} and {jobs[-1]}.")
    else:
        head = f"{', '.join(people[:-1])} and {people[-1]} live in a building with {n} floors, one on each floor."
    text = head + " " + " ".join(if_en(c) if c[0] == "if_then" else en(c, n) for c in clues)
    for x, y in (("If The ", "If the "), ("then The ", "then the "), ("If Either ", "If either "), ("then Either ", "then either ")):
        text = text.replace(x, y)
    return text


def make(level):
    cfg = LEVELS[level]
    n = cfg["n"]
    while True:
        people = rnd.sample(NAMES, n)
        jobs = rnd.sample(JOBS_EN, n) if cfg["jobs"] else []
        worlds = [(dict(zip(people, f)), dict(zip(people, j)) if jobs else {})
                  for f in itertools.permutations(range(1, n + 1)) for j in (itertools.permutations(jobs) if jobs else [()])]
        clues = []
        want = rnd.randint(*cfg["clues"])
        tries = 0
        while len(clues) < want and tries < 50:
            tries += 1
            if cfg["ifs"] and rnd.random() < 0.3:
                c = ("if_then", (fact(cfg, people, jobs, n, cfg["kinds"]), fact(cfg, people, jobs, n, cfg["kinds"])))
            else:
                c = fact(cfg, people, jobs, n, cfg["kinds"])
            if c in clues:
                continue
            if [w for w in worlds if all(holds(x, *w) for x in clues + [c])]:
                clues.append(c)
        fits = [w for w in worlds if all(holds(x, *w) for x in clues)]
        if not fits or len(fits) == len(worlds) or len(clues) < cfg["clues"][0]:
            continue
        mentioned = {a for c in clues for a in (c[1][:2] if c[0] != "if_then" else ()) if a in people}
        per = {"SUPPORTS": [], "CONTRADICTS": [], "UNRELATED": []}
        asked = set()
        for _ in range(60):
            h = fact(cfg, people, jobs, n, [k for k in cfg["kinds"] if k != "either_job"])
            if h in asked or h in clues:
                continue
            if cfg.get("other") and h[1][0] in mentioned:
                continue  # level 2: the statement is about the person the clue does not name
            asked.add(h)
            t = sum(holds(h, *w) for w in fits)
            per["SUPPORTS" if t == len(fits) else "CONTRADICTS" if t == 0 else "UNRELATED"].append(h)
        picked = []
        for label in per:
            rnd.shuffle(per[label])
            picked += [(label, h) for h in per[label][:2]]
        if sum(l != "UNRELATED" for l, _ in picked) < 2:
            continue
        return premise(clues, people, jobs, n), [(en(h, n), tr(h), l) for l, h in picked]


rows, pid = [], 70000
for level in range(1, 11):
    for held in [True] * 10 + [False] * 25:
        text, claims = make(level)
        for e, t, l in claims:
            r = {"id": pid, "kind": "logic", "level": level, "premise": text, "en": e, "tr": t, "label": l}
            if held:
                r["dev"] = True
            rows.append(r)
        pid += 1
with open(os.path.join(HERE, "labels", "logic_levels.jsonl"), "w", encoding="utf-8") as f:
    for r in rows:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
print(f"{pid - 70000} puzzles (250 training, 100 held-out), {len(rows)} statements:",
      {l: sum(r["label"] == l for r in rows) for l in ("SUPPORTS", "CONTRADICTS", "UNRELATED")})

# A second set (Yavuz, 22 Oct 2026): 30 more training puzzles a level, none the same as a held-out one;
# the held-out puzzles above stay the test.
held_texts = {r["premise"] for r in rows if r.get("dev")}
known = {r["premise"] for r in rows}
rows2, pid = [], 71000
for level in range(1, 11):
    made = 0
    while made < 30:
        text, claims = make(level)
        if text in known:
            continue
        known.add(text)
        for e, t, l in claims:
            rows2.append({"id": pid, "kind": "logic", "level": level, "premise": text, "en": e, "tr": t, "label": l})
        pid += 1
        made += 1
with open(os.path.join(HERE, "labels", "logic_levels2.jsonl"), "w", encoding="utf-8") as f:
    for r in rows2:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
print(f"second set: {pid - 71000} training puzzles, {len(rows2)} statements")
