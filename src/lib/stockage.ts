/**
 * Le stockage du navigateur, qui n'est pas toujours là.
 *
 * `localStorage` n'est pas une propriété qu'on lit : c'est un accesseur, et il
 * **lève** quand le navigateur est réglé pour bloquer les données de site.
 * Pas l'écriture : l'accès lui-même. Quarante-neuf appels de l'application le
 * faisaient à nu, dont trois sur le chemin de la connexion — une exception y
 * casse l'écran en entier, pour quelqu'un qui n'a aucun recours et aucune
 * raison de faire le lien avec un réglage de son navigateur.
 *
 * Le rendu serveur n'a pas de `window` non plus, ce que chaque appelant
 * vérifiait de son côté, ou oubliait.
 *
 * Règle : une valeur absente et un stockage indisponible se traitent pareil.
 * L'application n'a rien à faire de la distinction — dans les deux cas, elle
 * ne sait pas, et elle doit continuer.
 */

type Coffre = "local" | "session";

/**
 * L'un des deux coffres, ou rien.
 *
 * Il n'y a PAS de `try` ici, et c'est délibéré : chaque fonction publique a le
 * sien, et il rattrape déjà ce que l'accesseur lève. Un second l'aurait
 * doublé sans rien garantir de plus — sabotage fait, la suite restait verte,
 * ce qui est la définition d'une ligne qui ne tient rien. La garantie vit dans
 * les fonctions publiques, une par une, et chacune de leurs protections fait
 * tomber un test quand on la retire.
 *
 * Le garde de rendu serveur, lui, reste : le `catch` de l'appelant
 * rattraperait la `ReferenceError`, mais faire du chemin normal du serveur une
 * exception levée à chaque rendu est coûteux et illisible. Le test ne peut pas
 * distinguer les deux, et son commentaire le dit.
 */
function coffre(lequel: Coffre): Storage | null {
  if (typeof window === "undefined") return null;
  // L'accesseur LÈVE quand le navigateur bloque les données de site : ce n'est
  // pas la méthode qui refuse, c'est la propriété qui n'existe pas pour nous.
  return lequel === "local" ? window.localStorage : window.sessionStorage;
}

/** La valeur, ou `null` si elle manque ou si le stockage est indisponible. */
export function lire(cle: string): string | null {
  try {
    return coffre("local")?.getItem(cle) ?? null;
  } catch {
    return null;
  }
}

/** Écrit, et rend `false` si ça n'a pas pu se faire. Le quota compte aussi. */
export function ecrire(cle: string, valeur: string): boolean {
  try {
    const c = coffre("local");
    if (!c) return false;
    c.setItem(cle, valeur);
    return true;
  } catch {
    return false;
  }
}

export function effacer(cle: string): void {
  try {
    coffre("local")?.removeItem(cle);
  } catch { /* rien à effacer si rien ne s'ouvre */ }
}

export function lireSession(cle: string): string | null {
  try {
    return coffre("session")?.getItem(cle) ?? null;
  } catch {
    return null;
  }
}

export function ecrireSession(cle: string, valeur: string): boolean {
  try {
    const c = coffre("session");
    if (!c) return false;
    c.setItem(cle, valeur);
    return true;
  } catch {
    return false;
  }
}

export function effacerSession(cle: string): void {
  try {
    coffre("session")?.removeItem(cle);
  } catch { /* idem */ }
}

/**
 * Lit une valeur rangée en JSON. Une valeur illisible vaut une valeur absente :
 * un format qui a changé entre deux versions ne doit pas casser un écran.
 */
export function lireJson<T>(cle: string, defaut: T): T {
  const brut = lire(cle);
  if (brut === null) return defaut;
  try {
    return JSON.parse(brut) as T;
  } catch {
    return defaut;
  }
}

export function ecrireJson(cle: string, valeur: unknown): boolean {
  try {
    return ecrire(cle, JSON.stringify(valeur));
  } catch {
    // Une structure circulaire ne se sérialise pas : ce n'est pas au stockage
    // de le faire savoir en levant chez l'appelant.
    return false;
  }
}
