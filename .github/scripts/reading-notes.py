"""Scores the one-word verdict against reading for meaning (ReadingCompareTest) and leaves the result
on the run as notes, readable without the log. Usage: reading-notes.py <test-results dir> <label>"""
import glob
import sys
import xml.etree.ElementTree as ET

directory, label = sys.argv[1], sys.argv[2]
rows, readings = [], {}
for path in glob.glob(f"{directory}/TEST-*ReadingCompareTest*.xml"):
    root = ET.parse(path).getroot()
    for line in (root.findtext("system-out") or "").splitlines():
        parts = line.strip().split("\t")
        if parts[0] == "COMPARE" and len(parts) == 7:
            rows.append(parts[1:])
        elif parts[0] == "READING" and len(parts) >= 3:
            readings[parts[1]] = parts[2]


def right(answer, want):
    if want == "KEPT OUT":
        return answer in ("UNRELATED", "REFUTED")
    return answer == want


old_ok = sum(right(o, w) for _, o, _, w, _, _ in rows)
new_ok = sum(right(n, w) for _, _, n, w, _, _ in rows)
old_ms = [int(a) for *_, a, _ in rows if a != "0"]
new_ms = [int(b) for *_, b in rows if b != "0"]
avg = lambda xs: sum(xs) // len(xs) if xs else 0

lines = [f"SCORE one word {old_ok}/{len(rows)}, reading {new_ok}/{len(rows)}; "
         f"average {avg(old_ms)} ms against {avg(new_ms)} ms on the build machine"]
for name, o, n, w, _, _ in rows:
    mark = ("ok" if right(o, w) else "WRONG") + " -> " + ("ok" if right(n, w) else "WRONG")
    lines.append(f"{mark} | {name}: one word {o}, reading {n}, right {w}")
print(f"::notice title={label} - score::" + "%0A".join(lines))
print(f"::notice title={label} - readings::" + "%0A".join(f"{k}: {v[:260]}" for k, v in readings.items()))
summary = sys.stdout
print("\n".join(lines))
