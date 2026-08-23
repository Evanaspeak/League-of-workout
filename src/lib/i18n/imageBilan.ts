import { estLocale, type Locale } from "./langues";

/**
 * Les mots posés sur l'image du bilan de saison.
 *
 * Ils ne peuvent pas passer par `useT` : l'image est dessinée AU SERVEUR, sans
 * composant ni stockage local. C'est la même situation que les notifications
 * et les courriels, et la même réponse — la langue est celle rangée sur le
 * compte (`User.langue`), et les textes vivent à part.
 *
 * Sans ça, l'image partirait en français à tout le monde, et rien ne le
 * signalerait : celui qui écrit l'application la lit en français.
 */
export type MotsImage = {
  periode: (jours: number) => string;
  parties: string;
  victoires: string;
  paye: string;
  serie: string;
};

const MOTS: Record<Locale, MotsImage> = {
  fr: {
    periode: (j) => `${j} jours`,
    parties: "parties", victoires: "victoires", paye: "payé", serie: "jours d'affilée",
  },
  en: {
    periode: (j) => `${j} days`,
    parties: "matches", victoires: "wins", paye: "paid", serie: "days in a row",
  },
  es: {
    periode: (j) => `${j} días`,
    parties: "partidas", victoires: "victorias", paye: "pagado", serie: "días seguidos",
  },
  de: {
    periode: (j) => `${j} Tage`,
    parties: "Partien", victoires: "Siege", paye: "bezahlt", serie: "Tage in Folge",
  },
  zh: {
    periode: (j) => `${j} 天`,
    parties: "场次", victoires: "胜率", paye: "已完成", serie: "连续天数",
  },
  ja: {
    periode: (j) => `${j} 日`,
    parties: "試合", victoires: "勝率", paye: "こなした", serie: "連続日数",
  },
};

/** Les mots de la langue du compte. L'anglais à défaut, jamais du vide. */
export function motsImage(langue: unknown): MotsImage {
  return MOTS[estLocale(langue) ? langue : "en"];
}
