"""Word problems (havuz, hız, işçi, yaş, yüzde, karışım, tren) for the NLI model: practice in reading a
text closely enough to set up the equation it implies, not in writing the answer.

The model cannot write an equation; it can only say whether a statement follows from a text. So each
problem is a short text, and the statements about it are:
  SUPPORTS     the right result, in more than one form (2 hours 24 minutes = 144 minutes), or a fact
               the text settles without a number (the faster pipe lets more water through an hour)
  CONTRADICTS  the result of a typical mistake (adding or averaging the times, averaging speeds,
               meeting at the midpoint, a price that returns to where it was), or the reverse fact
  UNRELATED    something the text does not settle (a clock time when no start time is given, the
               pool's volume, who left the drain open)
Every answer is computed exactly (fractions), so the labels are not judged. The premise is English
(as the paragraphs are), the statement English and Turkish; a third of the problems also come with a
Turkish premise (Turkish statement only), under the same id.
Ten levels, from easy to hard (Yavuz's plan, 22 Oct 2026): 1 restating what the text says; 2 one
operation; 3 one step with a whole result; 4 the same in hours and minutes; 5 two pipes or two people
working together; 6 a tap and an open drain; 7 catching up, the average speed of a round trip, a train
on a bridge; 8 age ratios, a rise and a cut in price, mixtures; 9 several stages (a worker who joins
later, a clock time, a total time from a distance); 10 levels 5-9 with sentences and numbers that do
not matter. Every row carries its "level"; train_nli.py goes through the levels in order first.
Held out: in every level, problems written in a type's last wording, and only with numbers no
training problem of that level uses. Such rows carry "dev": true; train_nli.py scores them on their
own, level by level, and never trains on them.
Writes labels/problems.jsonl. Usage: problems.py [training problems] [held-out problems]"""
import collections
import json
import os
import random
import sys
from fractions import Fraction as F

N_TRAIN = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
N_DEV = int(sys.argv[2]) if len(sys.argv) > 2 else 200
rnd = random.Random(31)

NAMES = ["Ali", "Ayşe", "Mehmet", "Zeynep", "Can", "Elif", "Murat", "Selin"]
GEN = {"Ali": "Ali'nin", "Ayşe": "Ayşe'nin", "Mehmet": "Mehmet'in", "Zeynep": "Zeynep'in", "Can": "Can'ın",
       "Elif": "Elif'in", "Murat": "Murat'ın", "Selin": "Selin'in"}
ABL = {"Ali": "Ali'den", "Ayşe": "Ayşe'den", "Mehmet": "Mehmet'ten", "Zeynep": "Zeynep'ten", "Can": "Can'dan",
       "Elif": "Elif'ten", "Murat": "Murat'tan", "Selin": "Selin'den"}


# ---- how numbers are written ------------------------------------------------------------------

def whole(x):
    return F(x).denominator == 1


def minutes_ok(h):
    return whole(F(h) * 60)


def dur_en(h):
    m = int(F(h) * 60)
    hh, mm = divmod(m, 60)
    parts = []
    if hh:
        parts.append(f"{hh} hour" + ("s" if hh > 1 else ""))
    if mm:
        parts.append(f"{mm} minute" + ("s" if mm > 1 else ""))
    return " and ".join(parts)


def dur_tr(h):
    m = int(F(h) * 60)
    hh, mm = divmod(m, 60)
    return " ".join(p for p in (f"{hh} saat" if hh else "", f"{mm} dakika" if mm else "") if p)


def num(x):
    x = F(x)
    if whole(x):
        return str(int(x))
    if whole(x * 10):
        return f"{float(x):.1f}"
    if whole(x * 100):
        return f"{float(x):.2f}"
    return None


def num_tr(x):
    s = num(x)
    return s.replace(".", ",") if s else None


def clock(start_min, h):
    t = start_min + int(F(h) * 60)
    if t >= 24 * 60:
        return None
    return f"{t // 60}:{t % 60:02d}"


# ---- the problems ------------------------------------------------------------------------------
# Each maker takes (wording, numbers) and returns (premise_en, premise_tr, claims, numbers key) or None.
# claims: list of (en, tr, label). Each type lists its wordings; the last is kept for the held-out set.

def two_pipes(w, nums):
    a, b = nums
    t = F(a * b, a + b)
    if not minutes_ok(t) or a == b:
        return None
    noun, noun_tr, gen_tr = rnd.choice([("pool", "havuz", "havuzun"), ("tank", "depo", "deponun")])
    Noun, Noun_tr = noun.capitalize(), noun_tr.capitalize()
    pe = [f"Pipe A fills an empty {noun} in {a} hours. Pipe B fills the same {noun} in {b} hours. "
          f"Both pipes are opened together on the empty {noun}.",
          f"On its own, pipe A fills an empty {noun} in {a} hours, and pipe B does it in {b} hours. "
          f"The two pipes are turned on at the same time.",
          f"An empty {noun} can be filled by pipe A alone in {a} hours, while pipe B alone would need "
          f"{b} hours. The two are switched on together."][w]
    pt = [f"A musluğu boş bir {noun_tr}u {a} saatte dolduruyor. B musluğu aynı {noun_tr}u {b} saatte dolduruyor. "
          f"Boş {noun_tr}da iki musluk birlikte açılıyor.",
          f"A musluğu boş bir {noun_tr}u tek başına {a} saatte, B musluğu ise {b} saatte dolduruyor. "
          f"İki musluk aynı anda açılıyor.",
          f"Boş bir {noun_tr}u A musluğu tek başına {a} saatte doldurabiliyor; B musluğunun ise tek başına "
          f"{b} saate ihtiyacı var. İkisi birlikte açılıyor."][w]
    if noun_tr == "depo":
        pt = pt.replace("depou", "depoyu").replace("depoda", "depoda")
    start = None
    if rnd.random() < 0.4:
        start = rnd.choice(range(7 * 60, 15 * 60, 30))
        st = f"{start // 60}:{start % 60:02d}"
        pe += f" They are opened at {st}."
        pt += f" Musluklar açıldığında saat {st}."
    c = [(f"Filling the {noun} takes {dur_en(t)}.", f"{gen_tr.capitalize()} dolması {dur_tr(t)} sürer.", "SUPPORTS"),
         (f"The {noun} is full after {int(t * 60)} minutes.", f"{Noun_tr} {int(t * 60)} dakikada dolar.", "SUPPORTS"),
         (f"Filling the {noun} takes less time than pipe A would need on its own.",
          f"{Noun_tr}, A musluğunun tek başına harcayacağı süreden daha kısa sürede dolar.", "SUPPORTS"),
         (f"Filling the {noun} takes longer than pipe A would need on its own.",
          f"{Noun_tr}, A musluğunun tek başına harcayacağı süreden daha uzun sürede dolar.", "CONTRADICTS")]
    fast, slow = ("A", "B") if a < b else ("B", "A")
    c += [(f"More water flows from pipe {fast} each hour than from pipe {slow}.",
           f"{fast} musluğundan her saat {slow} musluğundan daha fazla su akar.", "SUPPORTS"),
          (f"More water flows from pipe {slow} each hour than from pipe {fast}.",
           f"{slow} musluğundan her saat {fast} musluğundan daha fazla su akar.", "CONTRADICTS")]
    for wrong in {F(a + b), F(a + b, 2), F(abs(a - b))}:
        if wrong != t and minutes_ok(wrong) and wrong > 0:
            c.append((f"Filling the {noun} takes {dur_en(wrong)}.", f"{gen_tr.capitalize()} dolması {dur_tr(wrong)} sürer.", "CONTRADICTS"))
    vol = rnd.choice([20, 40, 60, 80, 120, 150])
    c.append((f"The {noun} holds {vol} cubic meters of water.", f"{Noun_tr} {vol} metreküp su alıyor.", "UNRELATED"))
    c.append((f"Pipe A is newer than pipe B.", f"A musluğu B musluğundan daha yeni.", "UNRELATED"))
    end = rnd.choice(range(9, 20))
    if start is None:
        c.append((f"The {noun} is full before {end}:00.", f"{Noun_tr} dolduğunda saat henüz {end}:00 olmamıştır.", "UNRELATED"))
    else:
        right, bad = clock(start, t), clock(start, F(a + b, 2))
        if right:
            c.append((f"The {noun} is full at {right}.", f"{Noun_tr} dolduğunda saat {right} olur.", "SUPPORTS"))
        if bad and bad != right:
            c.append((f"The {noun} is full at {bad}.", f"{Noun_tr} dolduğunda saat {bad} olur.", "CONTRADICTS"))
    return pe, pt, c, ("pipes", a, b)


