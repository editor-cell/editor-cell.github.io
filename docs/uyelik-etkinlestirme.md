# Üyelik, yorumlar ve üyelere özel yazılar: açma kılavuzu

Kod sitede hazır durur ve kapalıdır. Kapalıyken sitede hiçbir şey değişmez; Supabase'e tek bir istek bile gitmez.
Açmak için aşağıdaki adımlar sırayla yapılır.

## 1. Supabase projesi

1. supabase.com'da hesap açın, "New project" deyin.
2. Ad: `orbis`. Bölge: Central EU (Frankfurt). Veri tabanı şifresini güvenli bir yere kaydedin; kimseyle paylaşmayın.
3. Proje açılınca Project Settings → API bölümünden iki değeri alın:
   - Project URL (`https://….supabase.co`)
   - anon / publishable key (herkese açık anahtar). "service_role" ya da "secret" yazan anahtarı ASLA siteye koymayın.

## 2. Veri tabanını kurmak

1. Supabase'de SQL Editor → New query.
2. `supabase/orbis-members.sql` dosyasının tamamını yapıştırıp Run deyin. Tekrar çalıştırmak zarar vermez.

## 3. Giriş ayarları

1. Authentication → URL Configuration:
   - Site URL: sitenin adresi (şu an `https://orbisreadingatlas.com`)
   - Redirect URLs: aynı adresin sonuna `/**` eklenmiş hâli (`https://orbisreadingatlas.com/**`)
2. Authentication → Email Templates → Magic Link: şablona 6 haneli kodu ekleyin, örneğin bağlantının altına:
   `Kodunuz: {{ .Token }}`
   Telefonda bağlantı başka bir tarayıcıda açılabildiği için kod daha garanti yoldur.
3. Supabase'in kendi e-posta gönderiminin saatlik sınırı çok düşüktür; deneme için yeter, okuyucular gelmeye başlamadan önce
   Authentication → SMTP Settings'ten kendi e-posta hizmetinizi (ör. alan adınıza bağlı bir e-posta hizmeti) bağlayın.
4. İsteğe bağlı, Google ile giriş: Authentication → Providers → Google açılır (Google Cloud'da bir OAuth istemcisi gerekir),
   sonra `src/lib/members/config.ts` içinde `google: true` yapılır.

## 4. Siteyi açmak

`src/lib/members/config.ts` dosyasında üç değer değişir, dosya yüklenir:

```ts
  enabled: true,
  supabaseUrl: "https://xxxx.supabase.co",
  supabaseKey: "herkese-açık-anahtar",
```

## 5. Kendinizi editör yapmak

1. Sitede başlıktaki kişi simgesinden kendi e-postanızla bir kez giriş yapın.
2. Supabase SQL Editor'da (e-postayı kendi adresinizle değiştirerek) çalıştırın:

```sql
update public.profiles set role = 'editor' where email = 'sizin@adresiniz.com';
```

3. Artık `/editor` adresinde editör paneli açılır: yorumlar, üyeler, üyelere özel metinler, yasaklı kelimeler.

## Üyelere özel yazı nasıl yayınlanır

1. Yazının `content/stories/<id>.json` dosyasına `"membersOnly": true` eklenir ve her dilin `body` alanında yalnız
   herkesin okuyabileceği giriş bölümü bırakılır. (Depo herkese açık olduğu için tam metin bu dosyaya yazılmaz.)
2. Tam metin editör panelindeki "Üyelere özel metinler" bölümünden, her dil için ayrı girilir.
3. Ücretli üye yazıyı açınca giriş bölümünün yerine tam metni görür; diğerleri giriş bölümünü ve "Bu yazının devamı ücretli
   üyelere açık" notunu görür.

## Kurallar (veri tabanında, sayfada değil)

- Yorumu yalnız üyeler yazar; herkes okur. Yorum adı profilden gelir.
- Yorumda bağlantı olamaz; yasaklı kelimeler tam kelime olarak engellenir.
- Bir üye dakikada bir, günde en çok otuz yorum yazar.
- Üç ayrı üyenin bildirdiği yorum kendiliğinden gizlenir; editör geri açar ya da siler.
- Okuyucu kendi rolünü ya da ücretli süresini değiştiremez; bunları yalnız editör (ileride ödeme sistemi) değiştirir.

## Ödeme (sonraki aşama)

Ücretli süre `profiles.paid_until` alanında tutulur. Ödeme sistemi bağlanana kadar editör panelinden "+1 ay" / "+1 yıl"
ile verilir. Ödeme sağlayıcısı seçilince, ödeme bildirimini alıp bu alanı güncelleyen küçük bir Supabase işlevi eklenecek.
