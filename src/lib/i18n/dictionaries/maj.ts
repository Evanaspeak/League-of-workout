export const maj = {
  fr: {
    prete: "Une mise à jour est prête à s'installer.",
    preteVersion: (v: string) => `La version ${v} est prête à s'installer.`,
    redemarrer: "Redémarrer maintenant",
    plusTard: "Plus tard",

    // Section « Application » des réglages
    titre: "Application",
    versionInstallee: (v: string) => `Version ${v}`,
    verifier: "Vérifier les mises à jour",
    verification: "Vérification…",
    aJour: "Tu as la dernière version.",
    telechargement: (v: string) => `Téléchargement de la version ${v}…`,
    telechargementSansVersion: "Téléchargement de la mise à jour…",
    erreur: "La mise à jour a échoué.",
    installeAuRedemarrage: "Elle s'installera à la fermeture de l'application, ou tout de suite si tu redémarres.",
    depuisSources: "Application lancée depuis les sources : pas de mise à jour à installer.",
  },
  en: {
    prete: "An update is ready to install.",
    preteVersion: (v: string) => `Version ${v} is ready to install.`,
    redemarrer: "Restart now",
    plusTard: "Later",

    titre: "Application",
    versionInstallee: (v: string) => `Version ${v}`,
    verifier: "Check for updates",
    verification: "Checking…",
    aJour: "You're on the latest version.",
    telechargement: (v: string) => `Downloading version ${v}…`,
    telechargementSansVersion: "Downloading the update…",
    erreur: "The update failed.",
    installeAuRedemarrage: "It will install when you close the app, or right away if you restart.",
    depuisSources: "Running from source: no update to install.",
  },
};
