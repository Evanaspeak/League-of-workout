/**
 * Ce que les deux documents juridiques ont en commun.
 *
 * L'adresse de contact et la date d'entrée en vigueur étaient écrites deux
 * fois, une par document. Changer l'une sans l'autre fait dire aux CGU et à la
 * politique de confidentialité qu'elles ont pris effet à des dates
 * différentes, ou donne deux adresses pour exercer ses droits — sur les deux
 * textes qui engagent l'éditeur du site.
 *
 * C'est le motif déjà trouvé sept fois ailleurs : ce n'est pas la copie qu'on
 * remarque, c'est qu'une correction n'en répare qu'une moitié.
 */

/** L'adresse à laquelle on exerce ses droits. */
export const CONTACT_LEGAL = "evantocquet@gmail.com";

/**
 * Date d'entrée en vigueur, commune aux deux documents.
 *
 * Elle valait « 26 juin 2026 » — une chaîne FRANÇAISE, affichée telle quelle
 * dans les six langues : un lecteur japonais lisait 「ベータ版 · 26 juin 2026
 * 施行」 sur le document qui l'engage. C'est la règle du projet, celle qui dit
 * que les dates passent par `Intl` et jamais par une table écrite à la main,
 * et elle manquait sur les deux seuls textes juridiques.
 *
 * Elle est donc rangée sous sa forme neutre, et mise en forme à la lecture.
 * Le jour ne change pas : seule son écriture suit la langue.
 */
export const DATE_ENTREE_EN_VIGUEUR = "2026-06-26";

/**
 * La date d'entrée en vigueur, écrite dans la langue de qui lit.
 *
 * `timeZone: "UTC"` n'est pas une précaution de style : sans elle, une date
 * ISO est lue à minuit UTC, et un navigateur réglé à l'ouest de Greenwich
 * afficherait la VEILLE. Sur une date d'entrée en vigueur, un jour d'écart
 * n'est pas une coquetterie de typographie.
 */
export function dateEntreeEnVigueur(etiquette: string): string {
  const [a, m, j] = DATE_ENTREE_EN_VIGUEUR.split("-").map(Number);
  return new Intl.DateTimeFormat(etiquette, {
    year: "numeric", month: "long", day: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(a, m - 1, j)));
}
