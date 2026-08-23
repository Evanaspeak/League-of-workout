import { JEUX } from "@/lib/jeux";

/**
 * L'adresse d'un jeu dans les pages publiques du calculateur.
 *
 * Le nom du jeu ne peut pas servir tel quel : « Call of Duty: Warzone » porte
 * deux points et des espaces, et une adresse qui les encode est illisible dans
 * un résultat de recherche — or ces pages n'existent que pour être trouvées.
 */
export function slugDeJeu(nom: string): string {
  return nom
    .normalize("NFD")
    // Les signes diacritiques partent : `é` devient `e`, sans quoi l'adresse
    // s'encode en %C3%A9 dans la barre du navigateur.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Le jeu correspondant à une adresse, ou `null` si elle ne désigne rien. */
export function jeuDepuisSlug(slug: string): string | null {
  const cible = String(slug ?? "").toLowerCase();
  return JEUX.find((j) => slugDeJeu(j.nom) === cible)?.nom ?? null;
}

/** Tous les couples adresse / nom, pour engendrer les pages et le plan du site. */
export function tousLesSlugs(): { slug: string; nom: string }[] {
  return JEUX.map((j) => ({ slug: slugDeJeu(j.nom), nom: j.nom }));
}
