import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { sansCommentaires } from "./test/sansCommentaires";

const SRC = join(__dirname);

/**
 * Tout tableau porte un nom, y compris ceux qu'aucun audit ne peut ouvrir.
 *
 * Un `<table>` sans `aria-label`, sans `aria-labelledby` et sans `<caption>`
 * s'annonce « tableau, trois colonnes » et rien d'autre. Le titre du panneau
 * est presque toujours juste au-dessus, mais rien ne le RELIE au tableau : un
 * lecteur d'écran qui saute de tableau en tableau — ce qu'il fait — ne le voit
 * jamais.
 *
 * **Pourquoi un test STATIQUE alors qu'un audit existe.** L'audit
 * (`scripts/accessibilite.mjs`) attrape ce défaut, et c'est lui qui l'a
 * trouvé sur le classement de l'écran des amis. Mais il ne voit qu'une page
 * OUVERTE, avec le compte qu'on lui donne : les deux tableaux de la rubrique
 * avancée des réglages ne se rendent que pour un administrateur, et les deux
 * du panneau `/admin` vivent sur un écran qui résiste à l'emprunt d'adresse —
 * limite déjà écrite au journal. Ces quatre-là étaient sans nom, et aucune
 * campagne n'aurait pu le dire.
 *
 * C'est le raisonnement de `modalesAnnoncees.test.ts`, mot pour mot : le test
 * statique voit aussi ce qui n'est pas ouvert au moment où l'on regarde.
 */

function fichiers(dossier: string, out: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "generated") continue;
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) fichiers(chemin, out);
    else if (/\.tsx$/.test(e.name) && !/\.test\.tsx$/.test(e.name)) out.push(chemin);
  }
  return out;
}

/** Les tableaux du produit, et ce qui les nomme. */
function tableaux(): { ou: string; nomme: boolean }[] {
  const out: { ou: string; nomme: boolean }[] = [];
  for (const f of fichiers(SRC)) {
    // Privé de ses commentaires : un bloc d'explication posé entre la balise
    // et sa légende repoussait celle-ci hors de la fenêtre de lecture, et le
    // garde accusait un tableau parfaitement nommé. C'est le piège que
    // `sansCommentaires` existe pour fermer, dans son troisième sens.
    const s = sansCommentaires(readFileSync(f, "utf8"));
    for (const m of s.matchAll(/<table\b/g)) {
      // La balise ouvrante peut tenir sur plusieurs lignes : on va jusqu'à son
      // « > », en suivant la profondeur des accolades — un style en ligne en
      // contient, et s'arrêter au premier « > » couperait au milieu.
      let i = m.index + 6;
      let profondeur = 0;
      while (i < s.length) {
        const c = s[i];
        if (c === "{") profondeur += 1;
        else if (c === "}") profondeur -= 1;
        else if (c === ">" && profondeur === 0) break;
        i += 1;
      }
      const ouvrante = s.slice(m.index, i);
      const corps = s.slice(i, i + 400);
      const nomme =
        /aria-label(ledby)?\s*=/.test(ouvrante) || /<caption\b/.test(corps);
      const ligne = s.slice(0, m.index).split("\n").length;
      out.push({ ou: `${relative(SRC, f)}:${ligne}`, nomme });
    }
  }
  return out;
}

describe("les tableaux du produit", () => {
  it("se recensent vraiment", () => {
    // Sans ce témoin, un motif devenu aveugle rendrait une liste vide de
    // fautifs, c'est-à-dire un contrôle vert qui n'a rien regardé.
    expect(tableaux().length).toBeGreaterThanOrEqual(6);
  });

  it("portent tous un nom accessible", () => {
    expect(tableaux().filter((t) => !t.nomme).map((t) => t.ou)).toEqual([]);
  });
});
