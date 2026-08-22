/**
 * Ce qu'un compte peut montrer au navigateur.
 *
 * `getCurrentUser` n'extrait déjà plus l'empreinte du mot de passe de la base :
 * c'est là que vit la garantie, et un test la tient. Mais deux routes rendent
 * le compte par diffusion — `{ ...user }` — donc elles publient tout ce qu'on
 * leur remet, quelle qu'en soit la provenance. Cette fonction est le seul
 * endroit qui décide de ce qui part, pour que le jour où le compte arrivera
 * d'ailleurs, la réponse ne change pas de nature sans qu'on l'ait voulu.
 *
 * Elle vit à part d'`auth-helpers` parce que les tests de routes doublent ce
 * module entier : la fonction y serait remplacée par une doublure, et les
 * tests de fuite éprouveraient un filtre qui n'est pas celui qui tourne.
 */
export function comptePublic<T extends object>(user: T): Omit<T, "passwordHash"> {
  const copie = { ...(user as T & { passwordHash?: unknown }) };
  delete copie.passwordHash;
  return copie as Omit<T, "passwordHash">;
}
