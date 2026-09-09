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
