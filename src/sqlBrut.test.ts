import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Le SQL brut, et la seule fois où il sert.
 *
 * La revue de sécurité affirmait « aucun SQL brut » au présent, sur un
 * décompte de quarante-sept routes. Il y en a soixante-quatre aujourd'hui, et
 * il y a bien un `$queryRaw` — inoffensif, mais la phrase était devenue
 * fausse. C'est exactement ce que ce journal reproche ailleurs : une
 * description périmée ne se distingue pas d'une garantie, et elle fait cesser
 * de vérifier.
 *
 * La prose est donc remplacée par ce garde, qui est la seule forme de
 * raison qu'une machine peut reprendre.
 *
 * DEUX RÈGLES, et la seconde compte plus que la première :
 *
 *  - les variantes `Unsafe` sont interdites SANS exemption possible. Elles
 *    prennent une chaîne, donc elles sont le seul point d'injection SQL que ce
 *    projet pourrait avoir ;
 *  - un gabarit `$queryRaw` doit être une constante. Prisma paramètre bien les
 *    interpolations d'un gabarit étiqueté — ce n'est donc pas une faille — mais
 *    une constante se relit en une seconde, là où une interpolation demande de
 *    vérifier d'où vient chaque valeur. Sur le seul SQL brut du dépôt, c'est un
 *    prix nul.
 */

const SRC = join(process.cwd(), "src");

/** Chaque dispense porte sa raison, et le test vérifie qu'elle désigne encore quelque chose. */
const DISPENSES: Record<string, string> = {
  "app/api/sante/route.ts":
    "la sonde de santé : `SELECT 1`, constante, qui prouve que la connexion vit",
};

function fichiers(racine: string): string[] {
  const sortie: string[] = [];
  const parcourir = (dossier: string) => {
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      if (e.name === "generated") continue; // le client engendré par Prisma
      const chemin = join(dossier, e.name);
      if (e.isDirectory()) parcourir(chemin);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) sortie.push(chemin);
    }
  };
  parcourir(racine);
  return sortie;
}

const BRUT = /\$(?:query|execute)Raw(?:Unsafe)?/g;
const NON_SUR = /\$(?:query|execute)RawUnsafe/;

/**
 * Le gabarit qui suit l'appel, jusqu'à son accent grave fermant.
 *
 * Découpé à la main plutôt que par une expression : un gabarit peut contenir
 * des accolades, et une expression qui s'arrête au premier `}` déclarerait
 * constant un gabarit qui ne l'est pas.
 */
export function gabaritApres(source: string, depuis: number): string | null {
  const ouvrant = source.indexOf("`", depuis);
  if (ouvrant < 0 || source.slice(depuis, ouvrant).trim() !== "") return null;
  const fermant = source.indexOf("`", ouvrant + 1);
  if (fermant < 0) return null;
  return source.slice(ouvrant + 1, fermant);
}

describe("le SQL brut", () => {
  const sources = fichiers(SRC);

  it("n'est employé nulle part, sauf là où c'est écrit", () => {
    // Témoin : un dossier renommé rendrait toutes les listes vides sans avoir
    // rien lu, et le contrôle passerait au vert en ne gardant rien.
    expect(sources.length).toBeGreaterThanOrEqual(200);

    const fautifs: string[] = [];
    const vus = new Set<string>();
    for (const f of sources) {
      const source = readFileSync(f, "utf8");
      if (!BRUT.test(source)) { BRUT.lastIndex = 0; continue; }
      BRUT.lastIndex = 0;
      const cle = relative(SRC, f).split("\\").join("/");
      vus.add(cle);
      if (!(cle in DISPENSES)) fautifs.push(cle);
    }
    expect(fautifs).toEqual([]);

    // Une dispense qui ne désigne plus rien de vivant est du code mort dans le
    // garde même qui existe pour l'attraper.
    for (const cle of Object.keys(DISPENSES)) expect([...vus]).toContain(cle);
  });

  it("n'emploie jamais les variantes qui prennent une chaîne", () => {
    const fautifs = sources
      .filter((f) => NON_SUR.test(readFileSync(f, "utf8")))
      .map((f) => relative(SRC, f));
    expect(fautifs).toEqual([]);
  });

  it("ne porte aucune interpolation là où il est dispensé", () => {
    let examines = 0;
    const fautifs: string[] = [];
    for (const cle of Object.keys(DISPENSES)) {
      const source = readFileSync(join(SRC, cle), "utf8");
      const re = new RegExp(BRUT.source, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(source))) {
        examines += 1;
        const gabarit = gabaritApres(source, m.index + m[0].length);
        if (gabarit === null || gabarit.includes("${")) fautifs.push(`${cle} → ${m[0]}`);
      }
    }
    // Sans ce compte, une dispense dont l'appel a disparu passerait au vert.
    expect(examines).toBeGreaterThanOrEqual(1);
    expect(fautifs).toEqual([]);
  });
});

describe("le découpage du gabarit", () => {
  // Éprouvé sur des cas fabriqués : le dépôt ne contient qu'un seul appel, donc
  // les fichiers réels ne distinguent pas un découpage juste d'un découpage
  // cassé.
  it("rend le contenu d'un gabarit constant", () => {
    const s = "await prisma.$queryRaw`SELECT 1`;";
    expect(gabaritApres(s, s.indexOf("$queryRaw") + "$queryRaw".length)).toBe("SELECT 1");
  });

  it("voit l'interpolation, même après une accolade", () => {
    const s = "prisma.$queryRaw`SELECT {a} FROM t WHERE id = ${id}`;";
    const g = gabaritApres(s, s.indexOf("$queryRaw") + "$queryRaw".length);
    expect(g).toContain("${");
  });

  it("rend null quand l'appel n'est pas suivi d'un gabarit", () => {
    const s = "prisma.$queryRawUnsafe(requete);";
    expect(gabaritApres(s, s.indexOf("$queryRawUnsafe") + "$queryRawUnsafe".length)).toBeNull();
  });
});
