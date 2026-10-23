Telefona kurmak için aşağıdaki **orbis-arastirma.apk** dosyasını indirin ve açın.

Bu deneme, 1.000 insan yapımı paragraf sorusuyla çalıştırılan son eğitilmiş modeli kullanır. Eski başlangıç modeli seçeneği yoktur. Ayrı 97 soruluk sınavda 44 doğru (%45,4) alınmıştır; uygulamadaki kaynak tarama başarısı ayrıca denenmelidir.

- **Model** sekmesinden E5 anlam modelini indirin veya mevcut E5 modelini kullanın.
- Aynı sekmede son eğitilmiş modelin altındaki **İndir** düğmesine basın. Paket doğrudan GitHub’dan indirilir, doğrulanır ve kendiliğinden kurulur. İndirme yaklaşık 837 MiB (878 MB), açılmış dosyalar yaklaşık 1,13 GB; kurulum için en az 3 GB boş alan gerekir.
- Model paketi GitHub sürümünde açıktır. Hesap, okuma anahtarı, tarayıcı veya dosya seçme işlemi gerekmez.
- Kaynakları toplayın, ardından arama bölümüne Türkçe veya İngilizce bir **iddia** yazın. Model, paragrafları iddiayı destekliyor, çürütüyor veya ilgisiz olarak değerlendirir; yanıt metni üretmez.

Eski kaynaklarınız korunur. Önceki modelin arama sonuçları yeni sonuçlarla karıştırılmaz. Bu sürüm arm64 Android 9 ve üzeri içindir. Gerçek telefondaki hız ve bellek kullanımı henüz ölçülmemiştir.


Bu güncellemede kısa cümleler, küçük harfle başlayan veya son noktalaması eksik metinler ve şekil açıklamaları sırf biçimleri nedeniyle elenmez. Eski yöntemle okunmuş belgeler web aramasında/toplamada tekrar okunmak üzere sıraya alınır; başarılı yeniden okuma öncesinde eski belge silinmez.

Varsayılan arama 24 web belgesi ve 60 aday paragrafı kapsar. Kaynaklar sırayla değerlendirilir. Belirsiz model kararları ve komşu paragraflarla çelişen kararlar evraka alınmaz; belirsizlerin sayısı ekranda belirtilir. Güncelleme öncesi kararlar yeniden kullanılmaz.

Gönderilen düşük kilolu çocuklar paragrafı, aynı Türkçe yargıyla gerçek model üzerinde kontrol edildi: bu sürüm onu destekleyici kanıt olarak dışa aktarmaz. Bu kontrol, modelin tüm anlamsal hatalarının çözüldüğü anlamına gelmez. Puan eşiği geçici bir çekimser kalma kuralıdır; doğruluk yüzdesi değildir. Model ağırlıkları değiştirilmedi, eğitim yapılmadı.
