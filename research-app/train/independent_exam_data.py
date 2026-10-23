"""Read published five-choice questions; never generate questions or answer labels.

Question text stays in the private Kaggle dataset. This repository contains only
the extractor and source/question identifiers. No training code imports this file.
"""
import collections
import hashlib
import html
import json
import pathlib
import re
import time
import unicodedata
import urllib.request

SOURCES = {
    "2023-tyt": "https://dokuman.osym.gov.tr/pdfdokuman/2023/YKS/TSK/yks_tyt_2023_kitapcik_T23ky.pdf",
    "2024-tyt": "https://dokuman.osym.gov.tr/pdfdokuman/2024/YKS/TSK/yks_tyt_2024_kitapcik_T24kt.pdf",
    "2022-ydt": "https://dokuman.osym.gov.tr/pdfdokuman/2022/YKS/TSK/yks_2022_ydt_ingilizce.pdf",
    "2023-ydt": "https://dokuman.osym.gov.tr/pdfdokuman/2023/YKS/TSK/yks_ydt_ing_2023_kitapcik_Sp72a.pdf",
    "2024-ydt": "https://dokuman.osym.gov.tr/pdfdokuman/2024/YKS/TSK/yks_ydt_ing_2024_kitapcik_Sp865a.pdf",
    "lsac-lr": "https://www.lsac.org/lsat/taking-lsat/test-format/logical-reasoning/logical-reasoning-sample-questions",
}


def clean(text):
    return " ".join(unicodedata.normalize("NFKC", text).split())


def download(url, target):
    target = pathlib.Path(target)
    if target.exists():
        data = target.read_bytes()
        if target.suffix != ".pdf" or b"%%EOF" in data[-1024:]:
            return data
        target.unlink()
    for attempt in range(4):
        try:
            request_url = url if attempt == 0 else url + ("&" if "?" in url else "?") + f"orbis_exam_retry={attempt}"
            with urllib.request.urlopen(request_url, timeout=45) as response:
                data = response.read()
            if target.suffix == ".pdf" and b"%%EOF" not in data[-1024:]:
                raise ValueError("Truncated source PDF")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            return data
        except Exception:
            if attempt == 3:
                raise
            time.sleep(2 * (attempt + 1))


def lines_of(page):
    out = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            # Exclude the diagonal copyright watermark, header and footer.
            if line["dir"] != (1.0, 0.0):
                continue
            x, y, x1, y1 = line["bbox"]
            text = clean("".join(s["text"] for s in line["spans"]))
            if text and 75 < y < 750:
                out.append({"x": x, "y": y, "x1": x1, "y1": y1, "text": text})
    return out


def ordered(lines):
    return sorted(lines, key=lambda x: (round(x["y"] / 2), x["x"]))


def joined(lines):
    return clean(" ".join(x["text"] for x in ordered(lines)))


def markers(lines):
    return [x for x in lines if re.fullmatch(r"\d+\.", x["text"])
            and (40 < x["x"] < 59 or 315 < x["x"] < 334)]


def question_region(lines, marker):
    right = marker["x"] > 300
    later = [x["y"] for x in markers(lines)
             if (x["x"] > 300) == right and x["y"] > marker["y"] + 3]
    end = min(later + [750])
    return [x for x in lines if (x["x"] > 300) == right
            and x["x"] > (335 if right else 60)
            and marker["y"] - 1 <= x["y"] < end - 1]


def stem_options(region):
    anchors = sorted([x for x in region if re.fullmatch(r"[A-E]\)", x["text"])],
                     key=lambda x: x["text"])
    if [a["text"] for a in anchors] != [a + ")" for a in "ABCDE"]:
        raise ValueError("Five unambiguous option labels required")
    first_y = min(a["y"] for a in anchors)
    stem = ordered([x for x in region if x["y"] < first_y - 2])
    options = [[] for _ in anchors]
    for x in region:
        if x in anchors or x["y"] < first_y - 2:
            continue
        previous = [a["y"] for a in anchors if x["y"] >= a["y"] - 2]
        row_y = max(previous) if previous else -1000
        candidates = [j for j, a in enumerate(anchors)
                      if abs(a["y"] - row_y) < 2 and x["x"] >= a["x1"] - 1]
        if candidates:
            options[max(candidates)].append(x)
    result = [joined(o) for o in options]
    if not all(result) or len(set(result)) != 5:
        raise ValueError("Incomplete or duplicate options")
    return stem, result


