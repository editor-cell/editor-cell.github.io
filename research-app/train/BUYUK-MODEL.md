# Qwen3 4B: paragraf anlama çalışması

23 Ekim 2026. Kullanıcı, İngilizce kaynakları İngilizce taleplerle okuyacak büyük modeli paragraf anlama için eğitmemizi istedi.

## Kurallar

- Model Qwen/Qwen3-4B; güncel başlangıç ve son eğitilmiş ek `qwen_latest.json` dosyasında tutulur. Sonraki tur yalnız buradaki en son ekten devam eder. Eksik ek varsa başlangıç modeline dönülmez.
- İlk tur için 15 dakikalık İngilizce paragraf eğitimi, insan yapımı ve yayımlanmış cevap anahtarlı beş şıklı LSAT okuma sorularıyla yapılır. Yapay soru, çeviri veya etiket üretilmez. Diğer dersler, sudoku ve bağımsız mantık soruları eğitimde kullanılmaz.
- Ücretsiz Kaggle GPU kullanılır; ücretli hesaplama açılmaz. Hugging Face yalnız özel model saklamak için kullanılır.
- Kullanıcıya kısa, Türkçe ve madde işaretli bilgi verilir. Bilgisayarı olduğu varsayılmaz.
- Modelin uygulamaya aktarılması ayrı iştir; bu çalışma uygulamanın mevcut modelini değiştirmez.

## Sabit başlangıç sınavı

- Başlangıç sınavı tamamlandı: Actions 39944863880; Qwen revision `1cfa9a7208912126459214e8b04321603b3df60c`.
- Sonuç 55/97; İngilizce paragraf 43/45, Türkçe paragraf 7/44, mantık 5/8.
- Aynı soru metni, sırası, şıkları ve anahtarı `qwen_exam_reference.json` ile doğrulanır. Fingerprint: `400eaec90c90f516403691afede8403d86c4112641fdc0d2a72ae70acdead61b`.
- Sınavdaki 8 mantık sorusu önceki 97 soruluk sınavla karşılaştırma içindir; eğitimde kullanılmaz. Eğitimden sonra hem 97 sorunun toplamı hem dil bölümleri raporlanır.
- Başlangıç modeli tekrar sınanmaz. Kaydedilmiş başlangıç puanı, son eğitilmiş modelin yeni puanıyla karşılaştırılır.

## Etkin eğitim yolu

- `.github/workflows/qwen-paragraph-training.yml`: `[qwen-paragraph]` işaretli, ilgili dosyaları değiştiren commit veya elle çalıştırma bir tur başlatır.
- `qwen_paragraph_request.json`: 15 dakika, 1000 farklı eğitim soruluk havuz, ayrı 100 kontrol sorusu; ilk tur öğrenme hızı 1e-5.
- `prepare_qwen_paragraph.py`: özgün LSAT train bölümünden seçim yapar. Özgün val/test paragrafları ile sabit 97 sorunun paragrafları eğitimden çıkarılır. Kaynak hashleri, soru yapısı ve metin örtüşmesi doğrulanır; 100 kontrol sorusu da ayrılır.
- `qwen_paragraph_round.py`: yalnız son Qwen üzerinden küçük bir LoRA eki eğitir. Her soruda şık sırası değiştirilir. Süre bitince ek kaydedilir, aynı temel model ve aynı çıkarım ayarlarıyla yeniden yüklenir; önce ayrı kontrol, sonra sabit 97 soru sınanır. Sınavlar model seçimi veya eğitim adımı için kullanılmaz.
- Önceki turlarda çalışılan soru kimlikleri tutulur; yeni tur havuzda henüz çalışılmamış sorulardan sürer. Havuz biterse sessizce tekrar edilmez.
- `qwen_training_state.py`: tamamlanan eki özel Hugging Face deposuna kaydeder ve güncel model işaretçisini ancak önceki durum hâlâ aynıysa ilerletir.
- Rapor `qwen-paragraph-<run>` artifactindedir: gerçek çalışılan farklı soru sayısı, güncelleme sayısı, süre, eski/yeni sınav puanları, özel model konumu. 1000 soruluk havuzun tamamı çalışılmadıysa tamamlanmış gibi raporlanmaz.
- İngilizce puanı gerilerse yeni bir turu kendiliğinden başlatmayın; sonucu kullanıcıya bildirin. Tek sınavdaki değişim kesin öğrenme veya ezber kanıtı değildir.

## Önceki düzenek

`big_read.py` ve `research-app-train-big.yml` önceki taslaktır. Farklı 120 soruluk sınavı ve ders soruları içeren veri seçimi nedeniyle bu çalışma için kullanılmaz. Etkin yol yukarıdaki sabit 97 sorulu, İngilizce paragraf eğitimidir.
