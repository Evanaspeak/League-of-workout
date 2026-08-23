/**
 * Le tri des traits du cartouche, sur des pixels vraiment sortis du jeu.
 *
 * `groupesChiffres.test.ts` dessine des traits aux largeurs relevées à la
 * main. C'est utile — on y écrit exactement le cas qu'on veut éprouver — mais
 * ça ne prouve pas que les largeurs relevées soient les bonnes, ni que le
 * seuil d'encre tienne devant une image réelle, avec son bruit, son
 * anticrénelage et le fond du jeu qui bouge derrière. Les deux tests ne disent
 * pas la même chose et aucun ne remplace l'autre.
 *
 * Ce qui est rangé ici, ce sont trois bandes de 342 × 32 pixels découpées dans
 * trois captures en 3440 × 1440, à l'endroit exact où la fonction va lire.
 * Pas les captures entières : cinq méga-octets chacune, pour une bande qui en
 * pèse vingt kilo-octets une fois compressée. Le reste de l'image n'est jamais
 * lu — la fonction ne découpe que cette bande — et le cadre reconstitué est
 * donc noir autour.
 *
 * Format brut plutôt que PNG : décoder demanderait une bibliothèque, or la
 * seule disponible ici l'est par transitivité. `zlib` vient avec Node.
 */
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Le module tire `electron` au chargement pour `nativeImage`. Ni la fonction
// éprouvée ni ce test n'en ont besoin : `groupesChiffres` ne fait que compter
// des pixels.
jest.mock("electron", () => ({ nativeImage: {}, app: { isPackaged: false } }), { virtual: true });

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { groupesChiffres } = require("./lecteurApex.js");

const L = 3440;
const H = 1440;
/** Bande du cartouche, telle que `zonesApex` la définit pour cette hauteur. */
const BANDE = { x: 2880, w: 342, dy: 50, h: 32 };

/**
 * Reconstitue un cadre entier avec la bande à sa place.
 *
 * La fonction lit la taille de l'image pour calculer où découper : lui donner
 * la bande seule la ferait chercher ailleurs. Le cadre est donc à la vraie
 * taille, et noir partout où la fonction ne regarde pas.
 */
function cadreAvecBande(tag: string, ancre: number) {
  const bande = gunzipSync(readFileSync(join(__dirname, "captures", `${tag}.bgra.gz`)));
  expect(bande.length).toBe(BANDE.w * BANDE.h * 4);
  const pixels = Buffer.alloc(L * H * 4);
  const y0 = ancre + BANDE.dy;
  for (let j = 0; j < BANDE.h; j++) {
    bande.copy(pixels, ((y0 + j) * L + BANDE.x) * 4, j * BANDE.w * 4, (j + 1) * BANDE.w * 4);
  }
  const vue = (ox: number, oy: number, w: number, h: number): any => ({
    getSize: () => ({ width: w, height: h }),
    crop: (r: { x: number; y: number; width: number; height: number }) =>
      vue(ox + r.x, oy + r.y, r.width, r.height),
    toBitmap: () => {
      const out = Buffer.alloc(w * h * 4);
      for (let y = 0; y < h; y++) {
        pixels.copy(out, y * w * 4, ((oy + y) * L + ox) * 4, ((oy + y) * L + ox + w) * 4);
      }
      return out;
    },
  });
  return vue(0, 0, L, H);
}

/** Les bornes de chaque nombre, marge de découpe retirée. */
const bornes = (g: any[]) => g.map((r) => [r.x + 2, r.x + r.width - 2]);

describe("groupesChiffres, sur des captures réelles", () => {
  it("trouve les trois nombres du cartouche (capture a, bannière à 164)", () => {
    // Éliminations, assistances, dégâts : « 8 », « 3 », « 2164 ». Le dernier
    // est quatre traits que le regroupement refait en un nombre.
    expect(bornes(groupesChiffres(cadreAvecBande("a", 164), 164)))
      .toEqual([[2966, 2978], [3045, 3056], [3156, 3205]]);
  });

  it("trouve les trois nombres quand la bannière a bougé d'un pixel (capture b, 165)", () => {
    // Même partie, une seconde plus tard : tout le bloc a glissé de sept
    // pixels vers la gauche et la bannière d'un vers le bas. Rien n'est fixe
    // dans ce coin, et c'est pour ça que les colonnes en dur ne marchaient pas.
    expect(bornes(groupesChiffres(cadreAvecBande("b", 165), 165)))
      .toEqual([[2959, 2971], [3038, 3050], [3149, 3204]]);
  });

  it("ne trouve rien quand le cartouche n'est pas dessiné (capture c, 79)", () => {
    // Avant le premier dégât de l'escouade : la bannière est là, le cartouche
    // non. Ne rien rendre est la bonne réponse — une élimination inventée se
    // paie en pompes.
    expect(groupesChiffres(cadreAvecBande("c", 79), 79)).toEqual([]);
  });
});
