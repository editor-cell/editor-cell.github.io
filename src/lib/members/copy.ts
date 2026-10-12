import type { Lang } from "../types.ts";

/** Words for membership, comments and the members-only locks, in the five languages. */
export type MembersCopy = {
  account: string;
  signIn: string;
  join: string;
  signInIntro: string;
  joinIntro: string;
  email: string;
  password: string;
  passwordHint: string;
  forgot: string;
  forgotIntro: string;
  sendReset: string;
  checkEmail: string;
  sentConfirm: (email: string) => string;
  sentReset: (email: string) => string;
  newPassword: string;
  newPasswordIntro: string;
  passwordSaved: string;
  back: string;
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
    wrongLogin: string;
    notConfirmed: string;
    alreadyMember: string;
    weakPassword: string;
    tooManyEmails: string;
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
    join: "Üye ol",
    signInIntro: "E-posta adresinizi ve şifrenizi yazın.",
    joinIntro:
      "Üyelik ücretsiz. E-posta adresinizi yazın ve bir şifre belirleyin. Size bir doğrulama bağlantısı göndereceğiz; bağlantıya dokunduğunuzda üyeliğiniz tamamlanır.",
    email: "E-posta adresi",
    password: "Şifre",
    passwordHint: "En az 8 karakter.",
    forgot: "Şifremi unuttum",
    forgotIntro: "E-posta adresinizi yazın; size şifre yenileme bağlantısı gönderelim.",
    sendReset: "Bağlantı gönder",
    checkEmail: "E-postanızı kontrol edin",
    sentConfirm: (email) =>
      `${email} adresine bir doğrulama bağlantısı gönderdik. Bağlantıya dokunduğunuzda üyeliğiniz tamamlanır; sonra buradan e-posta adresiniz ve şifrenizle giriş yaparsınız.`,
    sentReset: (email) =>
      `${email} adresine bir şifre yenileme bağlantısı gönderdik. Bağlantıya dokunun ve yeni şifrenizi belirleyin.`,
    newPassword: "Şifre",
    newPasswordIntro: "Yeni şifrenizi yazın.",
    passwordSaved: "Şifreniz kaydedildi.",
    back: "Geri dön",
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
      wrongLogin: "E-posta ya da şifre yanlış.",
      notConfirmed: "E-posta adresiniz henüz doğrulanmadı. Size gönderdiğimiz bağlantıya dokunun.",
      alreadyMember: "Bu e-posta adresiyle zaten bir üyelik var. Giriş yapın.",
      weakPassword: "Şifre en az 8 karakter olmalı.",
      tooManyEmails: "Kısa sürede çok fazla e-posta istendi. Biraz sonra tekrar deneyin.",
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
    join: "انضم",
    signInIntro: "اكتب بريدك الإلكتروني وكلمة المرور.",
    joinIntro:
      "العضوية مجانية. اكتب بريدك الإلكتروني واختر كلمة مرور. سنرسل إليك رابط تأكيد؛ تكتمل عضويتك عندما تضغط عليه.",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    passwordHint: "ثمانية أحرف على الأقل.",
    forgot: "نسيت كلمة المرور",
    forgotIntro: "اكتب بريدك الإلكتروني وسنرسل إليك رابطًا لتعيين كلمة مرور جديدة.",
    sendReset: "أرسل الرابط",
    checkEmail: "تحقّق من بريدك الإلكتروني",
    sentConfirm: (email) =>
      `أرسلنا رابط تأكيد إلى ${email}. تكتمل عضويتك عندما تضغط عليه، ثم تدخل من هنا ببريدك وكلمة المرور.`,
    sentReset: (email) =>
      `أرسلنا رابطًا إلى ${email} لتعيين كلمة مرور جديدة. اضغط عليه واختر كلمة المرور.`,
    newPassword: "كلمة المرور",
    newPasswordIntro: "اكتب كلمة المرور الجديدة.",
    passwordSaved: "حُفظت كلمة المرور.",
    back: "رجوع",
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
      wrongLogin: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      notConfirmed: "لم يُؤكَّد بريدك الإلكتروني بعد. اضغط على الرابط الذي أرسلناه إليك.",
      alreadyMember: "توجد عضوية بهذا البريد الإلكتروني. سجّل الدخول.",
      weakPassword: "يجب أن تتكون كلمة المرور من ثمانية أحرف على الأقل.",
      tooManyEmails: "طُلبت رسائل كثيرة في وقت قصير. حاول مرة أخرى بعد قليل.",
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
    join: "Join",
    signInIntro: "Enter your e-mail and your password.",
    joinIntro:
      "Membership is free. Enter your e-mail and choose a password. We will send you a confirmation link; your membership is complete once you tap it.",
    email: "E-mail address",
    password: "Password",
    passwordHint: "At least 8 characters.",
    forgot: "Forgot your password?",
    forgotIntro: "Enter your e-mail and we will send you a link to set a new password.",
    sendReset: "Send link",
    checkEmail: "Check your e-mail",
    sentConfirm: (email) =>
      `We sent a confirmation link to ${email}. Tap it and your membership is complete; then sign in here with your e-mail and password.`,
    sentReset: (email) =>
      `We sent a link to ${email} to set a new password. Tap it and choose your new password.`,
    newPassword: "Password",
    newPasswordIntro: "Enter your new password.",
    passwordSaved: "Your password is saved.",
    back: "Back",
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
      wrongLogin: "The e-mail or the password is wrong.",
      notConfirmed: "Your e-mail is not confirmed yet. Tap the link we sent you.",
      alreadyMember: "There is already a membership with this e-mail. Sign in.",
      weakPassword: "The password must be at least 8 characters.",
      tooManyEmails:
        "Too many e-mails were asked for in a short time. Please try again a little later.",
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
    join: "Adhérer",
    signInIntro: "Saisissez votre adresse et votre mot de passe.",
    joinIntro:
      "L’adhésion est gratuite. Saisissez votre adresse et choisissez un mot de passe. Nous vous enverrons un lien de confirmation ; votre adhésion est complète dès que vous le touchez.",
    email: "Adresse e-mail",
    password: "Mot de passe",
    passwordHint: "Au moins 8 caractères.",
    forgot: "Mot de passe oublié ?",
    forgotIntro:
      "Saisissez votre adresse ; nous vous enverrons un lien pour choisir un nouveau mot de passe.",
    sendReset: "Envoyer le lien",
    checkEmail: "Vérifiez votre messagerie",
    sentConfirm: (email) =>
      `Nous avons envoyé un lien de confirmation à ${email}. Touchez-le et votre adhésion est complète ; connectez-vous ensuite ici avec votre adresse et votre mot de passe.`,
    sentReset: (email) =>
      `Nous avons envoyé à ${email} un lien pour choisir un nouveau mot de passe. Touchez-le.`,
    newPassword: "Mot de passe",
    newPasswordIntro: "Saisissez votre nouveau mot de passe.",
    passwordSaved: "Votre mot de passe est enregistré.",
    back: "Retour",
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
      wrongLogin: "L’adresse ou le mot de passe est incorrect.",
      notConfirmed:
        "Votre adresse n’est pas encore confirmée. Touchez le lien que nous vous avons envoyé.",
      alreadyMember: "Une adhésion existe déjà avec cette adresse. Connectez-vous.",
      weakPassword: "Le mot de passe doit compter au moins 8 caractères.",
      tooManyEmails: "Trop de messages demandés en peu de temps. Réessayez un peu plus tard.",
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
    join: "Unirse",
    signInIntro: "Escriba su correo y su contraseña.",
    joinIntro:
      "La membresía es gratuita. Escriba su correo y elija una contraseña. Le enviaremos un enlace de confirmación; su membresía queda completa en cuanto lo toque.",
    email: "Correo electrónico",
    password: "Contraseña",
    passwordHint: "Al menos 8 caracteres.",
    forgot: "¿Olvidó su contraseña?",
    forgotIntro: "Escriba su correo y le enviaremos un enlace para elegir una contraseña nueva.",
    sendReset: "Enviar enlace",
    checkEmail: "Revise su correo",
    sentConfirm: (email) =>
      `Enviamos un enlace de confirmación a ${email}. Tóquelo y su membresía queda completa; después inicie sesión aquí con su correo y su contraseña.`,
    sentReset: (email) =>
      `Enviamos a ${email} un enlace para elegir una contraseña nueva. Tóquelo.`,
    newPassword: "Contraseña",
    newPasswordIntro: "Escriba su nueva contraseña.",
    passwordSaved: "Su contraseña se ha guardado.",
    back: "Volver",
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
      wrongLogin: "El correo o la contraseña no son correctos.",
      notConfirmed: "Su correo aún no está confirmado. Toque el enlace que le enviamos.",
      alreadyMember: "Ya existe una membresía con este correo. Inicie sesión.",
      weakPassword: "La contraseña debe tener al menos 8 caracteres.",
      tooManyEmails:
        "Se pidieron demasiados correos en poco tiempo. Inténtelo de nuevo un poco más tarde.",
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
  if (text.includes("comments_body_check") || text.includes("check constraint"))
    return words.length;
  if (code === "23505" || text.includes("duplicate key")) return words.alreadyReported;
  if (/invalid login credentials|invalid_credentials/i.test(`${text} ${code}`))
    return words.wrongLogin;
  if (/email not confirmed|email_not_confirmed/i.test(`${text} ${code}`)) return words.notConfirmed;
  if (/already (been )?registered|user_already_exists/i.test(`${text} ${code}`))
    return words.alreadyMember;
  if (/password should|weak_password/i.test(`${text} ${code}`)) return words.weakPassword;
  if (/rate limit|over_email_send_rate_limit/i.test(`${text} ${code}`)) return words.tooManyEmails;
  if (/token|otp|expired|invalid/i.test(text)) return words.badCode;
  return words.generic;
}
