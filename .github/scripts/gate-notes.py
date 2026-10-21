"""Leaves the concept-gate test on the run as notes: each failed check as an error, and what the
model found and decided on the close and subtle cases as notices (the log itself cannot be read
without signing in). Usage: gate-notes.py <test-results dir> <label>"""
import glob
import sys
import xml.etree.ElementTree as ET

directory, label = sys.argv[1], sys.argv[2]
gate, concepts = [], []
for path in glob.glob(f"{directory}/TEST-*ConceptGateTest*.xml"):
    root = ET.parse(path).getroot()
    for case in root.iter("testcase"):
        failure = case.find("failure")
        if failure is not None:
            msg = (failure.get("message") or "").replace("\n", " ")[:300]
            print(f"::error title={label}::{case.get('name')[:60]}: {msg}")
    for line in (root.findtext("system-out") or "").splitlines():
        text = line.strip()
        if text.startswith("GATE"):
            gate.append(text[:300])
        elif text.startswith("CONCEPTS"):
            concepts.append(text[:700])
# Two notices: the run page cuts a long one, and what was decided matters more than the lists behind it.
if gate:
    print(f"::notice title={label} - decisions::" + "%0A".join(gate))
if concepts:
    print(f"::notice title={label} - concept lists::" + "%0A".join(concepts))
