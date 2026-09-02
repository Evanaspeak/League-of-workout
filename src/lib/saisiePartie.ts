import type { CapacitesJeu } from "@/lib/jeux";

/**
 * Ce qui décide si une partie saisie à la main peut être enregistrée.
 *
 * C'est la porte de l'action la plus employée du produit — et, tant que la clé
 * Riot de production n'est pas arrivée, la SEULE façon d'enregistrer quoi que
 * ce soit. Elle se trompe dans les deux sens et les deux coûtent : trop
 * sévère, le bouton reste éteint et rien n'entre ; trop permissive, une partie
 * incomplète part au serveur, qui la refuse — et le message accuse alors la
 * saisie de quelqu'un qui avait rempli ce qu'on lui demandait.
 *
 * La règle vivait au milieu de huit cent soixante-dix lignes de composant,
 * entre trente états de React : rien ne pouvait l'atteindre. Elle ne dépend
 * pourtant d'aucun d'eux.
 */
export type SaisiePartie = {
  /** « parties » ou « temps » : une séance au temps n'a ni score ni champion. */
  typeJeu: string;
  jeu: string;
  dureeSec: number;
  capacites: Pick<CapacitesJeu, "champions" | "kda" | "br">;
  /** Vide est permis ; renseigné, il doit figurer dans la liste. */
  champion: string;
  championValide: boolean;
  kills: string;
  deaths: string;
  assists: string;
  placement: string;
};

/**
 * Les heures et les minutes d'une séance au temps.
 *
 * `Number("") || 0` traite l'absence comme un zéro, ce qui est le bon
 * comportement ICI : un champ vide vaut zéro heure. Ce qui n'est pas un nombre
 * vaut zéro aussi — le serveur, lui, refuse les valeurs aberrantes par
 * `bornesSaisie`, et c'est à lui de le faire.
 */
export function dureeEnSecondes(heures: string, minutes: string): number {
  const h = Number(heures);
  const m = Number(minutes);
  return (Number.isFinite(h) ? h : 0) * 3600 + (Number.isFinite(m) ? m : 0) * 60;
}

export function saisieComplete(s: SaisiePartie): boolean {
  // Une séance au temps ne demande qu'un jeu et une durée : ni score, ni
  // champion, ni classement. Demander le reste éteindrait le bouton pour
  // toujours sur Minecraft.
  if (s.typeJeu === "temps") return s.jeu.trim().length > 0 && s.dureeSec > 0;

  if (s.jeu.trim().length === 0) return false;
  // Le champion est facultatif ; renseigné, il doit être reconnu. Refuser un
  // champ vide obligerait à en nommer un sur les jeux qui en ont.
  if (s.capacites.champions && s.champion !== "" && !s.championValide) return false;
  if (s.capacites.kda && (s.kills === "" || s.deaths === "" || s.assists === "")) return false;
  // Le classement commence à un : « zéro » n'est pas une place.
  if (s.capacites.br && !(Number(s.placement) >= 1)) return false;
  return true;
}
