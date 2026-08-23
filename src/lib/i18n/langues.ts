/**
 * Les six langues, sans React.
 *
 * Elles vivaient dans `LocaleContext`, qui est un module client : une route
 * API qui voulait valider une langue tirait donc tout le contexte React avec
 * elle. Ici il n'y a que des données, et le serveur comme le navigateur les
 * lisent sans rien traîner.
 */
export type Locale = "fr" | "en" | "es" | "de" | "zh" | "ja";

/**
 * Toutes les langues proposées, dans l'ordre du sélecteur.
 *
 * Le français et l'anglais sont complets. Les quatre autres se remplissent
 * dictionnaire par dictionnaire : ce qui n'est pas encore traduit retombe sur
 * l'anglais, jamais sur du vide. Sans ce repli, ajouter une langue voudrait
 * dire traduire trente-deux fichiers d'un coup avant de pouvoir livrer quoi
 * que ce soit — et un seul oubli afficherait un trou.
 */
export const LANGUES: Locale[] = ["fr", "en", "es", "de", "zh", "ja"];

export function estLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LANGUES as string[]).includes(v);
}

/**
 * Étiquette de langue pour `Intl` : formats de date et de nombre.
 *
 * Elle vivait dans `LocaleContext`, donc dans un module client. Le bilan de
 * saison est rendu en image AU SERVEUR, à partir de la langue rangée sur le
 * compte : il lui faut cette table sans traîner React avec elle.
 */
const ETIQUETTES: Record<Locale, string> = {
  fr: "fr-FR", en: "en-US", es: "es-ES", de: "de-DE", zh: "zh-CN", ja: "ja-JP",
};

export function etiquetteLocale(locale: Locale): string {
  return ETIQUETTES[locale] ?? "en-US";
}
