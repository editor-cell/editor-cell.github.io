"""Five-option questions that people wrote (Yavuz, 23 Oct 2026: "work with five options, not four like a child").
The official LSAT questions in AGIEval (lighteval/agi_eval_en: lsat-lr, lsat-ar, lsat-rc), every one with five
answers, human-made:
  level 1  logical reasoning (a short passage, a question about its argument)
  level 2  analytical reasoning ("logic games": people, places, conditions; the same kind of puzzle as our floors
           and jobs, but written by exam setters)
  level 3  reading comprehension (long passages)
A question becomes five pairs: premise = the passage, hypothesis = the question with one answer, the right answer
SUPPORTS, the others NOT_SUPPORTS; fast_problems.py "fivehuman" trains on the five together (the right answer must
score above the other four) and its exam is the same: one choice among five, 20% by chance.
Held out: a quarter of the passages (by a hash of the passage, so every question of a passage stays on one side).
Rows: kind "fivehuman", "level", "qid", held-out "dev". Usage: five_human.py (needs Hugging Face)"""
import hashlib
import re


def fetch(cfg, split, cache):
    from huggingface_hub import hf_hub_download
    return hf_hub_download("lighteval/agi_eval_en", f"{cfg}/{split}-00000-of-00001.parquet", repo_type="dataset", cache_dir=cache)


def clean(option):
    return re.sub(r"^\([A-E]\)\s*", "", str(option).strip())


def hypothesis(question, option):
    q = question.strip()
    return q.replace("_", option) if "_" in q else f"{q} {option}"


def build(cache="five-cache"):
    import pandas as pd
    rows, pid = [], 300000
    stats = {}
    for level, cfg in ((1, "lsat-lr"), (2, "lsat-ar"), (3, "lsat-rc")):
        df = pd.concat([pd.read_parquet(fetch(cfg, s, cache)) for s in ("train", "validation")], ignore_index=True)
        n_tr = n_dev = 0
        for k, r in df.iterrows():
            options = [clean(o) for o in r["options"]]
            if len(options) != 5 or r["label"] not in "ABCDE":
                continue
            right = "ABCDE".index(r["label"])
            passage = str(r["passage"]).strip()
            dev = int(hashlib.md5(passage.encode()).hexdigest(), 16) % 4 == 0
            for j, opt in enumerate(options):
                row = {"id": pid, "kind": "fivehuman", "level": level, "qid": f"{cfg}-{k}", "premise": passage,
                       "en": hypothesis(str(r["question"]), opt), "tr": "", "label": "SUPPORTS" if j == right else "NOT_SUPPORTS"}
                if dev:
                    row["dev"] = True
                rows.append(row)
                pid += 1
            n_dev += dev
            n_tr += not dev
        stats[level] = (n_tr, n_dev)
    build.stats = stats
    return rows


if __name__ == "__main__":
    rows = build()
    print(len(rows), "pairs; questions (training, held-out) by level:", build.stats)
    seen = set()
    for r in rows:
        if r["level"] not in seen:
            seen.add(r["level"])
            print(f"\n-- level {r['level']} {r['label']}\n{r['premise'][:300]}\n=> {r['en'][:250]}")
