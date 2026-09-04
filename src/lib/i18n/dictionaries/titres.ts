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
    eclair: "Éclair",
    eclairAide: "Dette soldée dans l'heure",
    niveau: "Niveau",
    souffrance: "Niveau de souffrance",
    /**
     * « Payés », et pas « d'effort », parce que le panneau en porte DEUX.
     *
     * Quatre lignes plus bas, « Prochain palier · 500 points d'effort » compte
     * l'effort GÉNÉRÉ — ce que les parties ont coûté — quand celui-ci compte le
     * PAYÉ. Sur un compte à soixante défaites et zéro pompe faite, l'écran
     * disait « 100 points d'effort avant le suivant » juste au-dessus de
     * « 480 / 500 » : les mêmes trois mots pour deux quantités, et rien pour
     * les distinguer. C'est le défaut d'« activité » et celui des deux
     * « niveau », sous une troisième forme.
     *
     * « Payés » est déjà le mot du palier de série voisin — « 3 jours payés
     * d'affilée » — donc il ne demande rien à apprendre.
     */
    souffranceAide: (n: number) => `${n} points payés avant le suivant`,
    /**
     * Une PHRASE, pas un fragment.
     *
     * Le composant écrivait `${xp} XP ${versLeNiveau} ${n}`, ce qui donne
     * « 400 XP vers le niveau 5 » en français et « 400 XP 次のレベルまで 5 »
     * en japonais — le chiffre du niveau tombe après la postposition, et la
     * phrase ne veut plus rien dire. C'est la faute que le dictionnaire des
     * défis interdit en toutes lettres : un gabarit à trous produit de
     * l'allemand faux, et ici du japonais faux.
     *
     * L'XP arrive DÉJÀ mise en forme ; le niveau est un petit entier qui
     * n'a pas besoin d'`Intl`.
     */
    versLeNiveau: (xp: string, niveau: number) => `${xp} XP vers le niveau ${niveau}`,
    points: "points",
    xp: "XP",
    titre: "Titre",
    premierPas: "Premier pas",
    repenti: "Repenti",
    regulier: "Régulier",
    endurant: "Endurant",
    increvable: "Increvable",
    machine: "Machine",
  },
  en: {
    eclair: "Lightning",
    eclairAide: "Debt cleared within the hour",
    niveau: "Level",
    souffrance: "Pain level",
    souffranceAide: (n: number) => `${n} points paid to the next one`,
    versLeNiveau: (xp: string, niveau: number) => `${xp} XP to level ${niveau}`,
    points: "points",
    xp: "XP",
    titre: "Title",
    premierPas: "First step",
    repenti: "Repentant",
    regulier: "Steady",
    endurant: "Enduring",
    increvable: "Unbreakable",
    machine: "Machine",
  },
  es: {
    eclair: "Relámpago",
    eclairAide: "Deuda saldada en una hora",
    niveau: "Nivel",
    souffrance: "Nivel de sufrimiento",
    souffranceAide: (n: number) => `${n} puntos pagados hasta el siguiente`,
    versLeNiveau: (xp: string, niveau: number) => `${xp} XP para el nivel ${niveau}`,
    points: "puntos",
    xp: "XP",
    titre: "Título",
    premierPas: "Primer paso",
    repenti: "Arrepentido",
    regulier: "Constante",
    endurant: "Resistente",
    increvable: "Inquebrantable",
    machine: "Máquina",
  },
  de: {
    eclair: "Blitz",
    eclairAide: "Schuld binnen einer Stunde beglichen",
    niveau: "Stufe",
    souffrance: "Leidensstufe",
    souffranceAide: (n: number) => `${n} bezahlte Punkte bis zur nächsten`,
    versLeNiveau: (xp: string, niveau: number) => `${xp} XP bis Stufe ${niveau}`,
    points: "Punkte",
    xp: "XP",
    titre: "Titel",
    premierPas: "Erster Schritt",
    repenti: "Reuiger",
    regulier: "Beständig",
    endurant: "Ausdauernd",
    increvable: "Unverwüstlich",
    machine: "Maschine",
  },
  zh: {
    eclair: "闪电",
    eclairAide: "一小时内还清",
    niveau: "等级",
    souffrance: "受苦等级",
    souffranceAide: (n: number) => `距离下一级还差 ${n} 点已付出的努力`,
    versLeNiveau: (xp: string, niveau: number) => `距离等级 ${niveau} 还差 ${xp} XP`,
    points: "点",
    xp: "XP",
    titre: "称号",
    premierPas: "第一步",
    repenti: "悔悟者",
    regulier: "坚持者",
    endurant: "耐力者",
    increvable: "不倒者",
    machine: "机器",
  },
  ja: {
    eclair: "電光",
    eclairAide: "一時間以内に完済",
    niveau: "レベル",
    souffrance: "苦痛レベル",
    souffranceAide: (n: number) => `次のレベルまで支払い済みポイント ${n}`,
    versLeNiveau: (xp: string, niveau: number) => `レベル ${niveau} まであと ${xp} XP`,
    points: "ポイント",
    xp: "XP",
    titre: "称号",
    premierPas: "第一歩",
    repenti: "悔い改め",
    regulier: "継続者",
    endurant: "持久者",
    increvable: "不屈",
    machine: "マシン",
  },
};
