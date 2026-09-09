import { estLocale, type Locale } from "./langues";

/**
 * Les mots posés sur l'image d'une séance.
 *
 * Comme pour l'image du bilan, ils ne peuvent pas passer par `useT` : l'image
 * est dessinée AU SERVEUR, sans composant ni stockage local. La langue est
 * celle rangée sur le compte, et sans ça l'image partirait en français à tout
 * le monde — celui qui écrit l'application la lit en français, donc rien ne le
 * signalerait.
 */
/**
 * **Ce que les idéogrammes coûtent ici, mesuré plutôt que supposé.**
 *
 * Le moteur de `next/og` n'embarque que `Geist-Regular.ttf`. Devant un glyphe
 * qu'elle ne couvre pas, il va chercher la police chez Google — trois requêtes
 * par rendu, contre zéro pour un texte latin. C'est acceptable ici : cette
 * image est demandée par la personne elle-même, une fois, quand elle veut
 * partager ; ce n'est pas le cas de la carte sociale, qu'un robot réclame avec
 * un délai serré, et qui retombe donc sur l'anglais.
 *
 * Le prix à connaître : **si Google Fonts est injoignable, les idéogrammes
 * sortent en carrés vides** — vérifié en coupant ces requêtes. L'image part
 * quand même, illisible, et rien ne le signale. Le pseudo est dans le même cas
 * et aucun repli ne le couvre : un pseudo japonais sortirait en carrés le jour
 * de la panne, quelle que soit la langue du compte.
 */
export type MotsSeance = {
  titre: string;
  paye: string;
  record: (jours: number) => string;
};

const MOTS: Record<Locale, MotsSeance> = {
  fr: {
    titre: "Séance payée",
    paye: "points d'effort",
    record: (j) => `Meilleure séance en ${j} jours`,
  },
  en: {
    titre: "Session paid",
    paye: "effort points",
    record: (j) => `Best session in ${j} days`,
  },
  es: {
    titre: "Sesión pagada",
    paye: "puntos de esfuerzo",
    record: (j) => `Mejor sesión en ${j} días`,
  },
  de: {
    titre: "Einheit abgearbeitet",
    paye: "Aufwandspunkte",
    record: (j) => `Beste Einheit seit ${j} Tagen`,
  },
  zh: {
    titre: "已完成训练",
    paye: "努力点数",
    record: (j) => `${j} 天内最好的一次`,
  },
  ja: {
    titre: "こなしたセッション",
    paye: "努力ポイント",
    record: (j) => `${j} 日間で最高のセッション`,
  },
};

export function motsSeance(langue: string | null | undefined): MotsSeance {
  return MOTS[estLocale(langue) ? langue : "en"];
}
