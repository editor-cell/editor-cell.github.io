"""Verbal logic puzzles (sözel mantık) for the NLI model, worked out by brute force like a sudoku.

Each puzzle: three or four people, each with a different floor and a different job; a handful of
clues. Every assignment that fits the clues is enumerated; a statement true in all of them is
SUPPORTS (certainly true), false in all of them CONTRADICTS (certainly false), and true in some
UNRELATED (not certain). So the answers are exact, not judged. The clues are the premise (English,
as the paragraphs are), the statement the claim (English and Turkish).
Writes labels/puzzles.jsonl. Usage: puzzles.py [count]"""
import itertools
import json
import os
import random
import sys

random.seed(29)
COUNT = int(sys.argv[1]) if len(sys.argv) > 1 else 350

NAMES = ["Ali", "Ayşe", "Mehmet", "Zeynep", "Can", "Elif"]
ABL = {"Ali": "Ali'den", "Ayşe": "Ayşe'den", "Mehmet": "Mehmet'ten", "Zeynep": "Zeynep'ten", "Can": "Can'dan", "Elif": "Elif'ten"}
JOBS_EN = ["doctor", "teacher", "lawyer", "engineer"]
JOBS_TR = {"doctor": "doktor", "teacher": "öğretmen", "lawyer": "avukat", "engineer": "mühendis"}
JOB_ABL_TR = {"doctor": "doktordan", "teacher": "öğretmenden", "lawyer": "avukattan", "engineer": "mühendisten"}
ORD_TR = {1: "1.", 2: "2.", 3: "3.", 4: "4."}


def an(job):
    return "an" if job[0] in "aeiou" else "a"


# A fact is (kind, args); holds(fact, floors, jobs) says whether it is true in one assignment.
def holds(f, fl, jb):
    k, a = f
    if k == "floor":
        return fl[a[0]] == a[1]
    if k == "not_floor":
        return fl[a[0]] != a[1]
    if k == "job":
        return jb[a[0]] == a[1]
    if k == "not_job":
        return jb[a[0]] != a[1]
    if k == "above":
        return fl[a[0]] > fl[a[1]]
    if k == "directly_above":
        return fl[a[0]] == fl[a[1]] + 1
    if k == "job_floor":
        return any(jb[p] == a[0] and fl[p] == a[1] for p in fl)
    if k == "job_above":
        pa = [p for p in fl if jb[p] == a[0]]
        pb = [p for p in fl if jb[p] == a[1]]
        return bool(pa and pb) and fl[pa[0]] > fl[pb[0]]
    if k == "either_job":
        return jb[a[0]] == a[2] or jb[a[1]] == a[2]
    if k == "if_then":
        return (not holds(a[0], fl, jb)) or holds(a[1], fl, jb)
    raise ValueError(k)


def en(f, n):
    k, a = f
    if k == "floor":
        return f"{a[0]} lives on floor {a[1]}."
    if k == "not_floor":
        return f"{a[0]} does not live on floor {a[1]}."
    if k == "job":
        return f"{a[0]} is the {a[1]}."
    if k == "not_job":
        return f"{a[0]} is not the {a[1]}."
    if k == "above":
        return f"{a[0]} lives on a higher floor than {a[1]}."
    if k == "directly_above":
        return f"{a[0]} lives directly above {a[1]}."
    if k == "job_floor":
        return f"The {a[0]} lives on floor {a[1]}."
    if k == "job_above":
        return f"The {a[0]} lives on a higher floor than the {a[1]}."
    if k == "either_job":
        return f"Either {a[0]} or {a[1]} is the {a[2]}."
    if k == "if_then":
        return if_en(f)
    raise ValueError(k)


