export const recuperation = {
  fr: {
    badge: "Récupération de compte",
    heading: "Code oublié",
    // La demande ne change plus rien sur le compte : elle envoie un lien, et
    // c'est son ouverture qui remplace le code. Le texte le dit, parce que
    // c'est exactement ce qui rassure quelqu'un qui reçoit ce mail sans l'avoir
    // demandé.
    intro: "Entre l'email associé à ton compte : si un compte existe, tu recevras un lien pour obtenir un nouveau code. Ton code actuel continue de fonctionner jusque-là.",
    emailLabel: "Email",
    emailPlaceholder: "ton@email.com",
    submit: "Recevoir le lien",
    submitting: "Envoi…",
    successTitle: "Email envoyé",
    successBody: "Si un compte existe avec cet email, un lien vient d'être envoyé. Vérifie ta boîte mail (et tes spams). Rien n'a changé sur ton compte : ton code actuel marche toujours.",
    noEmailTitle: "Tu n'as pas renseigné d'email ?",
    noEmailBody: "Sans email associé à ton compte, on ne peut pas te renvoyer de code automatiquement. Contacte-nous pour une vérification manuelle.",
    backToLogin: "Retour à la connexion",
    genericError: "Une erreur est survenue. Réessaie.",
    networkError: "Erreur réseau. Vérifie ta connexion.",

    // ── Page d'ouverture du lien ──
    validerBadge: "Nouveau code",
    validerEnCours: "Vérification du lien…",
    validerTitre: "Voici ton nouveau code",
    validerCorps: "Note-le : il ne s'affichera qu'une fois. Ton ancien code ne fonctionne plus, et les sessions ouvertes avec ont été fermées.",
    validerPseudo: (pseudo: string) => `Connecte-toi avec le pseudo « ${pseudo} » et ce code.`,
    validerEchecTitre: "Lien invalide ou expiré",
    validerEchecCorps: "Ce lien a déjà servi, ou il a plus d'une heure. Demande-en un nouveau : ton code actuel n'a pas changé.",
    validerRedemander: "Demander un nouveau lien",
  },
  en: {
    badge: "Account recovery",
    heading: "Forgot your code",
    intro: "Enter the email linked to your account: if an account exists, you'll receive a link to get a new code. Your current code keeps working until then.",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    submit: "Send the link",
    submitting: "Sending…",
    successTitle: "Email sent",
    successBody: "If an account exists with this email, a link was just sent. Check your inbox (and spam folder). Nothing changed on your account: your current code still works.",
    noEmailTitle: "Didn't add an email?",
    noEmailBody: "Without an email linked to your account, we can't automatically send a new code. Reach out for a manual check.",
    backToLogin: "Back to sign in",
    genericError: "Something went wrong. Try again.",
    networkError: "Network error. Check your connection.",

    // ── Link landing page ──
    validerBadge: "New code",
    validerEnCours: "Checking the link…",
    validerTitre: "Here is your new code",
    validerCorps: "Write it down: it is shown once. Your old code no longer works, and sessions opened with it were closed.",
    validerPseudo: (pseudo: string) => `Sign in with the username “${pseudo}” and this code.`,
    validerEchecTitre: "Invalid or expired link",
    validerEchecCorps: "This link was already used, or it is over an hour old. Request a new one: your current code has not changed.",
    validerRedemander: "Request a new link",
  },
};
