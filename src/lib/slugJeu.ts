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

/** Combien d'autres jeux une page en propose. */
export const VOISINS_PROPOSES = 8;

/**
 * Les jeux proposés au bas d'une page de calculateur.
 *
 * Elle en prenait les huit PREMIERS du catalogue, donc les huit MÊMES sur les
 * seize pages. Mesuré : huit jeux recevaient quinze liens entrants, un en
 * recevait huit, et **sept n'en recevaient aucun** — Rocket League, Teamfight
 * Tactics, Minecraft, World of Warcraft, GTA V, Elden Ring et Les Sims
 * n'étaient atteignables que depuis l'index.
 *
 * Ce n'est pas une coquetterie de référencement : ces pages n'existent que
 * pour être trouvées, c'est le seul canal d'acquisition qui travaille sans
 * qu'on s'en occupe, et un moteur suit les liens. Une page vers laquelle rien
 * ne pointe est une page qu'on a écrite pour rien.
 *
 * La fenêtre est CIRCULAIRE et part du jeu lui-même : chaque jeu paraît alors
 * dans exactement huit fenêtres, et le graphe devient un anneau au lieu d'une
 * étoile. Deux propriétés que `src/lib/slugJeu.test.ts` vérifie, parce qu'un
 * catalogue qui grandit peut les défaire sans que rien ne le dise.
 */
export function voisinsDe(slug: string): { slug: string; nom: string }[] {
  const tous = tousLesSlugs();
  const i = tous.findIndex((j) => j.slug === slug);
  // Un jeu qu'on ne trouve pas ne doit pas rendre une liste vide : la page
  // existe quand même, et huit voisins valent mieux qu'aucun.
  const depart = i < 0 ? 0 : i + 1;
  const combien = Math.min(VOISINS_PROPOSES, tous.length - (i < 0 ? 0 : 1));
  return Array.from({ length: combien }, (_, k) => tous[(depart + k) % tous.length]);
}
