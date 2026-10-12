import type { Lang } from "../types.ts";

/** Words for the membership, payment and newsletter pages, in the five languages. */
export type PagesCopy = {
  membership: {
    title: string;
    lead: string;
    /** The menu and footer link while membership is free only. */
    menu: string;
    /** The page's heading and lead while membership is free only. */
    heading: string;
    freeLead: string;
    free: { name: string; price: string; points: string[]; action: string };
    paid: { name: string; points: string[]; action: string };
    /** The unit after a price: "/ ay", "/ 3 ay", … */
    per: Record<"monthly" | "quarterly" | "halfyear" | "yearly", string>;
    or: string;
    haveAccount: string;
    signIn: string;
    /** Beside the buttons while membership is not yet open. */
    soon: string;
  };
  payment: {
    title: string;
    lead: string;
    period: string;
    /** The name of each period on the payment page. */
    periods: Record<"monthly" | "quarterly" | "halfyear" | "yearly", string>;
    /** Beside the yearly period. */
    yearlyNote: { USD: string };
    summary: string;
    plan: string;
    total: string;
    includes: string;
    pay: string;
    waiting: string;
    back: string;
  };
  newsletter: {
    title: string;
    lead: string;
    soon: string;
    soonNote: string;
  };
  /** The account page while sign-up is not yet switched on. */
  accountSoon: string;
  seePlans: string;
  /** Under a reading while comments are not yet switched on. */
  joinToComment: string;
};

