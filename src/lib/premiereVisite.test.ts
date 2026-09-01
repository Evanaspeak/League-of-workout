import { cleOnboarding, cleVisite, oublierPremiereVisite } from "./premiereVisite";
import { effacer, effacerSession } from "./stockage";

jest.mock("./stockage", () => ({
  effacer: jest.fn(),
  effacerSession: jest.fn(),
}));

/**
 * Ce qui distingue une première visite d'un retour est rattaché au COMPTE.
 *
 * Écrites sous un nom fixe, ces marques disaient « ce navigateur a déjà vu
 * l'intro », ce qui n'est pas la question posée : sur un poste déjà utilisé,
 * un compte tout neuf n'avait droit ni à l'accueil ni à la visite. C'est le
 * moment où l'on en a le plus besoin, et le module n'avait aucun test.
 */
describe("les marques de première visite", () => {
  beforeEach(() => jest.clearAllMocks());

  it("portent l'identifiant du compte", () => {
    expect(cleOnboarding("u42")).toBe("low_onboarded:u42");
    expect(cleVisite("u42")).toBe("low_visite:u42");
  });

  it("retombent sur le nom nu tant que le compte est inconnu", () => {
    // L'identifiant n'existe qu'une fois l'inscription faite : entre-temps il
    // faut bien écrire quelque part, et ce nom-là est celui qu'on nettoie.
    for (const sans of [null, undefined, ""]) {
      expect(cleOnboarding(sans)).toBe("low_onboarded");
      expect(cleVisite(sans)).toBe("low_visite");
    }
  });

  it("ne confondent pas deux comptes", () => {
    expect(cleOnboarding("u1")).not.toBe(cleOnboarding("u2"));
  });
});

describe("rejouer l'intro", () => {
  beforeEach(() => jest.clearAllMocks());

  /**
   * Il faut un `window` pour que la fonction fasse quoi que ce soit.
   *
   * Elle sort tout de suite sans lui, et c'est voulu : elle est appelée depuis
   * des composants que le serveur rend aussi. Les tests tournent en
   * environnement Node, donc sans `window` — l'oublier faisait passer les
   * trois épreuves suivantes sur zéro appel, c'est-à-dire sur rien.
   */
  const sansNavigateur = globalThis.window;
  beforeAll(() => { (globalThis as { window?: unknown }).window = {}; });
  afterAll(() => { (globalThis as { window?: unknown }).window = sansNavigateur; });

  it("efface l'écran d'ouverture dans le stockage de session, pas l'autre", () => {
    // Deux stockages, et ce n'est pas un détail : l'écran d'ouverture ne dure
    // que le temps de l'onglet, les deux autres marques doivent tenir d'une
    // session à l'autre. Les effacer du mauvais côté ne ferait rien du tout.
    oublierPremiereVisite("u42");
    expect(effacerSession).toHaveBeenCalledWith("splash");
    expect(effacer).not.toHaveBeenCalledWith("splash");
  });

  it("efface les marques du compte ET les anciennes sans compte", () => {
    oublierPremiereVisite("u42");
    const efface = (effacer as jest.Mock).mock.calls.map(([c]) => c);
    expect(efface).toEqual(expect.arrayContaining([
      "low_onboarded", "low_visite", "low_onboarded:u42", "low_visite:u42",
    ]));
  });

  it("au rendu serveur, ne touche à rien", () => {
    const avec = globalThis.window;
    (globalThis as { window?: unknown }).window = undefined;
    oublierPremiereVisite("u42");
    expect(effacer).not.toHaveBeenCalled();
    expect(effacerSession).not.toHaveBeenCalled();
    (globalThis as { window?: unknown }).window = avec;
  });

  it("sans compte, efface au moins les anciennes", () => {
    // Les noms sans compte datent d'avant le rattachement. Les laisser
    // empêcherait l'intro de rejouer pour qui les porte encore.
    oublierPremiereVisite();
    const efface = (effacer as jest.Mock).mock.calls.map(([c]) => c);
    expect(efface).toEqual(["low_onboarded", "low_visite"]);
  });
});