def fill_drain(w, nums):
    a, b = nums  # the tap fills in a hours, the drain empties in b hours
    if a == b:
        return None
    noun, noun_tr = rnd.choice([("pool", "havuz"), ("tank", "depo")])
    acc_tr = "havuzu" if noun_tr == "havuz" else "depoyu"
    gen_tr = "havuzun" if noun_tr == "havuz" else "deponun"
    Noun_tr = noun_tr.capitalize()
    vol = rnd.choice([30, 50, 90, 200])
    pe = [f"A tap fills an empty {noun} in {a} hours. The drain at the bottom empties a full {noun} in {b} hours. "
          f"The tap is turned on while the drain is accidentally left open.",
          f"With the drain closed, a tap would fill the empty {noun} in {a} hours; with the tap off, the open "
          f"drain would empty a full {noun} in {b} hours. Someone turns the tap on and forgets to close the drain.",
          f"Water enters an empty {noun} from a tap that alone would fill it in {a} hours. At the same time water "
          f"leaves through an open drain that alone would empty the full {noun} in {b} hours."][w]
    pt = [f"Bir musluk boş bir {acc_tr} {a} saatte dolduruyor. Dipteki gider, dolu {acc_tr} {b} saatte boşaltıyor. "
          f"Gider yanlışlıkla açık unutulmuşken musluk açılıyor.",
          f"Gider kapalıyken bir musluk boş {acc_tr} {a} saatte doldururdu; musluk kapalıyken açık gider dolu "
          f"{acc_tr} {b} saatte boşaltırdı. Biri musluğu açıyor ve gideri kapatmayı unutuyor.",
          f"Boş bir {noun_tr}a, tek başına {a} saatte dolduracak bir musluktan su giriyor. Aynı anda, dolu "
          f"{acc_tr} tek başına {b} saatte boşaltacak açık bir giderden su çıkıyor."][w]
    if noun_tr == "depo":
        pt = pt.replace("depoa", "depoya")
    c = [(f"The {noun} would fill faster with the drain closed.", f"Gider kapalı olsaydı {noun_tr} daha çabuk dolardı.", "SUPPORTS"),
         (f"The drain was left open by the {noun} attendant.", f"Gideri {gen_tr} görevlisi açık unutmuş.", "UNRELATED"),
         (f"The {noun} holds {vol} cubic meters of water.", f"{Noun_tr} {vol} metreküp su alıyor.", "UNRELATED")]
    if b > a:
        t = F(a * b, b - a)
        if not minutes_ok(t):
            return None
        c += [(f"Filling the {noun} takes {dur_en(t)}.", f"{gen_tr.capitalize()} dolması {dur_tr(t)} sürer.", "SUPPORTS"),
              (f"The {noun} never fills.", f"{Noun_tr} hiç dolmaz.", "CONTRADICTS"),
              (f"Filling the {noun} takes longer than {a} hours.", f"{gen_tr.capitalize()} dolması {a} saatten uzun sürer.", "SUPPORTS")]
        for wrong in {F(b - a), F(a * b, a + b), F(a + b, 2), F(a)}:
            if wrong != t and minutes_ok(wrong):
                c.append((f"Filling the {noun} takes {dur_en(wrong)}.", f"{gen_tr.capitalize()} dolması {dur_tr(wrong)} sürer.", "CONTRADICTS"))
    else:
        c += [(f"The {noun} never fills.", f"{Noun_tr} hiç dolmaz.", "SUPPORTS"),
              (f"The {noun} fills, only more slowly than with the drain closed.",
               f"{Noun_tr} dolar, yalnızca gider kapalıyken olduğundan daha yavaş.", "CONTRADICTS")]
        for wrong in {F(a * b, a - b), F(a - b), F(a + b, 2)}:
            if minutes_ok(wrong):
                c.append((f"Filling the {noun} takes {dur_en(wrong)}.", f"{gen_tr.capitalize()} dolması {dur_tr(wrong)} sürer.", "CONTRADICTS"))
    return pe, pt, c, ("drain", a, b)


def workers(w, nums):
    a, b, k = nums  # x alone a days, y alone b days, x alone for k days first
    if k >= a or a == b:
        return None
    rest = (1 - F(k, a)) * F(a * b, a + b)
    if not whole(rest) or rest == 0:
        return None
    total = k + rest
    x, y = rnd.sample(NAMES, 2)
    kd = "1 day" if k == 1 else f"{k} days"
    job_en, job_tr = rnd.choice([("paint a fence", "bir çiti boyayabiliyor"), ("tile a floor", "bir zemini döşeyebiliyor"),
                                 ("build a wall", "bir duvarı örebiliyor")])
    pe = [f"{x} can {job_en} alone in {a} days; {y} can do it alone in {b} days. {x} works alone for {kd}, "
          f"then {y} joins in and they finish the job together.",
          f"Working alone, {x} would need {a} days to {job_en} and {y} would need {b} days. {x} starts alone; "
          f"after {kd} {y} joins, and the two work together until the job is done.",
          f"{x} starts to {job_en}, a job {x} could finish alone in {a} days. {y}, who alone would take {b} days "
          f"for the same job, joins after {kd}, and from then on they work side by side to the end."][w]
    pt = [f"{x} tek başına {job_tr.split()[0]} {job_tr.split()[1]} {a} günde {job_tr.split()[2]}; {y} ise {b} günde. "
          f"{x} {k} gün tek başına çalışıyor, sonra {y} ona katılıyor ve işi birlikte bitiriyorlar.",
          f"Tek başına çalışsa {x} bu iş için {a} güne, {y} ise {b} güne ihtiyaç duyardı. İşe {x} tek başına "
          f"başlıyor; {k} gün sonra {y} katılıyor ve iş bitene kadar ikisi birlikte çalışıyor.",
          f"{x}, tek başına {a} günde bitirebileceği bir işe başlıyor. Aynı işi tek başına {b} günde bitirecek olan "
          f"{y}, {k} gün sonra katılıyor ve o andan itibaren işin sonuna kadar birlikte çalışıyorlar."][w]
    c = [(f"The whole job takes {total} days.", f"İşin tamamı {total} gün sürer.", "SUPPORTS"),
         (f"{y} works on the job for {rest} days.", f"{y} bu işte {rest} gün çalışır.", "SUPPORTS"),
         (f"{x} works on the job for {total} days.", f"{x} bu işte {total} gün çalışır.", "SUPPORTS"),
         (f"{y} works on the job for {total} days.", f"{y} bu işte {total} gün çalışır.", "CONTRADICTS"),
         (f"{x} is paid more than {y}.", f"{x}, {ABL[y]} daha fazla ücret alıyor.", "UNRELATED"),
         (f"{x} and {y} are siblings.", f"{x} ile {y} kardeş.", "UNRELATED")]
    together = F(a * b, a + b)
    for wrong in {k + together, together, F(a + b, 2), F(k + b)}:
        if wrong != total and whole(wrong):
            c.append((f"The whole job takes {wrong} days.", f"İşin tamamı {wrong} gün sürer.", "CONTRADICTS"))
    return pe, pt, c, ("work", a, b, k)


