/**
 * Ce que l'application desktop dit pendant qu'on joue.
 *
 * Trois endroits l'écrivaient en français, en dur, dans le composant : la
 * pastille en jeu après une partie d'Apex, la notification système après une
 * partie de League, et la notification d'essai des réglages. Ils échappaient à
 * la règle « aucun texte dans un composant » parce qu'ils ne s'affichent pas
 * dans une page — mais quelqu'un qui lit l'application en allemand recevait
 * bien du français en jeu.
 *
 * Les noms d'exercices sont ceux d'une phrase, pas d'un tableau : la boxe se
 * compte en temps, d'où « 4 min de boxe » là où les autres donnent
 * « 12 pompes ».
 */
export const enJeu = {
  fr: {
    dejaEnregistree: "Partie déjà enregistrée",
    refuse: (raison: string) => `Refusé : ${raison}`,
    horsLigne: "Enregistrement impossible : pas de réseau ?",
    aVerifier: ", à vérifier",
    partieTerminee: "Partie terminée",
    aFaire: (quantite: string) => `${quantite} à faire.`,
    essaiTitre: "Win or Workout",
    essaiCorps: "Voilà à quoi ressemble un rappel.",
    issueIllisible: "Issue de partie illisible",
    issueIllisibleCorps: "Victoire ou défaite n'a pas pu être lu. Ajoute la partie à la main.",
    noms: { pompes: "pompes", squats: "squats", boxe: "de boxe", planche: "de planche", tractions: "tractions", course: "de course" },
  },
  en: {
    dejaEnregistree: "Match already logged",
    refuse: (raison: string) => `Refused: ${raison}`,
    horsLigne: "Could not log it: no network?",
    aVerifier: ", worth checking",
    partieTerminee: "Match over",
    aFaire: (quantite: string) => `${quantite} to do.`,
    essaiTitre: "Win or Workout",
    essaiCorps: "This is what a reminder looks like.",
    issueIllisible: "Match result unreadable",
    issueIllisibleCorps: "We could not tell a win from a loss. Add the match by hand.",
    noms: { pompes: "push-ups", squats: "squats", boxe: "of boxing", planche: "of plank", tractions: "pull-ups", course: "of running" },
  },
  es: {
    dejaEnregistree: "Partida ya registrada",
    refuse: (raison: string) => `Rechazado: ${raison}`,
    horsLigne: "No se ha podido registrar: ¿sin red?",
    aVerifier: ", conviene revisarlo",
    partieTerminee: "Partida terminada",
    aFaire: (quantite: string) => `${quantite} por hacer.`,
    essaiTitre: "Win or Workout",
    essaiCorps: "Así es como se ve un aviso.",
    issueIllisible: "Resultado ilegible",
    issueIllisibleCorps: "No se ha podido saber si fue victoria o derrota. Añade la partida a mano.",
    noms: { pompes: "flexiones", squats: "sentadillas", boxe: "de boxeo", planche: "de plancha", tractions: "dominadas", course: "de carrera" },
  },
  de: {
    dejaEnregistree: "Partie schon eingetragen",
    refuse: (raison: string) => `Abgelehnt: ${raison}`,
    horsLigne: "Eintragen nicht möglich: kein Netz?",
    aVerifier: ", besser nachsehen",
    partieTerminee: "Partie vorbei",
    aFaire: (quantite: string) => `${quantite} zu machen.`,
    essaiTitre: "Win or Workout",
    essaiCorps: "So sieht eine Erinnerung aus.",
    issueIllisible: "Ergebnis nicht lesbar",
    issueIllisibleCorps: "Sieg oder Niederlage ließ sich nicht erkennen. Trag die Partie von Hand ein.",
    noms: { pompes: "Liegestütze", squats: "Kniebeugen", boxe: "Boxen", planche: "Planke", tractions: "Klimmzüge", course: "Laufen" },
  },
  zh: {
    dejaEnregistree: "这局已经记录过了",
    refuse: (raison: string) => `被拒绝：${raison}`,
    horsLigne: "无法记录：没有网络？",
    aVerifier: "，建议核对一下",
    partieTerminee: "对局结束",
    aFaire: (quantite: string) => `还差 ${quantite}。`,
    essaiTitre: "Win or Workout",
    essaiCorps: "提醒大概就是这个样子。",
    issueIllisible: "无法判断胜负",
    issueIllisibleCorps: "没能读到这局是胜是负。请手动添加这局对局。",
    noms: { pompes: "个俯卧撑", squats: "个深蹲", boxe: "拳击", planche: "平板支撑", tractions: "个引体向上", course: "跑步" },
  },
  ja: {
    dejaEnregistree: "この試合は記録済みです",
    refuse: (raison: string) => `拒否されました：${raison}`,
    horsLigne: "記録できません。ネットワークがありませんか？",
    aVerifier: "（要確認）",
    partieTerminee: "試合終了",
    aFaire: (quantite: string) => `${quantite} が残っています。`,
    essaiTitre: "Win or Workout",
    essaiCorps: "通知はこんなふうに表示されます。",
    issueIllisible: "勝敗を読み取れません",
    issueIllisibleCorps: "勝ちか負けかを判別できませんでした。手動で試合を追加してください。",
    noms: { pompes: "腕立て", squats: "スクワット", boxe: "のボクシング", planche: "のプランク", tractions: "懸垂", course: "のランニング" },
  },
};
