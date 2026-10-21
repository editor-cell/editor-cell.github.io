import type { Lang } from "@/lib/types";

/**
 * Terms of use (including the terms of sale) and privacy policy, in English and Turkish.
 *
 * `{publisher}` in a text is replaced with EDITORIAL.publisherName (src/lib/editorial.ts),
 * or with "Orbis" while that is empty. `{email}` is replaced with the contact address.
 * `{prices}` is replaced with the supporting-membership prices from src/lib/members/plans.ts.
 * Other languages show the English text.
 */
export type LegalPage = "terms" | "privacy";

export const LEGAL_PAGES: readonly LegalPage[] = ["terms", "privacy"];

type Section = { heading: string; paragraphs: string[] };
type Doc = { title: string; lead: string; sections: Section[] };

export const LEGAL_UPDATED = "2026-10-09";

const EN: Record<LegalPage, Doc> & {
  updated: string;
  footer: string;
  related: string;
  agree: string[];
} = {
  updated: "Last updated",
  footer: "Legal",
  related: "Other legal pages",
  agree: ["Supporting membership is subject to the", "."],
  terms: {
    title: "Terms of use",
    lead: "These terms govern the use of Orbis at orbisreadingatlas.com and the sale of supporting membership.",
    sections: [
      {
        heading: "Publisher",
        paragraphs: ["Orbis is published by {publisher}. Contact: {email}."],
      },
      {
        heading: "Readings",
        paragraphs: [
          "The readings, recordings, pictures and videos belong to Orbis and their authors. Personal use and short quotations with a link to Orbis are free; republishing them in full or using them commercially needs written permission.",
        ],
      },
      {
        heading: "Membership and comments",
        paragraphs: [
          "Membership is free; you sign in with your e-mail address. Insults, hate speech, threats, other people's personal information, advertising and links are not allowed in comments, and such comments are removed.",
        ],
      },
      {
        heading: "Supporting membership",
        paragraphs: [
          "What you buy: for the period you choose, the Orbis digital magazine of eight articles a week, at least 36,000 characters in total (including spaces, measured on the English text), with audio of each article. Access starts as soon as you pay; you reach it in your browser at orbisreadingatlas.com, signed in to your account.",
          "Gift: access to all other content on Orbis is given to members as a gift; it is not part of what the price pays for.",
          "Price: {prices}. Taxes due in your country are added on the payment page, which shows the total before you pay. Payment is made by card through the payment provider named on that page.",
          "Renewal and cancellation: membership renews at the end of each period for the same period and price unless you cancel. You can cancel at any time; cancelling stops the next renewal, and access lasts until the end of the period you have paid for.",
          "Refunds: because access is provided immediately on payment, there is no right of withdrawal, and payments are not refunded, including for the rest of a cancelled period.",
        ],
      },
      {
        heading: "Law",
        paragraphs: ["Turkish law applies."],
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    lead: "Orbis collects as little about its readers as it can. This page says what is collected, why, and what you can do about it.",
    sections: [
      {
        heading: "Who is responsible",
        paragraphs: [
          "The data controller is {publisher}, publisher of Orbis. For anything about your data, write to {email}.",
        ],
      },
      {
        heading: "Reading without an account",
        paragraphs: [
          "You can read and listen without giving us anything. Orbis uses no advertising and no tracking cookies.",
          "Your browser keeps a few choices on your own device so the site remembers them: language, colour scheme, playback speed and the state of the menu. They are not sent to us.",
          "Our hosting provider, Cloudflare, processes the technical data every website receives (such as IP address and browser type) to deliver the pages and protect the site from attacks.",
        ],
      },
      {
        heading: "Members",
        paragraphs: [
          "When you join, we keep your e-mail address, the name you choose for your comments, your comments, your membership status, and the list of readings you have opened. We use them to run your account and the comment section. Your reading history is shown only to you, and you can clear it at any time on your account page.",
          "The legal basis is the performance of our agreement with you (KVKK article 5/2-c; GDPR article 6(1)(b)).",
        ],
      },
      {
        heading: "Supporting members",
        paragraphs: [
          "Payments are handled by our payment provider. It receives your card details; we do not. From the provider we receive your name, e-mail address, country, the plan you chose and whether your membership is active. We keep payment records for as long as tax law requires.",
        ],
      },
      {
        heading: "Newsletter",
        paragraphs: [
          "If you subscribe to the newsletter, we keep your e-mail address to send it, on the basis of your consent. Every newsletter has a link to unsubscribe, and unsubscribing deletes your address from the list.",
        ],
      },
      {
        heading: "Who else processes the data",
        paragraphs: [
          "We use a small number of service providers: Cloudflare (hosting), Supabase (member accounts and comments), an e-mail delivery service (sign-in codes and the newsletter) and our payment provider. They process data only on our instructions.",
          "Some of these providers keep data on servers outside Türkiye, including in the European Union and the United States. Where the law requires it, such transfers are made with your explicit consent or under the safeguards the law provides (KVKK article 9; GDPR chapter V).",
        ],
      },
      {
        heading: "How long we keep it",
        paragraphs: [
          "Account data is kept until you close your account. Comments are kept with the reading they belong to; when an account is closed, its comments are deleted. Newsletter addresses are kept until you unsubscribe.",
        ],
      },
      {
        heading: "Your rights",
        paragraphs: [
          "You may ask whether we process data about you, receive a copy, have it corrected or deleted, object to its processing and withdraw consent at any time (KVKK article 11; GDPR articles 15 to 21). Write to {email}; we answer within thirty days.",
          "You may also complain to the Turkish Personal Data Protection Authority (KVKK) or, in the European Union, to the data protection authority of your country.",
        ],
      },
    ],
  },
};

const TR: typeof EN = {
  updated: "Son güncelleme",
  footer: "Yasal",
  related: "Diğer yasal sayfalar",
  agree: ["Destekçi üyeliğe", "uygulanır."],
  terms: {
    title: "Kullanım şartları",
    lead: "Bu şartlar, orbisreadingatlas.com adresindeki Orbis'in kullanımına ve destekçi üyelik satışına uygulanır.",
    sections: [
      {
        heading: "Yayıncı",
        paragraphs: ["Orbis'in yayıncısı: {publisher}. İletişim: {email}."],
      },
      {
        heading: "Okumalar",
        paragraphs: [
          "Okumalar, ses kayıtları, görseller ve videolar Orbis'e ve yazarlarına aittir. Kişisel kullanım ve Orbis'e bağlantı verilerek kısa alıntı serbesttir; bütün olarak yeniden yayımlanması veya ticari kullanımı yazılı izne bağlıdır.",
        ],
      },
      {
        heading: "Üyelik ve yorumlar",
        paragraphs: [
          "Üyelik ücretsizdir; e-posta adresinizle giriş yaparsınız. Yorumlarda hakaret, nefret söylemi, tehdit, başkalarına ait kişisel bilgi, reklam ve bağlantı yasaktır; bu tür yorumlar kaldırılır.",
        ],
      },
      {
        heading: "Destekçi üyelik",
        paragraphs: [
          "Satışın konusu: seçilen dönem boyunca her hafta, toplamı en az 36.000 karakter (boşluklar dahil, İngilizce metin esas alınır) olan sekiz yazıdan oluşan Orbis dijital dergisi ve bu yazıların sesli dinlenmesi. Erişim ödemeyle hemen başlar; içeriklere orbisreadingatlas.com'da hesabınızla giriş yaparak tarayıcıdan ulaşılır.",
          "Hediye: Orbis'teki diğer bütün içeriklere erişim üyelere hediye olarak sunulur; ödenen ücretin karşılığı değildir.",
          "Fiyat: {prices}. Bulunduğunuz ülkede ödenmesi gereken vergiler ödeme sayfasında eklenir; toplam tutar ödemeden önce gösterilir. Ödeme, o sayfada adı yazan ödeme hizmet sağlayıcısı aracılığıyla kartla yapılır.",
          "Yenileme ve iptal: üyelik, iptal edilmedikçe her dönemin sonunda aynı süre ve fiyatla yenilenir. Dilediğiniz zaman iptal edebilirsiniz; iptal bir sonraki yenilemeyi durdurur, erişim ödenmiş dönemin sonuna kadar sürer.",
          "İade: erişim ödemeyle hemen sağlandığı için cayma hakkı yoktur; ödemeler, iptal edilen dönemin kalanı dahil, iade edilmez.",
        ],
      },
      {
        heading: "Uygulanacak hukuk",
        paragraphs: ["Türk hukuku uygulanır."],
      },
    ],
  },
  privacy: {
    title: "Gizlilik politikası",
    lead: "Orbis okurları hakkında olabildiğince az bilgi toplar. Bu sayfa neyin, neden toplandığını ve bu konuda neler yapabileceğinizi anlatır.",
    sections: [
      {
        heading: "Veri sorumlusu",
        paragraphs: [
          "Veri sorumlusu: {publisher} (Orbis'in yayıncısı). Verilerinizle ilgili her konuda {email} adresine yazabilirsiniz.",
        ],
      },
      {
        heading: "Hesapsız okuma",
        paragraphs: [
          "Hiçbir bilgi vermeden okuyabilir ve dinleyebilirsiniz. Orbis reklam ve takip çerezi kullanmaz.",
          "Tarayıcınız, sitenin tercihlerinizi hatırlaması için bazı seçimleri kendi cihazınızda saklar: dil, renk teması, oynatma hızı ve menünün durumu. Bunlar bize gönderilmez.",
          "Barındırma hizmeti sağlayıcımız Cloudflare, sayfaları ulaştırmak ve siteyi saldırılara karşı korumak için her web sitesine gelen teknik verileri (IP adresi, tarayıcı türü gibi) işler.",
        ],
      },
      {
        heading: "Üyeler",
        paragraphs: [
          "Üye olduğunuzda e-posta adresiniz, yorumlarınızda görünmesini seçtiğiniz ad, yorumlarınız, üyelik durumunuz ve açtığınız yazıların listesi saklanır. Bunlar hesabınızı ve yorum bölümünü yürütmek için kullanılır. Okuma geçmişinizi yalnız siz görürsünüz ve hesap sayfanızdan istediğiniz zaman silebilirsiniz.",
          "Hukuki sebep, sizinle aramızdaki sözleşmenin ifasıdır (KVKK m. 5/2-c; GDPR m. 6/1-b).",
        ],
      },
      {
        heading: "Destekçi üyeler",
        paragraphs: [
          "Ödemeler ödeme hizmet sağlayıcımız tarafından yürütülür. Kart bilgileriniz sağlayıcıya iletilir, bize gelmez. Sağlayıcıdan adınız, e-posta adresiniz, ülkeniz, seçtiğiniz plan ve üyeliğinizin etkin olup olmadığı bilgisi gelir. Ödeme kayıtları vergi mevzuatının öngördüğü süre boyunca saklanır.",
        ],
      },
      {
        heading: "Bülten",
        paragraphs: [
          "Bültene kaydolursanız e-posta adresiniz, açık rızanıza dayanarak, bülteni göndermek için saklanır. Her bültende abonelikten çıkma bağlantısı bulunur; çıktığınızda adresiniz listeden silinir.",
        ],
      },
      {
        heading: "Verileri işleyen diğer taraflar",
        paragraphs: [
          "Az sayıda hizmet sağlayıcıyla çalışıyoruz: Cloudflare (barındırma), Supabase (üye hesapları ve yorumlar), bir e-posta gönderim hizmeti (giriş kodları ve bülten) ve ödeme hizmet sağlayıcımız. Bu sağlayıcılar verileri yalnız bizim talimatımızla işler.",
          "Bu sağlayıcılardan bazıları verileri Avrupa Birliği ve Amerika Birleşik Devletleri dahil Türkiye dışındaki sunucularda tutar. Kanunun aradığı hâllerde bu aktarımlar açık rızanızla ya da kanunun öngördüğü güvencelerle yapılır (KVKK m. 9; GDPR V. bölüm).",
        ],
      },
      {
        heading: "Saklama süresi",
        paragraphs: [
          "Hesap verileri, hesabınızı kapatana kadar saklanır. Yorumlar ait oldukları okumayla birlikte durur; hesap kapatıldığında o hesabın yorumları silinir. Bülten adresleri abonelikten çıkılana kadar saklanır.",
        ],
      },
      {
        heading: "Haklarınız",
        paragraphs: [
          "Hakkınızda veri işlenip işlenmediğini öğrenme, bir kopyasını alma, düzeltilmesini veya silinmesini isteme, işlenmesine itiraz etme ve rızanızı dilediğiniz zaman geri alma haklarına sahipsiniz (KVKK m. 11; GDPR m. 15-21). Başvurularınızı {email} adresine yazabilirsiniz; otuz gün içinde yanıt verilir.",
          "Kişisel Verileri Koruma Kurumu'na ya da Avrupa Birliği'nde bulunuyorsanız kendi ülkenizin veri koruma otoritesine şikâyette bulunabilirsiniz.",
        ],
      },
    ],
  },
};

export function legalCopy(lang: Lang) {
  return lang === "tr" ? TR : EN;
}
