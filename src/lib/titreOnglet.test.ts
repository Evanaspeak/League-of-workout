import { titreAvecDette, titreNu } from "./titreOnglet";

const BASE = "Tableau de bord · Win or Workout";

describe("compteur dans le titre", () => {
  it("pose le compteur devant le titre", () => {
    expect(titreAvecDette(BASE, "38")).toBe(`(38) ${BASE}`);
  });

  it("ne s'empile pas quand le titre en porte déjà un", () => {
    // Le routeur réécrit le titre à chaque navigation : sans retrait, on
    // obtiendrait « (38) (38) (12) Tableau de bord ».
    const une = titreAvecDette(BASE, "38");
    expect(titreAvecDette(une, "12")).toBe(`(12) ${BASE}`);
    expect(titreAvecDette(titreAvecDette(une, "12"), "5")).toBe(`(5) ${BASE}`);
  });

  it("retire le compteur quand il n'y a plus rien à faire", () => {
    for (const rien of [null, undefined, "", "   "]) {
      expect(titreAvecDette(`(38) ${BASE}`, rien)).toBe(BASE);
    }
  });

  it("accepte une valeur qui n'est pas un nombre", () => {
    // La dette s'affiche parfois en durée : « 4 min 20 » doit passer comme
    // « 38 », sans quoi les comptes en boxe n'auraient jamais de compteur.
    expect(titreAvecDette(BASE, "4 min 20")).toBe(`(4 min 20) ${BASE}`);
    expect(titreNu(`(4 min 20) ${BASE}`)).toBe(BASE);
  });

  it("laisse intact un titre sans compteur", () => {
    expect(titreNu(BASE)).toBe(BASE);
  });

  it("ne mange pas une parenthèse qui appartient au titre", () => {
    // Un titre qui commence par une parenthèse sans espace après n'est pas un
    // compteur : « (bêta)Réglages » doit rester tel quel.
    expect(titreNu("(bêta)Réglages")).toBe("(bêta)Réglages");
  });
});
