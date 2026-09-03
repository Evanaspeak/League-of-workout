import { randomBytes } from "node:crypto";
import { LIBELLE_AUTORISE, type Verdict } from "@/lib/identite";

/**
 * Les règles du social, sorties des routes.
 *
 * Ce qu'elles décident se paie chez quelqu'un d'autre : une amitié posée du
 * mauvais côté, un code de groupe devinable, deux demandes croisées qu'aucun
 * des deux ne peut résoudre. Ça ne s'éprouve pas depuis une route — il faut
 * pouvoir écrire le cas.
 *
 * **La forme entière vient de la réponse 127**, « es-tu prêt à modérer un
 * espace social ? → Non ». Donc : aucun annuaire, aucune recherche, aucun
 * texte libre échangé. On ajoute un pseudo qu'on connaît déjà et l'autre
 * accepte ; on entre dans un groupe avec un code qu'on a reçu. Le seul texte
 * qui circule est un pseudo et un nom de groupe, tous deux passés par la
 * classe de caractères d'`identite.ts`. Il n'y a rien à modérer parce qu'il
 * n'y a rien à écrire.
 */

/** État d'une amitié en base. */
export type EtatAmitie = "attente" | "acceptee";

/**
 * Ce qu'une demande d'amitié doit produire, sachant ce qui existe déjà.
 *
 * Le cas qui compte est `accepter` : **si l'autre m'a déjà demandé, le fait
 * que je le demande à mon tour est une acceptation.** Créer une seconde ligne
 * laisserait deux demandes croisées, chacun voyant « en attente de sa
 * réponse » — c'est-à-dire une amitié que personne ne peut conclure, et qui ne
 * ressemble pas à un défaut : les deux écrans disent quelque chose de sensé.
 */
export type Decision =
  | { quoi: "soi-meme" }
  | { quoi: "deja-amis" }
  | { quoi: "deja-demande" }
  | { quoi: "accepter"; id: string }
  | { quoi: "creer" };

/**
 * Nombre de demandes envoyées et sans réponse qu'on peut avoir en même temps.
 *
 * C'est ce qui remplace la modération : personne ne relit ce qui se passe ici,
 * donc la seule protection contre quelqu'un qui demanderait tout le monde est
 * de rendre la chose impossible. Vingt est très au-dessus de ce qu'un usage
 * normal demande, et très en dessous de ce qu'il faudrait pour gêner.
 *
 * Ce que ça ne protège pas, et il faut le dire : quelqu'un qui redemande à la
 * même personne après chaque refus. Un refus supprime la ligne — voir le
 * schéma — donc rien ne s'en souvient. Le jour où ça se produira il faudra un
 * blocage, ce qui est un autre chantier.
 */
export const MAX_DEMANDES_EN_ATTENTE = 20;

/** Au-delà, le classement entre amis n'est plus un classement, c'est une liste. */
export const MAX_AMIS = 100;

/** Membres par groupe. Même raison, et ça borne la requête du classement. */
export const MAX_MEMBRES = 50;

/** Groupes par compte. Au-delà, la liste de l'écran cesse d'être une liste. */
export const MAX_GROUPES = 10;

/**
 * Que faire d'une demande de `moiId` vers `cibleId`.
 *
 * `existantes` porte les lignes qui concernent DÉJÀ ce couple, dans les deux
 * sens. Les chercher dans un seul sens est la faute : l'unicité en base porte
 * sur un couple orienté, elle n'empêche donc pas le doublon inverse.
 */
export function decisionDemande(
  moiId: string,
  cibleId: string,
  existantes: { id: string; demandeurId: string; receveurId: string; etat: string }[],
): Decision {
  if (moiId === cibleId) return { quoi: "soi-meme" };

  const duCouple = existantes.filter(
    (a) =>
      (a.demandeurId === moiId && a.receveurId === cibleId) ||
      (a.demandeurId === cibleId && a.receveurId === moiId),
  );

  if (duCouple.some((a) => a.etat === "acceptee")) return { quoi: "deja-amis" };

  const mienne = duCouple.find((a) => a.demandeurId === moiId);
  if (mienne) return { quoi: "deja-demande" };

  const sienne = duCouple.find((a) => a.demandeurId === cibleId);
  if (sienne) return { quoi: "accepter", id: sienne.id };

  return { quoi: "creer" };
}

/**
 * L'alphabet du code d'invitation.
 *
 * Sans les caractères qui se confondent à la lecture : ni O ni 0, ni I ni 1 ni
 * L. Un code se dicte en vocal avant de se taper, et un code qu'on retape faux
 * n'ouvre rien — or c'est la seule porte du groupe.
 */
