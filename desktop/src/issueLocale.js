// L'issue d'une partie de League, lue sur la machine du joueur.
//
// Deux sources locales, aucune clé développeur, et elles ne parlent pas au même
// moment :
//  - l'API de partie (port 2999) publie un événement « GameEnd » dans les
//    dernières secondes, puis se tait dès que le jeu se ferme ;
//  - le lanceur publie son écran de fin (« eog-stats-block »), mais seulement
//    APRÈS, quand la première a déjà disparu.
//
// La règle commune est écrite ici une fois : on ne rend jamais un résultat
// qu'on n'a pas lu. Inventer une défaite quand la lecture a échoué revient à
// faire payer une dette pour une partie gagnée, et la personne n'a aucun moyen
// de savoir d'où elle sort.

/**
 * @typedef {{ resultat: "V" | "D", motif: null }
 *   | { resultat: null, motif: "remake" | "desaccord" | "inconnu" }} Issue
 */

/** @type {Issue} */
const INCONNU = { resultat: null, motif: "inconnu" };

/** @returns {Issue} */
function gagne(estVictoire) {
  return { resultat: estVictoire ? "V" : "D", motif: null };
}

/**
 * Issue lue dans le journal d'événements de l'API de partie.
 *
 * `Result` vaut « Win » ou « Lose ». Rien d'autre n'est accepté : une valeur
 * inattendue vaut mieux non lue que rangée du côté coûteux.
 *
 * @returns {Issue}
 */
function issueDeLEvenement(data) {
  const evenements = data?.events?.Events;
  if (!Array.isArray(evenements)) return INCONNU;
  const fin = evenements.find((e) => e?.EventName === "GameEnd");
  const brut = String(fin?.Result ?? "").toLowerCase();
  if (brut.startsWith("win")) return gagne(true);
  if (brut.startsWith("lose") || brut.startsWith("loss")) return gagne(false);
  return INCONNU;
}

/**
 * Issue lue sur l'écran de fin du lanceur (`/lol-end-of-game/v1/eog-stats-block`).
 *
 * Cette API n'est pas documentée par Riot : sa forme change d'une version à
 * l'autre. On lit donc les deux endroits où le résultat se trouve, et on ne
 * conclut que s'ils s'accordent. Deux sources qui se contredisent sont un
 * signe que la forme a bougé, pas une occasion de choisir la plus flatteuse.
 *
 * @returns {Issue}
 */
function issueDeFinDePartie(bloc) {
  if (!bloc || typeof bloc !== "object") return INCONNU;

  // Une partie annulée n'est ni une victoire ni une défaite. Le contrôle passe
  // en premier : les deux sources s'accordent sur un remake, donc le contrôle
  // de désaccord ne le verrait jamais.
  const stats = bloc.localPlayer?.stats;
  if (estVrai(stats?.GAME_ENDED_IN_EARLY_SURRENDER)
      || bloc.gameEndedInEarlySurrender === true) {
    return { resultat: null, motif: "remake" };
  }

  const equipe = Array.isArray(bloc.teams)
    ? bloc.teams.find((e) => e?.isPlayerTeam === true)
    : null;
  const parEquipe = typeof equipe?.isWinningTeam === "boolean"
    ? equipe.isWinningTeam
    : null;

  const parJoueur = stats && "WIN" in stats ? estVrai(stats.WIN) : null;

  if (parEquipe === null && parJoueur === null) return INCONNU;
  if (parEquipe !== null && parJoueur !== null && parEquipe !== parJoueur) {
    return { resultat: null, motif: "desaccord" };
  }
  return gagne(parEquipe ?? parJoueur);
}

/**
 * Le lanceur écrit ses drapeaux tantôt en booléen, tantôt en 0/1, tantôt en
 * « 1 ». `Boolean("0")` vaut vrai : la conversion implicite ferait passer une
 * défaite pour une victoire.
 */
function estVrai(valeur) {
  if (typeof valeur === "boolean") return valeur;
  if (typeof valeur === "number") return valeur === 1;
  if (typeof valeur === "string") return valeur === "1" || valeur.toLowerCase() === "true";
  return false;
}

/**
 * Ce qu'on garde d'une partie en cours, relevé après relevé.
 *
 * Deux règles, et chacune corrige une perte constatée :
 *  - un relevé sans score ne remplace pas le précédent : il n'y aurait plus
 *    rien à enregistrer ;
 *  - une issue déjà lue ne se perd plus. Elle n'apparaît que sur les derniers
 *    relevés et ne repart jamais en arrière ; l'écraser par le `null` du relevé
 *    suivant, c'est perdre la seule lecture qu'on aura eue.
 */
function fusionnerReleve(precedent, nouveau) {
  if (!nouveau?.score) return precedent;
  return {
    ...nouveau,
    resultat: nouveau.resultat ?? precedent?.resultat ?? null,
  };
}

module.exports = { issueDeLEvenement, issueDeFinDePartie, fusionnerReleve, INCONNU };
