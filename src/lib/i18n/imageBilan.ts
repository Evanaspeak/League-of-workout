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
  /**
   * Le TAUX de victoire, pas leur nombre.
   *
   * La valeur affichée sous ce mot est un pourcentage. Quatre blocs sur six
   * portaient pourtant le mot du COMPTE — « victoires », « wins », « Siege » —
   * et les deux autres celui du taux. Le nom de la clé dit maintenant ce
   * qu'elle porte, comme `pointsPayes` face à `totalPoints`.
   */
  winrate: string;
  paye: string;
  serie: string;
};

const MOTS: Record<Locale, MotsImage> = {
  fr: {
    periode: (j) => `${j} jours`,
    parties: "parties", winrate: "winrate", paye: "payé", serie: "jours d'affilée",
  },
  en: {
    periode: (j) => `${j} days`,
    parties: "matches", winrate: "winrate", paye: "paid", serie: "days in a row",
  },
  es: {
    periode: (j) => `${j} días`,
    parties: "partidas", winrate: "% de victorias", paye: "pagado", serie: "días seguidos",
  },
  de: {
    periode: (j) => `${j} Tage`,
    parties: "Partien", winrate: "Siegquote", paye: "bezahlt", serie: "Tage in Folge",
  },
  zh: {
    periode: (j) => `${j} 天`,
    parties: "场次", winrate: "胜率", paye: "已完成", serie: "连续天数",
  },
  ja: {
    periode: (j) => `${j} 日`,
    parties: "試合", winrate: "勝率", paye: "こなした", serie: "連続日数",
  },
};

/** Les mots de la langue du compte. L'anglais à défaut, jamais du vide. */
export function motsImage(langue: unknown): MotsImage {
  return MOTS[estLocale(langue) ? langue : "en"];
}
