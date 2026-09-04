/**
 * Le défi du jour (ligne 138).
 *
 * Chaque défi porte une PHRASE, pas un gabarit à trous : « gagne 2 parties »
 * et « paie 100 points » ne se construisent pas de la même façon d'une langue
 * à l'autre, et un gabarit unique produirait de l'allemand faux. La cible est
 * passée en argument pour qu'elle reste écrite une seule fois — dans le code,
 * là où elle décide.
 */
export const defis = {
  fr: {
    titre: "Défi du jour",
    aide: "Il change chaque jour, et il vaut jusqu'à minuit.",
    fait: "Fait",
    parties3: (n: number) => `Enregistre ${n} parties`,
    victoires2: (n: number) => `Gagne ${n} parties`,
    jeux2: (n: number) => `Joue à ${n} jeux différents`,
    paye100: (n: number) => `Paie ${n} points d'effort`,
    paye300: (n: number) => `Paie ${n} points d'effort`,
    seances1: (n: number) => `Fais ${n} séance`,
  },
  en: {
    titre: "Daily challenge",
    aide: "It changes every day, and it stands until midnight.",
    fait: "Done",
    parties3: (n: number) => `Log ${n} games`,
    victoires2: (n: number) => `Win ${n} games`,
    jeux2: (n: number) => `Play ${n} different games`,
    paye100: (n: number) => `Pay ${n} effort points`,
    paye300: (n: number) => `Pay ${n} effort points`,
    seances1: (n: number) => `Do ${n} session`,
  },
  es: {
    titre: "Reto del día",
    aide: "Cambia cada día y vale hasta medianoche.",
    fait: "Hecho",
    parties3: (n: number) => `Registra ${n} partidas`,
    victoires2: (n: number) => `Gana ${n} partidas`,
    jeux2: (n: number) => `Juega a ${n} juegos distintos`,
    paye100: (n: number) => `Paga ${n} puntos de esfuerzo`,
    paye300: (n: number) => `Paga ${n} puntos de esfuerzo`,
    seances1: (n: number) => `Haz ${n} sesión`,
  },
  de: {
    titre: "Tagesaufgabe",
    aide: "Sie wechselt täglich und gilt bis Mitternacht.",
    fait: "Erledigt",
    parties3: (n: number) => `Trage ${n} Partien ein`,
    victoires2: (n: number) => `Gewinne ${n} Partien`,
    jeux2: (n: number) => `Spiele ${n} verschiedene Spiele`,
    paye100: (n: number) => `Zahle ${n} Aufwandspunkte`,
    paye300: (n: number) => `Zahle ${n} Aufwandspunkte`,
    seances1: (n: number) => `Absolviere ${n} Einheit`,
  },
  zh: {
    titre: "每日挑战",
    aide: "每天更换，有效至当日结束。",
    fait: "已完成",
    parties3: (n: number) => `记录 ${n} 场对局`,
    victoires2: (n: number) => `赢下 ${n} 场对局`,
    jeux2: (n: number) => `玩 ${n} 款不同的游戏`,
    paye100: (n: number) => `偿还 ${n} 点努力值`,
    paye300: (n: number) => `偿还 ${n} 点努力值`,
    seances1: (n: number) => `完成 ${n} 次训练`,
  },
  ja: {
    titre: "今日のチャレンジ",
    aide: "毎日変わり、その日のうちだけ有効です。",
    fait: "達成",
    parties3: (n: number) => `${n} 試合を記録する`,
    victoires2: (n: number) => `${n} 試合勝つ`,
    jeux2: (n: number) => `${n} 種類のゲームをプレイする`,
    paye100: (n: number) => `努力ポイントを ${n} 返す`,
    paye300: (n: number) => `努力ポイントを ${n} 返す`,
    seances1: (n: number) => `${n} 回のセッションをこなす`,
  },
};
