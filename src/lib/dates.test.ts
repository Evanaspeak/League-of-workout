import { analyserDatePartie } from "./dates";

describe("analyserDatePartie", () => {
  it("accepte une date passée", () => {
    const r = analyserDatePartie("2019-04-12T21:30");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.date.getFullYear()).toBe(2019);
  });

  it("accepte l'instant présent", () => {
    expect(analyserDatePartie(new Date().toISOString()).ok).toBe(true);
  });

  it("tolère une petite avance d'horloge", () => {
    // Le poste peut avoir deux minutes d'avance sur le serveur : ce n'est pas
    // une saisie dans le futur, c'est une horloge.
    const dansDeuxMinutes = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    expect(analyserDatePartie(dansDeuxMinutes).ok).toBe(true);
  });

  it("refuse demain", () => {
    const demain = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const r = analyserDatePartie(demain);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erreur).toMatch(/futur/);
  });

  it("refuse ce qui n'est pas une date", () => {
    expect(analyserDatePartie("hier soir").ok).toBe(false);
    expect(analyserDatePartie(null).ok).toBe(false);
    expect(analyserDatePartie(undefined).ok).toBe(false);
    expect(analyserDatePartie({}).ok).toBe(false);
  });
});
