// « Est-ce bien chez nous ? », posé une fois pour toutes.
//
// Cinq endroits comparaient l'adresse par préfixe :
//
//     url.startsWith(BACKEND_URL)
//
// C'est faux, et d'une façon qui ne se voit pas à la lecture :
// « https://winorworkout.com.exemple-mechant.tld/ » commence bien par
// « https://winorworkout.com ». Un domaine qui suffixe le nôtre passait donc
// pour le nôtre — dans la fenêtre sans barre d'adresse ni bouton retour, et
// devant le filtre de permissions qui accorde les notifications.
//
// Une origine se compare entière : protocole, hôte et port. `URL` la calcule,
// et refuse ce qui n'est pas une adresse — un `about:blank` ou un `javascript:`
// n'a pas d'origine comparable et n'a rien à faire ici.

/** Origine de référence, calculée une fois. `null` si l'adresse est illisible. */
function origineDe(url) {
  try {
    return new URL(String(url)).origin;
  } catch {
    return null;
  }
}

/**
 * Vrai si `url` est servie par la même origine que `base`.
 *
 * `new URL("x").origin` rend « null » (la chaîne) pour les schémas opaques :
 * on refuse explicitement, sinon deux adresses opaques se ressembleraient.
 */
function memeOrigine(url, base) {
  const a = origineDe(url);
  const b = origineDe(base);
  if (!a || !b || a === "null" || b === "null") return false;
  return a === b;
}

/**
 * Chemin de l'adresse, sans la requête ni le fragment.
 *
 * Rendu vide si l'adresse est illisible : un appelant qui compare un chemin
 * vide ne conclura jamais « c'est le tableau de bord » par accident.
 */
function cheminDe(url) {
  try {
    return new URL(String(url)).pathname;
  } catch {
    return "";
  }
}

/**
 * Vrai si le chemin est cette section, ou dedans.
 *
 * `startsWith("/api")` acceptait aussi « /apiculture » : la comparaison porte
 * sur des segments, pas sur des caractères.
 */
function dansLaSection(chemin, section) {
  return chemin === section || chemin.startsWith(`${section}/`);
}

module.exports = { memeOrigine, cheminDe, dansLaSection, origineDe };