def meeting(w, nums):
    d, v1, v2 = nums
    if v1 == v2:
        return None
    t = F(d, v1 + v2)
    if not minutes_ok(t) or not whole(v1 * t):
        return None
    d1, d2 = v1 * t, v2 * t
    pe = [f"Two cities are {d} km apart. A car leaves the first city for the second at {v1} km/h; at the same "
          f"moment a truck leaves the second city for the first at {v2} km/h.",
          f"A car and a truck set off at the same time from two cities {d} km apart, driving toward each other "
          f"on the same road. The car, starting from the first city, keeps a speed of {v1} km/h; the truck keeps {v2} km/h.",
          f"The road between the first city and the second is {d} km long. The car drives from the first city "
          f"at {v1} km per hour while the truck, which started at the same time, drives from the second city "
          f"toward it at {v2} km per hour."][w]
    pt = [f"İki şehir arası {d} km. Birinci şehirden ikinciye doğru saatte {v1} km hızla bir otomobil yola çıkıyor; "
          f"aynı anda ikinci şehirden birinciye doğru saatte {v2} km hızla bir kamyon hareket ediyor.",
          f"Bir otomobil ve bir kamyon, aralarında {d} km bulunan iki şehirden aynı anda, aynı yolda birbirlerine "
          f"doğru yola çıkıyor. Birinci şehirden çıkan otomobil saatte {v1} km, kamyon saatte {v2} km hızla gidiyor.",
          f"Birinci şehirle ikinci şehir arasındaki yol {d} km. Otomobil birinci şehirden saatte {v1} km hızla, "
          f"aynı anda yola çıkan kamyon ise ikinci şehirden ona doğru saatte {v2} km hızla ilerliyor."][w]
    more, less = ("car", "truck") if v1 > v2 else ("truck", "car")
    tr_name = {"car": "otomobil", "truck": "kamyon"}
    tr_abl = {"car": "otomobilden", "truck": "kamyondan"}
    c = [(f"They meet after {dur_en(t)}.", f"{dur_tr(t)} sonra karşılaşırlar.", "SUPPORTS"),
         (f"They meet {d1} km from the first city.", f"Birinci şehirden {d1} km uzakta karşılaşırlar.", "SUPPORTS"),
         (f"They meet {d2} km from the second city.", f"İkinci şehirden {d2} km uzakta karşılaşırlar.", "SUPPORTS"),
         (f"When they meet, the {more} has covered more ground than the {less}.",
          f"Karşılaştıklarında {tr_name[more]}, {tr_abl[less]} daha fazla yol almıştır.", "SUPPORTS"),
         (f"When they meet, the {less} has covered more ground than the {more}.",
          f"Karşılaştıklarında {tr_name[less]}, {tr_abl[more]} daha fazla yol almıştır.", "CONTRADICTS"),
         (f"They meet halfway between the two cities.", f"İki şehrin tam ortasında karşılaşırlar.", "CONTRADICTS"),
         (f"They meet {d2} km from the first city.", f"Birinci şehirden {d2} km uzakta karşılaşırlar.", "CONTRADICTS"),
         (f"The car reaches the second city before noon.", f"Otomobil ikinci şehre öğleden önce varır.", "UNRELATED"),
         (f"The truck is carrying furniture.", f"Kamyon mobilya taşıyor.", "UNRELATED")]
    for wrong in {F(d, abs(v1 - v2)), F(d, v1 + v2) * 2}:
        if wrong != t and minutes_ok(wrong) and wrong < 30:
            c.append((f"They meet after {dur_en(wrong)}.", f"{dur_tr(wrong)} sonra karşılaşırlar.", "CONTRADICTS"))
    return pe, pt, c, ("meet", d, v1, v2)


def catch_up(w, nums):
    v1, v2, k = nums  # cyclist v1, motorcyclist v2 leaves k hours later
    if v2 <= v1:
        return None
    t = F(v1 * k, v2 - v1)
    if not minutes_ok(t) or not whole(v2 * t):
        return None
    dist = v2 * t
    hrs = "1 hour" if k == 1 else f"{k} hours"
    pe = [f"A cyclist leaves a town at {v1} km/h. {hrs} later a motorcyclist leaves the same town on the "
          f"same road, in the same direction, at {v2} km/h.",
          f"A motorcyclist sets off from a town at {v2} km/h, {hrs} after a cyclist who left the same town "
          f"along the same road at {v1} km/h.",
          f"{hrs.capitalize()} after a cyclist rode out of a town at a steady {v1} km per hour, a motorcyclist follows on "
          f"the same road at a steady {v2} km per hour."][w]
    pt = [f"Bir bisikletli bir kasabadan saatte {v1} km hızla yola çıkıyor. {k} saat sonra bir motosikletli aynı "
          f"kasabadan aynı yolda, aynı yöne saatte {v2} km hızla hareket ediyor.",
          f"Bir motosikletli, aynı kasabadan aynı yolda saatte {v1} km hızla giden bir bisikletliden {k} saat sonra "
          f"saatte {v2} km hızla yola çıkıyor.",
          f"Bir bisikletli bir kasabadan sabit saatte {v1} km hızla çıktıktan {k} saat sonra, bir motosikletli aynı "
          f"yoldan sabit saatte {v2} km hızla onu takip ediyor."][w]
    c = [(f"The motorcyclist catches up with the cyclist {dur_en(t)} after setting off.",
          f"Motosikletli, yola çıktıktan {dur_tr(t)} sonra bisikletliye yetişir.", "SUPPORTS"),
         (f"They are side by side {dist} km from the town.", f"Kasabadan {dist} km uzakta yan yana gelirler.", "SUPPORTS"),
         (f"When the motorcyclist catches up, the cyclist has been riding for {dur_en(t + k)}.",
          f"Motosikletli yetiştiğinde bisikletli {dur_tr(t + k)} yoldadır.", "SUPPORTS"),
         (f"The motorcyclist never catches up with the cyclist.", f"Motosikletli bisikletliye hiç yetişemez.", "CONTRADICTS"),
         (f"The motorcyclist catches up with the cyclist {dur_en(t + k)} after setting off.",
          f"Motosikletli, yola çıktıktan {dur_tr(t + k)} sonra bisikletliye yetişir.", "CONTRADICTS"),
         (f"The cyclist is older than the motorcyclist.", f"Bisikletli motosikletliden daha yaşlı.", "UNRELATED"),
         (f"The town is by the sea.", f"Kasaba deniz kenarında.", "UNRELATED")]
    bad = v1 * t
    if bad != dist:
        c.append((f"They are side by side {bad} km from the town.", f"Kasabadan {bad} km uzakta yan yana gelirler.", "CONTRADICTS"))
    return pe, pt, c, ("catch", v1, v2, k)


def round_trip(w, nums):
    v1, v2, d = nums
    if v1 == v2:
        return None
    avg = F(2 * v1 * v2, v1 + v2)
    mean = F(v1 + v2, 2)
    if not whole(avg) or not whole(mean):
        return None
    give_d = rnd.random() < 0.5
    pe = [f"A driver goes from home to work at {v1} km/h and comes back home along the same road at {v2} km/h.",
          f"On the way to work a driver keeps to {v1} km/h; on the way home, on the same road, to {v2} km/h.",
          f"Driving the same road both ways, a commuter averages {v1} km/h going to work and {v2} km/h coming back."][w]
    pt = [f"Bir sürücü evinden işine saatte {v1} km hızla gidiyor ve aynı yoldan evine saatte {v2} km hızla dönüyor.",
          f"Bir sürücü işe giderken saatte {v1} km, aynı yoldan eve dönerken saatte {v2} km hızla gidiyor.",
          f"Gidiş ve dönüşte aynı yolu kullanan bir sürücü, işe giderken ortalama saatte {v1} km, dönerken saatte {v2} km hız yapıyor."][w]
    slow_en, fast_en = ("way back", "way there") if v2 < v1 else ("way there", "way back")
    slow_tr, fast_tr = ("Dönüş", "gidişten") if v2 < v1 else ("Gidiş", "dönüşten")
    c = [(f"The average speed for the whole round trip is {avg} km/h.", f"Gidiş-dönüş yolculuğunun ortalama hızı saatte {avg} km.", "SUPPORTS"),
         (f"The average speed for the whole round trip is below {mean} km/h.", f"Gidiş-dönüş yolculuğunun ortalama hızı saatte {mean} km'nin altında.", "SUPPORTS"),
         (f"The average speed for the whole round trip is {mean} km/h.", f"Gidiş-dönüş yolculuğunun ortalama hızı saatte {mean} km.", "CONTRADICTS"),
         (f"The {slow_en} takes longer than the {fast_en}.", f"{slow_tr} {fast_tr} daha uzun sürer.", "SUPPORTS"),
         (f"The way there and the way back take the same time.", f"Gidiş ve dönüş aynı sürede tamamlanır.", "CONTRADICTS")]
    if give_d:
        pe += f" Home and work are {d} km apart."
        pt += f" Ev ile iş yeri arası {d} km."
        tot = F(d, v1) + F(d, v2)
        if minutes_ok(tot):
            c.append((f"The round trip takes {dur_en(tot)} of driving.", f"Gidiş-dönüş toplam {dur_tr(tot)} sürer.", "SUPPORTS"))
            wrong = F(2 * d, mean)
            if wrong != tot and minutes_ok(wrong):
                c.append((f"The round trip takes {dur_en(wrong)} of driving.", f"Gidiş-dönüş toplam {dur_tr(wrong)} sürer.", "CONTRADICTS"))
    else:
        c.append((f"The drive to work takes 30 minutes.", f"İşe gidiş 30 dakika sürer.", "UNRELATED"))
    c.append((f"The driver works at a hospital.", f"Sürücü bir hastanede çalışıyor.", "UNRELATED"))
    return pe, pt, c, ("trip", v1, v2)


