"""Sudoku in the order a published course teaches it (Yavuz, 22 Oct 2026: "do not teach it yourself; take a published
series that goes from the simplest to the expert level"). The course is SudokuWiki (sudokuwiki.org): its
"Getting Started" page, then Naked Candidates, Hidden Candidates, Intersection Removal (the Basic tier), then the
Tough tier (X-Wing, Y-Wing, Swordfish, XYZ-Wing ...), in the site's own order. This file only walks real puzzles
with those techniques as the site defines them and writes each step down; it adds no technique and no order of its own.

The puzzles come from a published collection (sapientinc/sudoku-extreme, sudoku.py fetches it while the round runs).
A step becomes a short reading puzzle: the grid drawn as nine lines of nine squares ("_" for an empty one), or, for the
techniques that work on pencil marks ("candidates", as the site's own "Take Step" tool shows them), the squares or
lines the technique looks at with what each can hold. Statements are about one square. Every label is worked out by
trying all the ways the premise allows (not by the technique code): SUPPORTS if it follows, CONTRADICTS if it is
ruled out, UNRELATED if it stays open.

Levels, in the course's order (output level numbers):
  1 last remaining cell in a box          (Getting Started: the digit's other places in rows and columns rule squares out)
  2 last remaining cell in a row or column
  3 the last possible number in a square  (naked single)
  4 naked pair   5 naked triple   6 hidden pair   7 hidden triple      (Naked Candidates, Hidden Candidates)
  8 pointing pair/triple   9 box/line reduction                         (Intersection Removal)
  10 X-Wing   11 Y-Wing   12 Swordfish   13 XYZ-Wing                   (Tough)
build(n_train, n_dev, cache) -> rows in the labels shape (kind "sudoku", "level", held-out "dev").
Usage: sudoku_methods.py [real]   (no argument: puzzles made here for a quick local test)"""
import itertools
import random
import sys
import time

