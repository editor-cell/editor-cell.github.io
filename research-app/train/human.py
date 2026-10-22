"""Human-made pairs for the NLI model, fetched while the training runs and never stored here.

PAWS (Google; "may be freely used for any purpose"): English sentence pairs, each judged by five
people as saying the same thing or not. Most pairs share nearly all their words, so word overlap
alone cannot tell them apart ("flights from New York to Florida" / "from Florida to New York").
  same          -> SUPPORTS
  not the same  -> NOT_SUPPORTS (a contradiction or only something else: only "not support" is taught)
Tatoeba (CC BY 2.0 FR, tatoeba.org): sentences people translated, English-Turkish and
Turkish-Turkish (two Turkish wordings linked as the same sentence).
  English -> its Turkish translation             SUPPORTS
  Turkish -> another Turkish wording of it       SUPPORTS
  English -> a Turkish sentence that shares a word with the translation but is another sentence
                                                 NOT_SUPPORTS
build(n_paws, n_tatoeba, cache) -> rows in the labels/*.jsonl shape (kind "human")."""
import bz2
import csv
import io
import os
import random
import re
import tarfile
import urllib.request

TATOEBA = "https://downloads.tatoeba.org/exports/per_language/"
PAWS_TGZ = "https://storage.googleapis.com/paws/english/paws_wiki_labeled_final.tar.gz"


def get(url, cache):
    path = os.path.join(cache, url.rsplit("/", 1)[1])
    if not os.path.exists(path):
        os.makedirs(cache, exist_ok=True)
        urllib.request.urlretrieve(url, path)
    return path


def paws(cache):
    rows = []
    with tarfile.open(get(PAWS_TGZ, cache)) as tf:
        for m in tf.getmembers():
            if m.name.endswith("train.tsv"):
                text = tf.extractfile(m).read().decode("utf-8")
                for r in csv.DictReader(io.StringIO(text), delimiter="\t", quoting=csv.QUOTE_NONE):
                    rows.append((r["sentence1"].strip(), r["sentence2"].strip(), r["label"].strip() == "1"))
    return rows


def sentences(lang, cache):
    out = {}
    with bz2.open(get(f"{TATOEBA}{lang}/{lang}_sentences.tsv.bz2", cache), "rt", encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 3:
                out[parts[0]] = parts[2]
    return out


def links(pair, cache):
    a = pair.split("-")[0]
    with bz2.open(get(f"{TATOEBA}{a}/{pair}_links.tsv.bz2", cache), "rt", encoding="utf-8") as f:
        return [tuple(line.split()[:2]) for line in f if line.strip()]


def words(text):
    return {w for w in re.findall(r"\w+", text.lower()) if len(w) >= 5}


def build(n_paws=4000, n_tatoeba=3000, cache="human-cache", seed=11):
    rnd = random.Random(seed)
    rows, k = [], 0

    def add(premise, claim, label, lang):
        nonlocal k
        rows.append({"id": 50000 + k, "kind": "human", "premise": premise,
                     "en": claim if lang == "en" else "", "tr": claim if lang == "tr" else "", "label": label})
        k += 1

    for s1, s2, same in rnd.sample(paws(cache), n_paws):
        add(s1, s2, "SUPPORTS" if same else "NOT_SUPPORTS", "en")

    tur, eng = sentences("tur", cache), sentences("eng", cache)
    te = [(t, e) for t, e in links("tur-eng", cache) if t in tur and e in eng and len(eng[e].split()) >= 6]
    tt = [(a, b) for a, b in links("tur-tur", cache)
          if a in tur and b in tur and a < b and len(tur[a].split()) >= 5 and tur[a] != tur[b]]
    linked = {}
    for t, e in te:
        linked.setdefault(e, set()).add(t)
    by_word = {}
    for t in {t for t, _ in te}:
        for w in words(tur[t]):
            by_word.setdefault(w, []).append(t)
    n_pos = n_tatoeba * 2 // 3
    for t, e in rnd.sample(te, n_pos):
        add(eng[e], tur[t], "SUPPORTS", "tr")
    for a, b in rnd.sample(tt, min(len(tt), n_tatoeba // 3)):
        add(tur[a], tur[b], "SUPPORTS", "tr")
    made = 0
    for t, e in rnd.sample(te, len(te)):
        if made >= n_pos:
            break
        shared = [w for w in words(tur[t]) if 1 < len(by_word.get(w, [])) < 2000]
        if not shared:
            continue
        other = rnd.choice(by_word[rnd.choice(shared)])
        if other in linked[e] or tur[other] == tur[t]:
            continue
        add(eng[e], tur[other], "NOT_SUPPORTS", "tr")
        made += 1
    rnd.shuffle(rows)
    return rows


if __name__ == "__main__":
    import json
    import sys
    rows = build(cache=sys.argv[1] if len(sys.argv) > 1 else "human-cache")
    print(len(rows), {l: sum(r["label"] == l for r in rows) for l in ("SUPPORTS", "NOT_SUPPORTS")})
    for r in random.Random(2).sample(rows, 10):
        print(json.dumps(r, ensure_ascii=False)[:300])