TIMES_EN = {2: "twice", 3: "three times", 4: "four times", 5: "five times", 6: "six times"}


def ages(w, nums):
    m, n, k = nums  # x = m*y now; in k years x = n*(y+k)
    if not m > n >= 2:
        return None
    y_age = F(k * (n - 1), m - n)
    if not whole(y_age) or not 3 <= y_age <= 30:
        return None
    x_age = m * y_age
    if x_age > 90:
        return None
    x, y = rnd.sample(NAMES, 2)
    pe = [f"{x} is now {TIMES_EN[m]} as old as {y}. In {k} years, {x} will be {TIMES_EN[n]} as old as {y}.",
          f"Today {x}'s age is {m} times {y}'s age. {k} years from now, {x}'s age will be {n} times {y}'s age.",
          f"{x} is {TIMES_EN[m]} {y}'s age at present, and after {k} more years will be {TIMES_EN[n]} {y}'s age."][w]
    pt = [f"{x} şu an {GEN[y]} {m} katı yaşında. {k} yıl sonra {x}, {GEN[y]} {n} katı yaşında olacak.",
          f"Bugün {GEN[x]} yaşı {GEN[y]} yaşının {m} katı. {k} yıl sonra {GEN[x]} yaşı {GEN[y]} yaşının {n} katı olacak.",
          f"{x} şu anda {GEN[y]} yaşının {m} katı yaşta; {k} yıl daha geçince {GEN[y]} yaşının {n} katı yaşta olacak."][w]
    diff = x_age - y_age
    later = rnd.choice([5, 10, 15, 20])
    c = [(f"{y} is {y_age} years old now.", f"{y} şu an {y_age} yaşında.", "SUPPORTS"),
         (f"{x} is {x_age} years old now.", f"{x} şu an {x_age} yaşında.", "SUPPORTS"),
         (f"{x} is {diff} years older than {y}.", f"{x}, {ABL[y]} {diff} yaş büyük.", "SUPPORTS"),
         (f"In {later} years, {x} will still be {diff} years older than {y}.",
          f"{later} yıl sonra da {x}, {ABL[y]} {diff} yaş büyük olacak.", "SUPPORTS"),
         (f"The age gap between {x} and {y} grows as the years pass.",
          f"Yıllar geçtikçe {x} ile {y} arasındaki yaş farkı büyür.", "CONTRADICTS"),
         (f"{y} is older than {x}.", f"{y}, {ABL[x]} daha yaşlı.", "CONTRADICTS"),
         (f"{x} and {y} are siblings.", f"{x} ile {y} kardeş.", "UNRELATED"),
         (f"{x} was born in a summer month.", f"{x} bir yaz ayında doğdu.", "UNRELATED")]
    for wrong in {y_age + k, F(k), y_age * n}:
        if wrong != y_age and whole(wrong) and wrong > 0:
            c.append((f"{y} is {wrong} years old now.", f"{y} şu an {wrong} yaşında.", "CONTRADICTS"))
    return pe, pt, c, ("age", m, n, k)


def percent(w, nums):
    kind, p, r = nums
    if kind == "updown":
        final = p * (1 + F(r, 100)) * (1 - F(r, 100))
        if not whole(final):
            return None
        loss_pct = F(r * r, 100)
        give_p = rnd.random() < 0.6
        pe = [f"A shop raises the price of a coat by {r}% and some weeks later cuts the new price by {r}%.",
              f"The price of a coat goes up by {r}%; later the shop gives a {r}% discount on that raised price.",
              f"A coat's price is first increased by {r} percent, and then the increased price is reduced by {r} percent."][w]
        pt = [f"Bir mağaza bir montun fiyatını yüzde {r} artırıyor, birkaç hafta sonra da yeni fiyat üzerinden yüzde {r} indirim yapıyor.",
              f"Bir montun fiyatı yüzde {r} artıyor; daha sonra mağaza bu artmış fiyat üzerinden yüzde {r} indirim yapıyor.",
              f"Bir montun fiyatı önce yüzde {r} yükseltiliyor, ardından yükseltilmiş fiyat yüzde {r} düşürülüyor."][w]
        c = [(f"After both changes the coat is cheaper than it was at first.", f"İki değişiklikten sonra mont ilk fiyatından daha ucuz.", "SUPPORTS"),
             (f"After both changes the coat is back at its original price.", f"İki değişiklikten sonra mont ilk fiyatına döner.", "CONTRADICTS"),
             (f"After both changes the coat is dearer than it was at first.", f"İki değişiklikten sonra mont ilk fiyatından daha pahalı.", "CONTRADICTS"),
             (f"The coat is made of wool.", f"Mont yünden yapılmış.", "UNRELATED"),
             (f"The coat sold out within a day of the discount.", f"Mont indirimden sonraki bir gün içinde tükendi.", "UNRELATED")]
        if num(loss_pct):
            c.append((f"The final price is {num(loss_pct)}% below the original price.",
                      f"Son fiyat, ilk fiyatın yüzde {num_tr(loss_pct)} altında.", "SUPPORTS"))
        if give_p:
            pe += f" Before the changes the coat cost {p} lira."
            pt += f" Değişikliklerden önce montun fiyatı {p} liraydı."
            c.append((f"The coat finally costs {final} lira.", f"Montun son fiyatı {final} lira.", "SUPPORTS"))
            c.append((f"The coat finally costs {p} lira.", f"Montun son fiyatı {p} lira.", "CONTRADICTS"))
            top = p * (1 + F(r, 100))
            if whole(top):
                c.append((f"At its highest the coat cost {top} lira.", f"Montun en yüksek fiyatı {top} lira oldu.", "SUPPORTS"))
        return pe, pt, c, ("updown", p if give_p else 0, r)
    # profit: sold for p with r% profit on cost
    cost = F(p * 100, 100 + r)
    if not whole(cost):
        return None
    profit = p - cost
    wrong_cost = p * (1 - F(r, 100))
    pe = [f"A trader sells a bicycle for {p} lira and makes a profit of {r}% on what he paid for it.",
          f"By selling a bicycle for {p} lira, a trader earns {r}% more than the price he bought it for.",
          f"A bicycle is sold for {p} lira; the seller's profit is {r} percent, counted on his own purchase price."][w]
    pt = [f"Bir satıcı bir bisikleti {p} liraya satıyor ve bunun için ödediği fiyat üzerinden yüzde {r} kâr ediyor.",
          f"Bir satıcı, bisikleti {p} liraya satarak onu aldığı fiyattan yüzde {r} fazla kazanıyor.",
          f"Bir bisiklet {p} liraya satılıyor; satıcının kârı, kendi alış fiyatı üzerinden hesaplanan yüzde {r}."][w]
    c = [(f"The trader bought the bicycle for {cost} lira.", f"Satıcı bisikleti {cost} liraya almıştı.", "SUPPORTS"),
         (f"The trader's profit is {profit} lira.", f"Satıcının kârı {profit} lira.", "SUPPORTS"),
         (f"The trader sells the bicycle for more than he paid for it.", f"Satıcı bisikleti aldığından daha pahalıya satıyor.", "SUPPORTS"),
         (f"The trader sold the bicycle on a Monday.", f"Satıcı bisikleti bir pazartesi günü sattı.", "UNRELATED"),
         (f"The buyer paid in cash.", f"Alıcı nakit ödedi.", "UNRELATED")]
    if whole(wrong_cost) and wrong_cost != cost:
        c.append((f"The trader bought the bicycle for {wrong_cost} lira.", f"Satıcı bisikleti {wrong_cost} liraya almıştı.", "CONTRADICTS"))
        c.append((f"The trader's profit is {p - wrong_cost} lira.", f"Satıcının kârı {p - wrong_cost} lira.", "CONTRADICTS"))
    return pe, pt, c, ("profit", p, r)


