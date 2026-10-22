"""Sudoku as reading practice (Yavuz, 22 Oct 2026): "if it is there, it cannot be here", the same
elimination as the floor puzzles. The puzzles and their solutions come from a published collection
(sapientinc/sudoku-extreme on Hugging Face: puzzles gathered from the sudoku community, each with its
solution and a difficulty rating), fetched while the round runs and never stored here.

Each grid is written out row by row ("_" for an empty square); the statements are about squares:
  SUPPORTS     an empty square holds the digit of the published solution
  CONTRADICTS  an empty square holds another digit that the givens of its row, column and box do not
               rule out at a glance (so only real elimination tells it), or a given square misread
Ten levels by difficulty (the collection's rating, then fewer givens = harder), equal in size.
build(n_train, n_dev, cache) -> rows in the labels shape (kind "sudoku", "level", held-out "dev")."""
import csv
import os
import random

REPO = "sapientinc/sudoku-extreme"


def fetch(cache):
    from huggingface_hub import hf_hub_download
    return hf_hub_download(REPO, "test.csv", repo_type="dataset", cache_dir=cache)


def grids(path, limit, rnd):
    """(puzzle, solution, rating) for a random sample of the file's puzzles."""
    out = []
    with open(path, encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        for row in reader:
            cells = [c for c in row if len(c) == 81]
            if len(cells) < 2:
                continue
            puzzle, solution = (cells[0], cells[1]) if any(ch in cells[0] for ch in ".0") else (cells[1], cells[0])
            puzzle = puzzle.replace("0", ".")
            if "." in solution or "0" in solution:
                continue
            rating = 0.0
            for c in row:
                if c not in cells:
                    try:
                        rating = float(c)
                    except ValueError:
                        pass
            out.append((puzzle, solution, rating))
    rnd.shuffle(out)
    return out[:limit], header


def text(puzzle):
    rows = [" ".join(ch if ch != "." else "_" for ch in puzzle[r * 9:(r + 1) * 9]) for r in range(9)]
    return "A sudoku grid, row by row, with _ for an empty square. " + " ".join(f"Row {i + 1}: {r}." for i, r in enumerate(rows))


def seen_digits(puzzle, i):
    r, c = divmod(i, 9)
    br, bc = 3 * (r // 3), 3 * (c // 3)
    cells = [r * 9 + k for k in range(9)] + [k * 9 + c for k in range(9)] + \
            [(br + a) * 9 + bc + b for a in range(3) for b in range(3)]
    return {puzzle[k] for k in cells if puzzle[k] != "."}


def claims(puzzle, solution, rnd):
    blanks = [i for i in range(81) if puzzle[i] == "."]
    givens = [i for i in range(81) if puzzle[i] != "."]
    out = []

    def say(i, d, label):
        r, c = divmod(i, 9)
        out.append((f"The square in row {r + 1}, column {c + 1} holds a {d}.",
                    f"{r + 1}. satır, {c + 1}. sütundaki karede {d} var.", label))

    for i in rnd.sample(blanks, 2):
        say(i, solution[i], "SUPPORTS")
    tries = 0
    while sum(l == "CONTRADICTS" for _, _, l in out) < 2 and tries < 200:
        tries += 1
        i = rnd.choice(blanks)
        open_digits = [d for d in "123456789" if d not in seen_digits(puzzle, i) and d != solution[i]]
        if open_digits:
            say(i, rnd.choice(open_digits), "CONTRADICTS")
    if givens:
        i = rnd.choice(givens)
        if rnd.random() < 0.5:
            say(i, puzzle[i], "SUPPORTS")
        else:
            say(i, rnd.choice([d for d in "123456789" if d != puzzle[i]]), "CONTRADICTS")
    return out


def build(n_train=2000, n_dev=200, cache="sudoku-cache", seed=5):
    rnd = random.Random(seed)
    sample, _ = grids(fetch(cache), (n_train + n_dev) * 3, rnd)
    sample.sort(key=lambda g: (g[2], -sum(ch != "." for ch in g[0])))  # easy to hard
    per = len(sample) // 10
    rows, pid = [], 80000
    for level in range(1, 11):
        band = sample[(level - 1) * per: level * per]
        rnd.shuffle(band)
        chosen = band[: (n_train + n_dev) // 10]
        for k, (puzzle, solution, _) in enumerate(chosen):
            held = k < n_dev // 10
            for e, t, l in claims(puzzle, solution, rnd):
                row = {"id": pid, "kind": "sudoku", "level": level, "premise": text(puzzle), "en": e, "tr": t, "label": l}
                if held:
                    row["dev"] = True
                rows.append(row)
            pid += 1
    return rows


if __name__ == "__main__":
    rows = build(40, 20, "sudoku-cache")
    print(len(rows), rows[0]["premise"][:200])
    for r in rows[:6]:
        print(r["level"], r["label"], r["en"], "|", r["tr"])