def answer_key(document, kind):
    text = "\n".join(p.get_text() for p in list(document)[-2:])
    heading = "TÜRKÇE TESTİ" if kind == "tyt" else "İNGİLİZCE TESTİ"
    text = text[text.index(heading) + len(heading):]
    if kind == "tyt":
        text = text.split("SOSYAL BİLİMLER TESTİ")[0]
    pairs = re.findall(r"(?m)^\s*(\d+)\.\s*([A-E])\s*$", text)
    out = {}
    for n, a in pairs:
        n = int(n)
        if n in out and out[n] != a:
            raise ValueError("Ambiguous official answer key")
        out[n] = a
    if len(out) != (40 if kind == "tyt" else 80):
        raise ValueError(f"Incomplete official {kind} answer key: {len(out)}")
    return out


def pdf_questions(source, path):
    import fitz
    doc = fitz.open(path)
    kind = source.split("-")[1]
    key = answer_key(doc, kind)
    result = []
    for pi, page in enumerate(doc):
        if kind == "tyt" and pi > 14:
            break
        lines = lines_of(page)
        marks = markers(lines)
        if kind == "ydt":
            selected = [m for m in marks if 29 <= int(m["text"][:-1]) <= 43]
            if not selected:
                continue
            first = min(selected, key=lambda x: int(x["text"][:-1]))
            # All three questions on a reading page share the left-column passage.
            lead = [x for x in lines if 60 < x["x"] < 300 and x["y"] < first["y"] - 1]
            # Directions use x=71, while the passage starts at x=61.
            lead = [x for x in lead if x["x"] < 65]
            passage = joined(lead)
            if len(passage) < 400:
                raise ValueError(f"Missing shared reading passage: {source}/{pi + 1}")
        else:
            selected = [m for m in marks if 18 <= int(m["text"][:-1]) <= 40]
        for marker in selected:
            num = int(marker["text"][:-1])
            stem, options = stem_options(question_region(lines, marker))
            if kind == "tyt":
                gaps = [i for i in range(1, len(stem)) if stem[i]["y"] - stem[i - 1]["y1"] > 4]
                if not gaps:
                    # Questions 35-40 use a passage shared by two questions.
                    headings = [x for x in lines if re.match(r"\d+\.?\s*-\s*\d+\.?.*soruları", x["text"])]
                    headings = [x for x in headings if (lambda ns: int(ns[0]) <= num <= int(ns[1]))(re.findall(r"\d+", x["text"])[:2])]
                    if len(headings) != 1:
                        raise ValueError(f"Cannot separate original passage/question: {source}/{num}")
                    heading = headings[0]
                    right = heading["x"] > 300
                    first_number = int(re.findall(r"\d+", heading["text"])[0])
                    first_marker = next(x for x in marks if x["text"] == str(first_number) + ".")
                    lead = [x for x in lines if (x["x"] > 300) == right
                            and x["x"] > (335 if right else 60) and x["y"] < first_marker["y"] - 1]
                    endings = [x["y1"] for x in lead if "cevaplayınız" in x["text"]]
                    if len(endings) != 1:
                        raise ValueError("Missing shared-passage directions")
                    passage, question = joined([x for x in lead if x["y"] > endings[0]]), joined(stem)
                else:
                    cut = gaps[-1]
                    passage, question = joined(stem[:cut]), joined(stem[cut:])
            else:
                question = joined(stem)
            if len(passage) < 100 or not question.endswith(("?", ".", ":", "----.")):
                raise ValueError(f"Check original stem: {source}/{num}: {question}")
            result.append({"id": f"{source}-{num}", "group": "Turkish reading" if kind == "tyt" else "English reading",
                           "passage": passage, "question": question, "options": options, "answer": key[num],
                           "source": SOURCES[source], "page": pi + 1, "source_question": num})
    expected = 23 if kind == "tyt" else 15
    if len(result) != expected or len({r["id"] for r in result}) != expected:
        raise ValueError(f"Expected {expected} {source} questions; got {len(result)}")
    return sorted(result, key=lambda q: q["source_question"])


def strip_tags(text):
    return clean(html.unescape(re.sub(r"<[^>]+>", " ", text)))