def mixture(w, nums):
    x, p, y, q = nums
    if x == y or p == q:
        return None
    res = F(x * p + y * q, x + y)
    alc = F(x * p + y * q, 100)
    if not num(res) or not num(alc):
        return None
    pe = [f"{x} liters of a solution that is {p}% alcohol are mixed with {y} liters of a solution that is {q}% alcohol.",
          f"A chemist pours {y} liters of {q}% alcohol solution into {x} liters of {p}% alcohol solution.",
          f"Two solutions are combined: {x} liters at {p} percent alcohol and {y} liters at {q} percent alcohol."][w]
    pt = [f"Alkol oranı yüzde {p} olan {x} litre çözelti, alkol oranı yüzde {q} olan {y} litre çözeltiyle karıştırılıyor.",
          f"Bir kimyager, alkol oranı yüzde {p} olan {x} litre çözeltinin üzerine alkol oranı yüzde {q} olan {y} litre çözelti döküyor.",
          f"İki çözelti birleştiriliyor: alkol oranı yüzde {p} olan {x} litre ve alkol oranı yüzde {q} olan {y} litre."][w]
    lo, hi = min(p, q), max(p, q)
    c = [(f"The mixture is {num(res)}% alcohol.", f"Karışımın alkol oranı yüzde {num_tr(res)}.", "SUPPORTS"),
         (f"The mixture contains {num(alc)} liters of alcohol.", f"Karışımda {num_tr(alc)} litre alkol var.", "SUPPORTS"),
         (f"The mixture is {x + y} liters in all.", f"Karışım toplam {x + y} litre.", "SUPPORTS"),
         (f"The mixture is stronger in alcohol than the {lo}% solution.", f"Karışımın alkol oranı, yüzde {lo}'lik çözeltininkinden yüksek.", "SUPPORTS"),
         (f"The mixture is stronger in alcohol than both solutions.", f"Karışımın alkol oranı her iki çözeltininkinden de yüksek.", "CONTRADICTS"),
         (f"The mixture is used in a hospital.", f"Karışım bir hastanede kullanılıyor.", "UNRELATED")]
    mean = F(p + q, 2)
    if mean != res and num(mean):
        c.append((f"The mixture is {num(mean)}% alcohol.", f"Karışımın alkol oranı yüzde {num_tr(mean)}.", "CONTRADICTS"))
    if p + q != res and num(F(p + q)) and p + q < 100:
        c.append((f"The mixture is {p + q}% alcohol.", f"Karışımın alkol oranı yüzde {p + q}.", "CONTRADICTS"))
    # "yüzde 10'luk": the suffix follows the number's last word; keep only the forms we are sure of.
    if lo % 10 != 0:
        c = [r for r in c if f"'lik" not in r[1]]
    else:
        suffix = {10: "'luk", 20: "'lik", 30: "'luk", 40: "'lık", 50: "'lik", 60: "'lık", 70: "'lik", 80: "'lik", 90: "'lık"}[lo]
        c = [(e, t.replace(f"{lo}'lik", f"{lo}{suffix}"), l) for e, t, l in c]
    return pe, pt, c, ("mix", x, p, y, q)


def train_bridge(w, nums):
    length, bridge, kmh = nums
    ms = F(kmh * 1000, 3600)
    if not whole(ms):
        return None
    t = F(length + bridge, ms)
    t_bad = F(bridge, ms)
    if not whole(t) or not whole(t_bad):
        return None
    pe = [f"A train {length} meters long travels at {kmh} km/h and crosses a bridge {bridge} meters long.",
          f"A {length}-meter train moving at a steady {kmh} km/h passes over a {bridge}-meter bridge.",
          f"At a constant {kmh} kilometers per hour, a train whose length is {length} meters goes across a bridge of {bridge} meters."][w]
    pt = [f"{length} metre uzunluğunda bir tren saatte {kmh} km hızla gidiyor ve {bridge} metre uzunluğunda bir köprüden geçiyor.",
          f"Saatte sabit {kmh} km hızla giden {length} metrelik bir tren, {bridge} metrelik bir köprünün üzerinden geçiyor.",
          f"Uzunluğu {length} metre olan bir tren, sabit saatte {kmh} km hızla {bridge} metrelik bir köprüyü geçiyor."][w]
    c = [(f"From the moment the front of the train reaches the bridge until the last car has left it, {t} seconds pass.",
          f"Trenin önü köprüye girdiği andan son vagonu köprüden çıkana kadar {t} saniye geçer.", "SUPPORTS"),
         (f"The train covers {ms} meters every second.", f"Tren her saniye {ms} metre yol alır.", "SUPPORTS"),
         (f"From the moment the front of the train reaches the bridge until the last car has left it, {t_bad} seconds pass.",
          f"Trenin önü köprüye girdiği andan son vagonu köprüden çıkana kadar {t_bad} saniye geçer.", "CONTRADICTS"),
         (f"The train covers {kmh} meters every second.", f"Tren her saniye {kmh} metre yol alır.", "CONTRADICTS"),
         (f"The bridge crosses a river.", f"Köprü bir nehrin üzerinde.", "UNRELATED"),
         (f"The train carries passengers.", f"Tren yolcu taşıyor.", "UNRELATED")]
    if t_bad == t:
        return None
    return pe, pt, c, ("train", length, bridge, kmh)


# ---- easy steps (levels 1-4) ----------------------------------------------------------------------

def recall_pipes(w, nums):
    """Level 1: only what the text says, restated, and comparisons of the numbers it gives."""
    a, b = nums
    if a == b:
        return None
    pe = [f"Pipe A fills an empty pool in {a} hours. Pipe B fills the same pool in {b} hours.",
          f"On its own, pipe A fills an empty pool in {a} hours, and pipe B does it in {b} hours.",
          f"An empty pool can be filled by pipe A alone in {a} hours, while pipe B alone would need {b} hours."][w]
    pt = [f"A musluğu boş bir havuzu {a} saatte dolduruyor. B musluğu aynı havuzu {b} saatte dolduruyor.",
          f"A musluğu boş bir havuzu tek başına {a} saatte, B musluğu ise {b} saatte dolduruyor.",
          f"Boş bir havuzu A musluğu tek başına {a} saatte doldurabiliyor; B musluğunun ise tek başına {b} saate ihtiyacı var."][w]
    fast, slow = ("A", "B") if a < b else ("B", "A")
    c = [(f"Pipe A alone fills the pool in {a} hours.", f"A musluğu havuzu tek başına {a} saatte doldurur.", "SUPPORTS"),
         (f"Pipe B alone fills the pool in {b} hours.", f"B musluğu havuzu tek başına {b} saatte doldurur.", "SUPPORTS"),
         (f"Pipe A alone fills the pool in {b} hours.", f"A musluğu havuzu tek başına {b} saatte doldurur.", "CONTRADICTS"),
         (f"Pipe {fast} fills the pool faster than pipe {slow}.", f"{fast} musluğu havuzu {slow} musluğundan daha hızlı doldurur.", "SUPPORTS"),
         (f"Pipe {slow} fills the pool faster than pipe {fast}.", f"{slow} musluğu havuzu {fast} musluğundan daha hızlı doldurur.", "CONTRADICTS"),
         (f"The two pipes fill the pool equally fast.", f"İki musluk havuzu aynı hızla doldurur.", "CONTRADICTS"),
         (f"The pool is 25 meters long.", f"Havuz 25 metre uzunluğunda.", "UNRELATED"),
         (f"Pipe A is newer than pipe B.", f"A musluğu B musluğundan daha yeni.", "UNRELATED")]
    return pe, pt, c, ("recall-pipes", a, b)


