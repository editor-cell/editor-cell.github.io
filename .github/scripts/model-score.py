"""Prints a short score card from the live model tests: one line per check, then totals."""
import glob
import re
import sys
import xml.etree.ElementTree as ET

passed = total = 0
times = []
for path in glob.glob(f"{sys.argv[1]}/TEST-*LiveModelTest*.xml") + glob.glob(f"{sys.argv[1]}/TEST-*EmbedderTest*.xml"):
    root = ET.parse(path).getroot()
    times += [int(t) for t in re.findall(r"\[(\d+) ms\]", "".join(root.itertext()))]
    for case in root.iter("testcase"):
        if case.find("skipped") is not None:
            continue
        total += 1
        ok = case.find("failure") is None
        passed += ok
        failure = case.find("failure")
        detail = "" if ok else (failure.get("message") or "").splitlines()[0]
        print(f"{'PASS' if ok else 'FAIL'}  {case.get('name')[:70]}  {detail[:200]}")
for line in "".join(ET.parse(p).getroot().findtext("system-out") or "" for p in glob.glob(f"{sys.argv[1]}/TEST-*.xml")).splitlines():
    if line.strip().startswith(("PARAGRAPH ms", "STOP after", "SUGGESTION", "JUDGE", "TRANSLATION")):
        print("  " + line.strip()[:220])
avg = sum(times) / len(times) if times else 0
print(f"SCORE {passed}/{total}  average answer time {avg:.0f} ms on the build machine")
