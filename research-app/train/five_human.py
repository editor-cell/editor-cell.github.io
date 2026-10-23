"""Five-option questions that people wrote (Yavuz, 23 Oct 2026: "work with five options, not four like a child").
The official LSAT questions in AGIEval (lighteval/agi_eval_en: lsat-lr, lsat-ar, lsat-rc), every one with five
answers, human-made:
  level 1  logical reasoning (a short passage, a question about its argument)
  level 2  analytical reasoning ("logic games": people, places, conditions; the same kind of puzzle as our floors
           and jobs, but written by exam setters)
  level 3  reading comprehension (long passages)
  level 4  Turkish exam questions with a passage (TurkishMMLU, AYueksel/TurkishMMLU: Turkish language and literature,
           philosophy, religion and ethics, history, ...), five options each; only the questions whose stem carries a
           passage (at least 300 characters, the passage at least 150) come in
A question becomes five pairs: premise = the passage, hypothesis = the question with one answer, the right answer
SUPPORTS, the others NOT_SUPPORTS; fast_problems.py "fivehuman" trains on the five together (the right answer must
score above the other four) and its exam is the same: one choice among five, 20% by chance.
Held out: a quarter of the passages (by a hash of the passage, so every question of a passage stays on one side). That
quarter is cut in two: one half picks which epoch is kept, the other half ("final") is scored but never used to choose
anything, so its number is the honest one.
Rows: kind "fivehuman", "level", "qid", held-out "dev". Usage: five_human.py (needs Hugging Face)"""
import hashlib
import re


def fetch(cfg, split, cache):
    from huggingface_hub import hf_hub_download
    return hf_hub_download("lighteval/agi_eval_en", f"{cfg}/{split}-00000-of-00001.parquet", repo_type="dataset", cache_dir=cache)


def part(passage):
    """'train', 'dev' (picks the kept epoch) or 'final' (only scored), by a hash of the passage."""
    h = int(hashlib.md5(passage.encode()).hexdigest(), 16) % 8
    return "dev" if h == 0 else "final" if h == 4 else "train"


def clean(option):
    return re.sub(r"^\([A-E]\)\s*", "", str(option).strip())


def hypothesis(question, option):
    q = question.strip()
    return q.replace("_", option) if "_" in q else f"{q} {option}"


def split_stem(stem):
    """A Turkish exam stem is passage + question in one string. The question is the last sentence (it ends with '?'
    or a colon); the rest is the passage. -> (passage, question) or None when no passage can be told apart."""
    t = re.sub(r"\s+", " ", stem).strip()
    if len(t) < 300:
        return None
    body = t.rstrip()
    cut = max(body[:-1].rfind(". "), body[:-1].rfind("! "), body[:-1].rfind("? "))
    if cut < 0:
        return None
    passage, question = body[:cut + 1].strip(), body[cut + 2:].strip()
    if len(passage) < 150 or len(question) < 8:
        return None
    return passage, question


POINTS_AT_TEXT = re.compile(r"(par\u00e7a|metin|paragraf|anlat\u0131m|c\u00fcmle|ifade|dize|\u015fiir|ak\u0131l y\u00fcr|\u00e7\u0131kar\u0131m)", re.IGNORECASE)


def refers_to_text(question):
    """The question itself has to ask about the passage (what it says, means, implies), not about a fact the passage
    only hints at (who is the writer described above). Lower-cased Turkish: I and \u0130 are folded by hand."""
    return bool(POINTS_AT_TEXT.search(question.replace("I", "\u0131").replace("\u0130", "i").lower()))


def turkish(cache, pid):
    from huggingface_hub import hf_hub_download, list_repo_files
    rows, n_tr, n_dev = [], 0, 0
    for f in sorted(x for x in list_repo_files("AYueksel/TurkishMMLU", repo_type="dataset") if x.endswith(".json") and x.startswith(("dev/", "test/"))):
        import pandas as pd
        data = pd.read_json(hf_hub_download("AYueksel/TurkishMMLU", f, repo_type="dataset", cache_dir=cache)).to_dict("records")
        for k, r in enumerate(data):
            options = [str(o).strip() for o in r["choices"]]
            if len(options) != 5 or r["answer"] not in "ABCDE":
                continue
            parts = split_stem(str(r["question"]))
            if parts is None:
                continue
            passage, question = parts
            if not refers_to_text(question):
                turkish.left_out.append((f, question[:160]))
                continue
            turkish.kept.append((f, question[:160]))
            right = "ABCDE".index(r["answer"])
            where = part(passage)
            for j, opt in enumerate(options):
                row = {"id": pid, "kind": "fivehuman", "level": 4, "qid": f"tmmlu-{f}-{k}", "premise": passage,
                       "en": f"{question} {opt}", "tr": "", "label": "SUPPORTS" if j == right else "NOT_SUPPORTS"}
                if where != "train":
                    row["dev"] = True
                if where == "final":
                    row["final"] = True
                rows.append(row)
                pid += 1
            n_dev += where != "train"
            n_tr += where == "train"
    return rows, (n_tr, n_dev)


turkish.left_out, turkish.kept = [], []


def build(cache="five-cache", with_turkish=False):
    """with_turkish: the TurkishMMLU stems are split into passage and question by a rule that breaks on tables, lists and
    statements (peek of 23 Oct 2026: 46 of 315 long stems survive, many without their passage), so they stay out."""
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
            where = part(passage)
            for j, opt in enumerate(options):
                row = {"id": pid, "kind": "fivehuman", "level": level, "qid": f"{cfg}-{k}", "premise": passage,
                       "en": hypothesis(str(r["question"]), opt), "tr": "", "label": "SUPPORTS" if j == right else "NOT_SUPPORTS"}
                if where != "train":
                    row["dev"] = True
                if where == "final":
                    row["final"] = True
                rows.append(row)
                pid += 1
            n_dev += where != "train"
            n_tr += where == "train"
        stats[level] = (n_tr, n_dev)
    if with_turkish:
        extra, stats[4] = turkish(cache, pid)
        rows += extra
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