def recall_trip(w, nums):
    d, v1, v2 = nums
    if v1 == v2:
        return None
    pe = [f"Two cities are {d} km apart. A car drives at {v1} km/h and a truck at {v2} km/h.",
          f"The car keeps a speed of {v1} km/h and the truck {v2} km/h on the {d} km road between two cities.",
          f"Between the two cities lies a road of {d} km; on it the car goes at {v1} km per hour, the truck at {v2} km per hour."][w]
    pt = [f"İki şehir arası {d} km. Bir otomobil saatte {v1} km, bir kamyon saatte {v2} km hızla gidiyor.",
          f"İki şehir arasındaki {d} km'lik yolda otomobil saatte {v1} km, kamyon saatte {v2} km hız yapıyor.",
          f"İki şehir arasında {d} km'lik bir yol var; bu yolda otomobil saatte {v1} km, kamyon saatte {v2} km hızla gidiyor."][w]
    fast, slow = ("car", "truck") if v1 > v2 else ("truck", "car")
    trn = {"car": "Otomobil", "truck": "Kamyon"}
    abl = {"car": "otomobilden", "truck": "kamyondan"}
    c = [(f"The cities are {d} km apart.", f"Şehirler arası {d} km.", "SUPPORTS"),
         (f"The cities are {d + rnd.choice([20, 50, 100])} km apart.", "", "CONTRADICTS"),
         (f"The truck drives at {v2} km/h.", f"Kamyon saatte {v2} km hızla gidiyor.", "SUPPORTS"),
         (f"The truck drives at {v1} km/h.", f"Kamyon saatte {v1} km hızla gidiyor.", "CONTRADICTS"),
         (f"The {fast} is faster than the {slow}.", f"{trn[fast]} {abl[slow]} daha hızlı.", "SUPPORTS"),
         (f"The {slow} is faster than the {fast}.", f"{trn[slow]} {abl[fast]} daha hızlı.", "CONTRADICTS"),
         (f"The truck is carrying furniture.", f"Kamyon mobilya taşıyor.", "UNRELATED"),
         (f"The car is red.", f"Otomobil kırmızı.", "UNRELATED")]
    c[1] = (c[1][0], f"Şehirler arası {c[1][0].split()[3]} km.", "CONTRADICTS")
    return pe, pt, c, ("recall-trip", d, v1, v2)


def recall_ages(w, nums):
    a, b = nums
    if a == b:
        return None
    x, y = rnd.sample(NAMES, 2)
    pe = [f"{x} is {a} years old and {y} is {b}.", f"{y} is {b} years old; {x} is {a}.",
          f"{x}'s age is {a} years, while {y} has just turned {b}."][w]
    pt = [f"{x} {a} yaşında, {y} ise {b} yaşında.", f"{y} {b} yaşında; {x} {a} yaşında.",
          f"{GEN[x]} yaşı {a}; {y} ise az önce {b} yaşına girdi."][w]
    old, young = (x, y) if a > b else (y, x)
    c = [(f"{y} is {b} years old.", f"{y} {b} yaşında.", "SUPPORTS"),
         (f"{y} is {a} years old.", f"{y} {a} yaşında.", "CONTRADICTS"),
         (f"{old} is older than {young}.", f"{old}, {ABL[young]} daha yaşlı.", "SUPPORTS"),
         (f"{young} is older than {old}.", f"{young}, {ABL[old]} daha yaşlı.", "CONTRADICTS"),
         (f"{x} and {y} are the same age.", f"{x} ile {y} aynı yaşta.", "CONTRADICTS"),
         (f"{x} and {y} are siblings.", f"{x} ile {y} kardeş.", "UNRELATED"),
         (f"{x} lives in Izmir.", f"{x} İzmir'de yaşıyor.", "UNRELATED")]
    return pe, pt, c, ("recall-ages", a, b)


def one_step_distance(w, nums):
    """Level 2: a single operation on the numbers given."""
    v, t = nums
    pe = [f"A bus travels for {t} hours at a steady {v} km/h.", f"Keeping to {v} km/h, a bus drives for {t} hours without stopping.",
          f"For {t} hours a bus moves at a constant speed of {v} kilometers per hour."][w]
    pt = [f"Bir otobüs saatte sabit {v} km hızla {t} saat yol alıyor.", f"Saatte {v} km hızını koruyan bir otobüs {t} saat hiç durmadan gidiyor.",
          f"Bir otobüs {t} saat boyunca saatte sabit {v} km hızla ilerliyor."][w]
    d = v * t
    c = [(f"The bus covers {d} km.", f"Otobüs {d} km yol alır.", "SUPPORTS"),
         (f"The bus covers more than {d - 10} km.", f"Otobüs {d - 10} km'den fazla yol alır.", "SUPPORTS"),
         (f"In one hour the bus covers {v} km.", f"Otobüs bir saatte {v} km yol alır.", "SUPPORTS"),
         (f"The bus covers {v + t} km.", f"Otobüs {v + t} km yol alır.", "CONTRADICTS"),
         (f"The bus covers {v * (t + 1)} km.", f"Otobüs {v * (t + 1)} km yol alır.", "CONTRADICTS"),
         (f"The bus covers less than {v} km.", f"Otobüs {v} km'den az yol alır.", "CONTRADICTS"),
         (f"The bus is full of passengers.", f"Otobüs yolcuyla dolu.", "UNRELATED"),
         (f"The bus leaves at 9:00.", f"Otobüs saat 9:00'da kalkıyor.", "UNRELATED")]
    if t < 2:
        return None
    c = [x for x in c if "9:00'da" not in x[1]] + [(f"The bus leaves at 9:00.", f"Otobüs kalktığında saat 9:00.", "UNRELATED")]
    return pe, pt, c, ("dist", v, t)


def one_step_ages(w, nums):
    a, b, k = nums
    if a <= b:
        return None
    x, y = rnd.sample(NAMES, 2)
    pe = [f"{x} is {a} years old and {y} is {b}.", f"{y} is {b}; {x} is {a} years old.",
          f"{x} turned {a} this year, and {y} turned {b}."][w]
    pt = [f"{x} {a} yaşında, {y} ise {b} yaşında.", f"{y} {b} yaşında; {x} {a} yaşında.",
          f"{x} bu yıl {a}, {y} ise {b} yaşına girdi."][w]
    c = [(f"{x} is {a - b} years older than {y}.", f"{x}, {ABL[y]} {a - b} yaş büyük.", "SUPPORTS"),
         (f"In {k} years {x} will be {a + k}.", f"{k} yıl sonra {x} {a + k} yaşında olacak.", "SUPPORTS"),
         (f"Together they are {a + b} years old.", f"İkisinin yaşları toplamı {a + b}.", "SUPPORTS"),
         (f"{x} is {a + b} years older than {y}.", f"{x}, {ABL[y]} {a + b} yaş büyük.", "CONTRADICTS"),
         (f"In {k} years the age gap between them will be {a - b + k} years.", f"{k} yıl sonra aralarındaki yaş farkı {a - b + k} olacak.", "CONTRADICTS"),
         (f"In {k} years {x} will be {a + 2 * k}.", f"{k} yıl sonra {x} {a + 2 * k} yaşında olacak.", "CONTRADICTS"),
         (f"{x} and {y} go to the same school.", f"{x} ile {y} aynı okula gidiyor.", "UNRELATED")]
    return pe, pt, c, ("ages1", a, b, k)


def one_step_units(w, nums):
    kmh, x, y = nums
    ms = F(kmh * 1000, 3600)
    if not whole(ms) or x == y:
        return None
    pe = [f"A train runs at {kmh} km/h. A tank holds {x} liters of water and another holds {y} liters.",
          f"The train's speed is {kmh} km/h. One tank contains {x} liters of water, a second {y} liters.",
          f"At {kmh} kilometers per hour a train goes by; nearby stand two water tanks of {x} and {y} liters."][w]
    pt = [f"Bir tren saatte {kmh} km hızla gidiyor. Bir depoda {x} litre, diğerinde {y} litre su var.",
          f"Trenin hızı saatte {kmh} km. Bir depoda {x} litre su, ikincisinde {y} litre su bulunuyor.",
          f"Saatte {kmh} km hızla bir tren geçiyor; yakında {x} ve {y} litrelik iki su deposu duruyor."][w]
    c = [(f"The train covers {ms} meters every second.", f"Tren her saniye {ms} metre yol alır.", "SUPPORTS"),
         (f"The train covers {kmh * 2} km in two hours.", f"Tren iki saatte {kmh * 2} km yol alır.", "SUPPORTS"),
         (f"The two tanks hold {x + y} liters of water in all.", f"İki depoda toplam {x + y} litre su var.", "SUPPORTS"),
         (f"The train covers {kmh} meters every second.", f"Tren her saniye {kmh} metre yol alır.", "CONTRADICTS"),
         (f"The two tanks hold {x * y} liters of water in all.", f"İki depoda toplam {x * y} litre su var.", "CONTRADICTS"),
         (f"The train covers {kmh + 2} km in two hours.", f"Tren iki saatte {kmh + 2} km yol alır.", "CONTRADICTS"),
         (f"The train carries passengers.", f"Tren yolcu taşıyor.", "UNRELATED")]
    return pe, pt, c, ("units", kmh, x, y)


