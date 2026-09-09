import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sansCommentaires } from "./test/sansCommentaires";

/**
 * Un `<label>` désigne un champ, ou il ne désigne rien.
 *
 * Un intitulé posé DEVANT une commande ne l'étiquette pas : il faut un
 * `htmlFor` qui nomme son `id`, ou que le label ENTOURE la commande. Sans
 * ça, un lecteur d'écran annonce « zone de liste » et s'arrête là — le
 * texte à côté n'existe pas pour lui.
 *
 * Ce défaut est arrivé DEUX fois, et la seconde sur la seule porte d'entrée
 * du produit :
 *
 * - le panneau « Ton corps » des réglages, trouvé par un parcours navigateur
 *   et non par une relecture ;
 * - le formulaire de `/beta`, mesuré le 9 septembre : **huit champs, zéro nom
 *   accessible**, dont deux `<select>` sans même un `placeholder` sur quoi se
 *   rabattre. Les six du bloc facultatif échappaient en plus à l'audit, qui
 *   ne déplie rien — c'est l'angle mort déjà payé sur les rubriques des
 *   réglages.
 *
 * Ce que ce contrôle ne fait PAS : il ne juge pas la QUALITÉ du nom. Un
 * `htmlFor` qui pointe vers un `id` inexistant lui échapperait — c'est
 * l'audit navigateur qui l'attrape, en calculant le nom réellement rendu.
 * Ici on tient la forme, qui est ce qui a lâché.
 */

const SRC = join(__dirname);

function fichiers(dossier: string, sortie: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) {
      if (e.name === "generated" || e.name === "node_modules") continue;
      fichiers(chemin, sortie);
    } else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

/**
 * Les `<label>` d'un fichier, avec ce qui suit chacun jusqu'à sa fermeture et
 * un peu au-delà — assez pour voir si la commande est DEDANS ou après.
 */
function labels(source: string): { ouverture: string; corps: string }[] {
  const out: { ouverture: string; corps: string }[] = [];
  const motif = /<label\b([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = motif.exec(source)) !== null) {
    const fin = source.indexOf("</label>", m.index);
    out.push({
      ouverture: m[1],
      corps: fin < 0 ? "" : source.slice(m.index, fin),
    });
  }
  return out;
}

const COMMANDE = /<(input|select|textarea)\b/;

describe("les intitulés de formulaire", () => {
  const tous = fichiers(SRC);

  it("examine assez de fichiers pour que le reste veuille dire quelque chose", () => {
    // Le témoin. Un dossier renommé rendrait tout le reste vert en n'ouvrant
    // aucun fichier, et c'est ainsi que meurt un garde structurel.
    expect(tous.length).toBeGreaterThan(50);
    const avecLabel = tous.filter((f) => labels(sansCommentaires(readFileSync(f, "utf8"))).length > 0);
    expect(avecLabel.length).toBeGreaterThan(5);
  });

  it("désignent tous une commande, par htmlFor ou en l'entourant", () => {
    const fautifs: string[] = [];
    for (const f of tous) {
      const source = sansCommentaires(readFileSync(f, "utf8"));
      for (const { ouverture, corps } of labels(source)) {
        if (/\bhtmlFor=/.test(ouverture)) continue;
        if (COMMANDE.test(corps)) continue;
        const nom = f.slice(SRC.length + 1);
        const extrait = corps.replace(/\s+/g, " ").slice(0, 70);
        fautifs.push(`${nom} — ${extrait}…`);
      }
    }
    expect(fautifs).toEqual([]);
  });
});
