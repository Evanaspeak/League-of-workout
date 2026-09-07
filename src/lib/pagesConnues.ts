/**
 * Les pages qui existent.
 *
 * Le middleware refuse par défaut : tout ce qui n'est pas public exige une
 * session. C'est la bonne règle, et elle avait un effet de bord que personne
 * n'avait regardé — **une adresse qui n'existe pas était traitée comme une
 * page protégée**. `/fr/nimportequoi` répondait 307 vers `/fr/login`.
 *
 * Trois conséquences, mesurées en production :
 *
 * - une faute de frappe ou un lien mort menait à un écran de connexion, ce qui
 *   ne dit rien de ce qui s'est passé — et pour quelqu'un qui est DÉJÀ
 *   connecté, la redirection le renvoyait vers une page qu'il n'a pas demandée ;
 * - la page 404 localisée, écrite exprès, était **inatteignable** pour qui
 *   n'a pas de session ;
 * - un moteur de recherche qui suit un lien mort recevait 307 puis 200 sur la
 *   connexion, jamais 404 : une adresse supprimée ne sortait donc jamais de
 *   l'index.
 *
 * D'où cette liste. Une adresse hors liste n'est pas protégée, elle n'existe
 * pas : on laisse Next rendre son 404, dans la langue de l'adresse.
 *
 * **Le sens de l'erreur compte.** Oublier une page ici la fait répondre 404 au
 * lieu d'emmener à la connexion : c'est un défaut visible, et sans fuite. Le
 * contraire — dresser la liste des pages PRIVÉES et laisser passer le reste —
 * ferait d'une page oubliée une page publique. `src/pagesConnues.test.ts`
 * compare de toute façon cette liste au dossier des pages.
 */
import { tousLesSlugs } from "@/lib/slugJeu";

/**
 * L'adresse de la 404 du site, écrite une seule fois.
 *
 * Trois endroits la nomment — le middleware qui y réécrit, cette liste, et
 * celle des chemins publics — et une adresse écrite trois fois finit par avoir
 * une version en retard.
 */
import { CHEMIN_INTROUVABLE } from "@/lib/cheminIntrouvable";
export { CHEMIN_INTROUVABLE };

export const PAGES_CONNUES = [
  "/",
  "/admin",
  "/amis",
  "/beta",
  "/bilan",
  "/calculateur",
  /**
   * Le catalogue des jeux, en clair.
   *
   * Une étoile aurait suffi à laisser passer, et c'est ce qui était écrit
   * d'abord : le routeur rejette de toute façon un jeu inconnu. Mais une
   * adresse rejetée par le ROUTEUR ne rend pas la 404 du site — elle rend
   * celle de Next, sans langue et en anglais. En connaissant le catalogue, le
   * middleware traite un jeu inventé comme ce qu'il est, une adresse qui
   * n'existe pas, et la bonne page paraît.
   *
   * La liste vient de `tousLesSlugs`, la même que celle des pages engendrées :
   * la recopier ici en ferait une seconde qui divergerait au premier jeu
   * ajouté.
   */
  ...tousLesSlugs().map(({ slug }) => `/calculateur/${slug}`),
  "/cgu",
  "/confidentialite",
  "/connexion-app",
  "/dashboard",
  "/history",
  CHEMIN_INTROUVABLE,
  "/login",
  /**
   * Le profil public, à l'adresse que son propriétaire partage.
   *
   * Une étoile pour le jeton : il ne se connaît pas d'avance, et le lister
   * reviendrait à publier les liens. Une adresse dont le jeton ne désigne
   * personne rend la page « lien inconnu » plutôt qu'un 404 — dire « ce profil
   * a été fermé » plutôt que « lien inconnu » apprendrait qu'il a existé.
   */
  "/p/*",
  "/recuperation",
  "/recuperation/valider",
  "/settings",
  "/telechargement",
] as const satisfies readonly string[];

/**
 * Cette adresse correspond-elle à une page du site ?
 *
 * La comparaison se fait par SEGMENTS, comme partout ailleurs sur ce projet :
 * `startsWith("/settings")` accepterait `/settingsprivees`. Une étoile
 * remplace exactement un segment, jamais plusieurs — `/calculateur/*` couvre
 * `/calculateur/valorant` et non `/calculateur/a/b`.
 */
/**
 * Ce que Next.js engendre par CONVENTION DE NOM, et qui n'est pas une page.
 *
 * `opengraph-image`, `icon` et `apple-icon` vivent sous `[locale]` comme les
 * pages, et répondent à une adresse comme elles — mais ce ne sont pas des
 * pages : `PAGES_CONNUES` se compare au dossier des `page.tsx`, et les y
 * inscrire ferait mentir cette comparaison.
 *
 * Ils doivent pourtant échapper à la question « cette adresse existe-t-elle »,
 * sinon le middleware les réécrit vers la 404 — et une carte partagée qui rend
 * 404 laisse un lien sans vignette sur Discord, sans que rien ne le dise :
 * personne ne regarde le code d'une vignette. C'est la suite navigateur qui
 * l'a attrapé, et elle seule pouvait le faire.
 */
export const FICHIERS_DE_CONVENTION = [
  "/opengraph-image",
  "/icon",
  "/apple-icon",
] as const;

/** Cette adresse est-elle un fichier engendré par convention de nom ? */
export function estFichierDeConvention(chemin: string): boolean {
  return (FICHIERS_DE_CONVENTION as readonly string[]).includes(chemin);
}

export function estPageConnue(chemin: string): boolean {
  const segments = chemin.split("/").filter(Boolean);
  return PAGES_CONNUES.some((motif) => {
    const attendus = motif.split("/").filter(Boolean);
    if (attendus.length !== segments.length) return false;
    return attendus.every((a, i) => a === "*" || a === segments[i]);
  });
}
