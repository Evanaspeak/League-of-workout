/**
 * Le corps d'une requête, ou `null` quand il n'est pas lisible.
 *
 * `request.json()` LÈVE sur un corps tronqué ou vide — un octet perdu sur un
 * réseau mobile, un mandataire qui coupe, un client qui envoie du vide. Sans
 * rattrapage, la route rend « Erreur serveur » en 500 : elle accuse le serveur
 * d'une panne qui n'existe pas, et envoie chercher au mauvais endroit.
 *
 * C'est la règle déjà écrite dans ce projet — ce qui manque de notre côté est
 * un 500, ce qu'on nous a mal donné est un 400 qui le dit — et elle était
 * appliquée à onze routes sur dix-neuf. Les deux plus mal placées étaient
 * `beta-access` et `auth/register`, c'est-à-dire les seules que quelqu'un sans
 * compte touche : on lui disait que le site est cassé au moment précis où l'on
 * cherche à le faire entrer.
 *
 * Un corps qui n'est pas un OBJET est refusé de la même façon. Toutes les
 * routes de ce projet lisent des champs nommés : sur `null` la lecture lève,
 * sur un nombre ou un tableau elle rend `undefined` et le refus tombe plus
 * loin, sous un message qui parle d'autre chose.
 */
/**
 * Ce que chaque condition tient, mesuré par sabotage plutôt que supposé.
 *
 * - `Array.isArray` seul attrape le tableau, dont le `typeof` vaut aussi
 *   « object ».
 * - `typeof brut !== "object"` seul attrape le nombre, la chaîne et le
 *   booléen — et c'est celle qui coûtait : sans elle, la porte d'entrée du
 *   produit répondait « Pseudo manquant » sur un corps qui est un nombre,
 *   c'est-à-dire qu'elle accusait la saisie de quelqu'un. Une chaîne est le
 *   pire cas du lot, parce qu'elle PORTE des propriétés : `"abc".length` vaut
 *   trois, donc une route qui lit un champ homonyme en tirerait un chiffre
 *   venu de nulle part au lieu d'un refus.
 * - `brut === null` **ne se distingue ni par un test ni par le compilateur.**
 *   Retirée, `null` ne passe plus par le refus mais par le chemin de succès,
 *   qui rend `brut` — donc `null`. L'appelant reçoit la même valeur, et `tsc`
 *   se tait sur le `as T`. Elle reste parce qu'elle DIT que `null` est refusé,
 *   là où le chemin de succès l'affirmerait « objet » ; c'est écrit ici plutôt
 *   que laissé croire qu'un test la tient.
 */
export async function lireCorps<T = Record<string, unknown>>(
  requete: Request,
): Promise<T | null> {
  try {
    const brut: unknown = await requete.json();
    if (brut === null || typeof brut !== "object" || Array.isArray(brut)) return null;
    return brut as T;
  } catch {
    return null;
  }
}

/**
 * Le corps tel que les routes les plus anciennes le lisaient : des champs
 * nommés, validés un par un plus bas.
 *
 * `req.json()` rendait `any`, donc ces routes lisaient `body.userPrefs.langue`
 * sans rien déclarer. Le défaut de `lireCorps` est strict — une route neuve
 * reçoit `unknown` et doit dire ce qu'elle attend — et ce type-ci existe pour
 * les deux qui valident déjà chaque champ à la main, sans les réécrire.
 * L'employer ailleurs revient à renoncer au compilateur.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CorpsLibre = Record<string, any>;
