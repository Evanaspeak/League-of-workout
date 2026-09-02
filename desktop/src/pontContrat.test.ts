/**
 * Le pont entre la coquille et le site, des deux côtés à la fois.
 *
 * `preload.js` EXPOSE des méthodes ; `src/types/electron.d.ts` déclare celles
 * sur lesquelles le site compte. Rien ne reliait les deux, et le défaut que ça
 * laisse passer est le pire de sa famille : une méthode ajoutée au type et
 * appelée par une page, oubliée dans le pont, donne
 * « undefined is not a function » — dans l'APPLICATION INSTALLÉE seulement.
 * TypeScript ne dit rien (le type promet qu'elle existe), les parcours
 * navigateur ne disent rien (ils posent un faux pont), et l'appel tombe dans un
 * `catch`. La seule machine capable de le voir est celle de quelqu'un d'autre.
 *
 * C'est la même raison qui fait comparer ici la liste des six langues au
 * fichier du site : la coquille est construite sans le paquet du site, donc
 * les deux moitiés du contrat ne peuvent diverger qu'en silence.
 */
import { readFileSync } from "fs";
import { join } from "path";

const RACINE = join(__dirname, "..", "..");

/** Le contenu d'un bloc d'accolades, à partir d'une position. */
function blocAccolades(txt: string, depuis: number): string {
  const debut = txt.indexOf("{", depuis);
  let profondeur = 0;
  for (let k = debut; k < txt.length; k++) {
    if (txt[k] === "{") profondeur += 1;
    else if (txt[k] === "}") {
      profondeur -= 1;
      if (profondeur === 0) return txt.slice(debut + 1, k);
    }
  }
  throw new Error("bloc non refermé");
}

/**
 * Les membres de PREMIER niveau d'un bloc.
 *
 * La profondeur se suit à la main : sans elle, les champs des objets imbriqués
 * — `score`, `contexte`, `classement` — remontent comme des méthodes du pont,
 * et la comparaison signale dix manques qui n'en sont pas. C'est le premier
 * résultat qu'a rendu ce contrôle, et il était faux.
 */
function membresDePremierNiveau(bloc: string): string[] {
  const noms: string[] = [];
  let profondeur = 0;
  for (const ligne of bloc.split("\n")) {
    const nu = ligne.replace(/\/\/.*$/, "");
    if (profondeur === 0) {
      const m = /^\s*(\w+)\??\s*:/.exec(nu);
      if (m) noms.push(m[1]);
    }
    for (const c of nu) {
      if (c === "{" || c === "(") profondeur += 1;
      else if (c === "}" || c === ")") profondeur -= 1;
    }
  }
  return noms;
}

function sansCommentaires(chemin: string): string {
  return readFileSync(join(RACINE, chemin), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
}

const dts = sansCommentaires("src/types/electron.d.ts");
const declarees = membresDePremierNiveau(blocAccolades(dts, dts.indexOf("electronLOL?:")));

const preload = sansCommentaires("desktop/src/preload.js");
const exposees = membresDePremierNiveau(
  blocAccolades(preload, preload.indexOf("exposeInMainWorld")),
);

describe("le contrat du pont Electron", () => {
  // Sans ce contrôle, un fichier déplacé ou un motif qui ne trouve plus rien
  // rendrait le test vert en comparant deux listes vides.
  it("lit vraiment les deux moitiés", () => {
    expect(declarees.length).toBeGreaterThan(20);
    expect(exposees.length).toBeGreaterThan(20);
  });

  it("expose tout ce que le site déclare attendre", () => {
    expect(declarees.filter((m) => !exposees.includes(m))).toEqual([]);
  });

  /**
   * L'inverse est toléré pour une seule méthode, et elle porte sa raison :
   * `retourConnexion` est appelée par l'écran d'attente de la COQUILLE, une
   * page `data:` qui n'est pas le site. Une seconde exemption devrait faire se
   * demander si le pont ne porte pas du code mort.
   */
  it("n'expose rien d'autre que ce que le site déclare, sauf l'écran d'attente", () => {
    const surplus = exposees.filter((m) => !declarees.includes(m));
    expect(surplus).toEqual(["retourConnexion"]);
    // Et elle sert vraiment : une exemption qui ne désigne plus rien de vivant
    // est du code mort qu'on a fini par admettre.
    expect(readFileSync(join(RACINE, "desktop/src/main.js"), "utf8"))
      .toMatch(/auth:retour-connexion/);
  });
});
