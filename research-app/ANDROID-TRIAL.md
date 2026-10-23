Telefona kurmak için aşağıdaki **orbis-arastirma.apk** dosyasını indirin ve açın.

Bu deneme, 1.000 insan yapımı paragraf sorusuyla çalıştırılan son eğitilmiş modeli kullanır. Eski başlangıç modeli seçeneği yoktur. Ayrı 97 soruluk sınavda 44 doğru (%45,4) alınmıştır; uygulamadaki kaynak tarama başarısı ayrıca denenmelidir.

- **Model** sekmesinden E5 anlam modelini indirin veya mevcut E5 modelini kullanın.
- Aynı sekmede son eğitilmiş modelin altındaki **İndir** düğmesine basın. Paket doğrudan GitHub’dan indirilir, doğrulanır ve kendiliğinden kurulur. İndirme yaklaşık 837 MiB (878 MB), açılmış dosyalar yaklaşık 1,13 GB; kurulum için en az 3 GB boş alan gerekir.
- Model paketi GitHub sürümünde açıktır. Hesap, okuma anahtarı, tarayıcı veya dosya seçme işlemi gerekmez.
- Kaynakları toplayın, ardından arama bölümüne Türkçe veya İngilizce bir **iddia** yazın. Model, paragrafları iddiayı destekliyor, çürütüyor veya ilgisiz olarak değerlendirir; yanıt metni üretmez.

Eski kaynaklarınız korunur. Önceki modelin arama sonuçları yeni sonuçlarla karıştırılmaz. Bu sürüm arm64 Android 9 ve üzeri içindir. Gerçek telefondaki hız ve bellek kullanımı henüz ölçülmemiştir.


Bu sürümde 0,80 puan eşiği, puan farkı şartı ve komşu paragraflarla aynı karara ulaşma koşulu kaldırıldı. Ön elemeden geçen paragraf ile yargı doğrudan modele verilir; modelin destekliyor, çürütüyor veya ilgisiz kararı ek eşiklerle elenmez. Eski kurallarla kaydedilmiş arama sonuçları yeniden kullanılmaz; güncellemeden sonra aramayı yeniden başlatın.

Kısa cümleleri biçimleri nedeniyle eleyen eski şartlar geri getirilmedi. Kaynaklar sırayla taranır; varsayılan sınırlar 24 web belgesi ve 60 aday paragraftır. Kırık beyaz/koyu yeşil görünüm, açık/koyu tema ve kaynak/tarih filtreleri korunur. Model ağırlıkları değiştirilmedi ve eğitim yapılmadı.
