/**
 * Le résultat d'une partie Riot, lu sans supposition.
 *
 * Les deux routes lisaient `participant.win ? "V" : "D"`. Trois façons de se
 * tromper vivaient dans cette ligne :
 *
 * - **le champ manquant.** `undefined ? "V" : "D"` rend « défaite ». Une
 *   réponse tronquée, un changement de forme côté Riot, et la partie
 *   s'enregistre du mauvais côté sans que rien ne le signale.
 * - **le remake.** Quand une partie s'arrête avant la fin du décompte, Riot
 *   met `win: false` pour les dix joueurs. Ce n'est pas une défaite, c'est une
 *   partie qui n'a pas eu lieu : la compter en défaite crée une dette pour un
 *   match que personne n'a joué.
 * - **le désaccord.** `participant.win` et `teams[].win` disent la même chose
 *   dans une réponse saine. Quand ils divergent, on ne sait pas laquelle est
 *   vraie — et deviner du côté « défaite » est précisément le pari coûteux.
 *
 * D'où un résultat à trois états. `null` n'est pas une défaite : c'est
 * l'aveu qu'on ne sait pas, et l'appelant doit le dire au lieu d'enregistrer.
 */
export type MotifSansResultat = "remake" | "desaccord" | "inconnu";

export type ResultatPartie =
  | { resultat: "V" | "D" }
  | { resultat: null; motif: MotifSansResultat };

type Equipe = { teamId?: unknown; win?: unknown };
type Participant = {
  teamId?: unknown;
  win?: unknown;
  gameEndedInEarlySurrender?: unknown;
};
type Info = { teams?: unknown; gameEndedInEarlySurrender?: unknown };

/** Le drapeau de remake se trouve tantôt sur le participant, tantôt sur l'info. */
function estRemake(info: Info, participant: Participant): boolean {
  return participant.gameEndedInEarlySurrender === true
    || info.gameEndedInEarlySurrender === true;
}

/** La victoire vue par l'équipe du joueur, si les équipes sont exploitables. */
function victoireDeLEquipe(info: Info, participant: Participant): boolean | null {
  if (!Array.isArray(info.teams)) return null;
  const equipe = (info.teams as Equipe[])
    .find((e) => e && e.teamId === participant.teamId);
  if (!equipe || typeof equipe.win !== "boolean") return null;
  return equipe.win;
}

export function lireResultat(info: Info, participant: Participant): ResultatPartie {
  // Le remake passe avant tout le reste : les deux sources y disent « perdu »
  // et s'accordent parfaitement, ce qui rend le désaccord aveugle à ce cas.
  if (estRemake(info, participant)) return { resultat: null, motif: "remake" };

  const cote = typeof participant.win === "boolean" ? participant.win : null;
  const equipe = victoireDeLEquipe(info, participant);

  // Aucune des deux sources n'est exploitable : on ne devine pas.
  if (cote === null && equipe === null) return { resultat: null, motif: "inconnu" };

  // Une seule des deux : elle suffit. Exiger les deux refuserait des réponses
  // saines dont la forme a simplement changé.
  if (cote === null) return { resultat: equipe ? "V" : "D" };
  if (equipe === null) return { resultat: cote ? "V" : "D" };

  if (cote !== equipe) return { resultat: null, motif: "desaccord" };
  return { resultat: cote ? "V" : "D" };
}
