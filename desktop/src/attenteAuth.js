// Le `crypto` global d'Electron est celui du navigateur : ni randomBytes, ni
// timingSafeEqual. C'est bien le module Node qu'il faut ici.
const crypto = require("crypto");

/**
 * L'aléa qui garde le canal de connexion de l'application.
 *
 * L'application ouvre le navigateur du système sur la page de connexion, et
 * attend un retour sur un port local. Sans cet aléa, n'importe quoi tournant
 * sur la machine pourrait pousser une session dans l'application.
 *
 * Les règles vivaient dans `main.js`, qui fait mille cinq cents lignes et
 * n'avait aucun test — or celles-ci ne dépendent d'Electron par aucun bout.
 */

/**
 * Quinze minutes.
 *
 * Cinq ne suffisaient pas : choisir un compte, taper un mot de passe et passer
 * une double authentification dépasse couramment ce délai, et l'aléa expirait
 * pendant que le joueur s'exécutait — le retour se faisait alors refuser sans
 * que rien ne l'explique.
 */
const ATTENTE_MS = 15 * 60 * 1000;

/**
 * L'attente à employer : celle en cours si elle vaut encore, une neuve sinon.
 *
 * Deux chemins mènent ici — le bouton de la page et l'interception de
 * navigation — et ils peuvent se déclencher coup sur coup pour une SEULE
 * intention de connexion. Chacun forgeait son aléa et écrasait l'autre : le
 * premier retour se faisait refuser, et il fallait tout recommencer.
 */
function attenteCourante(existante, maintenant) {
  if (existante && maintenant < existante.expire) return existante;
  return {
    nonce: crypto.randomBytes(32).toString("base64url"),
    expire: maintenant + ATTENTE_MS,
  };
}

/**
 * Cet aléa est-il celui qu'on attend, et vaut-il encore ?
 *
 * La comparaison est à temps constant : comparer deux chaînes avec `===`
 * s'arrête au premier caractère différent, et le temps de réponse dit alors
 * combien de caractères étaient bons. Sur un secret que quelqu'un peut essayer
 * en boucle depuis la même machine, ça se mesure.
 *
 * `timingSafeEqual` exige deux tampons de MÊME longueur : la comparaison de
 * longueur passe donc avant, et elle n'apprend rien qu'on ne sache déjà — la
 * longueur de l'aléa est fixe et publique.
 */
function nonceValide(attente, recu, maintenant) {
  if (!attente || maintenant > attente.expire) return false;
  if (typeof recu !== "string" || recu.length !== attente.nonce.length) return false;
  return crypto.timingSafeEqual(Buffer.from(recu), Buffer.from(attente.nonce));
}

module.exports = { ATTENTE_MS, attenteCourante, nonceValide };