ROWS = [[r * 9 + c for c in range(9)] for r in range(9)]
COLS = [[r * 9 + c for r in range(9)] for c in range(9)]
BOXES = [[(3 * (b // 3) + a) * 9 + 3 * (b % 3) + k for a in range(3) for k in range(3)] for b in range(9)]
UNITS = ROWS + COLS + BOXES
PEERS = [set() for _ in range(81)]
for _u in UNITS:
    for _i in _u:
        PEERS[_i] |= set(_u)
for _i in range(81):
    PEERS[_i].discard(_i)
LEVELS = 13


def out_level(k):
    """Levels are the course's order, as numbered in the docstring."""
    return k


RULE = "Each row, each column and each box holds every digit from 1 to 9 exactly once."


def where(i):
    return f"row {i // 9 + 1}, column {i % 9 + 1}"


def square(i):
    return f"the square in {where(i)}"


def unit_name(u):
    return f"row {u + 1}" if u < 9 else f"column {u - 8}" if u < 18 else f"box {u - 17}"


def join_or(xs):
    xs = [str(x) for x in xs]
    return xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + " or " + xs[-1]


def join_and(xs):
    xs = [str(x) for x in xs]
    return xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + " and " + xs[-1]


# ---- the human solver ----------------------------------------------------------------------------------
class State:
    def __init__(self, digits):
        self.g = list(digits)
        self.cand = [set() for _ in range(81)]
        for i in range(81):
            if not self.g[i]:
                self.cand[i] = self.basic(i)

    def basic(self, i):
        return set(range(1, 10)) - {self.g[j] for j in PEERS[i] if self.g[j]}

    def place(self, i, d):
        self.g[i] = d
        self.cand[i] = set()
        for j in PEERS[i]:
            self.cand[j].discard(d)

    def done(self):
        return all(self.g)

    def unit_digits(self, u):
        return {self.g[i] for i in UNITS[u] if self.g[i]}


def f_naked_single(st, rnd):
    cells = [i for i in range(81) if not st.g[i] and len(st.cand[i]) == 1]
    if cells:
        i = rnd.choice(cells)
        return {"cell": i, "digit": next(iter(st.cand[i])), "scan": len(st.basic(i)) == 1}


def f_hidden_single(st, rnd):
    order = list(range(27))
    rnd.shuffle(order)
    for u in order:
        have = st.unit_digits(u)
        for d in range(1, 10):
            if d in have:
                continue
            cells = [i for i in UNITS[u] if d in st.cand[i]]
            if len(cells) == 1 and len(st.cand[cells[0]]) > 1:
                return {"unit": u, "digit": d, "cell": cells[0]}


def f_naked_pair(st, rnd):
    order = list(range(27))
    rnd.shuffle(order)
    for u in order:
        two = [i for i in UNITS[u] if not st.g[i] and len(st.cand[i]) == 2]
        for a, b in itertools.combinations(two, 2):
            if st.cand[a] == st.cand[b]:
                pair = st.cand[a]
                el = [(i, x) for i in UNITS[u] if i not in (a, b) and not st.g[i] for x in pair if x in st.cand[i]]
                if el:
                    return {"unit": u, "elims": el}


def f_hidden_pair(st, rnd):
    order = list(range(27))
    rnd.shuffle(order)
    for u in order:
        have = st.unit_digits(u)
        pos = {d: [i for i in UNITS[u] if d in st.cand[i]] for d in range(1, 10) if d not in have}
        for d1, d2 in itertools.combinations(sorted(pos), 2):
            if len(pos[d1]) == 2 and pos[d1] == pos[d2]:
                el = [(i, x) for i in pos[d1] for x in st.cand[i] if x not in (d1, d2)]
                if el:
                    return {"unit": u, "elims": el}


def f_naked_triple(st, rnd):
    order = list(range(27))
    rnd.shuffle(order)
    for u in order:
        three = [i for i in UNITS[u] if not st.g[i] and 2 <= len(st.cand[i]) <= 3]
        for trio in itertools.combinations(three, 3):
            union = set().union(*(st.cand[i] for i in trio))
            if len(union) == 3:
                el = [(i, x) for i in UNITS[u] if i not in trio and not st.g[i] for x in union if x in st.cand[i]]
                if el:
                    return {"unit": u, "elims": el}


def f_pointing(st, rnd):
    order = list(range(18, 27))
    rnd.shuffle(order)
    for u in order:
        for d in range(1, 10):
            cells = [i for i in UNITS[u] if d in st.cand[i]]
            if not 2 <= len(cells) <= 3:
                continue
            for lines in (ROWS, COLS):
                idx = {i // 9 if lines is ROWS else i % 9 for i in cells}
                if len(idx) == 1:
                    line = next(iter(idx))
                    el = [(j, d) for j in lines[line] if j not in UNITS[u] and d in st.cand[j]]
                    if el:
                        return {"box": u, "digit": d, "line": line if lines is ROWS else 9 + line, "elims": el}


def f_boxline(st, rnd):
    order = list(range(18))
    rnd.shuffle(order)
    for u in order:
        for d in range(1, 10):
            cells = [i for i in UNITS[u] if d in st.cand[i]]
            if not 2 <= len(cells) <= 3:
                continue
            boxes = {(i // 27) * 3 + (i % 9) // 3 for i in cells}
            if len(boxes) == 1:
                b = 18 + next(iter(boxes))
                el = [(j, d) for j in UNITS[b] if j not in UNITS[u] and d in st.cand[j]]
                if el:
                    return {"line": u, "box": b, "digit": d, "elims": el}


def fish(st, size, rnd):
    digits = list(range(1, 10))
    rnd.shuffle(digits)
    for d in digits:
        for lines, cross, base in ((ROWS, COLS, 0), (COLS, ROWS, 9)):
            rows = []
            for k, line in enumerate(lines):
                cells = [i for i in line if d in st.cand[i]]
                if 2 <= len(cells) <= size:
                    rows.append((k, cells))
            for combo in itertools.combinations(rows, size):
                if size == 3 and all(len(c) == 2 for _, c in combo):
                    pass
                across = set()
                for _, cells in combo:
                    across |= {(i % 9) if base == 0 else (i // 9) for i in cells}
                if len(across) != size:
                    continue
                keys = {k for k, _ in combo}
                el = []
                for x in across:
                    for j in cross[x]:
                        k = j // 9 if base == 0 else j % 9
                        if k not in keys and d in st.cand[j]:
                            el.append((j, d))
                if el:
                    return {"digit": d, "bases": [base + k for k, _ in combo], "elims": el}


def f_xwing(st, rnd):
    return fish(st, 2, rnd)


def f_swordfish(st, rnd):
    r = fish(st, 3, rnd)
    # a real Swordfish: at least one base line holds the digit in three squares, else an X-Wing hides in it
    return r


def f_xywing(st, rnd):
    pivots = [i for i in range(81) if not st.g[i] and len(st.cand[i]) == 2]
    rnd.shuffle(pivots)
    for p in pivots:
        a, b = sorted(st.cand[p])
        near = [i for i in PEERS[p] if not st.g[i] and len(st.cand[i]) == 2]
        for x in near:
            if not (a in st.cand[x] and b not in st.cand[x]):
                continue
            c = next(iter(st.cand[x] - {a}))
            for y in near:
                if y != x and st.cand[y] == {b, c}:
                    el = [(j, c) for j in PEERS[x] & PEERS[y] if j != p and not st.g[j] and c in st.cand[j]]
                    if el:
                        return {"pivot": p, "wing1": x, "wing2": y, "digit": c, "elims": el}


def f_hidden_triple(st, rnd):
    order = list(range(27))
    rnd.shuffle(order)
    for u in order:
        have = st.unit_digits(u)
        pos = {d: [i for i in UNITS[u] if d in st.cand[i]] for d in range(1, 10) if d not in have}
        few = [d for d in pos if 2 <= len(pos[d]) <= 3]
        for trio in itertools.combinations(few, 3):
            cells = set().union(*(pos[d] for d in trio))
            if len(cells) == 3:
                el = [(i, x) for i in cells for x in st.cand[i] if x not in trio]
                if el:
                    return {"unit": u, "elims": el}


def f_xyzwing(st, rnd):
    pivots = [i for i in range(81) if not st.g[i] and len(st.cand[i]) == 3]
    rnd.shuffle(pivots)
    for p in pivots:
        near = [i for i in PEERS[p] if not st.g[i] and len(st.cand[i]) == 2 and st.cand[i] < st.cand[p]]
        for x, y in itertools.combinations(near, 2):
            common = st.cand[x] & st.cand[y]
            if len(common) == 1 and st.cand[x] | st.cand[y] == st.cand[p]:
                z = next(iter(common))
                el = [(j, z) for j in PEERS[p] & PEERS[x] & PEERS[y] if not st.g[j] and z in st.cand[j]]
                if el:
                    return {"pivot": p, "wing1": x, "wing2": y, "digit": z, "elims": el}


# The course's order: the singles, Naked Candidates, Hidden Candidates, Intersection Removal, then the Tough tier.
# A level 0 step only places a digit (the walk needs it); the others are written down as reading puzzles.
LADDER = [(0, f_naked_single), (0, f_hidden_single), (4, f_naked_pair), (5, f_naked_triple), (6, f_hidden_pair),
          (7, f_hidden_triple), (8, f_pointing), (9, f_boxline), (10, f_xwing), (11, f_xywing), (12, f_swordfish),
          (13, f_xyzwing)]


# ---- exact labels: try every way the premise allows ----------------------------------------------------
def cells_possible(cells, cand, diff, cap=300000):
    """cells' possible digits over every assignment that respects the candidate lists and the "differ" pairs."""
    order = sorted(cells, key=lambda i: len(cand[i]))
    nb = {i: [j for j in cells if (min(i, j), max(i, j)) in diff] for i in cells}
    possible = {i: set() for i in cells}
    cur, count = {}, [0]

    def go(k):
        count[0] += 1
        if count[0] > cap:
            raise OverflowError
        if k == len(order):
            for i, d in cur.items():
                possible[i].add(d)
            return
        i = order[k]
        for d in cand[i]:
            if all(cur.get(j) != d for j in nb[i]):
                cur[i] = d
                go(k + 1)
                del cur[i]

    go(0)
    return possible


def picks_possible(units):
    """units: list of lists of squares where one digit may go, one square a unit. Every way of choosing a square
    in each unit so that no two chosen squares share a row, column or box (unless they are the same square)."""
    ok = {}
    for combo in itertools.product(*units):
        if all(a == b or a not in PEERS[b] for a, b in itertools.combinations(combo, 2)):
            for k, i in enumerate(combo):
                ok.setdefault(k, set()).add(i)
            ok.setdefault("n", 0)
            ok["n"] += 1
    return ok


class Model:
    """Either cells (candidate lists + differing pairs) or picks (one digit, units of squares)."""

    def __init__(self, kind, **kw):
        self.kind = kind
        self.__dict__.update(kw)
        if kind == "cells":
            self.possible = cells_possible(self.cells, self.cand, self.diff)
            if any(not v for v in self.possible.values()):
                raise ValueError("no way")
            self.mentioned = list(self.cells)
        else:
            self.ok = picks_possible(self.units)
            if not self.ok.get("n"):
                raise ValueError("no way")
            self.mentioned = sorted({i for u in self.units for i in u} | set(self.extra))

    def poss(self, cell, d):
        """(can the square hold d in some way, must it in every way)"""
        if self.kind == "cells":
            p = self.possible.get(cell)
            if p is None:
                return None
            return d in p, p == {d}
        if d != self.digit:
            return None
        k = next((k for k, u in enumerate(self.units) if cell in u), None)
        if k is None:
            return False, False
        can = cell in self.ok.get(k, set())
        return can, self.ok[k] == {cell}

    def label(self, form, cell, d):
        r = self.poss(cell, d)
        if r is None:
            return "UNRELATED"
        can, must = r
        if form == "holds":
            return "SUPPORTS" if must else "CONTRADICTS" if not can else "UNRELATED"
        return "SUPPORTS" if not can else "CONTRADICTS" if must else "UNRELATED"


def claim(form, cell, d):
    r, c = cell // 9 + 1, cell % 9 + 1
    if form == "holds":
        return f"The square in row {r}, column {c} holds a {d}.", f"{r}. satır, {c}. sütundaki karede {d} var."
    return f"The square in row {r}, column {c} cannot hold a {d}.", f"{r}. satır, {c}. sütundaki karede {d} olamaz."


# ---- instances: premise text + model + the step's own claim --------------------------------------------
def cand_text(i, st_cells):
    c = st_cells[i]
    if len(c) == 1:
        return f"{square(i).capitalize()} already holds a {next(iter(c))}."
    return f"{square(i).capitalize()} can hold {join_or(sorted(c))}."


def unit_instance(st, u, level, step):
    cells = UNITS[u]
    cand = {i: ({st.g[i]} if st.g[i] else set(st.cand[i])) for i in cells}
    diff = {(min(a, b), max(a, b)) for a, b in itertools.combinations(cells, 2)}
    text = (f"{RULE} {unit_name(u).capitalize()} has nine squares. " +
            " ".join(cand_text(i, cand) for i in cells))
    return text, Model("cells", cells=list(cells), cand=cand, diff=diff)


def digit_line(u, d, cells):
    if u < 9:
        return f"In row {u + 1}, a {d} can go {'only ' if len(cells) < 9 else ''}in " + (
            "column " if len(cells) == 1 else "columns ") + join_and(sorted(i % 9 + 1 for i in cells)) + "."
    if u < 18:
        return f"In column {u - 8}, a {d} can go {'only ' if len(cells) < 9 else ''}in " + (
            "row " if len(cells) == 1 else "rows ") + join_and(sorted(i // 9 + 1 for i in cells)) + "."
    return (f"In box {u - 17}, a {d} can go {'only ' if len(cells) < 9 else ''}in " +
            join_and([square(i) for i in sorted(cells)]) + ".")


def picks_instance(st, d, unit_ids, extra, target_unit=None):
    units = [[i for i in UNITS[u] if d in st.cand[i]] for u in unit_ids]
    text = RULE + " " + " ".join(digit_line(u, d, cs) for u, cs in zip(unit_ids, units))
    return text, Model("picks", units=units, digit=d, extra=extra)


def make_instance(level, st, found, rnd):
    """-> (premise, model, the step's own claim) or None"""
    if level in (4, 5, 6, 7):
        text, m = unit_instance(st, found["unit"], level, found)
        i, d = rnd.choice(found["elims"])
        return text, m, ("cannot", i, d)
    if level in (8, 9):
        i, d = rnd.choice(found["elims"])
        units = [found["box"], found["line"]] if level == 8 else [found["line"], found["box"]]
        text, m = picks_instance(st, found["digit"], units, [i])
        return text, m, ("cannot", i, found["digit"])
    if level in (10, 12):
        i, d = rnd.choice(found["elims"])
        base = found["bases"][0] // 9
        tline = (i // 9) if base == 0 else 9 + (i % 9)
        units = list(found["bases"]) + [tline]
        text, m = picks_instance(st, d, units, [])
        return text, m, ("cannot", i, d)
    if level in (11, 13):
        p, x, y = found["pivot"], found["wing1"], found["wing2"]
        i, d = rnd.choice(found["elims"])
        cells = [p, x, y, i]
        cand = {k: set(st.cand[k]) for k in cells}
        diff = {(min(a, b), max(a, b)) for a, b in itertools.combinations(cells, 2) if b in PEERS[a]}
        parts = [RULE] + [cand_text(k, cand) for k in cells]
        for a, b in sorted(diff):
            how = "row" if a // 9 == b // 9 else "column" if a % 9 == b % 9 else "box"
            parts.append(f"{square(a).capitalize()} and {square(b)} are in the same {how}.")
        return " ".join(parts), Model("cells", cells=cells, cand=cand, diff=diff), ("cannot", i, d)
    return None


def inverse(main):
    form, i, d = main
    return ("holds" if form == "cannot" else "cannot"), i, d


def claims_for(text, model, main, rnd):
    """the step's claim (SUPPORTS), its opposite (CONTRADICTS), one that stays open (UNRELATED), one more."""
    form, i, d = main
    if model.label(form, i, d) != "SUPPORTS":
        return None
    out = [(form, i, d)]
    inv = inverse(main)
    if model.label(*inv) == "CONTRADICTS":
        out.append(inv)
    pool = []
    for cell in model.mentioned:
        digits = sorted(model.cand[cell]) if model.kind == "cells" else [model.digit]
        digits = digits + [x for x in range(1, 10) if x not in digits][:2 if model.kind == "cells" else 0]
        for x in digits:
            for f in ("holds", "cannot"):
                pool.append((f, cell, x))
    rnd.shuffle(pool)
    want = {"UNRELATED": 1, "SUPPORTS": 1, "CONTRADICTS": 0}
    for c in pool:
        if c in out:
            continue
        lab = model.label(*c)
        if want.get(lab):
            want[lab] -= 1
            out.append(c)
    return out


# ---- the first two levels: the only digit left, read from the grid ------------------------------------
def grid_text(g):
    """The grid drawn as nine lines of nine squares, top to bottom, "_" for an empty square (no words)."""
    return "\n".join(" ".join(str(x) if x else "_" for x in g[r * 9:(r + 1) * 9]) for r in range(9))


def basic_cells(st, u, d):
    """The empty squares of a unit where a d is not ruled out by a d already standing in the square's row, column or box."""
    return [i for i in UNITS[u] if not st.g[i] and d not in {st.g[j] for j in PEERS[i] if st.g[j]}]


def scan_levels(st, rnd):
    """From the grid drawn as lines, the course's first three steps:
    1 the last remaining cell in a box   2 the last remaining cell in a row or column   3 the last possible number."""
    out = {}
    text = RULE + "\n" + grid_text(st.g)
    for level, units in ((1, range(18, 27)), (2, range(18))):
        units = list(units)
        rnd.shuffle(units)
        for u in units:
            have = st.unit_digits(u)
            digits = [d for d in range(1, 10) if d not in have]
            rnd.shuffle(digits)
            done = False
            for d in digits:
                cells = basic_cells(st, u, d)
                others = [j for j in UNITS[u] if not st.g[j] and j not in cells]
                if len(cells) == 1 and others:
                    i, j = cells[0], rnd.choice(others)
                    out[level] = [(text, "SUPPORTS", ("holds", i, d)), (text, "CONTRADICTS", ("cannot", i, d)),
                                  (text, "SUPPORTS", ("cannot", j, d)), (text, "CONTRADICTS", ("holds", j, d))]
                    done = True
                    break
            if done:
                break
    f = f_naked_single(st, rnd)
    if f and f["scan"]:
        i, d = f["cell"], f["digit"]
        seen = sorted({st.g[j] for j in PEERS[i] if st.g[j]})
        e = rnd.choice(seen)
        out[3] = [(text, "SUPPORTS", ("holds", i, d)), (text, "CONTRADICTS", ("cannot", i, d)),
                  (text, "SUPPORTS", ("cannot", i, e)), (text, "CONTRADICTS", ("holds", i, e))]
    return out


# ---- walking the puzzles --------------------------------------------------------------------------------
def to_digits(p):
    return [0 if ch in "._0" else int(ch) for ch in p]


def collect(puzzle, solution, rnd, quota, per_level=2, rare=6):
    """-> [(level, [(premise, label, claim)])] for one puzzle"""
    out, got = [], {}
    sol = to_digits(solution)

    def add(level, items):
        if items and got.get(level, 0) < (rare if level >= 10 else per_level) and quota.get(level, 0) > 0:
            got[level] = got.get(level, 0) + 1
            out.append((level, items))

    # a game partly played (some squares of the published solution filled in): the first three steps
    for _ in range(2):
        g = to_digits(puzzle)
        blanks = [i for i in range(81) if not g[i]]
        rnd.shuffle(blanks)
        for i in blanks[: int(len(blanks) * rnd.uniform(0.3, 0.75))]:
            g[i] = sol[i]
        for lv, items in scan_levels(State(g), rnd).items():
            add(lv, items)
    # the puzzle as published, walked by the easiest technique that applies
    st = State(to_digits(puzzle))
    for _ in range(80):
        if st.done():
            break
        moved = False
        for level, fn in LADDER:
            f = fn(st, rnd)
            if not f:
                continue
            moved = True
            if level == 0:
                st.place(f["cell"], f["digit"])
            else:
                try:
                    made = make_instance(level, st, f, rnd)
                    if made:
                        text, model, main = made
                        cl = claims_for(text, model, main, rnd)
                        if cl:
                            add(level, [(text, model.label(*c), c) for c in cl])
                except (ValueError, OverflowError):
                    pass
                for i, d in f["elims"]:
                    st.cand[i].discard(d)
            break
        if not moved:
            break
    return out


def build_from(samples, n_train=120, n_dev=15, seed=5, budget=240, weights=None):
    rnd = random.Random(seed)
    quota_train = {lv: int(n_train * (weights or {}).get(out_level(lv), 1)) for lv in range(1, LEVELS + 1)}
    quota_dev = {lv: n_dev for lv in range(1, LEVELS + 1)}
    rows, pid = [], 90000
    t0 = time.time()
    used = 0
    for k, (puzzle, solution) in enumerate(samples):
        held = k % 8 == 0
        quota = quota_dev if held else quota_train
        if not any(quota.values()):
            if not any(quota_dev.values()) and not any(quota_train.values()):
                break
            continue
        if time.time() - t0 > budget:
            break
        used += 1
        for level, items in collect(puzzle, solution, rnd, quota):
            quota[level] -= 1
            for text, lab, c in items:
                e, t = (c[1], c[2]) if c[0] == "raw" else claim(*c)
                row = {"id": pid, "kind": "sudoku", "level": out_level(level), "premise": text, "en": e, "tr": t, "label": lab}
                if held:
                    row["dev"] = True
                rows.append(row)
            pid += 1
    build_from.stats = (used, {out_level(lv): (int(n_train * (weights or {}).get(out_level(lv), 1)) - quota_train[lv], n_dev - quota_dev[lv]) for lv in quota_train})
    return rows


def build(n_train=120, n_dev=15, cache="sudoku-cache", seed=5, limit=6000, weights=None):
    import sudoku
    rnd = random.Random(seed)
    sample, _ = sudoku.grids(sudoku.fetch(cache), limit, rnd)
    return build_from([(p, s) for p, s, _ in sample], n_train, n_dev, seed, weights=weights)


# ---- a quick local test with puzzles made here ----------------------------------------------------------
def make_test_puzzles(n, rnd):
    def solve(g, count=2):
        best, empt = None, 10
        for i in range(81):
            if not g[i]:
                c = [d for d in range(1, 10) if all(g[j] != d for j in PEERS[i])]
                if len(c) < empt:
                    best, empt = (i, c), len(c)
                    if empt <= 1:
                        break
        if best is None:
            return 1
        total = 0
        i, c = best
        for d in c:
            g[i] = d
            total += solve(g, count)
            g[i] = 0
            if total >= count:
                break
        return total

    def full():
        g = [0] * 81
        def go():
            best, empt = None, 10
            for i in range(81):
                if not g[i]:
                    c = [d for d in range(1, 10) if all(g[j] != d for j in PEERS[i])]
                    if len(c) < empt:
                        best, empt = (i, c), len(c)
            if best is None:
                return True
            i, c = best
            rnd.shuffle(c)
            for d in c:
                g[i] = d
                if go():
                    return True
                g[i] = 0
            return False
        go()
        return g

    out = []
    while len(out) < n:
        s = full()
        g = list(s)
        order = list(range(81))
        rnd.shuffle(order)
        for i in order:
            keep = g[i]
            g[i] = 0
            if solve(list(g)) != 1:
                g[i] = keep
        out.append(("".join(str(x) if x else "." for x in g), "".join(map(str, s))))
    return out


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "real":
        rows = build(120, 15, "sudoku-cache")
    else:
        rnd = random.Random(1)
        rows = build_from(make_test_puzzles(int(sys.argv[1]) if len(sys.argv) > 1 else 60, rnd), 120, 15)
    used, per = build_from.stats
    print(len(rows), "claims from", used, "puzzles; (train, held-out) steps by level:", per)
    shown = set()
    for r in rows:
        if r["level"] not in shown:
            shown.add(r["level"])
            print(f"\n--- level {r['level']}\n{r['premise']}")
            for q in rows:
                if q["premise"] == r["premise"]:
                    print(f"   {q['label']:11} {q['en']}")
    import collections
    print(collections.Counter(r["label"] for r in rows))
