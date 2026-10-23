"""Checks of the five-option set (run where Hugging Face is reachable). Prints; changes nothing:
how many Turkish questions the text filter keeps and what it throws away, and how many questions are cut by the length limit."""
import collections
import five_human
from transformers import AutoTokenizer

rows = five_human.build("peek-cache", with_turkish=True)
print("questions (training, held-out) by level:", five_human.build.stats)
print("Turkish kept:", len(five_human.turkish.kept), " left out:", len(five_human.turkish.left_out))
for tag, lst in (("KEPT", five_human.turkish.kept), ("LEFT OUT", five_human.turkish.left_out)):
    print(f"--- {tag} (first 10 questions of different subjects)")
    seen = collections.Counter()
    for f, q in lst:
        subject = f.split("TurkishMMLU_")[-1]
        if seen[subject] < 2 and sum(seen.values()) < 10:
            seen[subject] += 1
            print(f"  [{subject}] {q}")
by_subject = collections.Counter(f.split("TurkishMMLU_")[-1] for f, _ in five_human.turkish.kept)
print("Turkish kept by subject:", dict(by_subject))

tok = AutoTokenizer.from_pretrained("MoritzLaurer/mDeBERTa-v3-base-xnli-multilingual-nli-2mil7")
cut = collections.defaultdict(lambda: [0, 0, 0])
seen_q = set()
for r in rows:
    if r["qid"] in seen_q:
        continue
    seen_q.add(r["qid"])
    n_p = len(tok(r["premise"], add_special_tokens=False)["input_ids"])
    n_h = len(tok(r["en"], add_special_tokens=False)["input_ids"])
    c = cut[r["level"]]
    c[0] += 1
    c[1] += n_p + n_h + 3 > 1024
    c[2] = max(c[2], n_p + n_h + 3)
for lv in sorted(cut):
    n, k, mx = cut[lv]
    print(f"level {lv}: {n} questions, {k} longer than 1024 tokens ({100 * k / n:.0f}%), longest {mx}")
