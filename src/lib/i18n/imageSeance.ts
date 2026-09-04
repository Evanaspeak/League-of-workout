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
