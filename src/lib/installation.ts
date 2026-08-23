/**
 * Faut-il proposer d'installer l'application sur l'écran d'accueil ?
 *
 * La décision est pure : elle prend l'état du navigateur en argument et rend
 * une réponse. C'est ce qui la rend éprouvable — la même logique écrite dans
 * un composant ne se teste qu'en simulant un navigateur entier, et personne
 * ne le fait.
 *
 * Trois choses la commandent, et chacune a une raison d'être :
 *  - la troisième visite, parce que proposer à la première revient à demander
 *    un engagement à quelqu'un qui ne sait pas encore ce qu'il regarde ;
 *  - le téléphone, parce qu'un écran d'accueil n'existe pas ailleurs ;
 *  - un seul refus, définitif. Reproposer après un refus est la façon la plus
 *    sûre de faire désinstaller.
 */

/** Clés de stockage. Le préfixe est celui du reste de l'application. */
export const CLE_VISITES = "low_visites";
export const CLE_REFUS = "low_install_refuse";
/**
 * Marque de session : une visite se compte une fois par ouverture, pas une
 * fois par page. Sans elle, aller du tableau de bord à l'historique puis aux
 * réglages suffisait à atteindre la « troisième visite » en deux minutes —
 * c'est-à-dire exactement l'inverse de ce qu'on cherche à mesurer.
 */
export const CLE_SESSION = "low_visite_comptee";

/** Visite à partir de laquelle on propose. */
export const VISITES_AVANT_PROPOSITION = 3;

export type EtatInstallation = {
  /** Nombre de visites déjà comptées, celle-ci incluse. */
  visites: number;
  /** L'invitation a déjà été refusée une fois. */
  refuse: boolean;
  /** L'appareil a un écran d'accueil où poser une icône. */
  telephone: boolean;
  /** L'application tourne déjà installée : il n'y a plus rien à proposer. */
  installee: boolean;
};

export function proposerInstallation(etat: EtatInstallation): boolean {
  if (etat.installee || etat.refuse || !etat.telephone) return false;
  return etat.visites >= VISITES_AVANT_PROPOSITION;
}

/**
 * Compte cette visite et rend le total.
 *
 * Le compteur est borné : au-delà, il ne dit plus rien de plus et un nombre
 * qui grandit sans fin dans le stockage local finit par surprendre celui qui
 * l'ouvre. Une valeur illisible — effacée, bricolée — repart de un plutôt que
 * de faire tomber la page.
 */
export function compterVisite(lu: string | null): number {
  return Math.min(visitesLues(lu) + 1, VISITES_AVANT_PROPOSITION + 1);
}

/** Lit le compteur sans l'avancer. Une valeur illisible vaut zéro visite. */
export function visitesLues(lu: string | null): number {
  const n = Number(lu);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/**
 * L'appareil a-t-il un écran d'accueil ?
 *
 * Le pointeur grossier plutôt que la largeur : une fenêtre étroite sur un
 * ordinateur n'est pas un téléphone, et lui proposer d'installer une icône
 * sur un écran d'accueil qui n'existe pas ne veut rien dire.
 */
export function estTelephone(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(pointer: coarse)").matches;
}

/** L'application tourne-t-elle déjà depuis l'écran d'accueil ? */
export function dejaInstallee(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // Safari iOS n'implémente pas `display-mode` et pose ce drapeau à la place.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * iOS n'expose aucune invite d'installation : Safari ne déclenche pas
 * `beforeinstallprompt` et n'en propose pas d'équivalent. Il reste le geste
 * manuel, qu'il faut alors décrire — sans quoi la moitié du public n'a
 * simplement aucun chemin.
 */
export function estIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS se présente comme un Mac depuis 2020 : seul l'écran tactile le
  // distingue d'un ordinateur de bureau.
  const iPadDeguise = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iPhone|iPad|iPod/.test(ua) || iPadDeguise;
}
