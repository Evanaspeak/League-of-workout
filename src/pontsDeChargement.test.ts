import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Les deux ponts de chargement tiennent, ou ils ne servent à rien.
 *
 * La mise en page racine montait vingt composants clients sur chaque page.
 * Six ne peuvent rien faire sans l'application Windows, sept commencent par
 * `if (estPagePublique(chemin)) return` : quelqu'un qui ouvrait les CGU depuis
 * un téléphone téléchargeait la modale d'accueil, la visite guidée, la demande
 * de consentement santé, la détection de partie et leurs dictionnaires en six
 * langues, pour ne rien en montrer. Trente kilo-octets sur chacune des dix
 * pages qu'un visiteur voit en premier.
 *
 * `PontConnecte` et `PontDesktop` les chargent à la demande. Le mécanisme
 * repose entièrement sur deux choses que rien ne signale si elles disparaissent :
 *
 * 1. l'import doit rester `dynamic(..., { ssr: false })`. Remplacé par un
 *    import ordinaire, le composant se comporte exactement pareil — et son
 *    code repart dans le morceau commun. Le défaut ne se voit qu'à la balance.
 * 2. la mise en page ne doit pas importer ces composants elle-même. Un seul
 *    import direct suffit à ramener le module dans le morceau commun, pont ou
 *    pas pont.
 */
const RACINE = join(__dirname, "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");

const PONTS = ["src/components/PontConnecte.tsx", "src/components/PontDesktop.tsx"];

/**
 * Les composants qu'un pont monte, lus dans son JSX.
 *
 * La première version de ce test lisait la liste dans les déclarations
 * `const X = dynamic(...)`. Elle ne pouvait donc rien attraper : remplacer un
 * import dynamique par un import ordinaire faisait sortir le nom de la liste,
 * et le test vérifiait la propriété sur les seuls composants qui l'avaient
 * encore. Les deux sabotages passaient au vert.
 *
 * La liste vient maintenant de ce qui est rendu — la seule chose qu'on ne peut
 * pas retirer sans retirer le composant.
 */
function montesPar(pont: string): string[] {
  const source = lire(pont);
  const rendus = [...source.matchAll(/<([A-Z]\w+)\s*\/>/g)].map((m) => m[1]);
  return [...new Set(rendus)];
}

describe("les ponts de chargement", () => {
  test("l'énumération trouve bien des composants dans chaque pont", () => {
    // Sans ce contrôle, un pont vidé ferait passer tous les autres tests.
    for (const pont of PONTS) expect(montesPar(pont).length).toBeGreaterThanOrEqual(5);
  });

  test.each(PONTS)("%s ne charge que par import dynamique, sans rendu serveur", (pont) => {
    const source = lire(pont);
    for (const nom of montesPar(pont)) {
      // Aucun import statique du composant : il repartirait dans le commun.
      expect(source).not.toMatch(new RegExp(`import\\s*\\{[^}]*\\b${nom}\\b[^}]*\\}\\s*from`));
      // Il doit exister une déclaration dynamique pour lui.
      const debut = source.indexOf(`const ${nom} = dynamic(`);
      expect(debut).toBeGreaterThanOrEqual(0);
      // Et le module ne doit pas être rendu au serveur : il n'y a pas de
      // `window` là-bas, et le rendre à vide referait le travail évité.
      //
      // La déclaration s'arrête à la suivante. Prendre « les 400 caractères
      // qui suivent » laissait lire le `ssr: false` du composant d'après :
      // le sabotage passait au vert.
      const suite = source.slice(debut + 1);
      const fin = suite.indexOf("\nconst ");
      const declaration = fin === -1 ? suite : suite.slice(0, fin);
      expect(declaration).toContain("ssr: false");
    }
  });

  test("la mise en page racine n'importe aucun de ces composants", () => {
    const layout = lire("src/app/[locale]/layout.tsx");
    for (const pont of PONTS) {
      for (const nom of montesPar(pont)) {
        expect(layout).not.toMatch(new RegExp(`import\\s*\\{[^}]*\\b${nom}\\b[^}]*\\}\\s*from`));
      }
    }
  });

  test("la mise en page racine monte bien les deux ponts", () => {
    const layout = lire("src/app/[locale]/layout.tsx");
    expect(layout).toContain("<PontConnecte />");
    expect(layout).toContain("<PontDesktop />");
  });
});
