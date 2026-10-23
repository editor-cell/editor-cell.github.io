# Orbis Araştırma · DeepSeek / Cloudflare denemesi

Paragraf değerlendirmesi Cloudflare üzerinde DeepSeek-R1-Distill-Qwen-32B ile yapılır. DeepSeek telefona indirilmez. Uygulamanın Model sekmesindeki “DeepSeek’i dene” düğmesi bağlantıyı gerçek bir paragrafla sınar.

Sorgu ve aday paragraflar Cloudflare'e gönderilir. Hem kayıtlı belgelerde hem webde ararken internet gerekir. Daha önce indirilen anlam modeli, paragrafları bulmak için telefonda kullanılmaya devam eder; bu sürüm için yeni bir paragraf modeli indirmek gerekmez.

En çok 24 belge açılır ve 60 paragraf değerlendirilir. Önceki modelin sonuçları yeni denemeye karıştırılmaz. Bağlantı veya kota sorunu aramayı hata mesajıyla durdurur; hata ilgisiz sonuç sayılmaz. Kaldığı yerden devam edilebilir.

Deneme servisi sabit model ve görevle çalışır; dakika başına istek sınırlaması vardır. Ücretli abonelik açılmaz. Kota biterse servis bunu hata olarak gösterir.
