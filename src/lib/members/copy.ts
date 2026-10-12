import type { Lang } from "../types.ts";

/** Words for membership, comments and the members-only locks, in the five languages. */
export type MembersCopy = {
  account: string;
  signIn: string;
  signInIntro: string;
  email: string;
  send: string;
  sent: (email: string) => string;
  code: string;
  verify: string;
  otherEmail: string;
  google: string;
  signOut: string;
  name: string;
  nameHint: string;
  save: string;
  saved: string;
  free: string;
  paid: (until: string) => string;
  editor: string;
  paidSoon: string;
  backToReading: string;
  comments: string;
  noComments: string;
  signInToComment: string;
  yourComment: string;
  post: string;
  report: string;
  reported: string;
  remove: string;
  removeConfirm: string;
  membersOnly: string;
  lockNote: string;
  lockSignIn: string;
  lockPaid: string;
  loading: string;
  closed: string;
  errors: {
    generic: string;
    badCode: string;
    links: string;
    words: string;
    tooFast: string;
    tooMany: string;
    nameRequired: string;
    length: string;
    alreadyReported: string;
  };
};

const COPY: Record<Lang, MembersCopy> = {
  tr: {
    account: "Hesap",
    signIn: "Giriş yap",
    signInIntro:
      "Üyelik ücretsiz. E-posta adresinizi yazın; size bir giriş bağlantısı ve 6 haneli bir kod gönderelim. Şifre yok.",
    email: "E-posta adresi",
    send: "Gönder",
    sent: (email) =>
      `${email} adresine bir bağlantı ve kod gönderdik. Bağlantıya dokunun ya da kodu buraya yazın.`,
    code: "Kod",
    verify: "Doğrula",
    otherEmail: "Başka bir adres kullan",
    google: "Google ile devam et",
    signOut: "Çıkış yap",
    name: "Yorumlarda görünecek adınız",
    nameHint: "2 ile 40 karakter arası.",
    save: "Kaydet",
    saved: "Kaydedildi.",
    free: "Ücretsiz üye",
    paid: (until) => `Ücretli üye, ${until} tarihine kadar`,
    editor: "Editör",
    paidSoon: "Ücretli üyelik yakında açılacak.",
    backToReading: "Okumaya dön",
    comments: "Yorumlar",
    noComments: "Henüz yorum yok.",
    signInToComment: "Yorum yazmak için giriş yapın.",
    yourComment: "Yorumunuz",
    post: "Gönder",
    report: "Bildir",
    reported: "Bildirildi",
    remove: "Sil",
    removeConfirm: "Bu yorum silinsin mi?",
    membersOnly: "Üyelere özel",
    lockNote: "Bu yazının devamı ücretli üyelere açık.",
    lockSignIn: "Giriş yap",
    lockPaid: "Üyeliğim",
    loading: "Yükleniyor…",
    closed: "Üyelik henüz açılmadı.",
    errors: {
      generic: "Bir sorun oldu. Lütfen tekrar deneyin.",
      badCode: "Kod geçersiz ya da süresi dolmuş.",
      links: "Yorumlarda bağlantı paylaşılamaz.",
      words: "Yorumunuzda izin verilmeyen bir kelime var.",
      tooFast: "Dakikada bir yorum yazılabilir. Biraz sonra tekrar deneyin.",
      tooMany: "Bugünlük yorum sınırına ulaştınız.",
      nameRequired: "Yorum yazmadan önce yorumlarda görünecek adınızı belirleyin.",
      length: "Yorum 2 ile 2000 karakter arasında olmalı.",
      alreadyReported: "Bu yorumu zaten bildirdiniz.",
    },
  },
  ar: {
    account: "الحساب",
    signIn: "تسجيل الدخول",
    signInIntro:
      "العضوية مجانية. اكتب بريدك الإلكتروني وسنرسل إليك رابط دخول ورمزًا من ستة أرقام. لا حاجة إلى كلمة مرور.",
    email: "البريد الإلكتروني",
    send: "إرسال",
    sent: (email) => `أرسلنا رابطًا ورمزًا إلى ${email}. اضغط على الرابط أو اكتب الرمز هنا.`,
    code: "الرمز",
    verify: "تحقّق",
    otherEmail: "استخدم عنوانًا آخر",
    google: "المتابعة باستخدام Google",
    signOut: "تسجيل الخروج",
    name: "الاسم الذي يظهر مع تعليقاتك",
    nameHint: "من حرفين إلى أربعين حرفًا.",
    save: "حفظ",
    saved: "تم الحفظ.",
    free: "عضو مجاني",
    paid: (until) => `عضو مشترك حتى ${until}`,
    editor: "المحرّر",
    paidSoon: "ستتاح العضوية المدفوعة قريبًا.",
    backToReading: "العودة إلى القراءة",
    comments: "التعليقات",
    noComments: "لا توجد تعليقات بعد.",
    signInToComment: "سجّل الدخول لكتابة تعليق.",
    yourComment: "تعليقك",
    post: "إرسال",
    report: "إبلاغ",
    reported: "تم الإبلاغ",
    remove: "حذف",
    removeConfirm: "هل تريد حذف هذا التعليق؟",
    membersOnly: "للأعضاء فقط",
    lockNote: "بقية هذه القراءة متاحة للأعضاء المشتركين.",
    lockSignIn: "تسجيل الدخول",
    lockPaid: "عضويتي",
    loading: "جارٍ التحميل…",
    closed: "لم تُفتح العضوية بعد.",
    errors: {
      generic: "حدث خطأ. يُرجى المحاولة مرة أخرى.",
      badCode: "الرمز غير صحيح أو انتهت صلاحيته.",
      links: "لا يمكن مشاركة الروابط في التعليقات.",
      words: "يحتوي تعليقك على كلمة غير مسموح بها.",
      tooFast: "يمكن كتابة تعليق واحد كل دقيقة. حاول بعد قليل.",
      tooMany: "بلغت الحد اليومي للتعليقات.",
      nameRequired: "اختر الاسم الذي يظهر مع تعليقاتك قبل الكتابة.",
      length: "يجب أن يكون التعليق بين حرفين و2000 حرف.",
      alreadyReported: "لقد أبلغت عن هذا التعليق من قبل.",
    },
  },
  en: {
    account: "Account",
    signIn: "Sign in",
    signInIntro:
      "Membership is free. Enter your e-mail and we will send you a sign-in link and a 6-digit code. No password.",
    email: "E-mail address",
    send: "Send",
    sent: (email) => `We sent a link and a code to ${email}. Tap the link, or enter the code here.`,
    code: "Code",
    verify: "Verify",
    otherEmail: "Use another address",
    google: "Continue with Google",
    signOut: "Sign out",
    name: "Your name on comments",
    nameHint: "2 to 40 characters.",
    save: "Save",
    saved: "Saved.",
    free: "Free member",
    paid: (until) => `Paid member until ${until}`,
    editor: "Editor",
    paidSoon: "Paid membership opens soon.",
    backToReading: "Back to the reading",
    comments: "Comments",
    noComments: "No comments yet.",
    signInToComment: "Sign in to comment.",
    yourComment: "Your comment",
    post: "Post",
    report: "Report",
    reported: "Reported",
    remove: "Delete",
    removeConfirm: "Delete this comment?",
    membersOnly: "Members only",
    lockNote: "The rest of this reading is open to paid members.",
    lockSignIn: "Sign in",
    lockPaid: "My membership",
    loading: "Loading…",
    closed: "Membership is not open yet.",
    errors: {
      generic: "Something went wrong. Please try again.",
      badCode: "The code is wrong or has expired.",
      links: "Links cannot be shared in comments.",
      words: "Your comment contains a word that is not allowed.",
      tooFast: "One comment a minute. Please try again shortly.",
      tooMany: "You have reached today's comment limit.",
      nameRequired: "Choose the name shown on your comments before writing.",
      length: "A comment must be between 2 and 2000 characters.",
      alreadyReported: "You have already reported this comment.",
    },
  },
  fr: {
    account: "Compte",
    signIn: "Se connecter",
    signInIntro:
      "L’adhésion est gratuite. Saisissez votre e-mail : nous vous enverrons un lien de connexion et un code à 6 chiffres. Pas de mot de passe.",
    email: "Adresse e-mail",
    send: "Envoyer",
    sent: (email) =>
      `Nous avons envoyé un lien et un code à ${email}. Touchez le lien ou saisissez le code ici.`,
    code: "Code",
    verify: "Vérifier",
    otherEmail: "Utiliser une autre adresse",
    google: "Continuer avec Google",
    signOut: "Se déconnecter",
    name: "Votre nom sur les commentaires",
    nameHint: "De 2 à 40 caractères.",
    save: "Enregistrer",
    saved: "Enregistré.",
    free: "Membre gratuit",
    paid: (until) => `Membre abonné jusqu’au ${until}`,
    editor: "Éditeur",
    paidSoon: "L’abonnement payant ouvrira bientôt.",
    backToReading: "Retour à la lecture",
    comments: "Commentaires",
    noComments: "Pas encore de commentaire.",
    signInToComment: "Connectez-vous pour commenter.",
    yourComment: "Votre commentaire",
    post: "Publier",
    report: "Signaler",
    reported: "Signalé",
    remove: "Supprimer",
    removeConfirm: "Supprimer ce commentaire ?",
    membersOnly: "Réservé aux membres",
    lockNote: "La suite de cette lecture est réservée aux abonnés.",
    lockSignIn: "Se connecter",
    lockPaid: "Mon abonnement",
    loading: "Chargement…",
    closed: "L’adhésion n’est pas encore ouverte.",
    errors: {
      generic: "Un problème est survenu. Veuillez réessayer.",
      badCode: "Le code est incorrect ou a expiré.",
      links: "Les liens ne sont pas autorisés dans les commentaires.",
      words: "Votre commentaire contient un mot non autorisé.",
      tooFast: "Un commentaire par minute. Réessayez dans un instant.",
      tooMany: "Vous avez atteint la limite de commentaires pour aujourd’hui.",
      nameRequired: "Choisissez le nom affiché sur vos commentaires avant d’écrire.",
      length: "Un commentaire doit compter entre 2 et 2000 caractères.",
      alreadyReported: "Vous avez déjà signalé ce commentaire.",
    },
  },
  es: {
    account: "Cuenta",
    signIn: "Iniciar sesión",
    signInIntro:
      "La membresía es gratuita. Escriba su correo y le enviaremos un enlace de acceso y un código de 6 dígitos. Sin contraseña.",
    email: "Correo electrónico",
    send: "Enviar",
    sent: (email) =>
      `Enviamos un enlace y un código a ${email}. Toque el enlace o escriba el código aquí.`,
    code: "Código",
    verify: "Verificar",
    otherEmail: "Usar otra dirección",
    google: "Continuar con Google",
    signOut: "Cerrar sesión",
    name: "Su nombre en los comentarios",
    nameHint: "De 2 a 40 caracteres.",
    save: "Guardar",
    saved: "Guardado.",
    free: "Miembro gratuito",
    paid: (until) => `Miembro de pago hasta el ${until}`,
    editor: "Editor",
    paidSoon: "La membresía de pago se abrirá pronto.",
    backToReading: "Volver a la lectura",
    comments: "Comentarios",
    noComments: "Todavía no hay comentarios.",
    signInToComment: "Inicie sesión para comentar.",
    yourComment: "Su comentario",
    post: "Publicar",
    report: "Denunciar",
    reported: "Denunciado",
    remove: "Eliminar",
    removeConfirm: "¿Eliminar este comentario?",
    membersOnly: "Solo para miembros",
    lockNote: "El resto de esta lectura está abierto a los miembros de pago.",
    lockSignIn: "Iniciar sesión",
    lockPaid: "Mi membresía",
    loading: "Cargando…",
    closed: "La membresía aún no está abierta.",
    errors: {
      generic: "Algo salió mal. Inténtelo de nuevo.",
      badCode: "El código es incorrecto o ha caducado.",
      links: "No se pueden compartir enlaces en los comentarios.",
      words: "Su comentario contiene una palabra no permitida.",
      tooFast: "Un comentario por minuto. Inténtelo de nuevo en un momento.",
      tooMany: "Ha alcanzado el límite de comentarios de hoy.",
      nameRequired: "Elija el nombre que aparecerá en sus comentarios antes de escribir.",
      length: "Un comentario debe tener entre 2 y 2000 caracteres.",
      alreadyReported: "Ya ha denunciado este comentario.",
    },
  },
};

export function membersCopy(lang: Lang): MembersCopy {
  return COPY[lang];
}

/** The reader-facing message for an error the database or Supabase sent back. */
export function errorText(error: unknown, lang: Lang): string {
  const words = COPY[lang].errors;
  const text = String((error as { message?: unknown } | null)?.message ?? error ?? "");
  const code = String((error as { code?: unknown } | null)?.code ?? "");
  if (text.includes("links")) return words.links;
  if (text.includes("words")) return words.words;
  if (text.includes("too_fast")) return words.tooFast;
  if (text.includes("too_many")) return words.tooMany;
  if (text.includes("name_required")) return words.nameRequired;
  if (text.includes("comments_body_check") || text.includes("check constraint")) return words.length;
  if (code === "23505" || text.includes("duplicate key")) return words.alreadyReported;
  if (/token|otp|expired|invalid/i.test(text)) return words.badCode;
  return words.generic;
}
