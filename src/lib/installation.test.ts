import {
  compterVisite, proposerInstallation, visitesLues, VISITES_AVANT_PROPOSITION,
} from "./installation";

const etat = (champs: Partial<Parameters<typeof proposerInstallation>[0]> = {}) => ({
  visites: VISITES_AVANT_PROPOSITION, refuse: false, telephone: true, installee: false,
  ...champs,
});

describe("quand proposer l'installation", () => {
  it("attend la troisième visite", () => {
    // Proposer à la première revient à demander un engagement à quelqu'un qui
    // ne sait pas encore ce qu'il regarde.
    expect(proposerInstallation(etat({ visites: 1 }))).toBe(false);
    expect(proposerInstallation(etat({ visites: 2 }))).toBe(false);
    expect(proposerInstallation(etat({ visites: 3 }))).toBe(true);
    expect(proposerInstallation(etat({ visites: 12 }))).toBe(true);
  });

  it("se tait sur un ordinateur", () => {
    expect(proposerInstallation(etat({ telephone: false }))).toBe(false);
  });

  it("ne repropose jamais après un refus", () => {
    // Reproposer après un refus est la façon la plus sûre de faire fermer.
    expect(proposerInstallation(etat({ refuse: true }))).toBe(false);
    expect(proposerInstallation(etat({ refuse: true, visites: 40 }))).toBe(false);
  });

  it("se tait quand l'application est déjà installée", () => {
    expect(proposerInstallation(etat({ installee: true }))).toBe(false);
  });
});

describe("compteur de visites", () => {
  it("part de un", () => {
    expect(compterVisite(null)).toBe(1);
  });

  it("avance d'une visite à l'autre", () => {
    expect(compterVisite("1")).toBe(2);
    expect(compterVisite("2")).toBe(3);
  });

  it("se borne au lieu de grandir sans fin", () => {
    expect(compterVisite("999999")).toBe(VISITES_AVANT_PROPOSITION + 1);
  });

  it("se relit sans avancer", () => {
    // Le compteur n'avance qu'une fois par ouverture de l'application : les
    // pages suivantes le lisent seulement. Sans cette distinction, aller du
    // tableau de bord aux réglages suffisait à atteindre la troisième visite.
    expect(visitesLues("2")).toBe(2);
    expect(visitesLues(null)).toBe(0);
    expect(visitesLues("bricolé")).toBe(0);
  });

  it("repart de un sur une valeur illisible", () => {
    // Un stockage effacé ou bricolé à la main ne doit pas faire tomber la page.
    for (const rebut of ["", "trois", "-4", "NaN", "{}"]) {
      expect(compterVisite(rebut)).toBe(1);
    }
  });
});
