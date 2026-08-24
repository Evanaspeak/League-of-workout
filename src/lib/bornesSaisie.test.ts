import { DUREE_MAX_SEC, JOUEURS_MAX, KDA_MAX, entierBorne } from "./bornesSaisie";

/**
 * Les bornes de saisie.
 *
 * Sans elles, `999999999` secondes de Minecraft au lieu de `999` produisait
 * cinq millions et demi de points de dette en une requête — une faute de
 * frappe, pas un abus, et une dette impossible à payer sur un produit dont
 * c'est le sujet. Et `1e308` traversait jusqu'à la base, qui répondait par une
 * erreur 500 sans rien expliquer.
 */
describe("entierBorne", () => {
  test("laisse passer une valeur ordinaire", () => {
    expect(entierBorne(12, 1000)).toBe(12);
    expect(entierBorne("7", 1000)).toBe(7);
  });

  test("arrondit plutôt que de refuser un décimal", () => {
    // Une durée mesurée au chronomètre arrive avec des décimales.
    expect(entierBorne(12.4, 1000)).toBe(12);
    expect(entierBorne(12.6, 1000)).toBe(13);
  });

  test("refuse ce qui dépasse la borne", () => {
    expect(entierBorne(1001, 1000)).toBeNull();
    expect(entierBorne(999999999, DUREE_MAX_SEC)).toBeNull();
  });

  test("refuse ce qui est sous la borne basse", () => {
    expect(entierBorne(-1, 1000)).toBeNull();
    expect(entierBorne(0, 1000, 1)).toBeNull();
  });

  test("refuse ce qui n'est pas un nombre fini", () => {
    // Le repli sur zéro confondait « absent » et « aberrant ».
    for (const aberrant of [NaN, Infinity, -Infinity, 1e308, "abc", {}, []]) {
      expect(entierBorne(aberrant, 1000)).toBeNull();
    }
  });

  test("distingue « absent » de « aberrant »", () => {
    // Les deux rendent `null` : c'est à l'appelant de décider si l'absence est
    // permise. Ce qui compte, c'est qu'aucun des deux ne devienne un chiffre.
    expect(entierBorne(null, 1000)).toBeNull();
    expect(entierBorne(undefined, 1000)).toBeNull();
    expect(entierBorne("", 1000)).toBeNull();
  });

  test("les bornes sont larges à dessein", () => {
    // Il s'agit d'attraper l'impossible, pas de discuter l'exploit.
    expect(DUREE_MAX_SEC).toBe(36 * 3600);
    expect(entierBorne(24 * 3600, DUREE_MAX_SEC)).toBe(86400);
    expect(KDA_MAX).toBeGreaterThanOrEqual(100);
    expect(JOUEURS_MAX).toBeGreaterThanOrEqual(150);
  });
});