const ALPHABET_CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const LONGUEUR_CODE = 8;

/**
 * Un code d'invitation.
 *
 * `randomBytes` et non `Math.random` : un code devinable fait entrer un
 * inconnu dans un groupe, ce qui est exactement ce que la réponse 127 interdit
 * de laisser arriver. Trente et un caractères à la puissance huit, soit de
 * l'ordre de mille milliards de combinaisons.
 *
 * **Le tirage jette les octets hors d'un multiple de la taille de
 * l'alphabet**, au lieu de prendre un modulo. Deux cent cinquante-six n'est
 * pas divisible par trente et un : un modulo direct rendrait les huit
 * premières lettres neuf fois sur deux cent cinquante-six contre huit pour les
 * autres, soit un excès de douze pour cent. Ça ne se voit pas à l'œil, et ça
 * réduit l'espace réel des codes.
 *
 * La source d'octets s'injecte, parce que c'est la seule façon d'éprouver ce
 * rejet : sur des tirages aléatoires, un alphabet biaisé de douze pour cent se
 * confond avec le bruit, et un test qui « vérifie » ça passerait des deux
 * côtés. Avec les deux cent cinquante-six valeurs posées une fois chacune, la
 * distribution attendue est exacte.
 */
export function nouveauCode(octets: (n: number) => Uint8Array = randomBytes): string {
  const seuil = Math.floor(256 / ALPHABET_CODE.length) * ALPHABET_CODE.length;
  let code = "";
  while (code.length < LONGUEUR_CODE) {
    for (const octet of octets(LONGUEUR_CODE * 2)) {
      if (octet >= seuil) continue;
      code += ALPHABET_CODE[octet % ALPHABET_CODE.length];
      if (code.length === LONGUEUR_CODE) break;
    }
  }
  return code;
}

/** L'alphabet, pour que le test puisse compter ce que le tirage en fait. */
export const ALPHABET_POUR_TEST = ALPHABET_CODE;

/**
 * La forme canonique d'un code tapé à la main.
 *
 * On accepte ce que quelqu'un tape réellement : des minuscules, des espaces,
 * un tiret au milieu parce qu'il l'a lu ainsi. Refuser ces trois choses, c'est
 * refuser la seule porte du groupe pour une question de présentation. Rend
 * `null` si ce n'est pas un code.
 */
export function normaliserCode(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const code = brut.toUpperCase().replace(/[\s-]/g, "");
  if (code.length !== LONGUEUR_CODE) return null;
  if (![...code].every((c) => ALPHABET_CODE.includes(c))) return null;
  return code;
}

export const NOM_GROUPE_MIN = 2;
export const NOM_GROUPE_MAX = 30;

/** Un nom de groupe suit la règle des pseudos : c'est du texte que d'autres liront. */
export function validerNomGroupe(brut: unknown): Verdict {
  if (typeof brut !== "string") {
    return { ok: false, erreur: "Nom de groupe manquant", statut: 400 };
  }
  const nom = brut.trim();
  if (nom.length < NOM_GROUPE_MIN) {
    return { ok: false, erreur: `Nom de groupe trop court (min ${NOM_GROUPE_MIN} caractères)`, statut: 400 };
  }
  if (nom.length > NOM_GROUPE_MAX) {
    return { ok: false, erreur: `Nom de groupe trop long (max ${NOM_GROUPE_MAX} caractères)`, statut: 400 };
  }
  if (!LIBELLE_AUTORISE.test(nom)) {
    return { ok: false, erreur: "Nom de groupe invalide (lettres, chiffres, espaces uniquement)", statut: 400 };
  }
  return { ok: true, valeur: nom };
}

/**
 * Qui hérite du groupe quand le propriétaire s'en va.
 *
 * Un groupe sans propriétaire ne peut plus refaire son code, c'est-à-dire plus
 * révoquer un lien déjà partagé : il devient une porte qu'on ne peut plus
 * fermer. Le plus ancien membre restant hérite — c'est arbitraire, et c'est
 * mieux que personne. Rend `null` quand il ne reste personne : le groupe part
 * alors avec son dernier membre.
 */
export function successeur(
  membres: { id: string; userId: string; role: string; createdAt: Date }[],
  partantId: string,
): { id: string } | null {
  const restants = membres
    .filter((m) => m.userId !== partantId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return restants[0] ? { id: restants[0].id } : null;
}
