"""Eş anlamlı ve eş sesli (synonyms and homonyms) for the NLI model, written by hand.

Synonyms: a claim that says what the paragraph says in other words (declined / geriledi / azaldı,
scrapped / kaldırıldı / son verdi) is SUPPORTED; the same words turned the other way CONTRADICT.
Homonyms: a word with two meanings (interest = ilgi / faiz, capital = sermaye / başkent, bill =
fatura / tasarı, bağ = üzüm bağı / ilişki, dolu = yağış / boş olmayan). The claim that takes the
meaning the paragraph means is SUPPORTED; the claim that takes the other meaning is UNRELATED, even
though it shares the word. The paragraph is in English as in the app; each claim comes in Turkish
and English. Writes labels/words.jsonl."""
import json
import os

S, C, U = "SUPPORTS", "CONTRADICTS", "UNRELATED"

GROUPS = [
    # ---- homonyms: the paragraph's meaning against the other meaning ----
    ("Interest in electric cars among young buyers rose sharply in 2023.", [
        ("2023'te genç alıcıların elektrikli otomobillere ilgisi belirgin biçimde arttı.", "Young buyers' interest in electric cars rose sharply in 2023.", S),
        ("2023'te elektrikli otomobil kredilerinde faizler belirgin biçimde arttı.", "Interest rates on electric car loans rose sharply in 2023.", U)]),
    ("The central bank kept interest rates unchanged at 5 percent in March.", [
        ("Merkez bankası martta faizi yüzde 5'te sabit tuttu.", "In March the central bank held its rate at 5 percent.", S),
        ("Martta merkez bankasına gösterilen ilgi değişmedi.", "The attention paid to the central bank did not change in March.", U),
        ("Merkez bankası martta faizi yüzde 5'e indirdi.", "The central bank cut its rate to 5 percent in March.", C)]),
    ("Flooding damaged homes along the east bank of the river.", [
        ("Sel, nehrin doğu kıyısındaki evlere zarar verdi.", "The flood harmed houses on the river's east side.", S),
        ("Sel, doğu bölgesindeki bir bankanın binasına zarar verdi.", "The flood damaged a bank's building in the east.", U)]),
    ("Foreign capital flowing into the country fell by a third last year.", [
        ("Geçen yıl ülkeye giren yabancı sermaye üçte bir azaldı.", "Foreign investment coming into the country dropped by a third last year.", S),
        ("Geçen yıl başkente gelen yabancıların sayısı üçte bir azaldı.", "The number of foreigners coming to the capital city fell by a third last year.", U),
        ("Geçen yıl ülkeye giren yabancı sermaye arttı.", "Foreign capital coming into the country rose last year.", C)]),
    ("Parliament passed the bill on pension reform in June.", [
        ("Meclis emeklilik reformu tasarısını haziranda kabul etti.", "In June lawmakers approved the pension reform bill.", S),
        ("Emeklilerin faturaları haziranda arttı.", "Pensioners' bills went up in June.", U)]),
    ("Households' energy bills doubled over the winter.", [
        ("Hanelerin enerji faturaları kışın iki katına çıktı.", "Households paid twice as much for energy over the winter.", S),
        ("Enerjiyle ilgili yasa tasarısı kışın iki kez görüşüldü.", "The energy bill was debated twice in parliament over the winter.", U)]),
    ("The government cut the duty on imported wheat to zero.", [
        ("Hükümet ithal buğdaydaki gümrük vergisini sıfırladı.", "The government removed the import tax on wheat.", S),
        ("Hükümet buğday ithalatını denetleme görevini başka bir kuruma devretti.", "The government handed its task of overseeing wheat imports to another agency.", U)]),
    ("The regulator imposed a fine on the bank for misleading customers.", [
        ("Düzenleyici kurum, müşterileri yanılttığı için bankaya para cezası verdi.", "The regulator penalised the bank for misleading its customers.", S),
        ("Düzenleyici kurum, bankanın müşterilere davranışını iyi buldu.", "The regulator found the bank's conduct towards customers fine.", C)]),
    ("Banks introduced a monthly charge for paper statements.", [
        ("Bankalar kâğıt hesap özetleri için aylık ücret almaya başladı.", "Banks began charging a monthly fee for paper statements.", S),
        ("Bankalar kâğıt hesap özetleri yüzünden suçlamalarla karşılaştı.", "Banks faced accusations over paper statements.", U)]),
    ("Pension funds sold government securities worth 2 billion dollars.", [
        ("Emeklilik fonları 2 milyar dolarlık devlet menkul kıymeti sattı.", "Pension funds sold 2 billion dollars of government paper.", S),
        ("Emeklilik fonları devletin güvenlik harcamalarına 2 milyar dolar ayırdı.", "Pension funds put 2 billion dollars into government security spending.", U)]),
    ("The company's stock fell 12 percent after the report.", [
        ("Rapordan sonra şirketin hisseleri yüzde 12 değer kaybetti.", "The company's shares lost 12 percent after the report.", S),
        ("Rapordan sonra şirketin depodaki ürün stoku yüzde 12 azaldı.", "The company's inventory shrank 12 percent after the report.", U)]),
    ("Retailers' stocks of unsold winter clothing rose in February.", [
        ("Perakendecilerin satılmamış kışlık giysi stokları şubatta arttı.", "Shops were left with more unsold winter clothes in February.", S),
        ("Perakende şirketlerinin hisseleri şubatta yükseldi.", "Retailers' share prices went up in February.", U)]),
    ("The carmaker closed its plant in Ohio in 2019.", [
        ("Otomobil üreticisi 2019'da Ohio'daki fabrikasını kapattı.", "The car company shut its Ohio factory in 2019.", S),
        ("Otomobil üreticisi 2019'da Ohio'daki bitki yetiştirme projesini durdurdu.", "The car company stopped its plant-growing project in Ohio in 2019.", U)]),
    ("Yields on ten-year government bonds rose above 4 percent.", [
        ("On yıllık devlet tahvillerinin getirisi yüzde 4'ün üzerine çıktı.", "Ten-year government bonds now return more than 4 percent.", S),
        ("On yıl içinde tarladan alınan verim yüzde 4'ten fazla arttı.", "Crop yields grew by more than 4 percent over ten years.", U)]),
    ("Wheat yields fell after the drought.", [
        ("Kuraklıktan sonra buğday verimi düştü.", "After the drought, less wheat was harvested per field.", S),
        ("Kuraklıktan sonra tarım tahvillerinin getirisi düştü.", "Returns on farm bonds fell after the drought.", U),
        ("Kuraklıktan sonra buğday verimi arttı.", "Wheat yields rose after the drought.", C)]),
    ("The government announced new measures to curb inflation.", [
        ("Hükümet enflasyonu frenlemek için yeni önlemler açıkladı.", "The government set out new steps to rein in inflation.", S),
        ("Hükümet enflasyonu ölçmek için yeni bir yöntem açıkladı.", "The government announced a new way of measuring inflation.", U)]),
    ("The insurer cancelled thousands of home policies in Florida.", [
        ("Sigorta şirketi Florida'da binlerce konut poliçesini iptal etti.", "The insurance company dropped thousands of home insurance contracts in Florida.", S),
        ("Sigorta şirketi Florida'nın konut politikasına karşı çıktı.", "The insurer opposed Florida's housing policy.", U)]),
    ("Trade between the two countries doubled in a decade.", [
        ("İki ülke arasındaki ticaret on yılda iki katına çıktı.", "Commerce between the two countries grew twofold in ten years.", S),
        ("İki ülkede zanaat öğrenen gençlerin sayısı on yılda iki katına çıktı.", "The number of young people learning a trade in the two countries doubled in ten years.", U)]),
    ("Tourism accounts for a tenth of the economy.", [
        ("Turizm ekonominin onda birini oluşturuyor.", "Tourism makes up a tenth of the economy.", S),
        ("Turizm şirketlerinin hesaplarında ekonominin onda biri tutuluyor.", "A tenth of the economy is held in tourism companies' accounts.", U)]),
    ("The trade fair in Izmir drew fewer visitors this year.", [
        ("İzmir'deki ticaret fuarı bu yıl daha az ziyaretçi çekti.", "Fewer people visited the Izmir trade fair this year.", S),
        ("İzmir'de ticaret bu yıl daha az adil oldu.", "Trade in Izmir was less fair this year.", U)]),
    ("Vineyards in the region shrank by a fifth.", [
        ("Bölgedeki üzüm bağları beşte bir küçüldü.", "The area under grapevines in the region fell by a fifth.", S),
        ("Bölgedeki ticari bağlar beşte bir zayıfladı.", "Business ties in the region weakened by a fifth.", U)]),
    ("Hail destroyed a third of the apricot harvest.", [
        ("Dolu, kayısı hasadının üçte birini yok etti.", "A hailstorm wiped out a third of the apricot crop.", S),
        ("Kayısı depolarının üçte biri dolu.", "A third of the apricot stores are full.", U)]),
    ("Exports by land fell while sea shipments rose.", [
        ("Karayoluyla ihracat azalırken deniz yoluyla sevkiyat arttı.", "Exports sent overland went down as shipments by sea went up.", S),
        ("Kara para ihracatı azaldı.", "The export of black money fell.", U),
        ("Deniz yoluyla sevkiyat azaldı.", "Sea shipments fell.", C)]),
    ("Turkey is the largest market for German cars in the region.", [
        ("Türkiye, bölgede Alman otomobilleri için en büyük pazar.", "In the region, Turkey buys the most German cars.", S),
        ("Alman otomobilleri bölgede en çok pazar günleri satılıyor.", "German cars sell best on Sundays in the region.", U)]),
    ("The central bank sold dollars to support the lira.", [
        ("Merkez bankası lirayı desteklemek için dolar sattı.", "The central bank sold dollars to prop up the lira.", S),
        ("Merkez bankası lirayı desteklemek için yeni bir kurum kurdu.", "The central bank set up a new agency to support the lira.", U)]),
    ("Most of the country's income comes from oil.", [
        ("Ülkenin gelirinin büyük kısmı petrolden gelir.", "Oil provides the bulk of the country's revenue.", S),
        ("Ülkenin gelirinin küçük bir kısmı petrolden gelir.", "Only a small share of the country's income comes from oil.", C)]),
    ("The average age of farmers rose to 58.", [
        ("Çiftçilerin yaş ortalaması 58'e yükseldi.", "Farmers are now 58 years old on average.", S),
        ("Çiftçilerin yaş ürün satışları 58'e yükseldi.", "Farmers' sales of fresh produce rose to 58.", U)]),
    ("Official figures show that exports rose in May.", [
        ("Resmî rakamlar ihracatın mayısta arttığını gösteriyor.", "Government statistics show exports went up in May.", S),
        ("Mayısta ihracat arttı.", "Exports rose in May.", S),
        ("Mayısta ihracat azaldı.", "Exports fell in May.", C)]),

    # ---- synonyms: the same judgment in other words ----
    ("Unemployment declined steadily in 2022.", [
        ("2022'de işsizlik istikrarlı biçimde geriledi.", "Joblessness fell steadily in 2022.", S),
        ("2022'de işsizlik sürekli azaldı.", "Unemployment kept going down in 2022.", S),
        ("2022'de işsizlik arttı.", "Unemployment rose in 2022.", C)]),
    ("The government scrapped the fuel subsidy in July.", [
        ("Hükümet temmuzda akaryakıt sübvansiyonunu kaldırdı.", "The government abolished the fuel subsidy in July.", S),
        ("Hükümet temmuzda yakıt desteğine son verdi.", "In July the government ended its support for fuel.", S),
        ("Hükümet temmuzda akaryakıt sübvansiyonunu artırdı.", "The government increased the fuel subsidy in July.", C)]),
    ("Prices soared after the drought.", [
        ("Kuraklıktan sonra fiyatlar fırladı.", "Prices shot up after the drought.", S),
        ("Kuraklıktan sonra fiyatlar hızla yükseldi.", "Prices climbed fast after the drought.", S),
        ("Kuraklıktan sonra fiyatlar yalnızca biraz arttı.", "Prices rose only slightly after the drought.", C)]),
    ("Many economists doubt that the plan will work.", [
        ("Birçok iktisatçı planın işe yarayacağından kuşkulu.", "Many economists are sceptical that the plan will succeed.", S),
        ("Pek çok ekonomist planın işe yarayacağından şüphe ediyor.", "Plenty of economists have doubts about whether the plan will work.", S),
        ("Birçok iktisatçı planın başarılı olacağından emin.", "Many economists are sure the plan will succeed.", C)]),
    ("The reform curbed tax evasion.", [
        ("Reform vergi kaçakçılığını frenledi.", "The reform held back tax evasion.", S),
        ("Reform vergi kaçırmayı azalttı.", "The reform reduced tax dodging.", S),
        ("Reform vergi kaçakçılığını tamamen bitirdi.", "The reform ended tax evasion completely.", U)]),
    ("Most households cannot afford a new car.", [
        ("Hanelerin çoğunun yeni bir otomobile gücü yetmiyor.", "Most households do not have the money for a new car.", S),
        ("Hanelerin çoğu yeni bir otomobil alabilecek durumda.", "Most households are able to buy a new car.", C)]),
    ("The minister resigned after the scandal.", [
        ("Bakan skandalın ardından istifa etti.", "The minister quit after the scandal.", S),
        ("Bakan skandalın ardından görevinden çekildi.", "The minister stepped down after the scandal.", S),
        ("Bakan skandalın ardından görevden alındı.", "The minister was dismissed after the scandal.", U)]),
    ("Rents climbed by 30 percent in Istanbul.", [
        ("İstanbul'da kiralar yüzde 30 arttı.", "Rents in Istanbul went up 30 percent.", S),
        ("İstanbul'da kira bedelleri yüzde 30 tırmandı.", "Istanbul rents rose by 30 percent.", S),
        ("İstanbul'da kiralar yüzde 30 geriledi.", "Rents in Istanbul fell 30 percent.", C)]),
    ("Inflation slowed to 3 percent.", [
        ("Enflasyon yüzde 3'e geriledi.", "Inflation eased to 3 percent.", S),
        ("Fiyat artışı yüzde 3'e indi.", "The rate of price increases came down to 3 percent.", S),
        ("Enflasyon yüzde 3'e çıktı.", "Inflation went up to 3 percent.", C)]),
    ("The study found no link between screen time and grades.", [
        ("Çalışma, ekran süresiyle notlar arasında bir bağlantı bulmadı.", "The research found no connection between screen time and marks.", S),
        ("Araştırmada ekran süresiyle notlar arasında bir ilişki görülmedi.", "The study saw no relation between time on screens and grades.", S),
        ("Çalışma, ekran süresinin notları düşürdüğünü buldu.", "The study found that screen time lowers grades.", C)]),
    ("Wages lagged behind inflation.", [
        ("Ücretler enflasyonun gerisinde kaldı.", "Pay did not keep up with inflation.", S),
        ("Ücret artışları enflasyona yetişemedi.", "Wage rises fell short of inflation.", S),
        ("Ücretler enflasyondan hızlı arttı.", "Wages grew faster than inflation.", C)]),
    ("The bank raised its lending rate.", [
        ("Banka kredi faizini artırdı.", "The bank increased the rate it charges on loans.", S),
        ("Banka borç verme faizini yükseltti.", "The bank put up its lending rate.", S),
        ("Banka mevduat faizini artırdı.", "The bank raised the rate it pays on deposits.", U)]),
    ("Exports to Germany halved.", [
        ("Almanya'ya ihracat yarıya indi.", "Exports to Germany fell by half.", S),
        ("Almanya'ya ihracat yüzde 50 azaldı.", "Exports to Germany dropped 50 percent.", S),
        ("Almanya'ya ihracat iki katına çıktı.", "Exports to Germany doubled.", C)]),
    ("The scheme was scrapped for lack of funds.", [
        ("Program para yetersizliği yüzünden iptal edildi.", "The programme was cancelled because there was not enough money.", S),
        ("Program kaynak bulunamadığı için rafa kaldırıldı.", "The scheme was shelved as no funding could be found.", S),
        ("Program başarısız olduğu için iptal edildi.", "The scheme was cancelled because it failed.", U)]),
    ("Few firms took up the subsidy.", [
        ("Destekten az sayıda şirket yararlandı.", "Only a small number of companies used the subsidy.", S),
        ("Şirketlerin pek azı sübvansiyonu kullandı.", "Hardly any firms made use of the subsidy.", S),
        ("Şirketlerin çoğu destekten yararlandı.", "Most firms took up the subsidy.", C)]),
    ("The vaccine roll-out sped up in April.", [
        ("Nisanda aşılama hızlandı.", "Vaccination picked up pace in April.", S),
        ("Aşı uygulaması nisanda ivme kazandı.", "The vaccination drive gathered speed in April.", S),
        ("Aşılama nisanda yavaşladı.", "Vaccination slowed down in April.", C)]),
    ("The country is heavily reliant on imported gas.", [
        ("Ülke büyük ölçüde ithal gaza bağımlı.", "The country depends largely on gas from abroad.", S),
        ("Ülkenin gaz ihtiyacının çoğu ithalatla karşılanıyor.", "Most of the country's gas needs are met by imports.", S),
        ("Ülke gazda kendi kendine yetiyor.", "The country is self-sufficient in gas.", C)]),
    ("The bank's profits rose by a hundred percent.", [
        ("Bankanın kârı yüzde yüz arttı.", "The bank's profit grew by one hundred percent.", S),
        ("Bankanın kârı iki katına çıktı.", "The bank's profit doubled.", S),
        ("Bankanın kârı yarıya indi.", "The bank's profit halved.", C)]),
    ("The country defaulted on its foreign debt in 2001.", [
        ("Ülke 2001'de dış borçlarını ödeyemez duruma düştü.", "In 2001 the country failed to pay its foreign debts.", S),
        ("Ülke 2001'de dış borçlarını zamanında ödedi.", "The country paid its foreign debts on time in 2001.", C)]),
]


def build():
    rows = []
    for k, (premise, claims) in enumerate(GROUPS):
        for tr, en, label in claims:
            rows.append({"id": 40000 + k, "kind": "words", "premise": premise, "en": en, "tr": tr, "label": label})
    return rows


if __name__ == "__main__":
    rows = build()
    here = os.path.dirname(os.path.abspath(__file__))
    with open(os.path.join(here, "labels", "words.jsonl"), "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(len(GROUPS), "paragraphs,", len(rows), "claims:", {l: sum(r["label"] == l for r in rows) for l in (S, C, U)})
