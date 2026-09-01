import { LANGUES, estLocale, type Locale } from "./langues";

/**
 * La langue dans l'adresse.
 *
 * Elle vivait dans le stockage du navigateur, ce qui a un prix qu'on paie en
 * silence : le serveur rend TOUJOURS la même version, donc les métadonnées de
 * chaque page partent en français à tout le monde, et `<html lang>` annonce
 * « fr » à un lecteur d'écran japonais jusqu'à ce que le paquet JavaScript
 * s'exécute. Un moteur de recherche, lui, ne voit jamais que le français : les
 * dix pages publiques et les quinze pages par jeu existent pour être trouvées,
 * et cinq langues sur six ne l'étaient pas.
 *
 * Ce module ne porte que les règles d'ADRESSE. Il n'importe rien de React ni
 * de Next : le middleware, le plan du site et les composants le lisent tous
 * les trois, et une règle écrite en trois exemplaires finit par ne valoir que
 * pour l'un d'eux.
 */

/**
 * Ce qui ne prend jamais de préfixe de langue, et pourquoi.
 *
 * La comparaison se fait par SEGMENTS, jamais par lettres : `startsWith("/api")`
 * accepte `/apiculture`. C'est la faute déjà corrigée dans le middleware et
 * dans l'application de bureau, et elle ne dépend que du nom qu'on donnera à
 * la prochaine route.
 */
export const SANS_PREFIXE = [
  // Les routes d'API ne sont lues par aucun moteur et par aucun humain.
  // Les préfixer casserait les rappels de Auth.js, l'application de bureau et
  // les déclencheurs programmés, pour un gain nul.
  "/api",
  // L'adresse de diffusion est un laissez-passer collé dans un logiciel de
  // streaming. Lui ajouter un préfixe casserait tous les liens déjà posés,
  // et il n'y a personne pour la relire.
  "/obs",
  // Servis par Next, jamais par une page.
  "/_next",
  "/_vercel",
] as const;

/** Un chemin échappe-t-il au préfixe de langue ? */
export function echappeAuPrefixe(chemin: string): boolean {
  // Un fichier servi tel quel : `/favicon.ico`, `/sw.js`, `/hors-ligne.html`.
  // Le dernier segment porte une extension, ce qu'aucune page n'a.
  const dernier = chemin.split("/").pop() ?? "";
  if (dernier.includes(".")) return true;
  return SANS_PREFIXE.some((p) => chemin === p || chemin.startsWith(`${p}/`));
}

/** La langue portée par l'adresse, ou `null` si elle n'en porte pas. */
export function localeDuChemin(chemin: string): Locale | null {
  const premier = chemin.split("/")[1] ?? "";
  return estLocale(premier) ? premier : null;
}

/**
 * Le chemin débarrassé de sa langue.
 *
 * C'est la forme sous laquelle toutes les autres règles du projet le
 * connaissent : `estPagePublique`, `estCheminPublic`, la visite guidée, le
 * recensement des pages orphelines. Aucune d'elles n'a à savoir qu'un préfixe
 * existe.
 */
export function sansLocale(chemin: string): string {
  const locale = localeDuChemin(chemin);
  if (!locale) return chemin;
  const reste = chemin.slice(`/${locale}`.length);
  return reste === "" ? "/" : reste;
}

/** Le même chemin, dans une autre langue. */
export function avecLocale(chemin: string, locale: Locale): string {
  if (echappeAuPrefixe(chemin)) return chemin;
  const nu = sansLocale(chemin);
  return nu === "/" ? `/${locale}` : `/${locale}${nu}`;
}

/**
 * La langue à servir à quelqu'un qui arrive sans en demander.
 *
 * Un choix déjà fait prime toujours : c'est le cookie, posé par le sélecteur.
 * À défaut on suit l'en-tête du navigateur, et ce qu'on ne connaît pas devient
 * de l'ANGLAIS et non du français. Le défaut français envoyait tout le monde
 * sur la version française, y compris ceux qui n'avaient rien demandé — et
 * celui qui écrit l'application ne s'en aperçoit jamais, puisqu'il la lit en
 * français.
 */
export function negocierLocale(
  cookie: string | null | undefined,
  entete: string | null | undefined,
): Locale {
  if (estLocale(cookie)) return cookie;
  for (const { etiquette } of parserAcceptLanguage(entete)) {
    // « fr-BE », « zh-Hant-TW », « pt-BR » : seule la première étiquette nous
    // intéresse.
    const base = etiquette.toLowerCase().split("-")[0];
    if (estLocale(base)) return base;
  }
  return "en";
}

/** Les langues demandées, de la plus voulue à la moins voulue. */
function parserAcceptLanguage(entete: string | null | undefined) {
  if (!entete) return [];
  return entete
    .split(",")
    .map((morceau) => {
      const [etiquette, ...parametres] = morceau.trim().split(";");
      const q = parametres
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="));
      // Une qualité absente vaut 1 ; une qualité illisible ne doit pas faire
      // passer la langue devant les autres, d'où le zéro.
      const poids = q === undefined ? 1 : Number(q.slice(2));
      return { etiquette: etiquette.trim(), poids: Number.isFinite(poids) ? poids : 0 };
    })
    .filter((l) => l.etiquette !== "" && l.poids > 0)
    .sort((a, b) => b.poids - a.poids);
}

/**
 * Les six adresses d'une même page, plus `x-default`.
 *
 * `x-default` désigne la page à servir à quelqu'un dont la langue ne figure
 * pas dans la liste. Sans lui, un moteur choisit lui-même parmi les six — et
 * il choisit mal : la version la plus anciennement connue, c'est-à-dire la
 * française, y compris pour une recherche faite en portugais ou en russe.
 *
 * Elle pointe vers l'adresse SANS préfixe, qui est exactement ce que
 * `x-default` attend : non pas une septième traduction, mais l'adresse qui
 * négocie. Le middleware y redirige en 308 vers le cookie, à défaut l'en-tête
 * du navigateur, à défaut l'anglais.
 *
 * Trois endroits en avaient besoin — les métadonnées d'une page publique,
 * celles d'une page par jeu, et le plan du site. Les trois construisaient leur
 * table chacun de leur côté, et aucun des trois n'avait `x-default` : c'est
 * exactement la forme que prend une règle écrite en trois exemplaires.
 */
export function languesAlternatives(chemin: string, base = ""): Record<string, string> {
  return {
    ...Object.fromEntries(LANGUES.map((l) => [l, `${base}${avecLocale(chemin, l)}`])),
    "x-default": `${base}${chemin}`,
  };
}

/**
 * L'en-tête par lequel le middleware transmet la langue négociée.
 *
 * La page 404 racine n'a plus de paramètre de route à lire — c'est justement
 * ce qui la définit. Le middleware, lui, connaît la langue : il vient de la
 * négocier ou de la lire dans l'adresse.
 */
export const EN_TETE_LANGUE = "x-wow-langue";

/** Toutes les langues, pour `generateStaticParams`. */
export function toutesLesLocales(): { locale: Locale }[] {
  return LANGUES.map((locale) => ({ locale }));
}
