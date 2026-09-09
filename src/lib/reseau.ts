/**
 * Une requête qui ne revient jamais.
 *
 * Ce projet a corrigé deux fois ce qu'il fallait faire d'un échec réseau : le
 * REFUS du serveur (500, 4xx) et l'ABSENCE de réseau. Les deux se règlent dans
 * un `catch` ou dans une branche `res.ok`, donc les deux finissent par rendre
 * la main.
 *
 * Il restait le troisième cas, et il n'a rien d'exotique : le serveur ACCEPTE
 * la connexion et n'honore jamais la requête. Un réseau mobile qui bascule, un
 * mandataire, un portail captif, une fonction partie en boucle — la socket
 * reste ouverte et la réponse ne vient pas. `fetch` ne rend alors la main
 * qu'au bout du délai TCP du système, qui se compte en minutes.
 *
 * La promesse ne se règle donc NI dans un sens NI dans l'autre. Ni le `catch`,
 * ni le `finally`, ni la branche d'échec ne passent : « Enregistrement… »
 * reste à l'écran sur un bouton désactivé, et surtout le retour en arrière n'a
 * jamais lieu — l'écran montre un réglage que le serveur n'a jamais reçu.
 * C'est exactement le défaut que la correction du refus existe pour empêcher,
 * par le seul chemin qu'elle ne couvrait pas.
 *
 * Mesuré au navigateur avant d'écrire quoi que ce soit : la requête retenue,
 * le bouton du test de force reste `[disabled]` avec son ellipse, la valeur
 * tapée toujours à l'écran, et rien ne bouge plus jamais.
 *
 * Ce que la correction est, et ce qu'elle n'est pas : elle ne traite PAS
 * l'échec — le traitement existe déjà partout, et il est bon. Elle rend
 * seulement l'échec ATTEIGNABLE. Une requête abandonnée lève, donc elle tombe
 * dans le `catch` que l'appelant a déjà, et l'écran dit ce qu'il sait déjà
 * dire.
 */

/**
 * Quinze secondes.
 *
 * Le chiffre se justifie par les deux bouts. En dessous, on abandonnerait des
 * requêtes qui allaient aboutir : le pire relevé de ce projet est le réveil de
 * Neon, six cents millisecondes au premier appel, et les corps échangés ici
 * tiennent en quelques kilo-octets compressés. Quinze secondes, c'est plus de
 * vingt fois la pire mesure.
 *
 * Au-dessus, on ne protège plus personne : quelqu'un qui attend devant un
 * bouton désactivé a cessé d'y croire bien avant, et la réponse ne vaut plus
 * rien quand elle arrive. Un délai qu'on allonge « pour être sûr » est la
 * façon la plus sûre de reconstruire le défaut qu'on corrige.
 *
 * Une seule valeur pour les lectures comme pour les écritures, et c'est
 * volontaire : les deux ont la même panne — un écran qui reste sur son
 * squelette ou sur son ellipse — et deux valeurs finiraient par diverger.
 */
export const DELAI_RESEAU_MS = 15_000;

/**
 * `fetch`, avec une échéance.
 *
 * Volontairement une enveloppe et non un `signal` à passer à la main : le
 * défaut doit être le plus PRUDENT, et un appelant qui oublie l'argument ne
 * doit pas retomber sur la requête sans fin. C'est la même règle que pour le
 * plafond de notifications, où l'exemption se demande au lieu de s'obtenir par
 * omission.
 *
 * Un appelant qui a DÉJÀ son propre `signal` le garde — il l'a posé pour une
 * raison, annuler une saisie qu'on vient de remplacer — et il reçoit
 * l'échéance EN PLUS. Les deux se combinent au lieu de se choisir : garder le
 * sien seul laisserait l'aperçu de partie sans borne, et le remplacer
 * casserait l'annulation. C'est ce qui permet à cette fonction de n'avoir
 * AUCUNE exemption, donc à la règle de n'avoir aucun trou.
 */
export function fetchBorne(url: string, init?: RequestInit): Promise<Response> {
  const echeance = AbortSignal.timeout(DELAI_RESEAU_MS);
  const signal = init?.signal ? AbortSignal.any([init.signal, echeance]) : echeance;
  return fetch(url, { ...init, signal });
}
