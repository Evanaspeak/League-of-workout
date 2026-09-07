import { JEUX } from "./jeux";

/**
 * Les règles d'une demande de jeu (réponse 180).
 *
 * « Laisser l'utilisateur déclarer un jeu absent, et compter les demandes. Ça
 * décide de la suite. » — donc ce que la mesure doit rendre est un compte de
 * PERSONNES, et tout ici sert à ça.
 *
 * Le texte est libre, ce qui pose la question de la modération. La réponse 127
 * dit non, et la parade est la même que pour le social : ce texte ne sort
 * jamais vers un autre utilisateur — l'administration seule le lit — et un
 * plafond par compte remplace la surveillance.
 */

/** Combien de jeux différents un compte peut demander. */
export const DEMANDES_MAX = 5;

/** Longueur maximale d'un nom de jeu. */
export const NOM_MAX = 60;

/**
 * La forme repliée d'un nom : minuscules, accents retirés, blancs resserrés.
 *
 * C'est elle qui porte l'unicité et le regroupement. Sans elle, « apex »,
 * « Apex » et « Apex  Legends » comptent séparément — donc le compte de
 * personnes est faux, et le même compte peut redemander indéfiniment en
 * changeant une majuscule.
 */
export function replier(nom: string): string {
  return nom
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export type DemandeRefusee = "vide" | "trop long" | "deja au catalogue";

/**
 * Ce qu'on accepte d'écrire, ou pourquoi on refuse.
 *
 * Un jeu DÉJÀ au catalogue est refusé plutôt que compté : la liste sert à
 * décider quoi ajouter, et elle se remplirait de ce qu'on a déjà. Le refus le
 * dit, pour que la personne comprenne qu'elle peut y jouer tout de suite.
 */
export function examinerDemande(brut: unknown):
  { ok: true; nom: string; cle: string } | { ok: false; motif: DemandeRefusee } {
  const nom = typeof brut === "string" ? brut.replace(/\s+/g, " ").trim() : "";
  if (!nom) return { ok: false, motif: "vide" };
  if (nom.length > NOM_MAX) return { ok: false, motif: "trop long" };
  const cle = replier(nom);
  if (JEUX.some((j) => replier(j.nom) === cle)) {
    return { ok: false, motif: "deja au catalogue" };
  }
  return { ok: true, nom, cle };
}

export type DemandeComptee = { nom: string; personnes: number };

/**
 * Le classement des demandes, du plus réclamé au moins réclamé.
 *
 * Le NOM montré est celui qu'on a vu le plus souvent sous cette clé : les gens
 * écrivent « fortnite », « Fortnite » et « FORTNITE », et l'administration doit
 * lire quelque chose plutôt que la forme repliée. À égalité, le premier arrivé
 * tient — un ordre qui change à chaque lecture se lit comme une donnée qui
 * bouge.
 */
export function compterDemandes(
  lignes: { nom: string; cle: string }[],
): DemandeComptee[] {
  const paquets = new Map<string, { noms: Map<string, number>; total: number }>();
  for (const l of lignes) {
    const p = paquets.get(l.cle) ?? { noms: new Map(), total: 0 };
    p.total += 1;
    p.noms.set(l.nom, (p.noms.get(l.nom) ?? 0) + 1);
    paquets.set(l.cle, p);
  }
  return [...paquets.values()]
    .map((p) => ({
      nom: [...p.noms.entries()].sort((a, b) => b[1] - a[1])[0][0],
      personnes: p.total,
    }))
    .sort((a, b) => b.personnes - a.personnes || a.nom.localeCompare(b.nom));
}