def one_step_time(w, nums):
    """Levels 3 and 4: one step (time = distance / speed); a whole number of hours, or hours and minutes."""
    d, v = nums
    t = F(d, v)
    if not minutes_ok(t) or t < F(1, 2):
        return None
    pe = [f"A car drives {d} km at a steady {v} km/h.", f"Keeping to {v} km/h, a driver covers a road of {d} km.",
          f"A road {d} km long is driven from end to end at a constant {v} kilometers per hour."][w]
    pt = [f"Bir otomobil saatte sabit {v} km hızla {d} km yol gidiyor.", f"Saatte {v} km hızı koruyan bir sürücü {d} km'lik bir yolu kat ediyor.",
          f"{d} km uzunluğundaki bir yol baştan sona saatte sabit {v} km hızla gidiliyor."][w]
    c = [(f"The drive takes {dur_en(t)}.", f"Yolculuk {dur_tr(t)} sürer.", "SUPPORTS"),
         (f"The drive takes {int(t * 60)} minutes.", f"Yolculuk {int(t * 60)} dakika sürer.", "SUPPORTS"),
         (f"The car is on the road for {d} km.", f"Otomobil {d} km yol gider.", "SUPPORTS"),
         (f"The drive takes {dur_en(t + 1)}.", f"Yolculuk {dur_tr(t + 1)} sürer.", "CONTRADICTS"),
         (f"The car arrives before noon.", f"Otomobil öğleden önce varır.", "UNRELATED"),
         (f"The driver stops for coffee on the way.", f"Sürücü yolda kahve molası veriyor.", "UNRELATED")]
    for wrong in {F(d - v) if d > v else None, F(v, 60)}:
        if wrong and wrong != t and minutes_ok(wrong) and wrong < 40:
            c.append((f"The drive takes {dur_en(wrong)}.", f"Yolculuk {dur_tr(wrong)} sürer.", "CONTRADICTS"))
    if t >= 2 and minutes_ok(t / 2) and t / 2 != t:
        c.append((f"The drive takes {dur_en(t / 2)}.", f"Yolculuk {dur_tr(t / 2)} sürer.", "CONTRADICTS"))
    return pe, pt, c, ("time", d, v)


def simple_profit(w, nums):
    cost, pct = nums
    sell = cost * (1 + F(pct, 100))
    if not whole(sell):
        return None
    pe = [f"A trader buys a lamp for {cost} lira and sells it for {sell} lira.", f"Bought for {cost} lira, a lamp is sold on for {sell} lira.",
          f"A lamp that cost the seller {cost} lira changes hands for {sell} lira."][w]
    pt = [f"Bir satıcı bir lambayı {cost} liraya alıp {sell} liraya satıyor.", f"{cost} liraya alınan bir lamba {sell} liraya satılıyor.",
          f"Satıcıya {cost} liraya mal olan bir lamba {sell} liraya el değiştiriyor."][w]
    profit = sell - cost
    c = [(f"The trader makes a profit of {profit} lira.", f"Satıcı {profit} lira kâr ediyor.", "SUPPORTS"),
         (f"The profit is {pct}% of what the trader paid.", f"Kâr, satıcının ödediği fiyatın yüzde {pct} kadarı.", "SUPPORTS"),
         (f"The trader sells the lamp for more than he paid.", f"Satıcı lambayı aldığından pahalıya satıyor.", "SUPPORTS"),
         (f"The trader loses money on the lamp.", f"Satıcı lambadan zarar ediyor.", "CONTRADICTS"),
         (f"The trader makes a profit of {sell + cost} lira.", f"Satıcı {sell + cost} lira kâr ediyor.", "CONTRADICTS"),
         (f"The lamp is made of brass.", f"Lamba pirinçten yapılmış.", "UNRELATED")]
    wrong = F(profit * 100, sell)
    if whole(wrong) and wrong != pct:
        c.append((f"The profit is {wrong}% of what the trader paid.", f"Kâr, satıcının ödediği fiyatın yüzde {wrong} kadarı.", "CONTRADICTS"))
    return pe, pt, c, ("profit1", cost, pct)


def two_workers(w, nums):
    """Level 5, beside the two pipes: two people working together."""
    a, b = nums
    t = F(a * b, a + b)
    if not minutes_ok(t) or a == b:
        return None
    x, y = rnd.sample(NAMES, 2)
    pe = [f"{x} can paint a room alone in {a} hours; {y} can paint it alone in {b} hours. They paint the room together.",
          f"Working alone, {x} would paint the room in {a} hours and {y} in {b} hours. Both start painting it at the same time.",
          f"A room takes {x} {a} hours to paint alone and {y} {b} hours; this time the two of them paint it side by side."][w]
    pt = [f"{x} odayı tek başına {a} saatte, {y} ise {b} saatte boyayabiliyor. Odayı birlikte boyuyorlar.",
          f"Tek başına çalışsa {x} odayı {a} saatte, {y} ise {b} saatte boyardı. İkisi aynı anda boyamaya başlıyor.",
          f"Odayı tek başına boyamak {x} için {a}, {y} için {b} saat sürüyor; bu kez ikisi yan yana boyuyor."][w]
    fast, slow = (x, y) if a < b else (y, x)
    c = [(f"Painting the room together takes {dur_en(t)}.", f"Odayı birlikte boyamak {dur_tr(t)} sürer.", "SUPPORTS"),
         (f"Together they finish sooner than {fast} would alone.", f"Birlikte, {fast} tek başına bitirdiğinden daha çabuk bitirirler.", "SUPPORTS"),
         (f"{fast} paints faster than {slow}.", f"{fast}, {ABL[slow]} daha hızlı boyuyor.", "SUPPORTS"),
         (f"Together they need more time than {fast} would alone.", f"Birlikte, {fast} tek başına harcayacağından daha uzun süreye ihtiyaç duyarlar.", "CONTRADICTS"),
         (f"{slow} paints faster than {fast}.", f"{slow}, {ABL[fast]} daha hızlı boyuyor.", "CONTRADICTS"),
         (f"The room is painted white.", f"Oda beyaza boyanıyor.", "UNRELATED"),
         (f"{x} is paid by the hour.", f"{x} saat başına ücret alıyor.", "UNRELATED")]
    for wrong in {F(a + b), F(a + b, 2)}:
        if wrong != t and minutes_ok(wrong):
            c.append((f"Painting the room together takes {dur_en(wrong)}.", f"Odayı birlikte boyamak {dur_tr(wrong)} sürer.", "CONTRADICTS"))
    return pe, pt, c, ("workers2", a, b)


# ---- level 10: the same problems, with sentences and numbers that do not matter --------------------

DISTRACT = {
    "two_pipes": [("The building next door was built in 2015.", "Yandaki bina 2015'te yapıldı."), ("Water costs 12 lira per cubic meter.", "Suyun metreküpü 12 lira.")],
    "fill_drain": [("The garden around it has 3 trees.", "Etrafındaki bahçede 3 ağaç var."), ("The tap was repaired 3 weeks ago.", "Musluk 3 hafta önce tamir edildi.")],
    "two_workers": [("The room has 2 windows.", "Odanın 2 penceresi var."), ("They bought 5 cans of paint.", "5 kutu boya aldılar.")],
    "workers": [("The job is paid 9000 lira.", "İş için 9000 lira ödeniyor."), ("They work 8 hours a day.", "Günde 8 saat çalışıyorlar.")],
    "meeting": [("The car is 6 years old.", "Otomobil 6 yaşında."), ("The truck carries 12 tons of sand.", "Kamyon 12 ton kum taşıyor.")],
    "catch_up": [("The cyclist's bicycle weighs 11 kg.", "Bisikletlinin bisikleti 11 kg."), ("The town has 4000 inhabitants.", "Kasabada 4000 kişi yaşıyor.")],
    "round_trip": [("The car uses 6 liters of fuel per 100 km.", "Araç 100 km'de 6 litre yakıt yakıyor."), ("The driver has driven for 15 years.", "Sürücü 15 yıldır araba kullanıyor.")],
    "ages": [("Their house has 4 rooms.", "Evlerinde 4 oda var."), ("Their grandmother is 81.", "Büyükanneleri 81 yaşında.")],
    "percent": [("The shop opened 7 years ago.", "Mağaza 7 yıl önce açıldı."), ("Thirty customers came in that day.", "O gün mağazaya otuz müşteri geldi.")],
    "mixture": [("The bottles cost 45 lira each.", "Şişelerin tanesi 45 lira."), ("The lab keeps its stock at 20 degrees.", "Laboratuvar stoğunu 20 derecede tutuyor.")],
    "train_bridge": [("The train has 9 cars.", "Trende 9 vagon var."), ("The bridge was opened 30 years ago.", "Köprü 30 yıl önce açıldı.")],
}


