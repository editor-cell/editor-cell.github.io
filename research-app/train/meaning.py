"""Form against meaning (cümlede yapı ve anlam) for the NLI model.

A sentence can be positive in form and positive in meaning ("Exports rose"), positive in form and
negative in meaning ("Exports failed to rise"), negative in form and negative in meaning ("Exports
did not rise") or negative in form and positive in meaning ("It cannot be said that exports did not
rise"). Each premise states one fact in one of the four shapes; each claim states a fact in one of
the four shapes (English and Turkish). The label follows from the meanings alone, worked out by rule:

  premise rose          -> rose: SUPPORTS, did not rise: CONTRADICTS, fell: CONTRADICTS, did not fall: SUPPORTS
  premise did not rise  -> rose: CONTRADICTS, did not rise: SUPPORTS, fell / did not fall: UNRELATED (could be flat)
  "more than doubled"   -> after rose: UNRELATED, after anything that rules out a rise: CONTRADICTS
  premise "more than doubled" -> every claim that follows from a rise is SUPPORTED (a strong text
                         carries a weaker claim; a weak text does not carry a stronger one)

Writes labels/meaning.jsonl. Usage: meaning.py [count]"""
import json
import os
import random
import sys

random.seed(31)
COUNT = int(sys.argv[1]) if len(sys.argv) > 1 else 300

SUBJECTS = [  # English, Turkish
    ("exports", "ihracat"), ("unemployment", "işsizlik"), ("inflation", "enflasyon"),
    ("emissions", "emisyonlar"), ("real wages", "reel ücretler"), ("house prices", "konut fiyatları"),
    ("business investment", "şirket yatırımları"), ("school attendance", "okula devam oranı"),
    ("road deaths", "trafik ölümleri"), ("tourist arrivals", "turist sayısı"),
    ("bank lending", "banka kredileri"), ("food prices", "gıda fiyatları"),
    ("hospital admissions", "hastaneye yatışlar"), ("household savings", "hane tasarrufları"),
    ("youth employment", "genç istihdamı"), ("rents", "kiralar"),
]
EVENTS = [
    ("after the rate rise", "faiz artışından sonra"), ("after the tax reform", "vergi reformundan sonra"),
    ("after the new law", "yeni yasadan sonra"), ("in 2024", "2024'te"),
    ("after the subsidy was cut", "sübvansiyon kesildikten sonra"), ("during the drought", "kuraklık döneminde"),
    ("after the minimum wage increase", "asgari ücret artışından sonra"), ("after the trade deal", "ticaret anlaşmasından sonra"),
]
EN_VERB = {"up": ("rise", "rose"), "down": ("fall", "fell")}
TR_VERB = {"up": ("yükseldi", "yükselmedi", "yükselmek"), "down": ("geriledi", "gerilemedi", "gerilemek")}


def cap(s):
    return s[0].upper() + s[1:]


# A meaning is (direction, happened). A shape is how it is said:
# PP positive form, positive meaning; PN positive form, negative meaning;
# NN negative form, negative meaning; NP negative form, positive meaning.
def premise_en(s, e, d, happened, shape):
    base, past = EN_VERB[d]
    if happened:
        if shape == "PP":
            return random.choice([f"{cap(s)} {past} {e}.", f"{cap(s)} {past} markedly {e}, the statistics office reported."])
        return random.choice([  # NP
            f"It cannot be said that {s} did not {base} {e}.",
            f"No one disputes that {s} {past} {e}; the debate is about why.",
            f"It is not true that {s} failed to {base} {e}.",
            f"{cap(s)} did not fail to {base} {e}.",
        ])
    if shape == "NN":
        return random.choice([f"{cap(s)} did not {base} {e}.", f"{cap(s)} did not {base} {e}, the statistics office reported."])
    return random.choice([  # PN
        f"{cap(s)} failed to {base} {e}.",
        f"Hopes that {s} would {base} {e} came to nothing.",
        f"Forecasts that {s} would {base} {e} proved wrong.",
        f"{cap(s)} fell short of any {'increase' if d == 'up' else 'decline'} {e}.",
    ])


def claim(s, st, e, et, d, happened, shape):
    base, past = EN_VERB[d]
    yes, no, inf = TR_VERB[d]
    if happened and shape == "PP":
        return f"{cap(s)} {past} {e}.", f"{cap(et)} {st} {yes}."
    if happened:  # NP
        return f"It cannot be said that {s} did not {base} {e}.", f"{cap(et)} {st} {no} demek doğru olmaz."
    if shape == "NN":
        return f"{cap(s)} did not {base} {e}.", f"{cap(et)} {st} {no}."
    return f"{cap(s)} failed to {base} {e}.", f"{cap(et)} {st} {inf[:-3]}mekte başarısız kaldı." if inf.endswith("mek") else ""


def label(pd, ph, cd, ch):
    if pd == cd:
        return "SUPPORTS" if ph == ch else "CONTRADICTS"
    if ph:  # the premise says it moved one way: the other way is ruled out, not moving that way is implied
        return "CONTRADICTS" if ch else "SUPPORTS"
    return "UNRELATED"  # it did not move one way: it may have moved the other way or stayed flat


rows = []
pid = 30000
count = {"SUPPORTS": 0, "CONTRADICTS": 0, "UNRELATED": 0}
for _ in range(COUNT):
    (s, st), (e, et) = random.choice(SUBJECTS), random.choice(EVENTS)
    pd, ph = random.choice(["up", "down"]), random.random() < 0.5
    pshape = random.choice(["PP", "NP"] if ph else ["NN", "PN"])
    premise = premise_en(s, e, pd, ph, pshape)
    strong = ph and pd == "up" and random.random() < 0.3
    if strong:  # the premise says more than a plain rise: every weaker claim follows from it
        pshape = "PP2"
        premise = f"{cap(s)} more than doubled {e}."
    options = [(cd, ch, sh) for cd in ("up", "down") for ch in (True, False)
               for sh in (["PP", "NP"] if ch else ["NN", "PN"])]
    random.shuffle(options)
    picked = options[:4]
    out = []
    for cd, ch, sh in picked:
        en, tr = claim(s, st, e, et, cd, ch, sh)
        out.append((en, tr, label(pd, ph, cd, ch), sh))
    if strong:
        out.append((f"{cap(s)} rose {e}.", f"{cap(et)} {st} yükseldi.", "SUPPORTS", "PP"))
    elif random.random() < 0.4:  # a claim that says more than the premise
        lab = "UNRELATED" if (pd == "up" and ph) else "CONTRADICTS" if (pd == "down" and ph) or (pd == "up" and not ph) else "UNRELATED"
        out.append((f"{cap(s)} more than doubled {e}.", f"{cap(et)} {st} iki katından fazla arttı.", lab, "PP"))
    for en, tr, lab, sh in out:
        rows.append({"id": pid, "kind": "meaning", "premise": premise, "form": pshape + ">" + sh,
                     "en": en, "tr": tr, "label": lab})
        count[lab] += 1
    pid += 1

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "labels", "meaning.jsonl")
with open(out, "w", encoding="utf-8") as f:
    for r in rows:
        f.write(json.dumps(r, ensure_ascii=False) + "\n")
print(f"{COUNT} premises, {len(rows)} claims: {count}")
