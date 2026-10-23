"""Select human-written, published five-choice LSAT reading questions.

Source: Wang et al., From LSAT: The Progress and Challenges of Complex
Reasoning (2022). No generated questions, options, translations or answers.
Copyrighted question text is fetched into the private training input only.
"""
import collections
import hashlib
import json
import pathlib
import re

from independent_exam_data import download, overlap_audit, clean

REVISION = "41f78ca7be3e24602b694b9d6b78105fc0c8bfc6"
ROOT = f"https://raw.githubusercontent.com/zhongwanjun/AR-LSAT/{REVISION}/complete_lsat_data/"


def canonical(row):
    return json.dumps(row, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def fingerprint(row):
    return hashlib.sha256(canonical(row).encode()).hexdigest()


def read_source(split, cache):
    path = pathlib.Path(cache) / f"complete-{split}-rc.json"
    data = download(ROOT + split + "_rc.json", path)
    return json.loads(data), hashlib.sha256(data).hexdigest()


def filtered(rows):
    # Reject ambiguous passage assignments rather than repair them ourselves.
    groups = collections.defaultdict(list)
    contexts = collections.defaultdict(set)
    for row in rows:
        group = row["id_string"].rsplit("_", 1)[0]
        groups[group].append(row)
        contexts[clean(row["context"])].add(group)
    bad = {k for k, g in groups.items() if len({clean(x["context"]) for x in g}) != 1}
    bad |= {k for keys in contexts.values() if len(keys) != 1 for k in keys}
    duplicates = collections.defaultdict(list)
    for row in rows:
        duplicates[(clean(row["context"]), clean(row["question"]))].append(row)
    out, rejected = [], collections.Counter()
    for row in rows:
        group = row["id_string"].rsplit("_", 1)[0]
        if group in bad:
            rejected["ambiguous_passage_group"] += 1
            continue
        options = [clean(x) for x in row["answers"]]
        if len(options) != 5 or len(set(options)) != 5 or not all(options) or row["label"] not in range(5):
            rejected["invalid_choices_or_answer"] += 1
            continue
        if len(duplicates[(clean(row["context"]), clean(row["question"]))]) != 1:
            rejected["duplicate_question"] += 1
            continue
        if len(clean(row["context"])) < 400:
            rejected["short_or_missing_passage"] += 1
            continue
        # Plain text lacks original line numbering and typography. Do not guess.
        if re.search(r"\blines?\s+\d|underlin|highlight|boldface|italic|\bfigure\b|\bdiagram\b", row["question"], re.I):
            rejected["missing_original_layout"] += 1
            continue
        out.append({"id": row["id_string"], "passage": clean(row["context"]),
            "question": clean(row["question"]), "options": options,
            "answer": "ABCDE"[row["label"]], "group": "English reading"})
    return out, dict(rejected)


def select(cache, protected):
    raw_train, train_hash = read_source("train", cache)
    raw_dev, dev_hash = read_source("val", cache)
    raw_test, test_hash = read_source("test", cache)
    train, train_rejected = filtered(raw_train)
    dev, dev_rejected = filtered(raw_dev)
    # The existing trainer reads at most 1024 tokens. Keep a small margin and
    # reject whole questions rather than silently cutting their passage.
    import sentencepiece as spm
    token_path = pathlib.Path(cache) / "mdeberta-spm.model"
    token_data = download("https://huggingface.co/MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7/resolve/main/spm.model", token_path)
    tokenizer = spm.SentencePieceProcessor(model_file=str(token_path))
    def fits(q):
        return max(len(tokenizer.encode(q["passage"])) + len(tokenizer.encode(q["question"] + " " + opt)) + 3 for opt in q["options"]) <= 1016
    short_train, short_dev = [q for q in train if fits(q)], [q for q in dev if fits(q)]
    train_rejected["too_long_for_current_trainer"] = len(train) - len(short_train)
    dev_rejected["too_long_for_current_trainer"] = len(dev) - len(short_dev)
    train, dev = short_train, short_dev
    # Keep original evaluation passages and the independent examination out of
    # training. The caller also supplies every previous five-choice passage.
    protected_train = list(protected) + [r["context"] for r in raw_dev + raw_test]
    train, blocked = overlap_audit(train, protected_train)
    train.sort(key=lambda q: hashlib.sha256(("orbis-paragraph-1000-v1:" + q["id"]).encode()).hexdigest())
    if len(train) < 1000:
        raise ValueError(f"Only {len(train)} eligible distinct questions; will not pad or repeat")
    train = train[:1000]
    dev, blocked_dev = overlap_audit(dev, list(protected) + [q["passage"] for q in train] + [r["context"] for r in raw_test])
    dev.sort(key=lambda q: hashlib.sha256(("orbis-paragraph-dev-v1:" + q["id"]).encode()).hexdigest())
    if len(dev) < 100:
        raise ValueError(f"Only {len(dev)} clean held-out questions")
    dev = dev[:100]
    assert not ({q["passage"] for q in train} & {q["passage"] for q in dev})
    manifest = {"version": 1, "source_revision": REVISION,
        "source_hashes": {"train": train_hash, "val": dev_hash, "test": test_hash,
                          "tokenizer": hashlib.sha256(token_data).hexdigest()},
        "train": {q["id"]: fingerprint(q) for q in train},
        "dev": {q["id"]: fingerprint(q) for q in dev},
        "counts": {"train_questions": len(train), "train_passages": len({q["passage"] for q in train}),
                   "dev_questions": len(dev), "dev_passages": len({q["passage"] for q in dev})},
        "rejected": {"train_structure": train_rejected, "dev_structure": dev_rejected,
                     "train_overlap_questions": len(blocked["excluded"]), "dev_overlap_questions": len(blocked_dev["excluded"])}}
    return {"train": train, "dev": dev, "manifest": manifest}


def labels(dataset):
    out = []
    for split in ("train", "dev"):
        for k, q in enumerate(dataset[split]):
            for j, option in enumerate(q["options"]):
                out.append({"id": 5000000 + (1000 if split == "dev" else 0) + k,
                    "kind": "fivehuman", "qid": q["id"], "level": 3,
                    "premise": q["passage"], "en": q["question"] + " " + option, "tr": "",
                    "label": "SUPPORTS" if "ABCDE"[j] == q["answer"] else "NOT_SUPPORTS",
                    "dev": split == "dev"})
    return out