def add_distraction(name, pe, pt):
    picks = DISTRACT[name][:]
    rnd.shuffle(picks)
    se, st = pe.split(". "), pt.split(". ")
    for e, t in picks:
        i = rnd.randint(0, len(se))
        j = min(i, len(st))
        se.insert(i, e.rstrip("."))
        st.insert(j, t.rstrip("."))
    join = lambda parts: ". ".join(p.rstrip(".") for p in parts) + "."
    return join(se), join(st)


# ---- levels ------------------------------------------------------------------------------------------
# A level is a list of (maker, numbers, test): the test says whether a made problem belongs to the level.

def is_whole_hours(pe):
    return True


LEVELS = {
    1: [(recall_pipes, lambda: (rnd.randint(2, 15), rnd.randint(2, 15)), None),
        (recall_trip, lambda: (rnd.choice(range(60, 900, 10)), rnd.choice(range(40, 130, 5)), rnd.choice(range(30, 110, 5))), None),
        (recall_ages, lambda: (rnd.randint(3, 80), rnd.randint(3, 80)), None)],
    2: [(one_step_distance, lambda: (rnd.choice(range(30, 125, 5)), rnd.randint(2, 9)), None),
        (one_step_ages, lambda: (rnd.randint(10, 80), rnd.randint(3, 60), rnd.randint(2, 20)), None),
        (one_step_units, lambda: (rnd.choice([18, 36, 54, 72, 90, 108, 126, 144]), rnd.choice(range(50, 1000, 50)), rnd.choice(range(50, 1000, 50))), None)],
    3: [(one_step_time, lambda: (rnd.choice(range(40, 900, 10)), rnd.choice(range(30, 130, 5))), lambda key, c: whole(F(key[1], key[2]))),
        (meeting, lambda: (rnd.choice(range(60, 900, 10)), rnd.choice(range(40, 130, 5)), rnd.choice(range(30, 110, 5))),
         lambda key, c: whole(F(key[1], key[2] + key[3]))),
        (simple_profit, lambda: (rnd.choice(range(50, 2001, 50)), rnd.choice([10, 20, 25, 30, 40, 50, 60, 75, 100])), None)],
    4: [(one_step_time, lambda: (rnd.choice(range(40, 900, 10)), rnd.choice(range(30, 130, 5))), lambda key, c: not whole(F(key[1], key[2]))),
        (meeting, lambda: (rnd.choice(range(60, 900, 10)), rnd.choice(range(40, 130, 5)), rnd.choice(range(30, 110, 5))),
         lambda key, c: not whole(F(key[1], key[2] + key[3])))],
    5: [(two_pipes, lambda: (rnd.randint(2, 15), rnd.randint(2, 15)), lambda key, c: "opened at" not in c),
        (two_workers, lambda: (rnd.randint(2, 15), rnd.randint(2, 15)), None)],
    6: [(fill_drain, lambda: (rnd.randint(2, 12), rnd.randint(2, 18)), None)],
    7: [(catch_up, lambda: (rnd.choice(range(10, 30, 2)), rnd.choice(range(30, 90, 5)), rnd.randint(1, 4)), None),
        (round_trip, lambda: (rnd.choice(range(30, 130, 5)), rnd.choice(range(30, 130, 5)), rnd.choice(range(20, 200, 10))), lambda key, c: "apart" not in c),
        (train_bridge, lambda: (rnd.choice(range(100, 500, 20)), rnd.choice(range(100, 1500, 20)), rnd.choice([36, 54, 72, 90, 108, 126, 144])), None)],
    8: [(ages, lambda: (rnd.randint(2, 6), rnd.randint(2, 5), rnd.randint(2, 20)), None),
        (percent, lambda: (rnd.choice(["updown", "profit"]), rnd.choice(range(100, 5001, 100)), rnd.choice([10, 20, 25, 30, 40, 50])), None),
        (mixture, lambda: (rnd.randint(1, 12), rnd.choice(range(5, 95, 5)), rnd.randint(1, 12), rnd.choice(range(5, 95, 5))), None)],
    9: [(workers, lambda: (rnd.randint(3, 20), rnd.randint(3, 30), rnd.randint(1, 8)), None),
        (two_pipes, lambda: (rnd.randint(2, 15), rnd.randint(2, 15)), lambda key, c: "opened at" in c),
        (round_trip, lambda: (rnd.choice(range(30, 130, 5)), rnd.choice(range(30, 130, 5)), rnd.choice(range(20, 200, 10))), lambda key, c: "apart" in c)],
}
LEVELS[10] = [m for lv in (5, 6, 7, 8, 9) for m in LEVELS[lv]]


def make(level, held_out, used):
    # The type first, then numbers until they work out: every type of a level comes up about as often.
    maker, draw, test = rnd.choice(LEVELS[level])
    for _ in range(20000):
        w = 2 if held_out else rnd.choice([0, 1])
        got = maker(w, draw())
        if not got:
            continue
        pe, pt, claims, key = got
        if key in used or (test and not test(key, pe)):
            continue
        name = maker.__name__
        if level == 10:
            pe, pt = add_distraction(name, pe, pt)
        # One wording of a claim at most; labels per claim are exact, never two labels for one claim.
        seen, clean = {}, []
        for e, t, l in claims:
            if e in seen:
                if seen[e] != l:
                    raise ValueError(f"one claim, two labels: {e}")
                continue
            seen[e] = l
            clean.append((e, t, l))
        per = {l: [x for x in clean if x[2] == l] for l in ("SUPPORTS", "CONTRADICTS", "UNRELATED")}
        if not per["SUPPORTS"] or not per["CONTRADICTS"]:
            continue
        picked = []
        for l, n in (("SUPPORTS", 3), ("CONTRADICTS", 3), ("UNRELATED", 2)):
            rnd.shuffle(per[l])
            picked += per[l][:n]
        return name, pe, pt, picked, key
    raise RuntimeError(f"level {level}: could not make a problem with {maker.__name__}")


def main():
    rows, pid = [], 60000
    dev_keys = set()
    labels = {"SUPPORTS": 0, "CONTRADICTS": 0, "UNRELATED": 0}
    per_level = {}
    for level in range(1, 11):
        # Held-out problems of a level come first, so their numbers can be kept out of its training problems.
        for held in [True] * (N_DEV // 10) + [False] * (N_TRAIN // 10):
            name, pe, pt, claims, key = make(level, held, set() if held else dev_keys)
            if held:
                dev_keys.add(key)
            turkish_too = rnd.random() < 1 / 3
            for e, t, l in claims:
                row = {"id": pid, "kind": "problem", "type": name, "level": level, "premise": pe, "en": e, "tr": t, "label": l}
                if held:
                    row["dev"] = True
                rows.append(row)
                labels[l] += 1
                if turkish_too:
                    rows.append(dict(row, premise=pt, en="", premise_lang="tr"))
            per_level.setdefault(level, collections.Counter())[name] += 1
            pid += 1
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "labels", "problems.jsonl")
    with open(out, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{N_TRAIN} training and {N_DEV} held-out problems in 10 levels, {len(rows)} rows; claims {labels}")
    for lv, cnt in per_level.items():
        print(f"  level {lv}: {dict(cnt)}")


if __name__ == "__main__":
    main()
