import { baremeDeLaPartie, cumulsParExercice } from "./historiqueBareme";
import {
  appliquerRatios, formaterCompact, quantite, RATIOS_DEFAUT,
} from "./exercices";

/** Un barème où une seconde de boxe vaut deux fois moins qu'à l'origine. */
const BOXE_DOUBLE = { ...RATIOS_DEFAUT, boxe: RATIOS_DEFAUT.boxe * 2 };

beforeEach(() => appliquerRatios(RATIOS_DEFAUT));
afterAll(() => appliquerRatios(RATIOS_DEFAUT));

describe("le barème d'une partie", () => {
  it("se relit depuis le JSON stocké", () => {
    expect(baremeDeLaPartie(JSON.stringify(BOXE_DOUBLE))?.boxe)
      .toBe(RATIOS_DEFAUT.boxe * 2);
  });

  it("est nul quand la partie n'en porte pas", () => {
    // Les parties d'avant la colonne. Elles retombent sur le barème en
    // vigueur, qui est ce qu'elles affichaient déjà.
    expect(baremeDeLaPartie(null)).toBeNull();
    expect(baremeDeLaPartie("")).toBeNull();
    expect(baremeDeLaPartie(undefined)).toBeNull();
  });

  it("est nul plutôt que faux quand le JSON est illisible", () => {
    // Une valeur tronquée ne doit pas faire tomber l'historique entier.
    expect(baremeDeLaPartie("{pas du json")).toBeNull();
  });

  it("borne ce qu'il relit, comme n'importe quelle valeur venue de la base", () => {
    const fou = baremeDeLaPartie('{"boxe":999999}');
    expect(fou!.boxe).toBeLessThan(999999);
  });
});

describe("ce qu'une partie déjà enregistrée a coûté", () => {
  /**
   * LE test de ce fichier. Sans le barème gelé, changer le prix d'une seconde
   * de boxe faisait passer une soirée de 4 min 25 à 8 min 50.
   */
  it("ne bouge pas quand le barème change ensuite", () => {
    const bareme = baremeDeLaPartie(JSON.stringify(RATIOS_DEFAUT));
    const avant = formaterCompact(38, "boxe", bareme);

    appliquerRatios(BOXE_DOUBLE);
    const apres = formaterCompact(38, "boxe", bareme);

    expect(apres).toBe(avant);
  });

  it("suit le barème du jour quand la partie n'en porte aucun", () => {
    // Le repli est délibéré : une partie sans barème est une partie d'avant la
    // colonne, et son affichage doit rester celui qu'il était.
    const avant = formaterCompact(38, "boxe", null);
    appliquerRatios(BOXE_DOUBLE);
    expect(formaterCompact(38, "boxe", null)).not.toBe(avant);
  });

  it("chiffre les parties SUIVANTES au nouveau barème", () => {
    // L'autre moitié de la règle : geler le passé ne doit pas geler l'avenir.
    appliquerRatios(BOXE_DOUBLE);
    const nouvelle = baremeDeLaPartie(JSON.stringify(BOXE_DOUBLE));
    expect(quantite(38, "boxe", nouvelle)).toBe(quantite(38, "boxe", BOXE_DOUBLE));
    expect(quantite(38, "boxe", nouvelle))
      .not.toBe(quantite(38, "boxe", RATIOS_DEFAUT));
  });
});

describe("le cumul de l'historique", () => {
  /**
   * Deux parties de même coût en POINTS, chiffrées sous deux barèmes
   * différents. Le cumul doit valoir la somme des deux quantités, et non la
   * conversion de la somme des points — qui reviendrait à réévaluer la
   * première partie au barème de la seconde.
   */
  const parties = [
    { id: "recente", parts: { boxe: 38 }, ratios: JSON.stringify(BOXE_DOUBLE) },
    { id: "ancienne", parts: { boxe: 38 }, ratios: JSON.stringify(RATIOS_DEFAUT) },
  ];

  it("additionne des quantités, chacune sous son propre barème", () => {
    const cumuls = cumulsParExercice(parties);
    const attendu =
      quantite(38, "boxe", RATIOS_DEFAUT) + quantite(38, "boxe", BOXE_DOUBLE);
    expect(cumuls.get("recente")!.boxe).toBe(attendu);
  });

  it("ne convertit jamais la somme des points", () => {
    const cumuls = cumulsParExercice(parties);
    // Le raccourci fautif : 76 points convertis d'un coup au barème du jour.
    expect(cumuls.get("recente")!.boxe).not.toBe(quantite(76, "boxe", RATIOS_DEFAUT));
    expect(cumuls.get("recente")!.boxe).not.toBe(quantite(76, "boxe", BOXE_DOUBLE));
  });

  it("fige le cumul de chaque ligne à son instant", () => {
    const cumuls = cumulsParExercice(parties);
    expect(cumuls.get("ancienne")!.boxe).toBe(quantite(38, "boxe", RATIOS_DEFAUT));
  });

  it("ne rend rien sur une liste vide, sans tomber", () => {
    expect(cumulsParExercice([]).size).toBe(0);
  });
});
