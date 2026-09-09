/**
 * L'icône de l'application installée.
 *
 * Ce qui s'éprouve ici n'est pas le dessin — il vient de `next/og`, doublé —
 * mais la seule DÉCISION de la route : la taille demandée dans l'adresse.
 * Elle est le seul paramètre du produit qui gouverne une allocation, et rien
 * ne la tenait : `taille=99999` dessinerait une image de dix milliards de
 * pixels, sur une adresse que le manifeste rend publique.
 *
 * C'est la famille « absent et aberrant sont deux choses différentes » du
 * journal, appliquée à une valeur qui ne se refuse pas — un manifeste ne sait
 * pas lire un message d'erreur — donc qui retombe sur la plus petite.
 */
jest.mock("next/og", () => ({
  ImageResponse: class {
    constructor(
      public element: unknown,
      public options: { width: number; height: number },
    ) {}
  },
}));

import { GET } from "./route";
import { requete } from "@/test/api";

/** La taille réellement passée au moteur de rendu. */
function taille(url: string): number {
  const rendue = GET(requete(url)) as unknown as { options: { width: number; height: number } };
  expect(rendue.options.width).toBe(rendue.options.height);
  return rendue.options.width;
}

describe("GET /api/pwa-icon", () => {
  it("rend les deux tailles que le manifeste réclame", () => {
    expect(taille("/api/pwa-icon?taille=192")).toBe(192);
    expect(taille("/api/pwa-icon?taille=512")).toBe(512);
  });

  it("retombe sur la plus petite quand la taille manque", () => {
    expect(taille("/api/pwa-icon")).toBe(192);
  });

  it("refuse une taille hors de la liste", () => {
    // 256 est plausible et n'est pas demandée : une taille « raisonnable »
    // mais absente de la liste doit retomber comme les autres, sinon la
    // liste ne sert à rien.
    expect(taille("/api/pwa-icon?taille=256")).toBe(192);
  });

  it("ne dessine pas une image démesurée", () => {
    // Le cas qui coûte : la valeur traverse jusqu'à une allocation.
    expect(taille("/api/pwa-icon?taille=99999")).toBe(192);
    expect(taille("/api/pwa-icon?taille=1e9")).toBe(192);
  });

  it("ne dessine pas une image de taille absurde", () => {
    // `Number("")` vaut zéro et `Number("abc")` vaut NaN : ni l'un ni l'autre
    // n'est dans la liste, donc les deux retombent — mais il faut le dire,
    // parce que ce sont deux chemins de conversion différents.
    expect(taille("/api/pwa-icon?taille=")).toBe(192);
    expect(taille("/api/pwa-icon?taille=abc")).toBe(192);
    expect(taille("/api/pwa-icon?taille=-512")).toBe(192);
  });
});
