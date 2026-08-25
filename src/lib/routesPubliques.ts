/**
 * Les chemins qui traversent le middleware sans session.
 *
 * La liste ET la règle qui la lit vivent ensemble, et pas dans `middleware.ts` :
 * `src/porteRoutes.test.ts` doit éprouver la règle qui tourne, pas une copie.
 * Il lisait le fichier du middleware au texte et réimplémentait la comparaison
 * de son côté — deux exemplaires d'une règle finissent toujours par diverger,
 * et c'est exactement ce qui avait laissé quatre routes dispensées de session
 * partir en 307 vers `/login`.
 *
 * Convention : un préfixe qui se termine par `/` ne couvre QUE ses enfants.
 * C'est ce qui distingue `/api/obs/<jeton>`, lu par un logiciel de diffusion
 * sans cookie, de `/api/obs`, qui rend et régénère le jeton et exige une
 * session.
 */
export const PREFIXES_PUBLICS = [
  "/beta",
  // L'inscription à la bêta, nommée en entier : `/api/beta` couvrait aussi
  // tout ce qui commencerait par ces lettres, ce qui n'est pas une décision
  // mais une coïncidence de nommage.
  "/api/beta-access",
  "/login",
  "/waitlist",
  "/cgu",
  "/confidentialite",
  "/telechargement",
  "/recuperation",
  // Point d'entrée de la connexion demandée par l'application desktop : exiger
  // une session pour aller s'en créer une n'aurait pas de sens.
  "/connexion-app",
  // Les pages du calculateur existent pour être trouvées par quelqu'un qui
  // n'a pas de compte : une redirection vers la connexion les viderait de
  // leur seul intérêt.
  "/calculateur",
  "/api/auth",
  // Trois nombres de configuration, déjà présents dans le HTML de chaque page.
  // La page d'accueil les relit sans session : les protéger la casserait sans
  // rien protéger.
  "/api/exercices/ratios",
  // La sonde de supervision. Exiger une session la rendrait muette le jour où
  // c'est l'authentification qui est tombée, c'est-à-dire le jour où elle
  // servirait.
  "/api/sante",
  // Signaler un problème sans être connecté : un souci sur l'écran de
  // connexion est le pire de tous, et c'est justement celui qu'une session
  // exigée rendrait impossible à remonter.
  "/api/signalement",
  // La source de diffusion : un logiciel comme OBS n'a ni cookie ni session,
  // et l'adresse elle-même est le laissez-passer.
  "/obs",
  // Les enfants seulement : `/api/obs` tout court rend et régénère le jeton,
  // et cette route-là exige une session.
  "/api/obs/",
  // Les deux déclencheurs programmés, appelés par GitHub Actions. Ils n'ont
  // ni cookie ni session : leur laissez-passer est RAPPEL_SECRET, contrôlé
  // dans la route elle-même.
  //
  // Ils étaient absents de cette liste, donc redirigés vers /login en 307
  // avant même d'atteindre leur contrôle. Le rappel du matin, le bilan
  // hebdomadaire et la relance des absents n'étaient jamais partis, et rien
  // ne le disait : le travail programmé note un code inattendu en
  // avertissement et rend la main, par conception, pour ne pas envoyer
  // vingt-quatre courriels d'échec par jour.
  "/api/push/programme",
  "/api/mail/hebdo",
  // L'amorçage de la configuration, avant qu'il existe le moindre compte.
  // Exiger une session pour créer les données dont dépend la première
  // session n'a pas de sens ; c'est INIT_SECRET qui la garde.
  "/api/init",
  // La liste des champions : rien de nominatif, et un commentaire de
  // `porteRoutes.test.ts` affirmait déjà que « le middleware la couvre » ;
  // il ne la couvrait pas.
  "/api/champions",
] as const;

/**
 * Un chemin est-il public ?
 *
 * La comparaison se fait par SEGMENTS, jamais par lettres. `startsWith("/api")`
 * accepte `/apiculture`, et `startsWith("/beta")` accepte `/betamachin` : rien
 * de tel n'existe aujourd'hui, ce qui rend la faute invisible et la laisse
 * dépendre du nom qu'on donnera à la prochaine route. Le même défaut a été
 * corrigé dans l'application de bureau, où il gardait une frontière d'origine.
 */
export function estCheminPublic(chemin: string): boolean {
  if (chemin === "/") return true;
  return PREFIXES_PUBLICS.some((prefixe) => {
    // Un préfixe terminé par `/` ne couvre que ses enfants.
    if (prefixe.endsWith("/")) return chemin.startsWith(prefixe);
    return chemin === prefixe || chemin.startsWith(`${prefixe}/`);
  });
}
