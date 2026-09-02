import {
  cadreDepuisRect, clesCandidates, LARGEUR_ETROITE, PART_ECRAN, tropGrandPourLEcran,
} from "./visiteGuidee";

const rect = (c: Partial<{ left: number; top: number; width: number; height: number }> = {}) =>
  ({ left: 10, top: 20, width: 300, height: 100, ...c });

describe("les ancres d'une étape", () => {
  it("prend l'ancre principale quand il n'y a rien d'autre", () => {
    expect(clesCandidates({ cle: "rail" }, 1280)).toEqual(["rail"]);
  });

  it("essaie le bouton du rail avant le rail, sur écran étroit", () => {
    // Sous 900 px le rail se replie : ses actions n'ont plus aucune surface,
    // et c'est le bouton qu'il faut désigner. L'ordre est la règle — mettre
    // le rail en premier ferait éclairer le vide.
    expect(clesCandidates({ cle: "rail", cleEtroite: "rail-bascule" }, 390))
      .toEqual(["rail-bascule", "rail"]);
  });

  it("ignore l'ancre étroite sur un grand écran", () => {
    expect(clesCandidates({ cle: "rail", cleEtroite: "rail-bascule" }, 1280))
      .toEqual(["rail"]);
  });

  it("garde le repli en dernier", () => {
    // La pastille de dette n'existe qu'une fois qu'on doit quelque chose, et
    // les graphiques qu'après quelques parties. Sans ce repli, ces étapes se
    // sautaient — pour un compte neuf, c'est-à-dire pour le seul public de
    // cette visite.
    expect(clesCandidates({ cle: "dette", cleSecours: "dette-carte" }, 1280))
      .toEqual(["dette", "dette-carte"]);
    expect(clesCandidates(
      { cle: "dette", cleEtroite: "rail-bascule", cleSecours: "dette-carte" }, 390,
    )).toEqual(["rail-bascule", "dette", "dette-carte"]);
  });

  it("bascule exactement au seuil", () => {
    const e = { cle: "a", cleEtroite: "b" };
    expect(clesCandidates(e, LARGEUR_ETROITE - 1)).toEqual(["b", "a"]);
    expect(clesCandidates(e, LARGEUR_ETROITE)).toEqual(["a"]);
  });
});

describe("le cadre à dessiner", () => {
  it("reprend le rectangle de l'élément", () => {
    expect(cadreDepuisRect(rect(), 1000))
      .toEqual({ left: 10, top: 20, width: 300, height: 100 });
  });

  it("ne rend rien quand l'élément n'occupe aucune surface", () => {
    // Un rail replié ou une section non dépliée n'occupe aucun pixel :
    // l'éclairer désignerait le vide. C'est le seul critère — un test « est-il
    // dans l'écran ? » vivait ici et faisait sauter les étapes situées sous la
    // ligne de flottaison, c'est-à-dire celles qu'on allait justement amener.
    expect(cadreDepuisRect(rect({ width: 0 }), 1000)).toBeNull();
    expect(cadreDepuisRect(rect({ height: 0 }), 1000)).toBeNull();
  });

  it("borne un élément immense à une part de l'écran", () => {
    // Le tableau de l'historique dépasse quatre mille pixels dès quelques
    // dizaines de parties : l'entourer en entier ferait partir la bulle avec
    // le cadre, hors de l'écran.
    const c = cadreDepuisRect(rect({ height: 4000 }), 1000);
    expect(c!.height).toBe(Math.round(1000 * PART_ECRAN));
    // Le haut ne bouge pas : c'est là que commence ce qu'on montre.
    expect(c!.top).toBe(20);
  });

  it("ne rogne pas ce qui tient déjà", () => {
    expect(cadreDepuisRect(rect({ height: 500 }), 1000)!.height).toBe(500);
  });
});

describe("trop grand pour l'écran", () => {
  it("dit oui au-delà de la part d'écran, non en deçà", () => {
    expect(tropGrandPourLEcran(1000 * PART_ECRAN + 1, 1000)).toBe(true);
    expect(tropGrandPourLEcran(1000 * PART_ECRAN, 1000)).toBe(false);
    expect(tropGrandPourLEcran(100, 1000)).toBe(false);
  });

  /**
   * La borne du cadre et ce contrôle lisaient chacun leur propre `0.62`. Deux
   * exemplaires d'un seuil finissent par diverger, et le symptôme serait un
   * cadre rogné qu'on ne déclare pas trop grand : la visite ne ferait alors
   * pas défiler jusqu'à l'ancre.
   */
  it("emploie le même seuil que le cadre", () => {
    const h = 1000;
    const borne = cadreDepuisRect(rect({ height: 4000 }), h)!.height;
    expect(tropGrandPourLEcran(borne + 1, h)).toBe(true);
  });
});
