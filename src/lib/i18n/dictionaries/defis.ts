/**
 * Le défi du jour (ligne 138).
 *
 * Chaque défi porte une PHRASE, pas un gabarit à trous : « gagne 2 parties »
 * et « paie 100 points » ne se construisent pas de la même façon d'une langue
 * à l'autre, et un gabarit unique produirait de l'allemand faux. La cible est
 * passée en argument pour qu'elle reste écrite une seule fois — dans le code,
 * là où elle décide.
 *
 * La cible arrive DÉJÀ mise en forme, d'où `n: string`. Le japonais l'a
 * montré : la phrase disait « 努力ポイントを 2000 返す » et la barre juste en
 * dessous « 0 / 2,000 » — deux écritures du même nombre à quatre caractères
 * d'écart. La barre avait été formatée trois heures plus tôt, la phrase non :
 * une correction qui n'en répare qu'une moitié, commise en la corrigeant.
 *
 * `gain` dit ce que le défi rapporte, et il le dit sans passer par `Intl` :
 * cinquante et trois cents s'écrivent pareil dans les six langues, un
 * séparateur de milliers ne s'y pose jamais. Le jour où un défi vaudra 1 500,
 * c'est ici qu'il faudra le formater — pas dans le composant, où la règle se
 * perdrait.
 */