def tr(f):
    k, a = f
    if k == "floor":
        return f"{a[0]} {ORD_TR[a[1]]} katta oturuyor."
    if k == "not_floor":
        return f"{a[0]} {ORD_TR[a[1]]} katta oturmuyor."
    if k == "job":
        return f"{a[0]} {JOBS_TR[a[1]]}."
    if k == "not_job":
        return f"{a[0]} {JOBS_TR[a[1]]} değil."
    if k == "above":
        return f"{a[0]}, {ABL[a[1]]} daha üst katta oturuyor."
    if k == "directly_above":
        return f"{a[0]}, {ABL[a[1]]} hemen bir üst katta oturuyor."
    if k == "job_floor":
        return f"{JOBS_TR[a[0]].capitalize()} {ORD_TR[a[1]]} katta oturuyor."
    if k == "job_above":
        return f"{JOBS_TR[a[0]].capitalize()}, {JOB_ABL_TR[a[1]]} daha üst katta oturuyor."
    if k == "either_job":
        return f"{JOBS_TR[a[2]].capitalize()} ya {a[0]} ya da {a[1]}."
    raise ValueError(k)


def random_fact(people, jobs, n, allow_if=True):
    p, q = random.sample(people, 2)
    j, j2 = random.sample(jobs, 2)
    floor = random.randint(1, n)
    kinds = ["floor", "not_floor", "job", "not_job", "above", "directly_above", "job_floor", "job_above", "either_job"]
    if allow_if:
        kinds.append("if_then")
    k = random.choice(kinds)
    if k in ("floor", "not_floor"):
        return (k, (p, floor))
    if k in ("job", "not_job"):
        return (k, (p, j))
    if k in ("above", "directly_above"):
        return (k, (p, q))
    if k == "job_floor":
        return (k, (j, floor))
    if k == "job_above":
        return (k, (j, j2))
    if k == "either_job":
        return (k, (p, q, j))
    a = random_fact(people, jobs, n, False)
    b = random_fact(people, jobs, n, False)
    while a[0] in ("if_then",) or b[0] in ("if_then",):
        a, b = random_fact(people, jobs, n, False), random_fact(people, jobs, n, False)
    return ("if_then", (a, b))


def if_en(f):
    a, b = f[1]
    return f"If {en(a, 0)[:-1]}, then {en(b, 0)}"


def premise_text(clues, people, jobs, n):
    head = (f"{', '.join(people[:-1])} and {people[-1]} live in a building with {n} floors, one on each floor. "
            f"Each has a different job: {', '.join(jobs[:-1])} and {jobs[-1]}.")
    body = " ".join(if_en(c) if c[0] == "if_then" else en(c, n) for c in clues)
    return head + " " + body


rows = []
pid = 20000
made = 0
want = {"SUPPORTS": 0, "CONTRADICTS": 0, "UNRELATED": 0}
while made < COUNT:
    n = random.choice([3, 4])
    people = random.sample(NAMES, n)
    jobs = random.sample(JOBS_EN, n)
    worlds = [(dict(zip(people, f)), dict(zip(people, j)))
              for f in itertools.permutations(range(1, n + 1)) for j in itertools.permutations(jobs)]
    clues = []
    for _ in range(random.randint(2, 6)):
        c = random_fact(people, jobs, n)
        left = [w for w in worlds if all(holds(x, *w) for x in clues + [c])]
        if left:
            clues.append(c)
    fits = [w for w in worlds if all(holds(x, *w) for x in clues)]
    if not fits or len(fits) == len(worlds):
        continue
    premise = premise_text(clues, people, jobs, n)
    asked = set()
    per = {"SUPPORTS": [], "CONTRADICTS": [], "UNRELATED": []}
    for _ in range(40):
        h = random_fact(people, jobs, n, False)
        if h in asked or h in clues:
            continue
        asked.add(h)
        t = sum(holds(h, *w) for w in fits)
        label = "SUPPORTS" if t == len(fits) else "CONTRADICTS" if t == 0 else "UNRELATED"
        per[label].append(h)
    picked = []
    for label in per:
        random.shuffle(per[label])
        picked += [(label, h) for h in per[label][:2]]
    if not picked:
        continue
    for label, h in picked:
        rows.append({"id": pid, "kind": "puzzle", "premise": premise, "en": en(h, n), "tr": tr(h), "label": label})
        want[label] += 1
    pid += 1
    made += 1

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "labels", "puzzles.jsonl")
with open(out, "w", encoding="utf-8") as f:
    for r in rows:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
print(f"{made} puzzles, {len(rows)} statements: {want}")
