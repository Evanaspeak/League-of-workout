import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { effortPaye } from "@/lib/i18n/dictionaries/effortPaye";

/**
 * L'effort PAYÉ porte un seul nom, dans chaque langue.
 *
 * C'est la même grandeur sur trois écrans — la colonne du classement entre
 * amis, la carte du bilan de saison, le profil public — et elle y était nommée
 * trois fois à la main. Le français, l'anglais et l'espagnol coïncidaient,
 * parce qu'ils avaient été recopiés ; l'allemand, le chinois et le japonais
 * avaient dérivé, c'est-à-dire les trois qu'on ne relit pas.
 *
 * Le chinois annonçait « 已完成训练 » — des entraînements accomplis — au-dessus
 * d'une QUANTITÉ d'effort (« 480 俯卧撑 »), et le japonais « こなした運動 ».
 * Un compte de séances par-dessus une quantité : c'est le défaut déjà corrigé
 * sur « Victoires » qui coiffait un pourcentage.
 *
 * Trouvé en LISANT l'écran en chinois puis en français, pas en relisant le
 * code : les trois libellés sont justes pris un par un, et rien ne les compare.
 */

const SRC = join(process.cwd(), "src");
const I18N = join(SRC, "lib", "i18n");
const PORTE_LA_REGLE = "effortPaye.ts";

const LIBELLES = Object.values(effortPaye).map((b) => b.nom);

function fichiers(racine: string, suffixes: string[]): string[] {
  const sortie: string[] = [];
  const parcourir = (dossier: string) => {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (suffixes.some((s) => e.name.endsWith(s))) sortie.push(chemin);
    }
  };
  parcourir(racine);
  return sortie;
}

/**
 * Le bloc FRANÇAIS d'un dictionnaire, et lui seul.
 *
 * Même raisonnement que pour les initiales de résultat : une clé posée dans
 * une autre langue sans l'être en français est une clé absente du bloc de
 * référence, et `dictionaries.test.ts` la refuse déjà. Lire les six blocs
 * ferait six fois le même travail pour la même trouvaille.
 *
 * Et ça suffit ici, parce que le défaut RÉEL portait bien en français : les
 * trois clés valaient « Effort payé » dans le bloc `fr`. C'est en chinois
 * qu'on l'a VU, c'est en français qu'on peut le compter.
 */
export function blocFrancais(source: string): string {
  const debut = source.indexOf("fr: {");
  if (debut < 0) return "";
  const fin = source.indexOf("\n  en: {", debut);
  return fin < 0 ? source.slice(debut) : source.slice(debut, fin);
}

describe("l'effort payé ne se nomme qu'à un endroit", () => {
  const dictionnaires = fichiers(I18N, [".ts"]).filter((f) => !f.endsWith(".test.ts"));

  it("aucun autre dictionnaire ne redéclare le libellé français", () => {
    let examines = 0;
    const fautifs: string[] = [];
    for (const f of dictionnaires) {
      if (f.endsWith(PORTE_LA_REGLE)) continue;
      const source = readFileSync(f, "utf8");
      const bloc = blocFrancais(source);
      if (!bloc) continue;
      examines += 1;
      for (const ligne of bloc.split("\n")) {
        const m = ligne.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*:\s*"([^"]*)"\s*,?\s*$/);
        if (m && m[2] === effortPaye.fr.nom) {
          fautifs.push(`${relative(SRC, f)} → ${m[1]}`);
        }
      }
    }
    // Témoin : un dossier renommé rendrait la liste vide sans rien avoir lu.
    expect(examines).toBeGreaterThanOrEqual(20);
    expect(fautifs).toEqual([]);
  });

  it("aucun écran n'écrit un de ces libellés à la main", () => {
    const ecrans = fichiers(join(SRC, "app"), [".tsx"])
      .concat(fichiers(join(SRC, "components"), [".tsx"]));
    expect(ecrans.length).toBeGreaterThanOrEqual(40);
    const fautifs: string[] = [];
    for (const f of ecrans) {
      const source = readFileSync(f, "utf8");
      for (const libelle of LIBELLES) {
        if (source.includes(libelle)) fautifs.push(`${relative(SRC, f)} → ${libelle}`);
      }
    }
    /**
     * Ce contrôle-ci vaut surtout pour le CHINOIS et le JAPONAIS : leurs
     * libellés ne portent aucun accent, donc `texteEnDurComposants.test.ts`
     * ne peut pas les voir — c'est son angle mort par construction, et c'est
     * exactement là que la divergence avait eu lieu.
     */
    expect(fautifs).toEqual([]);
  });

  it("les trois écrans lisent bien le dictionnaire partagé", () => {
    const lecteurs = fichiers(join(SRC, "app"), [".tsx"])
      .filter((f) => readFileSync(f, "utf8").includes("dictionaries/effortPaye"));
    /**
     * Le compte, pas les chemins : un garde épinglé sur un chemin devient muet
     * le jour où le fichier déménage, c'est-à-dire le jour où il servirait.
     */
    expect(lecteurs.length).toBeGreaterThanOrEqual(3);
    // Et l'import ne suffit pas : il faut l'APPELER. Un import reconnaît une
    // intention, pas un comportement.
    for (const f of lecteurs) {
      const source = readFileSync(f, "utf8");
      expect(source).toMatch(/(useT|textes)\(\s*dictEffort/);
    }
  });

  it("les six langues portent un libellé, et il n'est pas le même partout", () => {
    expect(LIBELLES).toHaveLength(6);
    for (const nom of LIBELLES) expect(nom.trim().length).toBeGreaterThan(0);
    // Sans ça, un dictionnaire recopié six fois depuis le français passerait :
    // c'est le défaut que la coquille Electron avait déjà payé.
    expect(new Set(LIBELLES).size).toBeGreaterThanOrEqual(5);
  });
});

describe("le découpage du bloc français", () => {
  // Éprouvé sur des cas fabriqués : les fichiers réels ne contiennent, par
  // construction, que des cas qu'il accepte, donc ils ne distinguent pas un
  // découpage juste d'un découpage cassé.
  it("s'arrête avant l'anglais", () => {
    const faux = `export const d = {\n  fr: {\n    a: "Effort payé",\n  },\n  en: {\n    a: "Effort paid",\n  },\n};`;
    const bloc = blocFrancais(faux);
    expect(bloc).toContain("Effort payé");
    expect(bloc).not.toContain("Effort paid");
  });

  it("rend une chaîne vide quand il n'y a pas de bloc français", () => {
    expect(blocFrancais("export const x = 1;")).toBe("");
  });
});
