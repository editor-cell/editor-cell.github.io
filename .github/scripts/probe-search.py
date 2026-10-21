"""For each site: does it offer a search the app could use without a browser? Prints one line per site."""
import re, sys, urllib.parse, urllib.request

SITES = sys.argv[1:] or [
    "www.who.int", "www.oecd.org", "www.worldbank.org", "ec.europa.eu", "www.un.org", "www.imf.org",
    "www.cdc.gov", "www.nih.gov", "www.eea.europa.eu", "www.ons.gov.uk", "www.bls.gov", "www.tuik.gov.tr",
    "www.healthdata.org", "data.worldbank.org", "www.unicef.org", "www.fao.org", "www.ilo.org",
]
QUERY = "sugar tax"
UA = {"User-Agent": "Mozilla/5.0 (Linux; Android) OrbisResearch/0.1", "Accept": "text/html,application/xml;q=0.9,*/*;q=0.5"}

def get(url, limit=1_500_000):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.geturl(), r.headers.get("Content-Type", ""), r.read(limit).decode("utf-8", "replace")

def links(html, base):
    out = []
    for h in re.findall(r'href="([^"#]+)"', html):
        u = urllib.parse.urljoin(base, h)
        if u.startswith("http") and urllib.parse.urlparse(u).netloc.endswith(urllib.parse.urlparse(base).netloc.removeprefix("www.")):
            out.append(u)
    return sorted(set(out))

def result_like(html, base):
    """Links that look like documents (not menus): long paths and mentioning the query words."""
    docs = [u for u in links(html, base) if len(urllib.parse.urlparse(u).path) > 12 and not re.search(r"\.(css|js|png|jpg|svg)$|/search", u)]
    hits = [u for u in docs if re.search(r"sugar|tax|beverage|drink", urllib.parse.unquote(u), re.I)]
    return docs, hits

for site in SITES:
    home = f"https://{site}/"
    note = []
    try:
        final, ctype, html = get(home)
    except Exception as e:
        print(f"{site:24} HOME FAILED {type(e).__name__}: {str(e)[:60]}"); continue
    templates = []
    m = re.search(r'<link[^>]+rel="search"[^>]+href="([^"]+)"', html) or re.search(r'<link[^>]+href="([^"]+)"[^>]+rel="search"', html)
    if m:
        try:
            _, _, xml = get(urllib.parse.urljoin(final, m.group(1)))
            t = re.search(r'template="([^"]+)"', xml.replace("&amp;", "&"))
            if t: templates.append(("opensearch", t.group(1).replace("{searchTerms}", urllib.parse.quote(QUERY))))
        except Exception as e:
            note.append(f"opensearch-failed:{type(e).__name__}")
    for pat in ("/search?q={q}", "/search?query={q}", "/search/?q={q}", "/?s={q}", "/site-search?q={q}", "/en/search?q={q}"):
        templates.append(("guess", urllib.parse.urljoin(final, pat.format(q=urllib.parse.quote(QUERY)))))
    best = None
    for kind, url in templates:
        try:
            f2, c2, body = get(url)
        except Exception:
            continue
        if "html" not in c2.lower() and "xml" not in c2.lower():
            continue
        docs, hits = result_like(body, f2)
        shell = len(re.sub(r"<[^>]+>", "", body)) < 1500 or bool(re.search(r"enable javascript|__NEXT_DATA__|id=\"root\"></div>", body, re.I) and not hits)
        score = len(hits) * 3 + min(len(docs), 20)
        if best is None or score > best[0]:
            best = (score, kind, url, len(docs), len(hits), shell)
    if best and best[4] > 0:
        print(f"{site:24} OK   {best[1]:10} docs={best[3]:3} relevant={best[4]:2}  {best[2][:90]}")
    elif best:
        print(f"{site:24} WEAK {best[1]:10} docs={best[3]:3} relevant=0 jsShell={best[5]}  {best[2][:80]} {' '.join(note)}")
    else:
        print(f"{site:24} NONE no search page found {' '.join(note)}")
