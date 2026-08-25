// Retient une fin de partie dont l'issue n'a pas pu être lue, le temps que le
// lanceur publie son écran de fin.
//
// Les deux sources locales ne parlent pas au même moment. L'API de partie se
// tait dès que le jeu se ferme ; le lanceur, lui, n'affiche son écran de fin
// qu'après. Envoyer la partie tout de suite, c'est l'envoyer sans issue alors
// que la réponse arrive trois secondes plus tard.
//
// Deux garanties, et ce sont elles qui comptent : la partie part toujours
// (avec l'issue si elle arrive, sans elle sinon), et elle ne part jamais deux
// fois. Une attente qui oublie de rendre la main perd la partie pour de bon,
// et personne ne saurait dire pourquoi.

/** Combien de temps on accepte d'attendre l'écran de fin du lanceur. */
const DELAI_MS = 30000;

/**
 * Combien de temps une issue arrivée trop tôt reste valable.
 *
 * Les deux sources ne se suivent pas dans un ordre garanti. L'API de partie se
 * tait quand le jeu se ferme, le lanceur publie son écran de fin peu après :
 * c'est le cas courant, et l'attente le couvre. Mais rien n'interdit l'inverse
 * — le lanceur bascule pendant que le jeu s'attarde. L'issue arrivait alors
 * sans partie à compléter, et se perdait pour de bon.
 */
const AVANCE_MS = 60000;

/**
 * @param {object} options
 * @param {(event: object) => void} options.envoyer  Remet la fin de partie.
 * @param {number} [options.delaiMs]
 * @param {typeof setTimeout} [options.poser]
 * @param {typeof clearTimeout} [options.retirer]
 */
function creerAttenteFin({ envoyer, delaiMs = DELAI_MS, avanceMs = AVANCE_MS, poser = setTimeout, retirer = clearTimeout }) {
  /** @type {{ event: object, minuteur: unknown } | null} */
  let attente = null;
  /** Une issue reçue alors que rien n'attendait, et l'instant de sa réception. */
  let issueEnAvance = null;

  /** Une fin de partie, complétée par ce que le lanceur a fini par dire. */
  function completer(event, issue) {
    const partie = { ...(event.partie ?? {}) };
    if (issue?.resultat === "V" || issue?.resultat === "D") partie.resultat = issue.resultat;
    if (issue?.motif) partie.motifSansResultat = issue.motif;
    return { ...event, partie };
  }

  function rendre(issue) {
    if (!attente) return;
    const { event, minuteur } = attente;
    // Remis à zéro AVANT l'envoi : `envoyer` peut retomber ici, et une attente
    // encore posée ferait partir la partie une seconde fois.
    attente = null;
    retirer(minuteur);
    envoyer(completer(event, issue));
  }

  return {
    /** Une partie vient de se terminer. */
    finDePartie(event) {
      // Une issue déjà lue ne s'attend pas : c'est le cas courant, et le plus
      // rapide doit rester le plus simple.
      const dejaLue = event?.partie?.resultat === "V" || event?.partie?.resultat === "D";
      if (dejaLue) return envoyer(event);

      // Une partie sans relevé n'a rien à enregistrer : l'issue n'y changerait
      // rien, et la retenir ne ferait que retarder l'overlay.
      if (!event?.partie?.score) return envoyer(event);

      // Le lanceur a parlé le premier : inutile d'attendre ce qu'on a déjà.
      // L'issue est consommée dans la foulée — elle vaut pour UNE partie, et
      // la resservir à la suivante lui prêterait un résultat qui n'est pas le
      // sien.
      const enAvance = issueEnAvance;
      issueEnAvance = null;
      if (enAvance && Date.now() - enAvance.quand < avanceMs) {
        return envoyer(completer(event, enAvance.issue));
      }

      // Deux fins de partie sans que le lanceur ait parlé : la première part
      // telle quelle plutôt que d'être écrasée et perdue.
      if (attente) rendre(null);
      attente = { event, minuteur: poser(() => rendre(null), delaiMs) };
    },

    /** Le lanceur a publié son écran de fin. */
    issue(issue) {
      if (!attente) {
        // Rien n'attend : soit la partie est déjà partie, soit le lanceur a
        // parlé avant que le jeu ne se ferme. On garde la réponse un temps
        // borné plutôt que de la jeter — c'est la seule qu'on aura.
        issueEnAvance = { issue, quand: Date.now() };
        return;
      }
      rendre(issue);
    },

    /** Fermeture de l'application : ce qui attend part avant qu'on éteigne. */
    arreter() {
      issueEnAvance = null;
      rendre(null);
    },

    /** Pour les tests et pour le journal. */
    enAttente() {
      return attente !== null;
    },
  };
}

module.exports = { creerAttenteFin, DELAI_MS };
