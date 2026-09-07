import { colleCjk } from "./cjk";
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
 *
 * **Et chaque notification a TROIS formulations** (ligne 100 du plan, réponse
 * « Elles sont fades »). Le ton ne change pas — il est la voix du produit, et
 * ce n'est pas ce que la réponse reproche. Ce qui rend fade un texte juste,
 * c'est de le recevoir mot pour mot tous les matins : à la troisième fois on
 * ne le lit plus, à la cinquième on coupe le canal. La variété est donc la
 * moitié du sujet que le code peut traiter sans arbitrer la voix.
 *
 * **Elle se DÉDUIT du jour, comme le défi quotidien**, et ne se range nulle
 * part. Un compteur en base finirait par diverger de ce qui le produit, et il
 * faudrait une colonne par notification. Le jour suffit, et il donne en prime
 * la propriété qu'on veut : deux jours consécutifs ne peuvent pas tomber sur
 * la même formulation, puisque leurs numéros se suivent.
 */
type Message = { titre: string; corps: string };

/**
 * Chaque notification porte ses formulations, et non l'inverse.
 *
 * Un « jeu de textes » complet par variante obligerait à écrire les quatre
 * ensemble alors qu'elles ne partent jamais ensemble : le seuil se déclenche
 * le soir, le rappel le matin, la relance après quinze jours, la pesée le
 * dimanche. Leurs variétés sont indépendantes.
 */
type Textes = {
  /** Le compteur vient de franchir le seuil : il y a de quoi faire une série. */
  seuil: ((duree: string) => Message)[];
  /** Le lendemain matin, quand la soirée s'est terminée avec une dette. */
  matin: ((duree: string) => Message)[];
  /** Après deux semaines sans une partie. Une fois, et une seule. */
  relance: ((jours: number) => Message)[];
  /**
   * Le rappel de pesée hebdomadaire (réponse 022, optionnel).
   *
   * Il ne dit RIEN du poids, ni d'une tendance, ni d'un objectif : c'est un
   * rappel de geste, pas un jugement. Quelqu'un qui suit son poids sait déjà
   * ce qu'il en pense, et une notification qui commente est une notification
   * qu'on coupe.
   */
  pesee: (() => Message)[];
};

