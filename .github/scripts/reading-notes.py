"""Scores the one-word verdict against reading for meaning and reading backwards (ReadingCompareTest)
and leaves the result on the run as notes, readable without the log.
Usage: reading-notes.py <test-results dir> <label>"""
import glob
import sys
import xml.etree.ElementTree as ET

directory, label = sys.argv[1], sys.argv[2]
rows, readings, backwards = [], {}, {}
for path in glob.glob(f"{directory}/TEST-*ReadingCompareTest*.xml"):
    root = ET.parse(path).getroot()
    for line in (root.findtext("system-out") or "").splitlines():
        parts = line.strip().split("\t")
        if parts[0] == "COMPARE" and len(parts) == 9:
            rows.append(parts[1:])
        elif parts[0] == "READING" and len(parts) >= 3:
            readings[parts[1]] = parts[2]
        elif parts[0] == "BACKWARDS" and len(parts) >= 3:
            backwards[parts[1]] = parts[2]


def right(answer, want):
    if want == "KEPT OUT":
        return answer in ("UNRELATED", "REFUTED")
    return answer == want


def avg(column):
    xs = [int(r[column]) for r in rows if r[column] != "0"]
    return sum(xs) // len(xs) if xs else 0


ways = [("one word", 1), ("reading", 2), ("backwards", 3)]
score = ", ".join(f"{name} {sum(right(r[i], r[4]) for r in rows)}/{len(rows)}" for name, i in ways)
times = ", ".join(f"{name} {avg(i + 4)} ms" for name, i in ways)
lines = [f"SCORE {score}; average {times} on the build machine"]
for r in rows:
    marks = " ".join("ok" if right(r[i], r[4]) else "WRONG" for _, i in ways)
    lines.append(f"{marks} | {r[0]}: one word {r[1]}, reading {r[2]}, backwards {r[3]}, right {r[4]}")
print(f"::notice title={label} - score::" + "%0A".join(lines))
print(f"::notice title={label} - readings::" + "%0A".join(f"{k}: {v[:240]}" for k, v in readings.items()))
print(f"::notice title={label} - backwards::" + "%0A".join(f"{k}: {v[:240]}" for k, v in backwards.items()))
print("\n".join(lines))
