"""Logic questions that people wrote (Yavuz, 22 Oct 2026: "take the logic questions from the ones people designed,
do not ask them yourself"). Two published sets, read as they are, nothing of mine added:
  FOLIO (Han et al., expert-written; premises, a conclusion, True / False / Uncertain)
        True -> SUPPORTS, False -> CONTRADICTS, Uncertain -> UNRELATED          (here: tasksource/folio)
  LogiQA 2.0 in sentence-pair form (questions of a national civil-service logic exam, written by people;
        premise, hypothesis, entailment / not-entailment)                      (here: tasksource/logiqa-2.0-nli)
        entailment -> SUPPORTS, not-entailment -> NOT_SUPPORTS
Levels are made by the sets' own size, not by anything I invented: each set's training items are split into five
bands, shortest to longest (FOLIO: by the number of premises, then length; LogiQA: by the length of premise and
hypothesis). FOLIO takes levels 1, 3, 5, 7, 9; LogiQA levels 2, 4, 6, 8, 10. The held-out items are each set's own
validation file (never trained on), put into the same bands. Rows: kind "humanlogic", "level", held-out "dev".
Usage: logic_human.py   (needs Hugging Face; prints the sizes and a few rows)"""
import bisect
import json
import os
import random

LABELS = {"True": "SUPPORTS", "False": "CONTRADICTS", "Uncertain": "UNRELATED"}


def fetch(repo, name, cache):
    from huggingface_hub import hf_hub_download
    return hf_hub_download(repo, name, repo_type="dataset", cache_dir=cache)


def read_jsonl(path):
    with open(path, encoding="utf-8") as f:
        return [json.loads(l) for l in f if l.strip()]


def bands(train_keys, k=5):
    """Cut points that split the training keys into k bands of about equal size."""
    s = sorted(train_keys)
    return [s[len(s) * i // k] for i in range(1, k)]


def band_of(key, cuts):
    return bisect.bisect_right(cuts, key)  # 0 .. 4


def folio_rows(cache):
    out = {}
    for split in ("train", "validation"):
        rows = read_jsonl(fetch("tasksource/folio", f"folio_v2_{split}.jsonl", cache))
        items = []
        for r in rows:
            if r.get("label") not in LABELS:
                continue
            lines = [x.strip() for x in r["premises"].split("\n") if x.strip()]
            text = " ".join(lines)
            items.append(((len(lines), len(text)), text, r["conclusion"].strip(), LABELS[r["label"]]))
        out[split] = items
    return out


def logiqa_rows(cache):
    out = {}
    for split in ("train", "validation"):
        rows = read_jsonl(fetch("tasksource/logiqa-2.0-nli", f"{split}.jsonl", cache))
        items = []
        for r in rows:
            lab = {"entailment": "SUPPORTS", "not-entailment": "NOT_SUPPORTS"}.get(r["label"])
            if lab and r["premise"].strip() and r["hypothesis"].strip():
                key = (len(r["premise"].split()) + len(r["hypothesis"].split()),)
                items.append((key, r["premise"].strip(), r["hypothesis"].strip(), lab))
        out[split] = items
    return out


def build(cache="humanlogic-cache", logiqa_per_level=400, logiqa_dev_per_level=60, seed=9):
    rnd = random.Random(seed)
    rows, pid = [], 100000
    stats = {}
    for first_level, data in ((1, folio_rows(cache)), (2, logiqa_rows(cache))):
        cuts = bands([k for k, *_ in data["train"]])
        for split in ("train", "validation"):
            by = {b: [] for b in range(5)}
            for item in data[split]:
                by[band_of(item[0], cuts)].append(item)
            for b, items in by.items():
                rnd.shuffle(items)
                if first_level == 2:
                    items = items[: logiqa_per_level if split == "train" else logiqa_dev_per_level]
                level = first_level + 2 * b
                for _, prem, hyp, lab in items:
                    row = {"id": pid, "kind": "humanlogic", "level": level, "premise": prem, "en": hyp, "tr": "", "label": lab}
                    if split == "validation":
                        row["dev"] = True
                    rows.append(row)
                    pid += 1
                stats[(level, split)] = len(items)
    build.stats = stats
    return rows


if __name__ == "__main__":
    rows = build()
    import collections
    print(len(rows), "claims;", collections.Counter((r["level"], bool(r.get("dev"))) for r in rows))
    print(collections.Counter((r["level"] % 2, r["label"]) for r in rows))
    shown = set()
    for r in rows:
        if r["level"] not in shown:
            shown.add(r["level"])
            print(f"\n-- level {r['level']} {'(held-out)' if r.get('dev') else ''} {r['label']}\n{r['premise'][:600]}\n=> {r['en'][:300]}")