export const defis = {
  fr: {
    moisTitre: "Ce mois-ci",
    moisAide: "Deux objectifs, remis à zéro le premier du mois.",
    moisPoints: (n: string) => `Paie ${n} points d'effort`,
    moisParties: (n: string) => `Enregistre ${n} parties`,
    collectifTitre: "Ensemble ce mois-ci",
    collectifAide: (n: number) => `Tout l'effort payé par tout le monde. ${n} personne${n > 1 ? "s y ont" : " y a"} contribué ce mois-ci.`,
    collectifAtteint: "Objectif atteint.",
    titre: "Défi du jour",
    aide: "Il change chaque jour, et il vaut jusqu'à minuit.",
    fait: "Fait",
    gain: (n: number) => `+${n} XP`,
    parties3: (n: string) => `Enregistre ${n} parties`,
    victoires2: (n: string) => `Gagne ${n} parties`,
    jeux2: (n: string) => `Joue à ${n} jeux différents`,
    paye100: (n: string) => `Paie ${n} points d'effort`,
    paye300: (n: string) => `Paie ${n} points d'effort`,
    seances1: (n: string) => `Fais ${n} séance`,
  },
  en: {
    moisTitre: "This month",
    moisAide: "Two goals, reset on the first of the month.",
    moisPoints: (n: string) => `Pay ${n} effort points`,
    moisParties: (n: string) => `Log ${n} games`,
    collectifTitre: "Together this month",
    collectifAide: (n: number) => `All the effort paid by everyone. ${n} ${n !== 1 ? "people have" : "person has"} contributed this month.`,
    collectifAtteint: "Goal reached.",
    titre: "Daily challenge",
    aide: "It changes every day, and it stands until midnight.",
    fait: "Done",
    gain: (n: number) => `+${n} XP`,
    parties3: (n: string) => `Log ${n} games`,
    victoires2: (n: string) => `Win ${n} games`,
    jeux2: (n: string) => `Play ${n} different games`,
    paye100: (n: string) => `Pay ${n} effort points`,
    paye300: (n: string) => `Pay ${n} effort points`,
    seances1: (n: string) => `Do ${n} session`,
  },
  es: {
    moisTitre: "Este mes",
    moisAide: "Dos objetivos, reiniciados el día uno de cada mes.",
    moisPoints: (n: string) => `Paga ${n} puntos de esfuerzo`,
    moisParties: (n: string) => `Registra ${n} partidas`,
    collectifTitre: "Juntos este mes",
    collectifAide: (n: number) => `Todo el esfuerzo pagado por todos. ${n} persona${n !== 1 ? "s han" : " ha"} contribuido este mes.`,
    collectifAtteint: "Objetivo alcanzado.",
    titre: "Reto del día",
    aide: "Cambia cada día y vale hasta medianoche.",
    fait: "Hecho",
    gain: (n: number) => `+${n} XP`,
    parties3: (n: string) => `Registra ${n} partidas`,
    victoires2: (n: string) => `Gana ${n} partidas`,
    jeux2: (n: string) => `Juega a ${n} juegos distintos`,
    paye100: (n: string) => `Paga ${n} puntos de esfuerzo`,
    paye300: (n: string) => `Paga ${n} puntos de esfuerzo`,
    seances1: (n: string) => `Haz ${n} sesión`,
  },
  de: {
    moisTitre: "Diesen Monat",
    moisAide: "Zwei Ziele, am Monatsersten zurückgesetzt.",
    moisPoints: (n: string) => `Zahle ${n} Aufwandspunkte`,
    moisParties: (n: string) => `Trage ${n} Partien ein`,
    collectifTitre: "Gemeinsam diesen Monat",
    collectifAide: (n: number) => `Der gesamte von allen bezahlte Aufwand. ${n} Person${n !== 1 ? "en haben" : " hat"} diesen Monat beigetragen.`,
    collectifAtteint: "Ziel erreicht.",
    titre: "Tagesaufgabe",
    aide: "Sie wechselt täglich und gilt bis Mitternacht.",
    fait: "Erledigt",
    gain: (n: number) => `+${n} XP`,
    parties3: (n: string) => `Trage ${n} Partien ein`,
    victoires2: (n: string) => `Gewinne ${n} Partien`,
    jeux2: (n: string) => `Spiele ${n} verschiedene Spiele`,
    paye100: (n: string) => `Zahle ${n} Aufwandspunkte`,
    paye300: (n: string) => `Zahle ${n} Aufwandspunkte`,
    seances1: (n: string) => `Absolviere ${n} Einheit`,
  },
  zh: {
    moisTitre: "本月",
    moisAide: "两个目标，每月一号重置。",
    moisPoints: (n: string) => `偿还 ${n} 点努力值`,
    moisParties: (n: string) => `记录 ${n} 场对局`,
    collectifTitre: "本月一起",
    collectifAide: (n: number) => `所有人偿还的努力量总和。本月有 ${n} 人参与。`,
    collectifAtteint: "目标已达成。",
    titre: "每日挑战",
    aide: "每天更换，有效至当日结束。",
    fait: "已完成",
    gain: (n: number) => `+${n} XP`,
    parties3: (n: string) => `记录 ${n} 场对局`,
    victoires2: (n: string) => `赢下 ${n} 场对局`,
    jeux2: (n: string) => `玩 ${n} 款不同的游戏`,
    paye100: (n: string) => `偿还 ${n} 点努力值`,
    paye300: (n: string) => `偿还 ${n} 点努力值`,
    seances1: (n: string) => `完成 ${n} 次训练`,
  },
  ja: {
    moisTitre: "今月",
    moisAide: "目標は 2 つ。毎月 1 日にリセットされます。",
    moisPoints: (n: string) => `努力ポイントを ${n} 返す`,
    moisParties: (n: string) => `${n} 試合を記録する`,
    collectifTitre: "今月はみんなで",
    collectifAide: (n: number) => `全員が返した努力量の合計です。今月は ${n} 人が参加しました。`,
    collectifAtteint: "目標を達成しました。",
    titre: "今日のチャレンジ",
    aide: "毎日変わり、その日のうちだけ有効です。",
    fait: "達成",
    gain: (n: number) => `+${n} XP`,
    parties3: (n: string) => `${n} 試合を記録する`,
    victoires2: (n: string) => `${n} 試合勝つ`,
    jeux2: (n: string) => `${n} 種類のゲームをプレイする`,
    paye100: (n: string) => `努力ポイントを ${n} 返す`,
    paye300: (n: string) => `努力ポイントを ${n} 返す`,
    seances1: (n: string) => `${n} 回のセッションをこなす`,
  },
};
