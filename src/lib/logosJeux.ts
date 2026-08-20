import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Les logos de jeux réellement présents dans le dépôt.
 *
 * La bande d'accueil tentait d'afficher `/images/jeux/<code>.svg` et se
 * rabattait sur son glyphe si l'image échouait. Ça ne marche pas : la balise
 * vient du rendu serveur, le navigateur demande l'image immédiatement, et
 * l'erreur survient avant que React n'ait attaché quoi que ce soit. On ne
 * voyait donc que des images cassées.
 *
 * La question se tranche là où elle a une réponse sûre : sur le disque, au
 * moment du rendu serveur. Aucun aller-retour, aucun scintillement, et le jour
 * où un fichier est déposé il apparaît sans toucher au code.
 */
export function logosDisponibles(): string[] {
  try {
    return readdirSync(join(process.cwd(), "public", "images", "jeux"))
      .filter((f) => f.endsWith(".svg"))
      .map((f) => f.slice(0, -4));
  } catch {
    // Dossier absent : la bande garde ses glyphes, ce qui est le cas nominal.
    return [];
  }
}
