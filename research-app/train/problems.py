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
Held out: every problem written in a type's last wording, and only with numbers no training problem
uses. Such rows carry "dev": true; train_nli.py scores them on their own and never trains on them.
Writes labels/problems.jsonl. Usage: problems.py [training problems] [held-out problems]"""
import json
import os
import random
import sys
from fractions import Fraction as F

N_TRAIN = int(sys.argv[1]) if len(sys.argv) > 1 else 420
N_DEV = int(sys.argv[2]) if len(sys.argv) > 2 else 110
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
         (f"{x} and {y} are brothers or sisters.", f"{x} ile {y} kardeş.", "UNRELATED")]
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
         (f"{x} and {y} are brother and sister.", f"{x} ile {y} kardeş.", "UNRELATED"),
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


MAKERS = [
    (two_pipes, lambda: (rnd.randint(2, 15), rnd.randint(2, 15))),
    (fill_drain, lambda: (rnd.randint(2, 12), rnd.randint(2, 18))),
    (workers, lambda: (rnd.randint(3, 20), rnd.randint(3, 30), rnd.randint(1, 8))),
    (meeting, lambda: (rnd.choice(range(60, 900, 10)), rnd.choice(range(40, 130, 5)), rnd.choice(range(30, 110, 5)))),
    (catch_up, lambda: (rnd.choice(range(10, 30, 2)), rnd.choice(range(30, 90, 5)), rnd.randint(1, 4))),
    (round_trip, lambda: (rnd.choice(range(30, 130, 5)), rnd.choice(range(30, 130, 5)), rnd.choice(range(20, 200, 10)))),
    (ages, lambda: (rnd.randint(2, 6), rnd.randint(2, 5), rnd.randint(2, 20))),
    (percent, lambda: (rnd.choice(["updown", "profit"]), rnd.choice(range(100, 5001, 100)), rnd.choice([10, 20, 25, 30, 40, 50]))),
    (mixture, lambda: (rnd.randint(1, 12), rnd.choice(range(5, 95, 5)), rnd.randint(1, 12), rnd.choice(range(5, 95, 5)))),
    (train_bridge, lambda: (rnd.choice(range(100, 500, 20)), rnd.choice(range(100, 1500, 20)), rnd.choice([36, 54, 72, 90, 108, 126, 144]))),
]


def make(held_out, used):
    # The type first, then numbers until they work out: every type comes up about as often.
    maker, draw = rnd.choice(MAKERS)
    while True:
        w = 2 if held_out else rnd.choice([0, 1])
        nums = draw()
        got = maker(w, nums)
        if not got:
            continue
        pe, pt, claims, key = got
        if key in used:
            continue
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
        return maker.__name__, pe, pt, picked, key


def main():
    rows, pid = [], 60000
    dev_keys = set()
    counts = {"dev": 0, "train": 0}
    labels = {"SUPPORTS": 0, "CONTRADICTS": 0, "UNRELATED": 0}
    kinds = {}
    plan = [True] * N_DEV + [False] * N_TRAIN
    for held in plan:
        # Held-out problems come first, so their numbers can be kept out of the training problems.
        name, pe, pt, claims, key = make(held, dev_keys if not held else set())
        if held:
            dev_keys.add(key)
        kinds[name] = kinds.get(name, 0) + 1
        turkish_too = rnd.random() < 1 / 3
        for e, t, l in claims:
            row = {"id": pid, "kind": "problem", "type": name, "premise": pe, "en": e, "tr": t, "label": l}
            if held:
                row["dev"] = True
            rows.append(row)
            labels[l] += 1
            if turkish_too:
                rows.append(dict(row, premise=pt, en="", premise_lang="tr"))
        counts["dev" if held else "train"] += 1
        pid += 1
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "labels", "problems.jsonl")
    with open(out, "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"{counts['train']} training and {counts['dev']} held-out problems, {len(rows)} rows; claims {labels}; types {kinds}")


if __name__ == "__main__":
    main()
