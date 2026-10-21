"""Leaves the concept-gate test on the run as notes: each failed check as an error, and what the
model found and decided on the close and subtle cases as one notice (the log itself cannot be read
without signing in). Usage: gate-notes.py <test-results dir> <label>"""
import glob
import sys
import xml.etree.ElementTree as ET

directory, label = sys.argv[1], sys.argv[2]
lines = []
for path in glob.glob(f"{directory}/TEST-*ConceptGateTest*.xml"):
    root = ET.parse(path).getroot()
    for case in root.iter("testcase"):
        failure = case.find("failure")
        if failure is not None:
            msg = (failure.get("message") or "").replace("\n", " ")[:300]
            print(f"::error title={label}::{case.get('name')[:60]}: {msg}")
    for line in (root.findtext("system-out") or "").splitlines():
        if line.strip().startswith(("CONCEPTS", "GATE")):
            lines.append(line.strip()[:400])
if lines:
    print(f"::notice title={label}::" + "%0A".join(lines)[:12000])
