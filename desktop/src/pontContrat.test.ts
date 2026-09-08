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

/**
 * Ce que le pont TRANSPORTE, et non plus ce qu'il expose.
 *
 * Les noms de méthodes sont la moitié du contrat ; l'autre est le contenu de
 * ce qui passe. La détection de jeu en est le cas le plus exposé, et sa chaîne
 * traverse quatre fichiers :
 *
 *   `jeuxProcessus.js` émet { type: "jeu-demarre" | "jeu-arrete", jeu }
 *   → `main.js` le transmet tel quel sur le canal `jeu:detecte`
 *   → `preload.js` le rend à la page
 *   → le SITE compare `type` à ces deux chaînes.
 *
 * **La moitié site est déjà tenue**, et par le compilateur : `electron.d.ts`
 * déclare l'union des deux littéraux, donc une comparaison à un troisième
 * n'aurait aucun recouvrement et `tsc` le nomme. **La moitié coquille l'est
 * aussi**, par `jeuxProcessus.test.ts`, qui épingle les deux noms émis.
 *
 * Ce que rien ne tenait, c'est le lien ENTRE les deux épingles. Le renommage
 * réel se fait dans cet ordre : on renomme dans `jeuxProcessus.js`, son test
 * tombe, on met le test à jour — et personne ne pense au fichier de
 * déclaration, qui vit dans l'autre paquet. Le site continue alors de
 * comparer à une chaîne que la coquille n'envoie plus.
 *
 * Le symptôme est TOTAL et MUET, comme celui des méthodes absentes : la
 * détection automatique de partie cesse entièrement. Pas de session, pas
 * d'enregistrement, pas d'erreur. Et là encore la seule machine capable de le
 * voir est celle de quelqu'un d'autre — les parcours posent un faux pont, où
 * c'est le TEST qui choisit les chaînes.
 */
const detection = sansCommentaires("desktop/src/jeuxProcessus.js");
/** Les types que la coquille émet vraiment, lus à la source. */
const emis = [...detection.matchAll(/signaler\(\{\s*type:\s*"([^"]+)"/g)].map((m) => m[1]);
/** Ceux que le site déclare attendre, lus dans l'union de `electron.d.ts`. */
const attendus = (/type:\s*((?:"[^"]+"\s*\|\s*)*"[^"]+")\s*;\s*jeu:/.exec(dts)?.[1] ?? "")
  .split("|")
  .map((s) => s.trim().replace(/^"|"$/g, ""))
  .filter(Boolean);

describe("les types de la détection de jeu", () => {
  it("se lisent vraiment des deux côtés", () => {
    // Le témoin, et il porte tout le reste : deux listes vides s'accordent
    // parfaitement, donc un motif devenu aveugle passerait au vert en n'ayant
    // rien comparé.
    expect(new Set(emis).size).toBeGreaterThanOrEqual(2);
    expect(attendus.length).toBeGreaterThanOrEqual(2);
  });

  it("sont exactement ceux que le site déclare", () => {
    // Les deux sens comptent. Un type émis que le site ne connaît pas est une
    // détection qui n'arrive nulle part ; un type déclaré que la coquille
    // n'envoie plus est une branche morte dans la page, qui attend un
    // événement qui ne viendra jamais.
    expect([...new Set(emis)].sort()).toEqual([...attendus].sort());
  });

  it("traversent la coquille sans être réécrits", () => {
    /**
     * Le maillon du milieu. `main.js` transmet `{ type, jeu, session }` en
     * relayant la variable : s'il composait le type lui-même, les deux
     * épingles pourraient s'accorder pendant que la page reçoit autre chose.
     * C'est le trou que ce projet paie en boucle — deux moitiés justes et un
     * branchement qui ne l'est pas.
     */
    const relais = sansCommentaires("desktop/src/main.js");
    expect(relais).toMatch(/webContents\.send\("jeu:detecte",\s*\{\s*type\s*,/);
  });
});
