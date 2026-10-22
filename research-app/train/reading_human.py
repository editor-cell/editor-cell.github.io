"""Reading comprehension questions that people wrote (Yavuz, 22 Oct 2026: for the paragraphs, only questions people
made; never my own). Two published sets, read as they are:
  RACE     English exams for Chinese middle- and high-school students, written by their teachers
           (ehovy/race; levels 1 = middle school, 2 = high school; the sets' own train and validation files)
  Belebele human-written multiple-choice questions on the same 900 short passages, in English and in Turkish
           (facebook/belebele, CC BY-SA 4.0; levels 3 = English, 4 = Turkish)
A question with four answers becomes four pairs: premise = the passage, hypothesis = the question with the answer
(a blank "_" in the question is filled with the answer), correct answer SUPPORTS, a wrong answer NOT_SUPPORTS.
The real measure is the exam itself: of the four answers of a question, the one the model finds most entailed is
its choice (fast_problems.py "readhuman" scores that, 25% by chance).
Held out: RACE's validation file; Belebele by article (all questions of an article, in both languages, so a passage
is never seen in one language and tested in the other). Rows: kind "readhuman", "level", "qid", held-out "dev".
Usage: reading_human.py   (needs Hugging Face; prints sizes and a few rows)"""
import hashlib
import json
import random


def fetch(repo, name, cache):
    from huggingface_hub import hf_hub_download
    return hf_hub_download(repo, name, repo_type="dataset", cache_dir=cache)


def hypothesis(question, option):
    q, o = question.strip(), str(option).strip()
    return q.replace("_", o) if "_" in q else f"{q} {o}"


def race_rows(cache, rnd, per_level, dev_per_level):
    import pandas as pd
    rows = []
    for level, cfg in ((1, "middle"), (2, "high")):
        for split, n in (("train", per_level), ("validation", dev_per_level)):
            df = pd.read_parquet(fetch("ehovy/race", f"{cfg}/{split}-00000-of-00001.parquet", cache))
            idx = list(range(len(df)))
            rnd.shuffle(idx)
            for k in idx[:n]:
                r = df.iloc[k]
                options = list(r["options"])
                right = "ABCD".index(r["answer"])
                for j, opt in enumerate(options):
                    rows.append({"level": level, "qid": f"race-{cfg}-{split}-{k}", "premise": r["article"].strip(),
                                 "en": hypothesis(r["question"], opt), "label": "SUPPORTS" if j == right else "NOT_SUPPORTS",
                                 "dev": split == "validation"})
    return rows


def belebele_rows(cache):
    rows = []
    for level, lang in ((3, "eng_Latn"), (4, "tur_Latn")):
        path = fetch("facebook/belebele", f"data/{lang}.jsonl", cache)
        for line in open(path, encoding="utf-8"):
            if not line.strip():
                continue
            r = json.loads(line)
            dev = int(hashlib.md5(r["link"].encode()).hexdigest(), 16) % 5 == 0
            right = int(r["correct_answer_num"]) - 1
            for j in range(4):
                rows.append({"level": level, "qid": f"bele-{lang}-{r['link']}-{r['question_number']}",
                             "premise": r["flores_passage"].strip(), "en": hypothesis(r["question"], r[f"mc_answer{j + 1}"]),
                             "label": "SUPPORTS" if j == right else "NOT_SUPPORTS", "dev": dev})
    return rows


def build(cache="reading-cache", race_per_level=1000, race_dev_per_level=150, seed=3):
    rnd = random.Random(seed)
    raw = race_rows(cache, rnd, race_per_level, race_dev_per_level) + belebele_rows(cache)
    rows = []
    for k, r in enumerate(raw):
        row = {"id": 200000 + k, "kind": "readhuman", "level": r["level"], "qid": r["qid"], "premise": r["premise"],
               "en": r["en"], "tr": "", "label": r["label"]}
        if r["dev"]:
            row["dev"] = True
        rows.append(row)
    build.stats = {(lv, d): len({r["qid"] for r in rows if r["level"] == lv and bool(r.get("dev")) == d})
                   for lv in (1, 2, 3, 4) for d in (False, True)}
    return rows


if __name__ == "__main__":
    rows = build()
    print(len(rows), "pairs; questions (level, held-out):", build.stats)
    seen = set()
    for r in rows:
        if r["level"] not in seen:
            seen.add(r["level"])
            print(f"\n-- level {r['level']} {r['label']}\n{r['premise'][:400]}\n=> {r['en'][:200]}")
