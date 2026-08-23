import { langueDuCompte, textesNotification } from "./notifications";
import { LANGUES } from "./langues";

describe("langue du compte", () => {
  it("retient les six langues", () => {
    for (const l of LANGUES) expect(langueDuCompte(l)).toBe(l);
  });

  it("retombe sur l'anglais et non sur le français", () => {
    // Le défaut français envoyait des notifications françaises à des gens qui
    // n'avaient jamais vu un écran français.
    for (const rebut of [null, undefined, "", "it", 42, {}]) {
      expect(langueDuCompte(rebut)).toBe("en");
    }
  });
});

describe("textes de notification", () => {
  it("existent dans les six langues", () => {
    for (const l of LANGUES) {
      for (const cle of ["seuil", "matin"] as const) {
        const t = textesNotification(l)[cle]("5 min");
        expect(t.titre.trim()).not.toBe("");
        expect(t.corps).toContain("5 min");
      }
      // Pas de longueur minimale : un titre chinois tient en trois caractères,
      // et un seuil en nombre de signes aurait refusé une traduction juste.
    }
  });

  it("disent six choses différentes", () => {
    // Une langue qui retomberait silencieusement sur une autre passerait le
    // contrôle ci-dessus sans qu'on s'en aperçoive.
    for (const cle of ["seuil", "matin"] as const) {
      const vus = LANGUES.map((l) => textesNotification(l)[cle]("5 min").corps);
      expect(new Set(vus).size).toBe(LANGUES.length);
    }
  });

  it("ne disent pas la même chose le soir et le matin", () => {
    // Le rappel du matin existe pour dire autre chose que le rappel du seuil :
    // recopier le second dans le premier ferait deux notifications identiques.
    for (const l of LANGUES) {
      const t = textesNotification(l);
      expect(t.matin("5 min").corps).not.toBe(t.seuil("5 min").corps);
    }
  });

  it("ne félicitent ni n'encouragent", () => {
    // Le ton est celui du reste de l'application : direct, sans moquerie et
    // sans encouragement de façade.
    for (const l of LANGUES) {
      const { titre, corps } = textesNotification(l).seuil("5 min");
      expect(`${titre} ${corps}`).not.toMatch(/bravo|super|génial|well done|keep it up|加油|頑張/i);
    }
  });
});