const COPY: Record<Lang, PagesCopy> = {
  tr: {
    membership: {
      title: "Üyelik",
      lead: "Orbis’teki okumaların çoğu herkese açık. Üye olarak yazıların altında yorum yazabilir, destekçi üyelikle her hafta sekiz yazıdan oluşan dijital dergiyi okuyup dinleyebilir, Orbis’in bağımsız çalışmasına katkı verebilirsiniz.",
      menu: "Ücretsiz kayıt ol",
      heading: "Orbis’e katılın",
      freeLead:
        "Orbis’teki bütün yazılar herkese açık; okumak da dinlemek de ücretsiz. Üyelik de ücretsiz.",
      free: {
        name: "Ücretsiz üyelik",
        price: "Ücretsiz",
        points: [
          "Yazıların altında yorum yazma",
          "Okuduğunuz bütün yazıların listesi; hangi cihazdan girerseniz girin",
          "Haftalık bülten, açıldığında",
        ],
        action: "Ücretsiz kayıt ol",
      },
      paid: {
        name: "Destekçi üyelik",
        points: [
          "Her hafta sekiz yazıdan oluşan dijital dergi",
          "Dergideki yazıları sesli dinleme",
          "Hediye: bütün içeriklere erişim",
          "Ücretsiz üyeliğin bütün imkânları",
          "Kaynaklara dayalı, bağımsız yayıncılığa doğrudan destek",
        ],
        action: "Destekçi ol",
      },
      per: {
        monthly: "ay",
        quarterly: "3 ay",
        halfyear: "6 ay",
        yearly: "yıl",
      },
      or: "ya da",
      haveAccount: "Zaten üye misiniz?",
      signIn: "Giriş yapın",
      soon: "Yakında",
    },
    payment: {
      title: "Ödeme",
      lead: "Destekçi üyelik için bir dönem seçin.",
      period: "Dönem",
      periods: {
        monthly: "Aylık",
        quarterly: "3 aylık",
        halfyear: "6 aylık",
        yearly: "Yıllık",
      },
      yearlyNote: { USD: "En avantajlı" },
      summary: "Özet",
      plan: "Destekçi üyelik",
      total: "Toplam",
      includes: "Üyeliğe dahil olanlar",
      pay: "Ödemeye geç",
      waiting:
        "Kartla ödeme kısa süre içinde açılıyor. Açıldığında bu düğme sizi güvenli ödeme sayfasına götürecek.",
      back: "Üyelik seçeneklerine dön",
    },
    newsletter: {
      title: "Bülten",
      lead: "Orbis Bülteni, yeni yayımlanan okumaları ve arşivden seçilmiş yazıları belli aralıklarla e-posta kutunuza getirecek.",
      soon: "Bülten yakında faaliyete geçecek.",
      soonNote: "Kayıt formu açıldığında bu sayfada yer alacak.",
    },
    accountSoon: "Üye kayıtları kısa süre içinde açılıyor.",
    seePlans: "Üyelik seçeneklerine bakın",
    joinToComment: "Yorum yazmak için üye olun.",
  },
  ar: {
    membership: {
      title: "العضوية",
      lead: "معظم قراءات أوربيس متاحة للجميع. بالعضوية يمكنك التعليق تحت المقالات، وبعضوية الداعم تصل إلى المقالات الخاصة بالأعضاء وتسهم في عمل أوربيس المستقل.",
      menu: "انضم مجانًا",
      heading: "انضم إلى أوربيس",
      freeLead: "كل قراءات أوربيس متاحة للجميع، قراءةً واستماعًا، والعضوية مجانية أيضًا.",
      free: {
        name: "العضوية المجانية",
        price: "مجانًا",
        points: [
          "التعليق تحت المقالات",
          "قائمة بكل ما قرأته، من أي جهاز تدخل منه",
          "النشرة الأسبوعية، عند إطلاقها",
        ],
        action: "انضم مجانًا",
      },
      paid: {
        name: "عضوية الداعم",
        points: [
          "المقالات الخاصة بالأعضاء كاملة",
          "كل ما في العضوية المجانية",
          "دعم مباشر لنشر مستقل قائم على المصادر",
        ],
        action: "كن داعمًا",
      },
      per: {
        monthly: "شهريًا",
        quarterly: "كل 3 أشهر",
        halfyear: "كل 6 أشهر",
        yearly: "سنويًا",
      },
      or: "أو",
      haveAccount: "أنت عضو بالفعل؟",
      signIn: "سجّل الدخول",
      soon: "قريبًا",
    },
    payment: {
      title: "الدفع",
      lead: "اختر مدة عضوية الداعم.",
      period: "المدة",
      periods: {
        monthly: "شهري",
        quarterly: "كل 3 أشهر",
        halfyear: "كل 6 أشهر",
        yearly: "سنوي",
      },
      yearlyNote: { USD: "الأوفر" },
      summary: "الملخص",
      plan: "عضوية الداعم",
      total: "المجموع",
      includes: "ما تشمله العضوية",
      pay: "تابع إلى الدفع",
      waiting: "يُفتح الدفع بالبطاقة قريبًا. عندها ينقلك هذا الزر إلى صفحة دفع آمنة.",
      back: "العودة إلى خيارات العضوية",
    },
    newsletter: {
      title: "النشرة",
      lead: "ستحمل نشرة أوربيس إلى بريدك، على فترات منتظمة، القراءات الجديدة ومقالات مختارة من الأرشيف.",
      soon: "تبدأ النشرة قريبًا.",
      soonNote: "سيظهر نموذج الاشتراك في هذه الصفحة عند افتتاحها.",
    },
    accountSoon: "يُفتح تسجيل الأعضاء قريبًا.",
    seePlans: "اطّلع على خيارات العضوية",
    joinToComment: "انضم لتكتب تعليقًا.",
  },
  en: {
    membership: {
      title: "Membership",
      lead: "Most Orbis readings are open to everyone. As a member you can comment under the readings; as a supporting member you also read and listen to the weekly digital magazine of eight articles and help keep Orbis independent.",
      menu: "Join Free",
      heading: "Join Orbis",
      freeLead: "Every reading on Orbis is free to read and to listen to. Joining is free too.",
      free: {
        name: "Free membership",
        price: "Free",
        points: [
          "Write comments under the readings",
          "Your reading history, on any device you sign in from",
          "The weekly newsletter, when it opens",
        ],
        action: "Join Free",
      },
      paid: {
        name: "Supporting membership",
        points: [
          "A digital magazine of eight articles every week",
          "Audio of every magazine article",
          "Gift: access to all content",
          "Everything in free membership",
          "Direct support for sourced, independent publishing",
        ],
        action: "Become a supporter",
      },
      per: {
        monthly: "month",
        quarterly: "3 months",
        halfyear: "6 months",
        yearly: "year",
      },
      or: "or",
      haveAccount: "Already a member?",
      signIn: "Sign in",
      soon: "Coming soon",
    },
    payment: {
      title: "Payment",
      lead: "Choose a period for your supporting membership.",
      period: "Period",
      periods: {
        monthly: "Monthly",
        quarterly: "Every 3 months",
        halfyear: "Every 6 months",
        yearly: "Yearly",
      },
      yearlyNote: { USD: "Best value" },
      summary: "Summary",
      plan: "Supporting membership",
      total: "Total",
      includes: "Included",
      pay: "Continue to payment",
      waiting:
        "Card payment opens shortly. When it does, this button will take you to a secure checkout page.",
      back: "Back to membership options",
    },
    newsletter: {
      title: "Newsletter",
      lead: "The Orbis newsletter will bring new readings and pieces chosen from the archive to your inbox at regular intervals.",
      soon: "The newsletter is launching soon.",
      soonNote: "The sign-up form will appear on this page when it opens.",
    },
    accountSoon: "Member sign-up opens shortly.",
    seePlans: "See membership options",
    joinToComment: "Join to comment.",
  },
  fr: {
    membership: {
      title: "Adhésion",
      lead: "La plupart des lectures d’Orbis sont ouvertes à tous. Membre, vous pouvez commenter sous les textes ; membre bienfaiteur, vous lisez aussi les textes réservés aux membres, et soutenez l’indépendance d’Orbis.",
      menu: "Inscription gratuite",
      heading: "Rejoindre Orbis",
      freeLead:
        "Toutes les lectures d’Orbis sont gratuites, à lire comme à écouter. L’inscription aussi est gratuite.",
      free: {
        name: "Adhésion gratuite",
        price: "Gratuit",
        points: [
          "Commenter sous les lectures",
          "Votre historique de lecture, sur tout appareil où vous vous connectez",
          "La lettre hebdomadaire, dès son lancement",
        ],
        action: "Inscription gratuite",
      },
      paid: {
        name: "Adhésion bienfaiteur",
        points: [
          "Les textes réservés aux membres, en entier",
          "Tout ce que comprend l’adhésion gratuite",
          "Un soutien direct à une publication sourcée et indépendante",
        ],
        action: "Devenir bienfaiteur",
      },
      per: {
        monthly: "mois",
        quarterly: "3 mois",
        halfyear: "6 mois",
        yearly: "an",
      },
      or: "ou",
      haveAccount: "Déjà membre ?",
      signIn: "Se connecter",
      soon: "Bientôt",
    },
    payment: {
      title: "Paiement",
      lead: "Choisissez la durée de votre adhésion bienfaiteur.",
      period: "Durée",
      periods: {
        monthly: "Mensuelle",
        quarterly: "Tous les 3 mois",
        halfyear: "Tous les 6 mois",
        yearly: "Annuelle",
      },
      yearlyNote: { USD: "Le plus avantageux" },
      summary: "Récapitulatif",
      plan: "Adhésion bienfaiteur",
      total: "Total",
      includes: "Ce qui est compris",
      pay: "Passer au paiement",
      waiting:
        "Le paiement par carte ouvre sous peu. Ce bouton mènera alors à une page de paiement sécurisée.",
      back: "Retour aux formules d’adhésion",
    },
    newsletter: {
      title: "Lettre d’information",
      lead: "La lettre d’Orbis apportera dans votre boîte, à intervalles réguliers, les nouvelles lectures et des textes choisis dans les archives.",
      soon: "La lettre d’information sera bientôt lancée.",
      soonNote: "Le formulaire d’inscription apparaîtra sur cette page à son ouverture.",
    },
    accountSoon: "Les inscriptions ouvrent sous peu.",
    seePlans: "Voir les formules d’adhésion",
    joinToComment: "Adhérez pour commenter.",
  },
  es: {
    membership: {
      title: "Membresía",
      lead: "La mayoría de las lecturas de Orbis están abiertas a todos. Como miembro puede comentar bajo los textos; como miembro benefactor lee además los textos reservados a miembros, y ayuda a que Orbis siga siendo independiente.",
      menu: "Únase gratis",
      heading: "Únase a Orbis",
      freeLead:
        "Todas las lecturas de Orbis son gratuitas, para leer y para escuchar. Unirse también es gratis.",
      free: {
        name: "Membresía gratuita",
        price: "Gratis",
        points: [
          "Comentar bajo las lecturas",
          "Su historial de lectura, en cualquier dispositivo desde el que entre",
          "El boletín semanal, cuando se lance",
        ],
        action: "Únase gratis",
      },
      paid: {
        name: "Membresía benefactora",
        points: [
          "Los textos para miembros, completos",
          "Todo lo de la membresía gratuita",
          "Apoyo directo a una publicación independiente y con fuentes",
        ],
        action: "Hacerse benefactor",
      },
      per: {
        monthly: "mes",
        quarterly: "3 meses",
        halfyear: "6 meses",
        yearly: "año",
      },
      or: "o",
      haveAccount: "¿Ya es miembro?",
      signIn: "Inicie sesión",
      soon: "Próximamente",
    },
    payment: {
      title: "Pago",
      lead: "Elija el periodo de su membresía benefactora.",
      period: "Periodo",
      periods: {
        monthly: "Mensual",
        quarterly: "Cada 3 meses",
        halfyear: "Cada 6 meses",
        yearly: "Anual",
      },
      yearlyNote: { USD: "La mejor opción" },
      summary: "Resumen",
      plan: "Membresía benefactora",
      total: "Total",
      includes: "Incluye",
      pay: "Continuar al pago",
      waiting:
        "El pago con tarjeta se abre en breve. Entonces este botón le llevará a una página de pago segura.",
      back: "Volver a las opciones de membresía",
    },
    newsletter: {
      title: "Boletín",
      lead: "El boletín de Orbis llevará a su correo, a intervalos regulares, las nuevas lecturas y textos elegidos del archivo.",
      soon: "El boletín empezará pronto.",
      soonNote: "El formulario de suscripción aparecerá en esta página cuando se abra.",
    },
    accountSoon: "El registro de miembros se abre en breve.",
    seePlans: "Ver las opciones de membresía",
    joinToComment: "Únase para comentar.",
  },
};

export function pagesCopy(lang: Lang): PagesCopy {
  return COPY[lang];
}
