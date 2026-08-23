import { langueDuCompte } from "./notifications";
import type { Bilan } from "../bilanHebdo";

/**
 * Les textes des courriels.
 *
 * Comme les notifications, ils s'écrivent hors du navigateur : pas de
 * composant, pas de stockage local, pas de rendu. Ils vivent donc à part, et
 * lisent la langue rangée sur le compte.
 *
 * Ils sont courts. Un bilan qui tient en cinq lignes se lit ; un bilan qui
 * demande de faire défiler ne se lit pas, et la semaine suivante il ne
 * s'ouvre plus.
 */
export type TextesBilan = {
  sujet: string;
  titre: (pseudo: string) => string;
  parties: string;
  effort: string;
  paye: string;
  jours: string;
  /** La phrase de clôture, qui change selon qu'on a soldé ou non. */
  cloture: (reste: boolean) => string;
  lien: string;
  /** Comment arrêter de le recevoir. Sans cette ligne, on se désabonne de
   *  tout — y compris de ce qui servait. */
  arret: string;
};

const TEXTES: Record<string, TextesBilan> = {
  fr: {
    sujet: "Ta semaine",
    titre: (p) => `Ta semaine, ${p}`,
    parties: "Parties", effort: "Effort généré", paye: "Effort payé", jours: "Jours actifs",
    cloture: (reste) => reste
      ? "Il reste quelque chose à solder. Ça ne s'efface pas tout seul."
      : "Rien en attente. C'est rare, et ça se note.",
    lien: "Ouvrir le tableau de bord",
    arret: "Tu peux couper ce bilan dans tes réglages.",
  },
  en: {
    sujet: "Your week",
    titre: (p) => `Your week, ${p}`,
    parties: "Games", effort: "Effort owed", paye: "Effort paid", jours: "Active days",
    cloture: (reste) => reste
      ? "Something is still outstanding. It does not clear itself."
      : "Nothing waiting. That is rare, and worth noting.",
    lien: "Open the dashboard",
    arret: "You can turn this recap off in your settings.",
  },
  es: {
    sujet: "Tu semana",
    titre: (p) => `Tu semana, ${p}`,
    parties: "Partidas", effort: "Esfuerzo generado", paye: "Esfuerzo pagado", jours: "Días activos",
    cloture: (reste) => reste
      ? "Queda algo por saldar. No se borra solo."
      : "Nada pendiente. Es raro, y merece anotarse.",
    lien: "Abrir el panel",
    arret: "Puedes desactivar este resumen en tus ajustes.",
  },
  de: {
    sujet: "Deine Woche",
    titre: (p) => `Deine Woche, ${p}`,
    parties: "Runden", effort: "Angefallener Aufwand", paye: "Bezahlter Aufwand", jours: "Aktive Tage",
    cloture: (reste) => reste
      ? "Es steht noch etwas offen. Von allein verschwindet das nicht."
      : "Nichts offen. Das ist selten und darf notiert werden.",
    lien: "Zum Dashboard",
    arret: "Du kannst diesen Rückblick in deinen Einstellungen abschalten.",
  },
  zh: {
    sujet: "你的一周",
    titre: (p) => `${p}，这是你的一周`,
    parties: "场次", effort: "产生的量", paye: "已还的量", jours: "活跃天数",
    cloture: (reste) => reste
      ? "还有没还的。它不会自己消失。"
      : "没有欠着的。这不常见，值得记一笔。",
    lien: "打开面板",
    arret: "你可以在设置里关掉这封小结。",
  },
  ja: {
    sujet: "今週のまとめ",
    titre: (p) => `${p} さんの一週間`,
    parties: "試合数", effort: "発生した量", paye: "返した量", jours: "動いた日数",
    cloture: (reste) => reste
      ? "まだ残っています。ひとりでに消えることはありません。"
      : "残りはありません。めずらしいことなので、書いておきます。",
    lien: "ダッシュボードを開く",
    arret: "この週まとめは設定でオフにできます。",
  },
};

export function textesBilan(langue: unknown): TextesBilan {
  return TEXTES[langueDuCompte(langue)];
}

/** Les quatre chiffres du bilan, dans l'ordre où ils se lisent. */
export function lignesBilan(t: TextesBilan, b: Bilan): { libelle: string; valeur: string }[] {
  return [
    { libelle: t.parties, valeur: `${b.parties} (${b.victoires}V / ${b.defaites}D)` },
    { libelle: t.effort, valeur: String(b.pointsDus) },
    { libelle: t.paye, valeur: String(b.pointsPayes) },
    { libelle: t.jours, valeur: String(b.joursActifs) },
  ];
}
