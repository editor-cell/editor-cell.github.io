"""Logic puzzles in twenty levels (Yavuz, 22 Oct 2026: twenty levels, with steps in between the ten).
Built with logic_levels.py's puzzle maker. The ten earlier levels become levels 1, 3, 5, 7, 9, 11, 13,
15, 17 and 20, and the new ones sit between them:
   1  two people, a clue naming a floor                       (old 1)
   2  two people, a clue ruling a floor out
   3  two people, the statement about the other person         (old 2)
   4  three people, floors only, one clue
   5  three people, floors only, two clues                     (old 3)
   6  three people, floors only, one comparison and one floor
   7  three people, floors only, comparisons                   (old 4)
   8  three people, floors and jobs, two plain clues
   9  three people, floors and jobs, three plain clues         (old 5)
  10  three people, floors and jobs, with job-floor clues
  11  three people, every kind of clue but "if"                (old 6)
  12  three people, now and then one "if ... then"
  13  three people, "if ... then" more often                   (old 7)
  14  four people, floors only, three clues
  15  four people, floors only, four clues with comparisons    (old 8)
  16  four people, floors and jobs, four plain clues
  17  four people, every kind of clue but "if"                 (old 9)
  18  four people, now and then one "if ... then", five clues
  19  four people, "if ... then" more often, five clues
  20  four people, five or six clues of every kind             (old 10)
Writes labels/logic20.jsonl: the earlier puzzles with their new level numbers (same ids, the same
held-out ones) and 30 new training and 10 new held-out puzzles for every level."""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, "logic_levels.py"), encoding="utf-8").read()
exec(src[: src.index("\nrows, pid = [], 70000")])
rnd.seed(77)
# The two-person levels have few possible puzzles with six names; four more names give room for new ones.
NAMES += ["Murat", "Selin", "Emre", "Deniz"]
ABL.update({"Murat": "Murat'tan", "Selin": "Selin'den", "Emre": "Emre'den", "Deniz": "Deniz'den"})

F, J = FLOOR_KINDS, JOB_KINDS
LEVELS.clear()
LEVELS.update({
    1: dict(n=2, jobs=False, clues=(1, 1), kinds=["floor"], ifs=False),
    2: dict(n=2, jobs=False, clues=(1, 1), kinds=["not_floor"], ifs=False),
    3: dict(n=2, jobs=False, clues=(1, 1), kinds=["floor", "not_floor"], ifs=False, other=True),
    4: dict(n=3, jobs=False, clues=(1, 1), kinds=["floor", "not_floor"], ifs=False),
    5: dict(n=3, jobs=False, clues=(2, 2), kinds=["floor", "not_floor"], ifs=False),
    6: dict(n=3, jobs=False, clues=(2, 2), kinds=["above", "floor"], ifs=False),
    7: dict(n=3, jobs=False, clues=(2, 3), kinds=["above", "directly_above", "floor", "not_floor"], ifs=False),
    8: dict(n=3, jobs=True, clues=(2, 2), kinds=["floor", "not_floor", "job", "not_job"], ifs=False),
    9: dict(n=3, jobs=True, clues=(3, 3), kinds=["floor", "not_floor", "job", "not_job"], ifs=False),
    10: dict(n=3, jobs=True, clues=(3, 3), kinds=["floor", "job", "not_job", "job_floor"], ifs=False),
    11: dict(n=3, jobs=True, clues=(3, 4), kinds=F + J, ifs=False),
    12: dict(n=3, jobs=True, clues=(3, 4), kinds=F + J, ifs=True, if_rate=0.15),
    13: dict(n=3, jobs=True, clues=(3, 4), kinds=F + J, ifs=True),
    14: dict(n=4, jobs=False, clues=(3, 3), kinds=["floor", "not_floor", "above"], ifs=False),
    15: dict(n=4, jobs=False, clues=(4, 4), kinds=F, ifs=False),
    16: dict(n=4, jobs=True, clues=(4, 4), kinds=["floor", "not_floor", "job", "not_job"], ifs=False),
    17: dict(n=4, jobs=True, clues=(4, 5), kinds=F + J, ifs=False),
    18: dict(n=4, jobs=True, clues=(5, 5), kinds=F + J, ifs=True, if_rate=0.15),
    19: dict(n=4, jobs=True, clues=(5, 5), kinds=F + J, ifs=True),
    20: dict(n=4, jobs=True, clues=(5, 6), kinds=F + J, ifs=True),
})
OLD_TO_NEW = {1: 1, 2: 3, 3: 5, 4: 7, 5: 9, 6: 11, 7: 13, 8: 15, 9: 17, 10: 20}

# make() asks for an "if" with a chance of 0.3; a level may ask less often.
_rand = rnd.random
rows = []
for name in ("logic_levels.jsonl", "logic_levels2.jsonl"):
    for line in open(os.path.join(HERE, "archive", name), encoding="utf-8"):
        r = json.loads(line)
        r["level"] = OLD_TO_NEW[r["level"]]
        rows.append(r)
known = {r["premise"] for r in rows}
pid = 72000
for level in range(1, 21):
    rate = LEVELS[level].get("if_rate")
    for held in [True] * 10 + [False] * 30:
        while True:
            if rate:
                LEVELS[level]["ifs"] = _rand() < rate / 0.3
            text, claims = make(level)
            if rate:
                LEVELS[level]["ifs"] = True
            if text not in known:
                break
        known.add(text)
        for e, t, l in claims:
            r = {"id": pid, "kind": "logic", "level": level, "premise": text, "en": e, "tr": t, "label": l}
            if held:
                r["dev"] = True
            rows.append(r)
        pid += 1
with open(os.path.join(HERE, "labels", "logic20.jsonl"), "w", encoding="utf-8") as f:
    for r in rows:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
print(f"{len({r['id'] for r in rows})} puzzles in 20 levels ({len({r['id'] for r in rows if r.get('dev')})} held-out), {len(rows)} statements")
