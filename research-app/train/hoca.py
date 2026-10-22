"""A second teacher (ikinci hoca): ChatGPT labels our hand-labelled claims without seeing our labels;
only the claims we both label the same way stay in training.

  hoca.py packets <dir>   writes the claims, without their labels, as packets of about 200 for the
                          teacher (paragraph, then its numbered Turkish claims), and a README with
                          the instructions; nothing else from this repository goes there.
  hoca.py compare <dir>   reads the teacher's answers (<dir>/answers/packetNN.csv: code,label),
                          prints where we agree and where we do not, and writes labels/agreed.json:
                          the codes of the claims kept. train_nli.py drops the rest when the file
                          exists.
The claims sent are the ones labelled by hand (batch*, logic*, words); puzzles and form-and-meaning
answers are computed, not judged, and need no second teacher."""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PER_PACKET = 200

README = """# Labelling task

You are a second, independent judge for a reading model. Each packet file holds short paragraphs,
each followed by numbered claims in Turkish. For every claim decide, from the paragraph alone:

- SUPPORTS: the paragraph says this, or says something that carries it (a paragraph that says prices
  more than doubled supports "prices rose").
- CONTRADICTS: the paragraph says the opposite, or rules the claim out.
- UNRELATED: the paragraph does not settle it either way, including when the claim says more than the
  paragraph does ("rose sharply" when the paragraph only says "rose"), or is about something else
  that happens to share a word.

Rules:
- Read every paragraph and every claim yourself and judge each one on its own. Do not write a program,
  a keyword rule or any shortcut to produce the answers.
- Use only the paragraph. Do not use what you know about the world, and do not look at any other
  file, branch or commit of this repository.
- Answer every code in the packet, in a file answers/packetNN.csv (NN as in the packet's name), one
  line per claim: `code,LABEL`, with a first line `code,label`. Nothing else in the file.
- Commit the answer file to this branch (hoca). Change no other file.
"""


def claims():
    rows = []
    for path in sorted(glob.glob(os.path.join(HERE, "labels", "*.jsonl"))):
        name = os.path.basename(path)[:-6]
        if not (name.startswith("batch") or name.startswith("logic") or name == "words"):
            continue
        for n, line in enumerate(open(path, encoding="utf-8")):
            if line.strip():
                rows.append((f"{name}-{n + 1:04d}", json.loads(line)))
    return rows


def packets(out):
    pool = {p["id"]: p for p in json.load(open(os.path.join(HERE, "pool.json"), encoding="utf-8"))}
    by_text = {}
    for code, e in claims():
        text = e.get("premise") or pool[e["id"]]["text"]
        by_text.setdefault(text, []).append((code, e["tr"]))
    os.makedirs(os.path.join(out, "answers"), exist_ok=True)
    open(os.path.join(out, "README.md"), "w", encoding="utf-8").write(README)
    k, size, body, total = 1, 0, [], 0

    def flush():
        nonlocal k, size, body
        if body:
            with open(os.path.join(out, f"packet{k:02d}.md"), "w", encoding="utf-8") as f:
                f.write(f"# Packet {k:02d}\n\nAnswer in answers/packet{k:02d}.csv. See README.md.\n\n" + "\n".join(body))
            k, size, body = k + 1, 0, []

    for i, (text, items) in enumerate(by_text.items()):
        if size + len(items) > PER_PACKET and size:
            flush()
        body.append(f"## Paragraph {i + 1}\n\n{text}\n")
        body += [f"- `{code}` {tr}" for code, tr in items] + [""]
        size += len(items)
        total += len(items)
    flush()
    print(f"{total} claims in {k - 1} packets")


def compare(out):
    mine = dict(claims())
    theirs = {}
    for path in sorted(glob.glob(os.path.join(out, "answers", "packet*.csv"))):
        for line in open(path, encoding="utf-8"):
            parts = [x.strip().strip("`") for x in line.split(",")]
            if len(parts) == 2 and parts[0] in mine:
                theirs[parts[0]] = parts[1].upper()
    agreed = sorted(c for c, l in theirs.items() if l == mine[c]["label"])
    differ = sorted(c for c, l in theirs.items() if l != mine[c]["label"])
    unanswered = len(mine) - len(theirs)
    print(f"answered {len(theirs)} of {len(mine)}; agree on {len(agreed)}, differ on {len(differ)}, unanswered {unanswered}")
    for c in differ:
        print(f"{c}: mine {mine[c]['label']}, teacher {theirs[c]} | {mine[c]['tr']}")
    json.dump({"agreed": agreed, "differ": differ}, open(os.path.join(HERE, "labels", "agreed.json"), "w"), indent=0)


if __name__ == "__main__":
    {"packets": packets, "compare": compare}[sys.argv[1]](sys.argv[2])
