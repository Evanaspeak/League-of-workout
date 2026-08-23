import { LANGUES, type Locale } from "./langues";

/**
 * Les textes envoyés hors du navigateur : notifications push.
 *
 * Ils ne peuvent pas passer par `useT` — il n'y a pas de composant, pas de
 * stockage local, pas de rendu. C'est le serveur qui écrit, et il ne connaît
 * de la personne que ce que la base lui dit. D'où la langue rangée sur le
 * compte, et ce dictionnaire à part.
 *
 * Le ton est celui du reste : direct, sans moquerie et sans encouragement de
 * façade. Une notification qui dit « Bravo, continue comme ça ! » se fait
 * couper au bout de trois jours ; une qui dit ce qui est dû se lit.
 */
type Textes = {
  /** Le compteur vient de franchir le seuil : il y a de quoi faire une série. */
  seuil: (duree: string) => { titre: string; corps: string };
  /** Le lendemain matin, quand la soirée s'est terminée avec une dette. */
  matin: (duree: string) => { titre: string; corps: string };
  /** Après deux semaines sans une partie. Une fois, et une seule. */
  relance: (jours: number) => { titre: string; corps: string };
};

const TEXTES: Record<Locale, Textes> = {
  fr: {
    seuil: (d) => ({
      titre: "Il y a de quoi faire",
      corps: `${d} en attente. Entre deux parties, c'est maintenant que ça se paie.`,
    }),
    matin: (d) => ({
      titre: "La soirée d'hier attend",
      corps: `${d} laissées derrière toi. Ça ne s'efface pas tout seul.`,
    }),
    relance: (j) => ({
      titre: `${j} jours sans une partie`,
      corps: "Soit tu as arrêté de perdre, soit tu as arrêté de compter.",
    }),
  },
  en: {
    seuil: (d) => ({
      titre: "Enough has piled up",
      corps: `${d} waiting. Between two games is when it gets paid.`,
    }),
    matin: (d) => ({
      titre: "Last night is still there",
      corps: `${d} left behind. It does not clear itself.`,
    }),
    relance: (j) => ({
      titre: `${j} days without a game`,
      corps: "Either you stopped losing, or you stopped counting.",
    }),
  },
  es: {
    seuil: (d) => ({
      titre: "Ya hay bastante",
      corps: `${d} pendientes. Entre partida y partida es cuando se paga.`,
    }),
    matin: (d) => ({
      titre: "Lo de anoche sigue ahí",
      corps: `${d} que dejaste atrás. No se borra solo.`,
    }),
    relance: (j) => ({
      titre: `${j} días sin una partida`,
      corps: "O has dejado de perder, o has dejado de contarlo.",
    }),
  },
  de: {
    seuil: (d) => ({
      titre: "Es hat sich etwas angesammelt",
      corps: `${d} offen. Zwischen zwei Runden wird bezahlt.`,
    }),
    matin: (d) => ({
      titre: "Der gestrige Abend steht noch",
      corps: `${d} liegen geblieben. Von allein verschwindet das nicht.`,
    }),
    relance: (j) => ({
      titre: `${j} Tage ohne eine Runde`,
      corps: "Entweder hast du aufgehört zu verlieren, oder aufgehört zu zählen.",
    }),
  },
  zh: {
    seuil: (d) => ({
      titre: "攒够了",
      corps: `还欠 ${d}。两局之间，就是还的时候。`,
    }),
    matin: (d) => ({
      titre: "昨晚的还在",
      corps: `留下了 ${d}。它不会自己消失。`,
    }),
    relance: (j) => ({
      titre: `${j} 天没打一局`,
      corps: "要么你不再输了，要么你不再记了。",
    }),
  },
  ja: {
    seuil: (d) => ({
      titre: "たまってきました",
      corps: `${d} 残っています。試合と試合のあいだが、返すときです。`,
    }),
    matin: (d) => ({
      titre: "昨夜の分が残っています",
      corps: `${d} 置いたままです。ひとりでに消えることはありません。`,
    }),
    relance: (j) => ({
      titre: `${j} 日、一試合もなし`,
      corps: "負けるのをやめたのか、数えるのをやめたのか。",
    }),
  },
};

/**
 * La langue rangée sur le compte, ou l'anglais.
 *
 * L'anglais et non le français : c'est déjà la règle du navigateur, et le
 * défaut français envoyait des notifications françaises à des gens qui
 * n'avaient jamais vu un écran français.
 */
export function langueDuCompte(valeur: unknown): Locale {
  return typeof valeur === "string" && (LANGUES as string[]).includes(valeur)
    ? (valeur as Locale)
    : "en";
}

/** Les textes de notification dans la langue d'un compte. */
export function textesNotification(langue: unknown): Textes {
  return TEXTES[langueDuCompte(langue)];
}
