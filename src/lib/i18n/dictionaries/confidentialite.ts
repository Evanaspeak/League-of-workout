export const confidentialite = {
  fr: {
    pageTitle: "POLITIQUE DE CONFIDENTIALITÉ",
    versionLabel: (date: string) => `Version bêta · En vigueur au ${date} · Conforme au RGPD`,
    article1: {
      title: "1. Responsable du traitement",
      role: "Evan Tocquet, développeur indépendant",
      contactLabel: "Contact :",
    },
    article2: {
      title: "2. Données collectées",
      intro: "L'Application collecte uniquement les données nécessaires à son fonctionnement :",
      tableHeaders: ["Donnée", "Source", "Finalité"],
      rows: [
        ["Adresse email", "Inscription / OAuth", "Identification du compte"],
        ["Nom d'affichage", "Inscription / OAuth", "Affichage dans l'interface"],
        ["Photo de profil", "OAuth (Google/Discord)", "Affichage dans l'interface"],
        ["Riot ID & PUUID", "Saisi par l'utilisateur", "Synchronisation des parties via l'API Riot"],
        ["Données de parties", "API Riot / Saisie manuelle", "Calcul et historique des pompes"],
        ["Mot de passe", "Inscription email", "Authentification (stocké haché, jamais en clair)"],
        ["Genre, âge, poids, taille", "Candidature bêta et réglages", "Niveau de départ et estimation de l'énergie dépensée"],
        ["Heures de sport par semaine", "Candidature bêta et réglages", "Calibrage du niveau de départ"],
        ["Nombre maximum de pompes", "Test de force dans l'Application", "Multiplicateur appliqué à la dette"],
        ["Candidature bêta", "Formulaire d'inscription", "Sélection des cent premiers comptes (motivation, provenance, engagement)"],
        ["Abonnement aux notifications", "Autorisation donnée au navigateur", "Envoi des rappels de dette"],
        ["Date de votre réponse au consentement santé", "Votre réponse à la demande", "Prouver le consentement (art. 7.1) et ne pas reposer la question"],
        ["Signalement de problème", "Formulaire de signalement, si vous l'employez", "Comprendre et corriger le problème (page, version, navigateur, langue, taille d'écran)"],
        ["Historique des paiements de dette", "Vos paiements dans l'Application", "Compter votre série de jours et signaler un retard"],
      ],
      outro: "Le genre, l'âge, le poids et la taille, croisés avec l'activité physique enregistrée, constituent des données de santé au sens de l'article 9 du RGPD. Ils servent uniquement à fixer votre niveau de départ et à estimer l'énergie dépensée. Ils ne sont ni revendus, ni transmis à un tiers, ni utilisés à d'autres fins. Aucun moyen de paiement et aucune donnée de localisation ne sont collectés.",
    },
    article3: {
      title: "3. Base légale",
      paragraphs: [
        "Les traitements reposent sur votre consentement (art. 6.1.a RGPD), exprimé lors de la création du compte, et sur l'exécution du service auquel vous avez souscrit (art. 6.1.b).",
        "Les données de santé énumérées à l'article 2 relèvent de l'article 9 du RGPD. Leur traitement repose sur votre consentement explicite (art. 9.2.a), recueilli séparément du reste et révocable à tout moment depuis vos réglages.",
        "Le refus n'empêche pas d'utiliser l'Application : sans ces données, le niveau de départ est établi par le seul test de force, et l'estimation de l'énergie dépensée n'est pas affichée.",
      ],
    },
    article4: {
      title: "4. Durée de conservation",
      paragraphs: [
        "Vos données sont conservées aussi longtemps que votre compte est actif. En cas de demande de suppression, toutes vos données personnelles sont effacées dans un délai de 30 jours.",
        "Un compte resté sans aucune connexion pendant deux ans est supprimé avec l'ensemble de ses données, après un courriel d'avertissement envoyé trente jours plus tôt.",
      ],
    },
    article5: {
      title: "5. Partage des données",
      intro: "Vos données ne sont jamais vendues ni cédées à des tiers à des fins commerciales. Elles sont partagées uniquement avec les sous-traitants techniques nécessaires au fonctionnement de l'Application :",
      items: [
        { label: "Vercel", text: "hébergement de l'application (États-Unis, Clauses Contractuelles Types)" },
        { label: "Neon", text: "base de données PostgreSQL (États-Unis, Clauses Contractuelles Types)" },
        { label: "Riot Games API", text: "récupération des données de parties publiques" },
        { label: "Google / Discord", text: "authentification OAuth (optionnel)" },
      ],
    },
    article6: {
      title: "6. Cookies et stockage local",
      intro: "L'Application utilise :",
      items: [
        "Un cookie de session chiffré (Auth.js) pour maintenir la connexion",
        'pour vos préférences locales (ex : "Rester connecté", introduction vue)',
      ],
      localStoragePrefix: "Le",
      localStorageSuffix: "du navigateur",
      outro: "Aucun cookie publicitaire ou de traçage tiers n'est utilisé.",
    },
    article7: {
      title: "7. Vos droits (RGPD)",
      intro: "Conformément au Règlement Général sur la Protection des Données, vous disposez des droits suivants :",
      items: [
        { label: "Droit d'accès", text: "obtenir une copie de vos données" },
        { label: "Droit de rectification", text: "corriger des données inexactes" },
        { label: "Droit à l'effacement", text: "demander la suppression de votre compte et de toutes vos données" },
        { label: "Droit à la portabilité", text: "recevoir vos données dans un format lisible" },
        { label: "Droit d'opposition", text: "vous opposer à un traitement" },
        { label: "Droit de retirer votre consentement", text: "à tout moment depuis vos réglages, sans que cela remette en cause ce qui a été traité avant" },
      ],
      exerciseLabel: "Pour exercer ces droits, contactez-nous à :",
      cnilPrefix: "En cas de litige non résolu, vous pouvez saisir la",
      cnilName: "CNIL",
      cnilFull: "(Commission Nationale de l'Informatique et des Libertés) à l'adresse",
    },
    article8: {
      title: "8. Sécurité",
      paragraphs: [
        "Les mots de passe sont stockés de façon irréversible (hachage bcrypt). Les communications sont chiffrées via HTTPS. L'accès à la base de données est restreint et authentifié.",
      ],
    },
    article9: {
      title: "9. Modifications",
      paragraphs: [
        "Cette politique peut être mise à jour. La date de dernière modification est indiquée en haut de cette page. Les changements significatifs seront signalés lors de votre prochaine connexion.",
      ],
    },
    footerLink: "Conditions Générales d'Utilisation",
  },
  en: {
    pageTitle: "PRIVACY POLICY",
    versionLabel: (date: string) => `Beta version · In effect as of ${date} · GDPR compliant`,
    article1: {
      title: "1. Data Controller",
      role: "Evan Tocquet, independent developer",
      contactLabel: "Contact:",
    },
    article2: {
      title: "2. Data Collected",
      intro: "The Application only collects the data necessary for its operation:",
      tableHeaders: ["Data", "Source", "Purpose"],
      rows: [
        ["Email address", "Registration / OAuth", "Account identification"],
        ["Display name", "Registration / OAuth", "Display in the interface"],
        ["Profile picture", "OAuth (Google/Discord)", "Display in the interface"],
        ["Riot ID & PUUID", "Entered by the user", "Match synchronization via the Riot API"],
        ["Match data", "Riot API / Manual entry", "Push-up calculation and history"],
        ["Password", "Email registration", "Authentication (stored hashed, never in plain text)"],
        ["Gender, age, weight, height", "Beta application and settings", "Starting level and estimated energy spent"],
        ["Weekly hours of sport", "Beta application and settings", "Calibration of the starting level"],
        ["Maximum number of push-ups", "Strength test in the Application", "Multiplier applied to the debt"],
        ["Beta application", "Registration form", "Selection of the first hundred accounts (motivation, referral, commitment)"],
        ["Notification subscription", "Permission granted to the browser", "Sending debt reminders"],
        ["Date of your health-consent answer", "Your answer to the request", "Proving consent (art. 7.1) and not asking again"],
        ["Problem report", "The report form, if you use it", "Understanding and fixing the problem (page, version, browser, language, screen size)"],
        ["Debt payment history", "Your payments in the Application", "Counting your day streak and flagging a late debt"],
      ],
      outro: "Gender, age, weight and height, combined with the physical activity recorded, constitute health data within the meaning of Article 9 GDPR. They are used solely to set your starting level and to estimate the energy you spend. They are never sold, never passed to a third party, and never used for any other purpose. No payment information and no location data are collected.",
    },
    article3: {
      title: "3. Legal Basis",
      paragraphs: [
        "Processing is based on your consent (GDPR art. 6.1.a), given when creating your account, and on the performance of the service you subscribed to (art. 6.1.b).",
        "The health data listed in Article 2 falls under Article 9 GDPR. Its processing is based on your explicit consent (art. 9.2.a), collected separately from the rest and withdrawable at any time from your settings.",
        "Refusing does not prevent you from using the Application: without this data, your starting level is set by the strength test alone, and the estimate of energy spent is not shown.",
      ],
    },
    article4: {
      title: "4. Retention Period",
      paragraphs: [
        "Your data is retained for as long as your account is active. In the event of a deletion request, all your personal data is erased within 30 days.",
        "An account with no sign-in for two years is deleted along with all its data, after a warning email sent thirty days beforehand.",
      ],
    },
    article5: {
      title: "5. Data Sharing",
      intro: "Your data is never sold or transferred to third parties for commercial purposes. It is only shared with the technical processors necessary for the operation of the Application:",
      items: [
        { label: "Vercel", text: "application hosting (United States, Standard Contractual Clauses)" },
        { label: "Neon", text: "PostgreSQL database (United States, Standard Contractual Clauses)" },
        { label: "Riot Games API", text: "retrieval of public match data" },
        { label: "Google / Discord", text: "OAuth authentication (optional)" },
      ],
    },
    article6: {
      title: "6. Cookies and Local Storage",
      intro: "The Application uses:",
      items: [
        "An encrypted session cookie (Auth.js) to maintain your login session",
        'for your local preferences (e.g. "Stay signed in", introduction seen)',
      ],
      localStoragePrefix: "The browser's",
      localStorageSuffix: "",
      outro: "No advertising or third-party tracking cookies are used.",
    },
    article7: {
      title: "7. Your Rights (GDPR)",
      intro: "In accordance with the General Data Protection Regulation, you have the following rights:",
      items: [
        { label: "Right of access", text: "obtain a copy of your data" },
        { label: "Right to rectification", text: "correct inaccurate data" },
        { label: "Right to erasure", text: "request the deletion of your account and all your data" },
        { label: "Right to data portability", text: "receive your data in a readable format" },
        { label: "Right to object", text: "object to processing" },
        { label: "Right to withdraw consent", text: "at any time from your settings, without affecting what was processed beforehand" },
      ],
      exerciseLabel: "To exercise these rights, contact us at:",
      cnilPrefix: "In the event of an unresolved dispute, you may refer the matter to the",
      cnilName: "CNIL",
      cnilFull: "(French Data Protection Authority) at",
    },
    article8: {
      title: "8. Security",
      paragraphs: [
        "Passwords are stored irreversibly (bcrypt hashing). Communications are encrypted via HTTPS. Access to the database is restricted and authenticated.",
      ],
    },
    article9: {
      title: "9. Changes",
      paragraphs: [
        "This policy may be updated. The date of the last modification is shown at the top of this page. Significant changes will be flagged the next time you log in.",
      ],
    },
    footerLink: "Terms of Service",
  },
};