def lsac_questions(text):
    parts = re.split(r"<h2>Question (\d+)</h2>", text)
    out = []
    for n, part in zip(parts[1::2], parts[2::2]):
        before, expl = re.split(r"<h2[^>]*>Explanation for Question \d+</h2>", part, maxsplit=1)
        ps = [strip_tags(p) for p in re.findall(r"<p[^>]*>(.*?)</p>", before, re.S)]
        ps = [p for p in ps if p]
        options = [strip_tags(p) for p in re.findall(r"<li[^>]*>(.*?)</li>", before, re.S)]
        explanation = strip_tags(expl)
        # Read the examiner's explicit answer declaration, never solve the item.
        patterns = [r"correct (?:response|answer)[^.]{0,60}?\(([A-E])\)",
                    r"\(([A-E])\)[^.]{0,60}?(?:correct (?:response|answer))",
                    r"Response \(([A-E])\) is correct\."]
        answers = {m for pattern in patterns for m in re.findall(pattern, explanation, re.I)}
        if len(options) != 5 or len(answers) != 1 or len(ps) < 2:
            raise ValueError(f"Cannot read original LSAC item {n}")
        out.append({"id": f"lsac-lr-{n}", "group": "Logical reasoning", "passage": " ".join(ps[:-1]),
                    "question": ps[-1], "options": options, "answer": answers.pop(),
                    "source": SOURCES["lsac-lr"], "source_question": int(n)})
    if len(out) != 10:
        raise ValueError("Expected ten official LSAC examples")
    return out


def normal_words(text):
    return re.findall(r"\w+", unicodedata.normalize("NFKD", clean(text)).casefold())


def overlap_audit(questions, prior_texts):
    """Conservative lexical screen; cannot rule out pretraining or translated overlap.

    Exclude a whole candidate passage if 12 consecutive words or at least 60% of
    its five-word shingles occur in a prior paragraph/stem. Short shared boilerplate
    alone cannot remove an item. The report lists IDs, not copyrighted text.
    """
    signatures = {}
    lookup = collections.defaultdict(set)
    for q in questions:
        words = normal_words(q["passage"])
        grams = {tuple(words[i:i+5]) for i in range(len(words)-4)}
        signatures[q["id"]] = (words, grams)
        for gram in grams:
            lookup[gram].add(q["id"])
    hits = {}
    count = 0
    for text in prior_texts:
        words = normal_words(text)
        if len(words) < 12:
            continue
        count += 1
        grams = {tuple(words[i:i+5]) for i in range(len(words)-4)}
        possible = set().union(*(lookup[g] for g in grams if g in lookup))
        for qid in possible:
            qw, qg = signatures[qid]
            common = qg & grams
            if len(common) < 8:
                continue
            run = any(all(tuple(qw[i+j:i+j+5]) in grams for j in range(8)) for i in range(len(qw)-11))
            if run or len(common) / max(1, len(qg)) >= 0.6:
                hits[qid] = {"reason": "prior passage/stem overlap", "five_word_coverage": round(len(common) / len(qg), 3)}
    return [q for q in questions if q["id"] not in hits], {"prior_texts_checked": count, "excluded": hits,
             "limits": "Lexical screening only; pretraining and translated paraphrases cannot be ruled out."}


def build(sources_dir):
    root = pathlib.Path(sources_dir)
    rows, hashes = [], {}
    for source, url in SOURCES.items():
        path = root / (source + (".html" if source == "lsac-lr" else ".pdf"))
        data = download(url, path)
        hashes[source] = hashlib.sha256(data).hexdigest()
        rows += lsac_questions(data.decode("utf-8")) if source == "lsac-lr" else pdf_questions(source, path)
    # Leave out the sentence-position item with bare Roman-numeral options.
    rows = [q for q in rows if q["id"] != "2023-tyt-18"]
    if len(rows) != 100:
        raise ValueError("The fixed source selection must contain 100 questions before overlap exclusions")
    return rows, hashes


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--sources", default="exam-source-cache")
    parser.add_argument("--output", default="exam-candidates.json")
    args = parser.parse_args()
    rows, hashes = build(args.sources)
    pathlib.Path(args.output).write_text(json.dumps({"questions": rows, "source_hashes": hashes}, ensure_ascii=False, indent=2))
    print(json.dumps({"candidates": len(rows), "groups": dict(collections.Counter(q["group"] for q in rows)), "source_hashes": hashes}))