const TEXTES: Record<Locale, Textes> = {
  fr: {
    seuil: [
      (d) => ({
        titre: "Il y a de quoi faire",
        corps: `${d} en attente. Entre deux parties, c'est maintenant que ça se paie.`,
      }),
      (d) => ({
        titre: "Le compteur est monté",
        corps: `${d} au compteur. La partie suivante n'attendra pas.`,
      }),
      (d) => ({
        titre: "C'est le moment",
        corps: `${d} de retard. Entre deux parties, ça part vite.`,
      }),
    ],
    matin: [
      (d) => ({
        titre: "La soirée d'hier attend",
        corps: `${d} laissées derrière toi. Ça ne s'efface pas tout seul.`,
      }),
      (d) => ({
        titre: "Rien n'a bougé cette nuit",
        corps: `${d} au réveil. Le café peut attendre trois minutes.`,
      }),
      (d) => ({
        titre: "Hier soir est toujours là",
        corps: `${d} en attente depuis hier. Le matin est le moment le plus simple.`,
      }),
    ],
    relance: [
      (j) => ({
        titre: `${j} jours sans une partie`,
        corps: "Soit tu as arrêté de perdre, soit tu as arrêté de compter.",
      }),
      (j) => ({
        titre: `${j} jours que le compteur dort`,
        corps: "Rien n'a été enregistré ici depuis. Une soirée suffit à le réveiller.",
      }),
      (j) => ({
        titre: `${j} jours`,
        corps: "Ta dette t'attend exactement où tu l'as laissée.",
      }),
    ],
    pesee: [
      () => ({
        titre: "Une semaine depuis ta dernière pesée",
        corps: "Trente secondes, et la courbe reprend.",
      }),
      () => ({
        titre: "La courbe s'est arrêtée là",
        corps: "Une pesée, et elle repart.",
      }),
      () => ({
        titre: "Sept jours sans pesée",
        corps: "Le chiffre compte moins que la régularité.",
      }),
    ],
  },
  en: {
    seuil: [
      (d) => ({
        titre: "Enough has piled up",
        corps: `${d} waiting. Between two games is when it gets paid.`,
      }),
      (d) => ({
        titre: "The counter has climbed",
        corps: `${d} on the counter. The next game will not wait.`,
      }),
      (d) => ({
        titre: "Now is the moment",
        corps: `${d} behind. Between two games, it goes fast.`,
      }),
    ],
    matin: [
      (d) => ({
        titre: "Last night is still there",
        corps: `${d} left behind. It does not clear itself.`,
      }),
      (d) => ({
        titre: "Nothing moved overnight",
        corps: `${d} waiting for you. Coffee can wait three minutes.`,
      }),
      (d) => ({
        titre: "Yesterday evening is still here",
        corps: `${d} owed since last night. Morning is the easiest time.`,
      }),
    ],
    relance: [
      (j) => ({
        titre: `${j} days without a game`,
        corps: "Either you stopped losing, or you stopped counting.",
      }),
      (j) => ({
        titre: `${j} days with the counter asleep`,
        corps: "Nothing has been logged here since. One evening wakes it up.",
      }),
      (j) => ({
        titre: `${j} days`,
        corps: "Your debt is waiting exactly where you left it.",
      }),
    ],
    pesee: [
      () => ({
        titre: "A week since your last weigh-in",
        corps: "Thirty seconds, and the curve picks up again.",
      }),
      () => ({
        titre: "The curve stopped there",
        corps: "One weigh-in, and it starts again.",
      }),
      () => ({
        titre: "Seven days without a weigh-in",
        corps: "The number matters less than the rhythm.",
      }),
    ],
  },
  es: {
    seuil: [
      (d) => ({
        titre: "Ya hay bastante",
        corps: `${d} pendientes. Entre partida y partida es cuando se paga.`,
      }),
      (d) => ({
        titre: "El contador ha subido",
        corps: `${d} en el contador. La siguiente partida no va a esperar.`,
      }),
      (d) => ({
        titre: "Es el momento",
        corps: `${d} de retraso. Entre dos partidas se va rápido.`,
      }),
    ],
    matin: [
      (d) => ({
        titre: "Lo de anoche sigue ahí",
        corps: `${d} que dejaste atrás. No se borra solo.`,
      }),
      (d) => ({
        titre: "Nada se ha movido esta noche",
        corps: `${d} al despertar. El café puede esperar tres minutos.`,
      }),
      (d) => ({
        titre: "Lo de ayer sigue aquí",
        corps: `${d} pendientes desde anoche. Por la mañana es más fácil.`,
      }),
    ],
    relance: [
      (j) => ({
        titre: `${j} días sin una partida`,
        corps: "O has dejado de perder, o has dejado de contarlo.",
      }),
      (j) => ({
        titre: `${j} días con el contador dormido`,
        corps: "Aquí no se ha registrado nada desde entonces. Una noche basta para despertarlo.",
      }),
      (j) => ({
        titre: `${j} días`,
        corps: "Tu deuda te espera justo donde la dejaste.",
      }),
    ],
    pesee: [
      () => ({
        titre: "Una semana desde tu último pesaje",
        corps: "Treinta segundos y la curva sigue.",
      }),
      () => ({
        titre: "La curva se quedó ahí",
        corps: "Un pesaje, y vuelve a arrancar.",
      }),
      () => ({
        titre: "Siete días sin pesarte",
        corps: "El número importa menos que la constancia.",
      }),
    ],
  },
  de: {
    seuil: [
      (d) => ({
        titre: "Es hat sich etwas angesammelt",
        corps: `${d} offen. Zwischen zwei Runden wird bezahlt.`,
      }),
      (d) => ({
        titre: "Der Zähler ist gestiegen",
        corps: `${d} auf dem Zähler. Die nächste Runde wartet nicht.`,
      }),
      (d) => ({
        titre: "Jetzt ist der Moment",
        corps: `${d} im Rückstand. Zwischen zwei Runden geht das schnell.`,
      }),
    ],
    matin: [
      (d) => ({
        titre: "Der gestrige Abend steht noch",
        corps: `${d} liegen geblieben. Von allein verschwindet das nicht.`,
      }),
      (d) => ({
        titre: "Über Nacht hat sich nichts bewegt",
        corps: `${d} beim Aufwachen. Der Kaffee kann drei Minuten warten.`,
      }),
      (d) => ({
        titre: "Gestern Abend ist immer noch da",
        corps: `${d} offen seit gestern. Morgens geht es am leichtesten.`,
      }),
    ],
    relance: [
      (j) => ({
        titre: `${j} Tage ohne eine Runde`,
        corps: "Entweder hast du aufgehört zu verlieren, oder aufgehört zu zählen.",
      }),
      (j) => ({
        titre: `${j} Tage schläft der Zähler`,
        corps: "Seitdem wurde hier nichts eingetragen. Ein Abend weckt ihn wieder.",
      }),
      (j) => ({
        titre: `${j} Tage`,
        corps: "Deine Schuld wartet genau da, wo du sie gelassen hast.",
      }),
    ],
    pesee: [
      () => ({
        titre: "Eine Woche seit deiner letzten Wiegung",
        corps: "Dreißig Sekunden, und die Kurve geht weiter.",
      }),
      () => ({
        titre: "Die Kurve endet dort",
        corps: "Einmal wiegen, und sie läuft weiter.",
      }),
      () => ({
        titre: "Sieben Tage ohne Wiegung",
        corps: "Die Zahl zählt weniger als die Regelmäßigkeit.",
      }),
    ],
  },
  zh: {
    seuil: [
      (d) => ({
        titre: "攒够了",
        corps: colleCjk(`还欠 ${d}。两局之间，就是还的时候。`),
      }),
      (d) => ({
        titre: "计数涨上来了",
        corps: colleCjk(`计数里有 ${d}。下一局不会等你。`),
      }),
      (d) => ({
        titre: "就是现在",
        corps: colleCjk(`拖着 ${d}。两局之间，很快就还完了。`),
      }),
    ],
    matin: [
      (d) => ({
        titre: "昨晚的还在",
        corps: colleCjk(`留下了 ${d}。它不会自己消失。`),
      }),
      (d) => ({
        titre: "这一夜什么都没变",
        corps: colleCjk(`醒来还欠 ${d}。咖啡可以等三分钟。`),
      }),
      (d) => ({
        titre: "昨天晚上的账还在",
        corps: colleCjk(`从昨晚起欠着 ${d}。早上是最好还的时候。`),
      }),
    ],
    relance: [
      (j) => ({
        titre: `${j} 天没打一局`,
        corps: "要么你不再输了，要么你不再记了。",
      }),
      (j) => ({
        titre: `${j} 天没动过计数`,
        corps: "这段时间这里什么都没记。一个晚上就能重新开始。",
      }),
      (j) => ({
        titre: `${j} 天`,
        corps: "你的欠账就停在你离开的地方。",
      }),
    ],
    pesee: [
      () => ({
        titre: "距离上次称重已经一周",
        corps: "三十秒，曲线就能接上。",
      }),
      () => ({
        titre: "曲线停在那里了",
        corps: "称一次，它就继续往前走。",
      }),
      () => ({
        titre: "七天没有称重",
        corps: "数字不重要，规律才重要。",
      }),
    ],
  },
  ja: {
    seuil: [
      (d) => ({
        titre: "たまってきました",
        corps: colleCjk(`${d} 残っています。試合と試合のあいだが、返すときです。`),
      }),
      (d) => ({
        titre: "カウンターが上がりました",
        corps: colleCjk(`${d} たまっています。次の試合は待ってくれません。`),
      }),
      (d) => ({
        titre: "いまがそのときです",
        corps: colleCjk(`${d} 滞っています。試合と試合のあいだなら、すぐ終わります。`),
      }),
    ],
    matin: [
      (d) => ({
        titre: "昨夜の分が残っています",
        corps: colleCjk(`${d} 置いたままです。ひとりでに消えることはありません。`),
      }),
      (d) => ({
        titre: "夜のあいだ、何も動いていません",
        corps: colleCjk(`起きた時点で ${d}。コーヒーは三分待てます。`),
      }),
      (d) => ({
        titre: "昨日の夜の分がまだあります",
        corps: colleCjk(`昨夜から ${d} 残っています。朝がいちばん楽です。`),
      }),
    ],
    relance: [
      (j) => ({
        titre: `${j} 日、一試合もなし`,
        corps: "負けるのをやめたのか、数えるのをやめたのか。",
      }),
      (j) => ({
        titre: `${j} 日、カウンターは止まったまま`,
        corps: "その間、ここには何も記録されていません。一晩あれば戻せます。",
      }),
      (j) => ({
        titre: `${j} 日`,
        corps: "あなたの負債は、置いていったところでそのまま待っています。",
      }),
    ],
    pesee: [
      () => ({
        titre: "前回の計測から 1 週間",
        corps: "30 秒で、グラフの続きが描けます。",
      }),
      () => ({
        titre: "グラフはそこで止まっています",
        corps: "一度はかれば、また伸びていきます。",
      }),
      () => ({
        titre: "7 日間、計測なし",
        corps: "数字よりも、続けることのほうが大事です。",
      }),
    ],
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

/**
 * Le rang de la formulation, déduit du seul JOUR.
 *
 * Deux jours consécutifs ne peuvent pas tomber sur la même : leurs numéros se
 * suivent, donc leurs restes aussi. C'est la propriété qu'on veut, et elle
 * tient sans mémoire — un compteur rangé en base finirait par diverger de ce
 * qui le produit, et il en faudrait un par notification.
 *
 * Un jour illisible rend zéro plutôt que `NaN` : une notification qui ne part
 * pas parce qu'une date était mal écrite serait une panne bien plus chère que
 * la répétition qu'on corrige.
 */
export function rangDuJour(jour: string, combien: number): number {
  if (combien <= 0) return 0;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour);
  if (!m) return 0;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!Number.isFinite(t)) return 0;
  const jours = Math.floor(t / 86_400_000);
  return ((jours % combien) + combien) % combien;
}

/**
 * Les textes de notification dans la langue d'un compte, pour un jour donné.
 *
 * Le jour est OBLIGATOIRE, et ce n'est pas une coquetterie : rendu optionnel,
 * un appelant qui l'oublie recevrait toujours la même formulation sans que
 * rien ne le dise — c'est-à-dire exactement le défaut qu'on corrige, réintroduit
 * en silence. Obligatoire, c'est le compilateur qui nomme les appelants.
 */
export function textesNotification(langue: unknown, jour: string) {
  const t = TEXTES[langueDuCompte(langue)];
  return {
    seuil: t.seuil[rangDuJour(jour, t.seuil.length)],
    matin: t.matin[rangDuJour(jour, t.matin.length)],
    relance: t.relance[rangDuJour(jour, t.relance.length)],
    pesee: t.pesee[rangDuJour(jour, t.pesee.length)],
  };
}
