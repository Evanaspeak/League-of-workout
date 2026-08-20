import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Les logos de jeux réellement présents dans le dépôt.
 *
 * La question se tranche là où elle a une réponse sûre : sur le disque, au
 * moment du rendu serveur. Un premier essai s'en remettait à `onError` sur la
 * balise, mais la balise vient du rendu serveur et le navigateur demande
 * l'image avant que React n'ait attaché son gestionnaire : on obtenait des
 * images cassées et aucun repli.
 *
 * Les trois formats sont acceptés : un logo arrive rarement en SVG propre. Le
 * vectoriel passe devant, puis le WebP, puis le PNG — c'est l'ordre de qualité
 * à l'agrandissement.
 */
const EXTENSIONS = [".svg", ".webp", ".png"];

/** Code du jeu → nom de fichier à servir, extension comprise. */
export type LogosJeux = Record<string, string>;

export function logosDisponibles(): LogosJeux {
  let fichiers: string[];
  try {
    fichiers = readdirSync(join(process.cwd(), "public", "images", "jeux"));
  } catch {
    // Dossier absent : la bande garde ses glyphes, ce qui est le cas nominal.
    return {};
  }
  const trouves: LogosJeux = {};
  for (const ext of EXTENSIONS) {
    for (const f of fichiers) {
      if (!f.endsWith(ext)) continue;
      const code = f.slice(0, -ext.length);
      // Le premier format rencontré gagne : l'ordre des extensions est la
      // préférence, un SVG ne doit pas se faire doubler par un PNG homonyme.
      if (!(code in trouves)) trouves[code] = f;
    }
  }
  return trouves;
}
