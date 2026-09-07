import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { settings } from "@/lib/i18n/dictionaries/settings";

/**
 * L'application ne peut pas recevoir d'image, et elle le dit.
 *
 * La réponse 154 est un refus doublé d'une consigne : « non, trop risqué —
 * inciter à le faire pour eux, mais jamais transmis à l'application ». Une
 * photo avant-après est la donnée la plus intime qu'un produit de ce genre
 * puisse toucher ; ce qu'on promet est de ne pas pouvoir la recevoir.
 *
 * Ce garde tient les DEUX moitiés ensemble : tant que l'écran affirme qu'on ne
 * la recevra jamais, aucune route ne doit ouvrir de chemin qui accepte une
 * image. Le jour où l'une des deux bouge, il faut reprendre l'autre — ce qui
 * est exactement le bon comportement, parce que la promesse est écrite à
 * quelqu'un.
 */
const API = join(process.cwd(), "src", "app", "api");
const SRC = join(process.cwd(), "src");

function fichiers(dossier: string, extension: RegExp, out: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "generated") continue;
    const c = join(dossier, e.name);
    if (e.isDirectory()) fichiers(c, extension, out);
    else if (extension.test(e.name) && !e.name.includes(".test.")) out.push(c);
  }
  return out;
}

/**
 * Les façons dont une image entrerait.
 *
 * `formData` est le chemin d'un envoi de fichier, `Blob` et `arrayBuffer` ceux
 * d'un corps binaire. Une route qui n'emploie aucun des trois ne peut pas
 * recevoir de photo, quoi qu'on lui envoie.
 */
const ENTREES_BINAIRES = /\.formData\s*\(|\.arrayBuffer\s*\(|new Blob\s*\(|multipart\/form-data/;

/** Un champ de fichier dans un écran : l'autre bout du même chemin. */
const CHAMP_FICHIER = /type\s*=\s*["'{]?\s*["']?file["']?/;

describe("aucune photo ne peut entrer", () => {
  it("aucune route n'accepte un corps binaire ni un envoi de fichier", () => {
    const routes = fichiers(API, /\.tsx?$/);
    // Sans témoin, un dossier renommé rendrait le contrôle vert sur zéro route.
    expect(routes.length).toBeGreaterThan(50);

    const fautives = routes.filter((f) => ENTREES_BINAIRES.test(readFileSync(f, "utf8")));
    expect(fautives.map((f) => relative(SRC, f))).toEqual([]);
  });

  it("aucun écran ne propose de choisir un fichier", () => {
    const ecrans = fichiers(SRC, /\.tsx$/);
    expect(ecrans.length).toBeGreaterThan(60);

    const fautifs = ecrans.filter((f) => CHAMP_FICHIER.test(readFileSync(f, "utf8")));
    expect(fautifs.map((f) => relative(SRC, f))).toEqual([]);
  });

  it("et le tri reconnaît bien ce qu'il cherche", () => {
    // L'état sain est ZÉRO trouvaille : les fichiers réels ne distinguent pas
    // un motif juste d'un motif aveugle.
    expect(ENTREES_BINAIRES.test("const f = await req.formData();")).toBe(true);
    expect(ENTREES_BINAIRES.test("const b = await req.arrayBuffer();")).toBe(true);
    expect(ENTREES_BINAIRES.test('const r = await req.json();')).toBe(false);
    expect(CHAMP_FICHIER.test('<input type="file" />')).toBe(true);
    expect(CHAMP_FICHIER.test('<input type="number" />')).toBe(false);
  });

  it("et la promesse est écrite dans les six langues", () => {
    // Une promesse qui disparaîtrait d'une seule langue laisserait ce garde
    // sans objet pour ceux qui lisent celle-là.
    for (const langue of ["fr", "en", "es", "de", "zh", "ja"] as const) {
      expect(settings[langue].corpsPhotoAide.length).toBeGreaterThan(40);
      expect(settings[langue].corpsPhotoTitre.length).toBeGreaterThan(3);
    }
  });
});
