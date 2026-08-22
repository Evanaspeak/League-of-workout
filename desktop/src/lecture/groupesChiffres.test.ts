/**
 * Le tri des traits du cartouche d'Apex.
 *
 * Ce qui est éprouvé ici, c'est la règle qui a remplacé les colonnes fixes :
 * une icône se distingue d'un chiffre à la largeur de son trait. Les mesures
 * viennent de captures réelles en 3440×1440 — chiffre onze à treize pixels,
 * icône vingt-cinq à trente-huit, pointe de parallélogramme dix-huit.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { groupesChiffres } = require("./lecteurApex.js");

const L = 3440;
const H = 1440;

/** Une image factice : elle ne sait que ce dont la fonction a besoin. */
function imageAvec(traits: Array<[number, number]>) {
  const pixels = Buffer.alloc(L * H * 4);
  for (const [x0, x1] of traits) {
    for (let x = x0; x < x1; x++) {
      for (let y = 0; y < H; y++) {
        const i = (y * L + x) * 4;
        pixels[i] = 255; pixels[i + 1] = 255; pixels[i + 2] = 255; pixels[i + 3] = 255;
      }
    }
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

/** Les bornes du nombre, marge de découpe retirée. */
const bornes = (g: any[]) => g.map((r) => [r.x + 2, r.x + r.width - 2]);

describe("groupesChiffres", () => {
  it("garde les chiffres et écarte les icônes", () => {
    // Crâne, « 8 », poignée de main, « 3 », éclat, « 2164 » : les largeurs sont
    // celles relevées sur la capture du 22/08 à 19h56.
    // Les dégâts sont quatre traits, pas un : « 2164 » se découpe chiffre par
    // chiffre, et c'est le regroupement qui en refait un nombre.
    const image = imageAvec([[2931, 2956], [2966, 2978], [3004, 3042], [3045, 3056],
      [3116, 3152], [3156, 3167], [3169, 3175], [3179, 3191], [3192, 3205]]);
    expect(bornes(groupesChiffres(image, 164))).toEqual([[2966, 2978], [3045, 3056], [3156, 3205]]);
  });

  it("réunit les chiffres d'un même nombre, séparés par moins de huit pixels", () => {
    const image = imageAvec([[3156, 3167], [3169, 3175], [3179, 3191], [3192, 3205]]);
    expect(bornes(groupesChiffres(image, 164))).toEqual([[3156, 3205]]);
  });

  it("écarte la pointe d'un parallélogramme, plus large qu'un chiffre", () => {
    // Dix-huit pixels : trop pour un chiffre, trop peu pour une icône. C'est ce
    // trait qui ajoutait un quatrième nombre au cartouche.
    const image = imageAvec([[2895, 2913], [2966, 2978]]);
    expect(bornes(groupesChiffres(image, 164))).toEqual([[2966, 2978]]);
  });

  it("écarte un trait coupé par le bord de la bande, dont la largeur est inconnue", () => {
    // La bande finit à 218 px du bord droit, soit x = 3222.
    const image = imageAvec([[3215, 3230], [2966, 2978]]);
    expect(bornes(groupesChiffres(image, 164))).toEqual([[2966, 2978]]);
  });

  it("ne trouve rien là où le cartouche n'est pas dessiné", () => {
    expect(groupesChiffres(imageAvec([]), 79)).toEqual([]);
  });

  it("ne sort pas de l'image quand la bannière est trouvée tout en bas", () => {
    expect(groupesChiffres(imageAvec([[2966, 2978]]), H - 10)).toEqual([]);
  });
});
