# Büyük model: paragrafta anlama eğitimi (ChatGPT için devir notu)

Durum 23 Ekim 2026 itibarıyladır. Bu düzeneği Claude kurdu; turları bundan sonra ChatGPT yürütür.

## Ne eğitiliyor, neden

- Model: uygulamadaki büyük model, Qwen3 4B (Qwen/Qwen3-4B). Uygulama bu modeli paragrafın bir iddiayı destekleyip desteklemediğine karar vermek için kullanıyor.
- Küçük NLI modeli (mDeBERTa) bırakıldı: 1.000 paragraf sorusuyla eğitildikten sonra paragraf sınavı yalnız 43'ten 45'e çıktı.
- Yavuz'un kararı: büyük model yalnız paragrafta anlama eğitimi alacak. Başka konu (mantık, problem, sudoku) yok.

## Yavuz'un kuralları

- Yalnız insanların hazırladığı, cevabı yayımlanmış sorular. Claude'un ya da ChatGPT'nin ürettiği soru ve etiket hiç kullanılmaz. Gerekçesi: yapay zekânın okuma ölçüsü insanınkiyle aynı değil, modele dar okuma taşınmasın.
- Sorular beş şıklı (sınav gibi). Dört şık ve tek tek doğru/yanlış eğitimi istenmiyor.
- Turlar 15 dakika; turlar üst üste konur (her tur bir öncekinin ekinden devam eder). Saatler süren ağır tur yok.
- Öğrenip öğrenmediği yaklaşık 100 soruluk, modelin görmediği bir sınavla ölçülür.
- Eğitim bedava Kaggle kartında yapılır (haftada 30 saat). Hugging Face kredisi harcanmaz.
- Sistem kurmadan önce Yavuz'la konuşulur.
- Yavuz avukat, bilgisayarı yok, her şeyi telefondan yapıyor: ona Türkçe, kısa, madde işaretiyle yazın; dosya yolu ve kod göstermeyin.

## Sorular

- İngilizce: yayımlanmış LSAT okuma soruları (Wang ve ark., From LSAT, 2022; ChatGPT'nin küçük modelde kullandığı kaynakla aynı), yaklaşık 2.340 soru. Uzun paragraf, paragrafla ilgili soru, 5 şık.
- Türkçe: Türkiye'deki sınav müfredatından öğretmen yazımı, paragraf içeren sorular (TurkishMMLU), 5 şık.
- Paragrafların dörtte biri sınava ayrılır (paragrafın özetine göre); bir paragraf hem eğitimde hem sınavda olmaz. Sınav her turda aynı: 60 İngilizce + 60 Türkçe.
- Model paragrafı, soruyu ve A-E şıklarını görür, tek harfle cevap verir (uygulamadaki gibi düşünme kapalı). Şans başarısı %20.
- Eğitimde şıkların sırası her seferinde karıştırılır; model harfi değil cevabı öğrensin diye.

## Nasıl çalıştırılır

- GitHub'da "Research app (big model paragraph reading on a free Kaggle graphics card)" iş akışı, dal anlam-okuma. Elle başlatılır (Run workflow).
- Girdiler:
  - mode: smoke (soruları kurup sayar, Kaggle'a gitmez), start (turu Kaggle'a gönderir ve bekler), collect (bekleme süresini aşan turun sonucunu alır).
  - minutes: eğitim süresi. 0 = yalnız sınav (başlangıç puanı). Varsayılan 15.
  - start: devam edilecek önceki turun Hugging Face deposu (ör. orbis-qwen3-4b-buyuk-okuma-1). Boş = model yayımlandığı hâliyle.
  - kernel: Kaggle defterinin adı; her tur için yeni bir ad (orbis-buyuk-okuma-1, -2, ...). Sonucun deposu bu addan çıkar: orbis-qwen3-4b-buyuk-okuma-N.
  - seed: eğitim sorularının sırası.
- Sonuçlar iş akışının kontrol notlarında, "Reading" başlığıyla: "EXAM before" ve "EXAM after" satırları, İngilizce ve Türkçe ayrı.
- Yalnız küçük bir ek (LoRA) eğitilir ve özel bir Hugging Face deposuna yazılır. Uygulamanın indirdiği model dosyasına dokunulmaz.
- Kaggle kuyruğu yüzünden 15 dakikalık tur 30-90 dakika sürebilir (modelin indirilmesi ve iki sınav dahil).

## İlk adımlar

1. mode=smoke: soruların kurulduğunu ve sayıları gör.
2. mode=start, minutes=0, kernel=orbis-buyuk-okuma-0: hiç eğitilmemiş modelin başlangıç puanı. Kazanç buna göre ölçülür.
3. mode=start, minutes=15, kernel=orbis-buyuk-okuma-1: ilk tur.
4. Sonraki turlar: start=önceki turun deposu, kernel=yeni ad.
5. Sınav düşmeye başlarsa (eğitim kaybı düşüyor ama sınav düşüyorsa) model ezberliyor demektir: dur, Yavuz'a sor. İnsan yapımı yeni beş şıklı paragraf seti bulunmadan aynı soruları tekrar tekrar vermek işe yaramaz.

## Uygulamaya girmesi

- Bu eğitim yalnız bir ek üretir; uygulama tek bir GGUF dosyası kullanıyor. Eki uygulamaya koymak için önce modelle birleştirilip GGUF'a (Q4_K_M) çevrilmesi gerekir. Bu adım henüz kurulmadı; Yavuz'la konuşmadan kurulmaz.
- Uygulamaya girmeden önce uygulamanın kendi testlerinden (ConceptGateTest) geçmeli: paragraf okumayı öğrenip ilgisiz paragrafı ayırmayı ya da Türkçe çeviriyi bozmuş olabilir.
