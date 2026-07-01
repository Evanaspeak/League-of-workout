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
      ],
      outro: "Aucune donnée de santé au sens médical, aucun moyen de paiement, et aucune donnée de localisation ne sont collectés.",
    },
    article3: {
      title: "3. Base légale",
      paragraphs: [
        "Les traitements reposent sur votre consentement (art. 6.1.a RGPD), exprimé lors de la création du compte, et sur l'exécution du service auquel vous avez souscrit (art. 6.1.b).",
      ],
    },
    article4: {
      title: "4. Durée de conservation",
      paragraphs: [
        "Vos données sont conservées aussi longtemps que votre compte est actif. En cas de demande de suppression, toutes vos données personnelles sont effacées dans un délai de 30 jours.",
      ],
    },
    article5: {
      title: "5. Partage des données",
      intro: "Vos données ne sont jamais vendues ni cédées à des tiers à des fins commerciales. Elles sont partagées uniquement avec les sous-traitants techniques nécessaires au fonctionnement de l'Application :",
      items: [
        { label: "Vercel", text: "— hébergement de l'application (États-Unis, Clauses Contractuelles Types)" },
        { label: "Neon", text: "— base de données PostgreSQL (États-Unis, Clauses Contractuelles Types)" },
        { label: "Riot Games API", text: "— récupération des données de parties publiques" },
        { label: "Google / Discord", text: "— authentification OAuth (optionnel)" },
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
        { label: "Droit d'accès", text: "— obtenir une copie de vos données" },
        { label: "Droit de rectification", text: "— corriger des données inexactes" },
        { label: "Droit à l'effacement", text: "— demander la suppression de votre compte et de toutes vos données" },
        { label: "Droit à la portabilité", text: "— recevoir vos données dans un format lisible" },
        { label: "Droit d'opposition", text: "— vous opposer à un traitement" },
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
    footerLink: "→ Conditions Générales d'Utilisation",
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
      ],
      outro: "No health data in the medical sense, no payment information, and no location data are collected.",
    },
    article3: {
      title: "3. Legal Basis",
      paragraphs: [
        "Processing is based on your consent (GDPR art. 6.1.a), given when creating your account, and on the performance of the service you subscribed to (art. 6.1.b).",
      ],
    },
    article4: {
      title: "4. Retention Period",
      paragraphs: [
        "Your data is retained for as long as your account is active. In the event of a deletion request, all your personal data is erased within 30 days.",
      ],
    },
    article5: {
      title: "5. Data Sharing",
      intro: "Your data is never sold or transferred to third parties for commercial purposes. It is only shared with the technical processors necessary for the operation of the Application:",
      items: [
        { label: "Vercel", text: "— application hosting (United States, Standard Contractual Clauses)" },
        { label: "Neon", text: "— PostgreSQL database (United States, Standard Contractual Clauses)" },
        { label: "Riot Games API", text: "— retrieval of public match data" },
        { label: "Google / Discord", text: "— OAuth authentication (optional)" },
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
        { label: "Right of access", text: "— obtain a copy of your data" },
        { label: "Right to rectification", text: "— correct inaccurate data" },
        { label: "Right to erasure", text: "— request the deletion of your account and all your data" },
        { label: "Right to data portability", text: "— receive your data in a readable format" },
        { label: "Right to object", text: "— object to processing" },
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
    footerLink: "→ Terms of Service",
  },
};
