import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * L'entrée du héros ne se fait pas en fondu.
 *
 * Un élément à `opacity: 0` n'existe pas pour le navigateur : il ne peut pas
 * être élu plus grand élément affiché. Le sous-titre du héros, qui l'est, ne
 * comptait donc qu'une fois le fondu joué — 3396 ms sur téléphone bridé contre
 * 1416 ms sans, mesuré trois fois de chaque côté. La page d'accueil était le
 * seul des dix écrans au-dessus du seuil, et la cause n'était ni le poids ni
 * le réseau.
 *
 * Le test est statique parce que le défaut l'est : il se voit dans la règle,
 * et une mesure au navigateur ne tourne pas en intégration continue.
 */
const CSS = readFileSync(join(__dirname, "app/styles/mouvement.css"), "utf8");

/** Le corps d'une animation nommée, espaces aplatis. */
function corpsAnimation(nom: string): string {
  const debut = CSS.indexOf(`@keyframes ${nom}`);
  expect(debut).toBeGreaterThanOrEqual(0);
  const ouvrante = CSS.indexOf("{", debut);
  let profondeur = 0;
  for (let i = ouvrante; i < CSS.length; i++) {
    if (CSS[i] === "{") profondeur++;
    else if (CSS[i] === "}") {
      profondeur--;
      if (profondeur === 0) return CSS.slice(ouvrante, i + 1).replace(/\s+/g, " ");
    }
  }
  throw new Error(`accolade non refermée dans @keyframes ${nom}`);
}

describe("l'entrée du héros", () => {
  it("n'anime pas l'opacité", () => {
    expect(corpsAnimation("heroRise")).not.toMatch(/opacity/);
  });

  it("anime bien quelque chose — sinon le test ci-dessus ne prouve rien", () => {
    expect(corpsAnimation("heroRise")).toMatch(/transform:\s*translateY/);
  });

  it("lit vraiment le corps de l'animation demandée", () => {
    // Le découpage par accolades est la seule partie qui peut se tromper de
    // règle : on l'éprouve sur une animation dont on sait qu'elle fond.
    expect(corpsAnimation("fadeIn")).toMatch(/opacity/);
  });
});
