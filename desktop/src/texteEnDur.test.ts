// Le français ne doit plus s'écrire en dur dans la coquille Electron.
//
// Le site a son garde depuis longtemps (`langueEnDur.test.ts`) : aucun
// composant ne compare `locale` à une langue. La coquille, elle, n'en avait
// aucun — et elle écrivait tout en français : trois écrans de connexion, le
// menu près de l'horloge, deux notifications. Ce sont précisément les endroits
// où personne ne le voit, puisqu'ils ne s'ouvrent qu'en cas de pépin.
//
// Les contrôles portent sur la structure, pas sur le vocabulaire : « cette
// phrase est-elle française » ne se décide pas par une expression régulière,
// « ce libellé vient-il du dictionnaire » se décide très bien.

// `export {}` fait de ce fichier un module : sans lui, ses `const` de tête
// vivent dans la portée globale et se heurtent à celles des autres tests.
export {};

const fs = require("node:fs");
const path = require("node:path");

const lire = (nom: string) => fs.readFileSync(path.join(__dirname, nom), "utf8");
const main = lire("main.js");
const tray = lire("tray.js");

/** Une déclaration se lit sans ses commentaires : ils décrivent le défaut. */
function sansCommentaires(source: string): string {
  return source
    .split("\n")
    .filter((l: string) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");
}

describe("la coquille ne parle plus français à tout le monde", () => {
  it("lit bien les fichiers qu'elle prétend contrôler", () => {
    // Sans ce contrôle, un fichier renommé rendrait tout le reste vert.
    expect(main.length).toBeGreaterThan(20_000);
    expect(tray.length).toBeGreaterThan(2_000);
  });

  it("ne fige plus la langue des pages de secours", () => {
    // `<html lang="fr">` était écrit dans les trois : la page se déclarait
    // française quoi qu'il arrive, y compris quand son contenu ne l'était pas.
    expect(main).not.toContain('lang="fr"');
    expect(main.match(/data:text\/html/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it("construit ses trois écrans à partir d'une langue", () => {
    for (const nom of ["WAITING_HTML", "ERREUR_PORT_HTML", "ATTENTE_EXPIREE_HTML"]) {
      expect({ nom, parametre: new RegExp(`const ${nom} = \\(langue\\)`).test(main) })
        .toEqual({ nom, parametre: true });
    }
  });

  it("n'appelle jamais ces écrans sans langue", () => {
    // Un appel sans argument rendrait l'anglais à tout le monde, ce qui est
    // moins visible qu'un français figé, donc pire.
    const nus = sansCommentaires(main)
      .match(/(WAITING_HTML|ERREUR_PORT_HTML|ATTENTE_EXPIREE_HTML)\(\s*\)/g) ?? [];
    expect(nus).toEqual([]);
  });

  it("ne laisse aucun libellé de menu écrit en dur", () => {
    // Le menu près de l'horloge est le seul écran qui subsiste quand la
    // fenêtre est fermée : c'est le dernier endroit où l'on veut du français
    // imposé.
    const libelles = sansCommentaires(tray).match(/label:\s*"[^"]+"/g) ?? [];
    expect(libelles).toEqual([]);
    // Et il y a bien des libellés à contrôler.
    expect((tray.match(/label:/g) ?? []).length).toBeGreaterThan(5);
  });

  it("ne laisse plus aucune phrase accentuée dans les sources de la coquille", () => {
    // Le contrôle le plus grossier, et celui qui a trouvé le plus : les textes
    // de la pastille Apex et les motifs d'échec de capture. Une chaîne
    // accentuée dans du code qui n'a pas de dictionnaire, c'est du français
    // imposé — sauf s'il s'agit d'un nom propre, auquel cas il s'exempte ici
    // avec sa raison.
    const EXEMPTIONS: string[] = [];
    const fichiers = ["main.js", "tray.js", "capture.js", "overlay.js", "lcu.js", "liveclient.js"];
    const fautifs: string[] = [];
    for (const nom of fichiers) {
      for (const ligne of sansCommentaires(lire(nom)).split("\n")) {
        // Les traces de console s'adressent à qui développe, pas à qui joue.
        if (/console\.(log|warn|error)/.test(ligne)) continue;
        for (const m of ligne.matchAll(/"([^"]*[éèêàçûôîïœ][^"]*)"/gi)) {
          if (!EXEMPTIONS.includes(m[1])) fautifs.push(`${nom} : ${m[1]}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("ne laisse aucun texte de notification écrit en dur", () => {
    // « Win or Workout » est le nom du produit : il ne se traduit pas.
    const textes = sansCommentaires(`${main}\n${tray}`)
      .match(/\b(title|body):\s*"[^"]+"/g) ?? [];
    const fautifs = textes.filter((t: string) => !/"Win or Workout"/.test(t));
    expect(fautifs).toEqual([]);
  });
});
