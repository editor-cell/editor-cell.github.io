"""Prints a short score card from the LiveModelTest results: one line per check, then totals."""
import glob
import re
import sys
import xml.etree.ElementTree as ET

passed = total = 0
times = []
for path in glob.glob(f"{sys.argv[1]}/TEST-*LiveModelTest*.xml"):
    for case in ET.parse(path).getroot().iter("testcase"):
        if case.find("skipped") is not None:
            continue
        total += 1
        ok = case.find("failure") is None
        passed += ok
        out = case.findtext("system-out") or ""
        times += [int(t) for t in re.findall(r"\[(\d+) ms\]", out)]
        detail = next((l.strip() for l in out.splitlines() if l.strip().startswith(("TRANSLATION", "JUDGE"))), "")
        if not detail and not ok:
            detail = " | ".join(l.strip() for l in out.splitlines()[-4:])
        print(f"{'PASS' if ok else 'FAIL'}  {case.get('name')[:70]}  {detail[:200]}")
avg = sum(times) / len(times) if times else 0
print(f"SCORE {passed}/{total}  average answer time {avg:.0f} ms on the build machine")
