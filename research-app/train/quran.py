"""Reading the Quran (Kur'an) for the NLI model: the same verse in several renderings carries the same
judgment (aynı yargı), a different verse does not.

The texts are fetched when the reading runs and are never kept in this public repository: the
Arabic (Tanzil "simple"), four Turkish meals (Diyanet İşleri, Diyanet Vakfı, Elmalılı sadeleştirilmiş,
Hasan Basri Çantay) and three English renderings (Pickthall, Yusuf Ali, Saheeh International), all
from the fawazahmed0/quran-api collection on GitHub.

Each pass ("reading") builds fresh pairs with its own seed, so the eleven readings see different
meals side by side:
  the verse in English      -> the verse in Turkish            SUPPORTS
  the verse in Arabic       -> the verse in Turkish (or back)  SUPPORTS
  one Turkish meal          -> another Turkish meal            SUPPORTS
  the verse in English      -> a neighbouring verse in Turkish UNRELATED  (same subject, not the same judgment;
                                                                         only when the two share almost no words,
                                                                         so a neighbour that restates it is never
                                                                         called "different")
  the verse in Turkish      -> a verse from elsewhere          UNRELATED
Care taken:
  - words a translator adds in brackets (an explanation, not the verse) are removed, so a rendering
    never says more than the verse it stands for;
  - a meal that runs several verses together, or leaves part of one out, is left out for that verse
    (its length is compared with the other renderings);
  - a verse that recurs (the refrain of Rahmân, say) or is very short is never used as "different".
Usage: quran.py [cache dir] -> prints counts and a few pairs of one reading."""
import json
import os
import random
import re
import statistics
import sys
import urllib.request

BASE = "https://raw.githubusercontent.com/fawazahmed0/quran-api/1/editions/"
ARABIC = "ara-quransimple"
TURKISH = ["tur-diyanetisleri", "tur-diyanetvakfi", "tur-elmallsadelesti", "tur-hasanbasricanta"]
ENGLISH = ["eng-mohammedmarmadu", "eng-abdullahyusufal", "eng-ummmuhammad"]


def fetch(edition, cache):
    path = os.path.join(cache, edition + ".json")
    if not os.path.exists(path):
        os.makedirs(cache, exist_ok=True)
        urllib.request.urlretrieve(BASE + edition + ".json", path)
    rows = json.load(open(path, encoding="utf-8"))["quran"]
    assert len(rows) == 6236, (edition, len(rows))
    return [r["text"] for r in rows], [(r["chapter"], r["verse"]) for r in rows]


def clean(text):
    text = re.sub(r"\([^()]*\)|\[[^\[\]]*\]", " ", text)  # added explanations
    text = re.sub(r"\([^()]*\)", " ", text)               # what nesting left
    text = re.sub(r"[«»\"“”]", "", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", re.sub(r"\s+", " ", text)).strip(" ,;:")
    return text


def plain_arabic(text):
    return re.sub(r"[ً-ٰٟۖ-ۭـ]", "", text).strip()


def words(text):
    return re.findall(r"\w+", text.lower())


def load(cache):
    arabic, refs = fetch(ARABIC, cache)
    texts = {e: [clean(t) for t in fetch(e, cache)[0]] for e in TURKISH + ENGLISH}
    # A rendering's length for a verse, against that translator's usual length; a rendering far
    # from the other renderings of the same verse has run verses together or left some out.
    avg = {e: statistics.mean(len(words(t)) or 1 for t in ts) for e, ts in texts.items()}
    good = []
    for i in range(len(refs)):
        r = {e: len(words(texts[e][i])) / avg[e] for e in texts}
        m = statistics.median(r.values())
        good.append({e for e, x in r.items() if words(texts[e][i]) and 0.6 * m <= x <= 1.6 * m})
    # Verses that recur word for word (in Arabic) are the same verse for this purpose.
    same = {}
    for i, a in enumerate(arabic):
        same.setdefault(plain_arabic(a), []).append(i)
    twin = {i: set(v) for v in same.values() for i in v}
    return refs, arabic, texts, good, twin


def reading(n, refs, arabic, texts, good, twin):
    rnd = random.Random(1000 + n)
    out = []
    tr_words = {}

    def tr_set(i):
        if i not in tr_words:
            tr_words[i] = set(words(texts[TURKISH[0]][i]))
        return tr_words[i]

    def different(i, j, limit=0.4):
        # Not the same verse, not a recurring twin, not two short verses, little in common.
        if j in twin[i] or min(len(words(texts[TURKISH[0]][i])), len(words(texts[TURKISH[0]][j]))) < 4:
            return False
        a, b = tr_set(i), tr_set(j)
        return len(a & b) / max(1, len(a | b)) < limit

    for i, (sura, aya) in enumerate(refs):
        tr = [e for e in TURKISH if e in good[i]]
        en = [e for e in ENGLISH if e in good[i]]
        if not tr:
            continue
        t1 = rnd.choice(tr)
        if en:
            out.append((texts[rnd.choice(en)][i], texts[t1][i], "SUPPORTS"))
        if rnd.random() < 0.5:
            out.append((arabic[i], texts[rnd.choice(tr)][i], "SUPPORTS"))
        else:
            out.append((texts[rnd.choice(tr)][i], arabic[i], "SUPPORTS"))
        others = [e for e in tr if e != t1]
        if others:
            a, b = (t1, rnd.choice(others)) if rnd.random() < 0.5 else (rnd.choice(others), t1)
            out.append((texts[a][i], texts[b][i], "SUPPORTS"))
        # A neighbour: same sura, a verse or two away.
        near = [j for j in (i - 2, i - 1, i + 1, i + 2)
                if 0 <= j < len(refs) and refs[j][0] == sura and different(i, j, 0.15)]
        near = [j for j in near if any(e in good[j] for e in TURKISH)]
        if en and near:
            j = rnd.choice(near)
            out.append((texts[rnd.choice(en)][i], texts[rnd.choice([e for e in TURKISH if e in good[j]])][j], "UNRELATED"))
        # A verse from elsewhere.
        for _ in range(5):
            j = rnd.randrange(len(refs))
            if refs[j][0] != sura and different(i, j) and any(e in good[j] for e in TURKISH):
                out.append((texts[t1][i], texts[rnd.choice([e for e in TURKISH if e in good[j]])][j], "UNRELATED"))
                break
    rnd.shuffle(out)
    return out


if __name__ == "__main__":
    cache = sys.argv[1] if len(sys.argv) > 1 else "quran-cache"
    data = load(cache)
    refs, arabic, texts, good, twin = data
    left_out = {e: sum(e not in g for g in good) for e in texts}
    print("renderings left out as running verses together or short:", left_out)
    print("verses that recur:", sum(len(v) > 1 for v in twin.values()))
    r = reading(1, *data)
    print(len(r), "pairs in one reading:", {k: sum(x[2] == k for x in r) for k in ("SUPPORTS", "UNRELATED")})
    for p, h, l in random.Random(5).sample(r, 12):
        print(f"\n[{l}]\n  P: {p[:200]}\n  H: {h[:200]}")
