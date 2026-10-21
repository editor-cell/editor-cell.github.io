"""Collects paragraphs from the owner's kind of sources (public institutions) for training examples.
For each source it reads a feed or a news page, opens up to PER_SOURCE documents on the same site
(robots.txt respected), and keeps the prose paragraphs of each: 200 to 1500 characters, whole
sentences. Writes research-app/train/corpus.jsonl, one paragraph per line with its document's
address, title and the paragraphs before and after it."""
import json
import re
import sys
import time
import urllib.robotparser
from urllib.parse import urljoin, urlparse

import requests
import trafilatura
from bs4 import BeautifulSoup

PER_SOURCE = 25
UA = "OrbisResearchTrial/0.1 (+https://orbisreadingatlas.com)"

# A feed first where one is known, then the site's own news page: whichever gives documents.
SOURCES = {
    "BIS": ["https://www.bis.org/doclist/cbspeeches.rss", "https://www.bis.org/doclist/all_pressrels.rss"],
    "ECB": ["https://www.ecb.europa.eu/rss/press.html", "https://www.ecb.europa.eu/press/pubbydate/html/index.en.html"],
    "Federal Reserve": ["https://www.federalreserve.gov/feeds/speeches.xml", "https://www.federalreserve.gov/feeds/press_all.xml"],
    "WHO": ["https://www.who.int/rss-feeds/news-english.xml", "https://www.who.int/news"],
    "IMF": ["https://www.imf.org/en/Blogs", "https://www.imf.org/en/News"],
    "World Bank": ["https://blogs.worldbank.org/en/rss", "https://www.worldbank.org/en/news/all"],
    "OECD": ["https://www.oecd.org/en/about/news.html"],
    "UN": ["https://news.un.org/feed/subscribe/en/news/all/rss.xml"],
    "UNICEF": ["https://www.unicef.org/press-releases"],
    "FAO": ["https://www.fao.org/newsroom/en/"],
    "ILO": ["https://www.ilo.org/resource/news"],
    "CDC": ["https://tools.cdc.gov/api/v2/resources/media/132608.rss", "https://www.cdc.gov/media/index.html"],
    "NIH": ["https://www.nih.gov/news-events/news-releases/feed.xml", "https://www.nih.gov/news-events/news-releases"],
    "EEA": ["https://www.eea.europa.eu/en/newsroom/news"],
    "ONS": ["https://www.ons.gov.uk/news/news"],
    "Eurostat": ["https://ec.europa.eu/eurostat/web/main/news/euro-indicators"],
}

session = requests.Session()
session.headers["User-Agent"] = UA
robots = {}


def allowed(url):
    host = urlparse(url).scheme + "://" + urlparse(url).netloc
    if host not in robots:
        rp = urllib.robotparser.RobotFileParser()
        try:
            r = session.get(host + "/robots.txt", timeout=20)
            rp.parse(r.text.splitlines() if r.ok else [])
        except Exception:
            rp.parse([])
        robots[host] = rp
    return robots[host].can_fetch(UA, url)


def get(url):
    if not allowed(url):
        return None
    try:
        r = session.get(url, timeout=30)
        time.sleep(1)
        return r if r.ok else None
    except Exception:
        return None


def links(start):
    r = get(start)
    if r is None:
        return []
    site = urlparse(start).netloc.split(".", 1)[-1]
    text = r.text
    if "<rss" in text[:500] or "<feed" in text[:500] or "<rdf" in text[:500].lower():
        out = re.findall(r"<link>\s*([^<\s]+)\s*</link>", text) + re.findall(r'<link[^>]+href="([^"]+)"', text)
    else:
        soup = BeautifulSoup(text, "html.parser")
        out = [urljoin(start, a["href"]) for a in soup.select("a[href]")]
        out = [u for u in out if re.search(r"/(news|speech|speeches|press|blogs?|stories|newsroom|releases?)/", u.lower())]
    keep = []
    for u in out:
        u = u.split("#")[0]
        if site in urlparse(u).netloc and u.rstrip("/") != start.rstrip("/") and u not in keep \
                and not re.search(r"\.(pdf|jpg|png|mp4|xml|rss)$|/(tag|topic|category|search)/", u.lower()):
            keep.append(u)
    return keep


def paragraphs(html):
    text = trafilatura.extract(html, include_comments=False, include_tables=False, favor_precision=True) or ""
    paras = [re.sub(r"\s+", " ", p).strip() for p in text.split("\n")]
    return [p for p in paras if p]


def prose(p):
    return 200 <= len(p) <= 1500 and p[-1] in ".!?\"”)" and p[0].isupper() and len(re.findall(r"[.!?](\s|$)", p)) >= 1


rows, seen = [], set()
for name, starts in SOURCES.items():
    docs = []
    for s in starts:
        docs += [u for u in links(s) if u not in docs]
        if len(docs) >= PER_SOURCE:
            break
    got = 0
    for url in docs[:PER_SOURCE]:
        r = get(url)
        if r is None or "html" not in r.headers.get("content-type", ""):
            continue
        title = (BeautifulSoup(r.text, "html.parser").title or BeautifulSoup("<t></t>", "html.parser")).get_text(" ", strip=True)[:200]
        ps = paragraphs(r.text)
        for i, p in enumerate(ps):
            if not prose(p) or p in seen:
                continue
            seen.add(p)
            rows.append({"source": name, "url": url, "title": title, "text": p,
                         "before": ps[i - 1] if i > 0 else "", "after": ps[i + 1] if i + 1 < len(ps) else ""})
            got += 1
    print(f"{name}: {len(docs)} documents found, {got} paragraphs kept", flush=True)

out = __file__.replace("collect.py", "corpus.jsonl")
with open(out, "w", encoding="utf-8") as f:
    for row in rows:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
print(f"TOTAL {len(rows)} paragraphs")
sys.exit(0 if rows else 1)
