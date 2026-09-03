/**
 * Ce qui fait qu'une identité est la même identité.
 *
 * Trois routes créent ou modifient un compte — l'inscription par mot de passe,
 * l'accès bêta, la mise à jour du profil — et chacune validait à sa façon.
 * L'inscription était la seule à écrire l'adresse telle quelle : l'index unique
 * de Postgres compare octet par octet, donc « Evan@x.com » et « evan@x.com » y
 * cohabitaient, alors que le reste du code les tenait pour la même personne.
 * De là venait l'escalade d'administrateur : le test d'admin passe l'adresse en
 * minuscules, l'unicité non.
 *
 * Une seule définition ici, importée partout. Un quatrième chemin d'écriture
 * ajouté plus tard tombera dessus avant d'inventer sa propre règle.
 */

/**
 * Forme canonique d'une adresse : c'est celle-ci qu'on stocke et qu'on compare,
 * jamais celle que l'utilisateur a tapée. Rend `null` si ce n'en est pas une.
 */
export function normaliserEmail(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const email = brut.trim().toLowerCase();
  // Volontairement minimal : une adresse vraiment invalide se révèle à l'envoi,
  // et un contrôle trop zélé rejette des adresses parfaitement légitimes.
  if (email.length < 5 || email.length > 254) return null;
  const arobase = email.indexOf("@");
  if (arobase < 1 || arobase !== email.lastIndexOf("@")) return null;
  if (arobase === email.length - 1) return null;
  if (/\s/.test(email)) return null;
  return email;
}

/**
 * Lettres, chiffres, espace et quelques signes. Pas de balises, pas de retours.
 *
 * Exporté parce qu'un nom de groupe suit exactement la même règle : c'est du
 * texte écrit par quelqu'un et lu par d'autres, et il n'y a personne pour
 * modérer ce qui s'y écrirait. Recopier la classe de caractères en ferait une
 * seconde, qui divergerait au premier signe ajouté.
 */
export const LIBELLE_AUTORISE = /^[\p{L}\p{N} _.\-]+$/u;
export const PSEUDO_MIN = 2;
export const PSEUDO_MAX = 24;

export type Verdict =
  | { ok: true; valeur: string }
  | { ok: false; erreur: string; statut: number };

/**
 * Valide un pseudo. Les bornes viennent de la route d'accès bêta, qui était la
 * seule à les appliquer ; l'inscription ne vérifiait que la longueur minimale et
 * la mise à jour du profil ne vérifiait rien du tout.
 */
export function validerPseudo(brut: unknown): Verdict {
  if (typeof brut !== "string") {
    return { ok: false, erreur: "Pseudo manquant", statut: 400 };
  }
  const pseudo = brut.trim();
  if (pseudo.length < PSEUDO_MIN) {
    return { ok: false, erreur: `Pseudo trop court (min ${PSEUDO_MIN} caractères)`, statut: 400 };
  }
  if (pseudo.length > PSEUDO_MAX) {
    return { ok: false, erreur: `Pseudo trop long (max ${PSEUDO_MAX} caractères)`, statut: 400 };
  }
  if (!LIBELLE_AUTORISE.test(pseudo)) {
    return { ok: false, erreur: "Pseudo invalide (lettres, chiffres, espaces uniquement)", statut: 400 };
  }
  return { ok: true, valeur: pseudo };
}

/**
 * Vrai si ce pseudo est déjà porté par quelqu'un d'autre.
 *
 * L'unicité vit dans l'application et pas en base : des doublons existent déjà,
 * et un index unique refuserait de se construire dessus. `sauf` permet à un
 * compte de réenregistrer son propre pseudo sans se heurter à lui-même.
 */
export async function pseudoDejaPris(pseudo: string, sauf?: string): Promise<boolean> {
  // Import différé : les règles ci-dessus doivent rester testables sans base,
  // et charger le client Prisma au montage du module l'en empêcherait.
  const { prisma } = await import("@/lib/prisma");
  const autre = await prisma.user.findFirst({
    where: {
      pseudo: { equals: pseudo, mode: "insensitive" },
      ...(sauf ? { NOT: { id: sauf } } : {}),
    },
    select: { id: true },
  });
  return autre !== null;
}
