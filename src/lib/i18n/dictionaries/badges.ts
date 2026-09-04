/**
 * Les paliers et les badges.
 *
 * Les libellés se composent à partir de la famille et du seuil : écrire à la
 * main les dix-huit noms dans six langues aurait fait cent huit chaînes à
 * maintenir, dont la moitié auraient fini par diverger.
 */
export const badges = {
  fr: {
    titre: "Paliers",
    aide: "Ce que tu as déjà fait, et ce qui vient ensuite.",
    prochain: "Prochain palier",
    volume: (n: number) => `${n} points d'effort`,
    parties: (n: number) => (n === 1 ? "Première partie" : `${n} parties`),
    serie: (n: number) => `${n} jours payés d'affilée`,
    obtenus: (n: number, total: number) => `${n} sur ${total}`,
    tout: "Tout est atteint. Il faudra en inventer d'autres.",
  },
  en: {
    titre: "Milestones",
    aide: "What you have already done, and what comes next.",
    prochain: "Next milestone",
    volume: (n: number) => `${n} effort points`,
    parties: (n: number) => (n === 1 ? "First match" : `${n} matches`),
    serie: (n: number) => `${n} days paid in a row`,
    obtenus: (n: number, total: number) => `${n} of ${total}`,
    tout: "All reached. New ones will have to be invented.",
  },
  es: {
    titre: "Hitos",
    aide: "Lo que ya has hecho, y lo que viene después.",
    prochain: "Próximo hito",
    volume: (n: number) => `${n} puntos de esfuerzo`,
    parties: (n: number) => (n === 1 ? "Primera partida" : `${n} partidas`),
    serie: (n: number) => `${n} días pagados seguidos`,
    obtenus: (n: number, total: number) => `${n} de ${total}`,
    tout: "Todo conseguido. Habrá que inventar otros.",
  },
  de: {
    titre: "Meilensteine",
    aide: "Was du schon geschafft hast, und was als Nächstes kommt.",
    prochain: "Nächster Meilenstein",
    volume: (n: number) => `${n} Aufwandspunkte`,
    parties: (n: number) => (n === 1 ? "Erste Partie" : `${n} Partien`),
    serie: (n: number) => `${n} Tage in Folge bezahlt`,
    obtenus: (n: number, total: number) => `${n} von ${total}`,
    tout: "Alles erreicht. Es müssen neue erfunden werden.",
  },
  zh: {
    titre: "里程碑",
    aide: "你已经做到的，以及接下来的目标。",
    prochain: "下一个里程碑",
    volume: (n: number) => `${n} 点努力值`,
    parties: (n: number) => (n === 1 ? "第一场对局" : `${n} 场对局`),
    serie: (n: number) => `连续 ${n} 天还清`,
    obtenus: (n: number, total: number) => `${total} 个中的 ${n} 个`,
    tout: "全部达成。得再想些新的了。",
  },
  ja: {
    titre: "マイルストーン",
    aide: "これまでの実績と、次の目標です。",
    prochain: "次のマイルストーン",
    volume: (n: number) => `努力ポイント ${n}`,
    parties: (n: number) => (n === 1 ? "初めての試合" : `${n} 試合`),
    serie: (n: number) => `${n} 日連続で返済`,
    obtenus: (n: number, total: number) => `${total} 個中 ${n} 個`,
    tout: "すべて達成しました。新しいものを考える必要があります。",
  },
};
