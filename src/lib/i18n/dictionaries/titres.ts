/**
 * Les titres et le niveau de compte (lignes 148 et 149).
 *
 * Les clés vivent dans `src/lib/niveauCompte.ts`, les mots ici : c'est la
 * règle du projet, et elle a une raison de plus dans ce cas précis. Un titre
 * s'affiche à côté d'un pseudo, donc devant quelqu'un d'autre, et il n'y a pas
 * de place pour une phrase. Chaque langue doit donc trouver SON mot d'un
 * caractère, pas traduire le français mot à mot.
 *
 * Aucun titre ne dit quelque chose de désobligeant. Ce n'est pas de la
 * politesse, c'est une contrainte : le produit ne doit jamais être celui qui
 * vous désigne publiquement.
 */
export const titres = {
  fr: {
    niveau: "Niveau",
    versLeNiveau: "vers le niveau",
    points: "points",
    titre: "Titre",
    premierPas: "Premier pas",
    repenti: "Repenti",
    regulier: "Régulier",
    endurant: "Endurant",
    increvable: "Increvable",
    machine: "Machine",
  },
  en: {
    niveau: "Level",
    versLeNiveau: "to level",
    points: "points",
    titre: "Title",
    premierPas: "First step",
    repenti: "Repentant",
    regulier: "Steady",
    endurant: "Enduring",
    increvable: "Unbreakable",
    machine: "Machine",
  },
  es: {
    niveau: "Nivel",
    versLeNiveau: "para el nivel",
    points: "puntos",
    titre: "Título",
    premierPas: "Primer paso",
    repenti: "Arrepentido",
    regulier: "Constante",
    endurant: "Resistente",
    increvable: "Inquebrantable",
    machine: "Máquina",
  },
  de: {
    niveau: "Stufe",
    versLeNiveau: "bis Stufe",
    points: "Punkte",
    titre: "Titel",
    premierPas: "Erster Schritt",
    repenti: "Reuiger",
    regulier: "Beständig",
    endurant: "Ausdauernd",
    increvable: "Unverwüstlich",
    machine: "Maschine",
  },
  zh: {
    niveau: "等级",
    versLeNiveau: "升至等级",
    points: "点",
    titre: "称号",
    premierPas: "第一步",
    repenti: "悔悟者",
    regulier: "坚持者",
    endurant: "耐力者",
    increvable: "不倒者",
    machine: "机器",
  },
  ja: {
    niveau: "レベル",
    versLeNiveau: "次のレベルまで",
    points: "ポイント",
    titre: "称号",
    premierPas: "第一歩",
    repenti: "悔い改め",
    regulier: "継続者",
    endurant: "持久者",
    increvable: "不屈",
    machine: "マシン",
  },
};
