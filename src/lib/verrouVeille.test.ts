import { poserVeille, retirerVeille, veillePossible } from "./verrouVeille";

/**
 * Le verrou de veille.
 *
 * Ce module n'existe que pour une raison qu'on ne peut pas mesurer d'ici : un
 * téléphone s'éteint au bout de trente secondes, et une planche de cinq
 * minutes se fait alors devant un écran noir. Un Chromium sans tête ne s'endort
 * pas ; ce qui se prouve, c'est qu'aucun de ses chemins d'échec ne fait tomber
 * une séance.
 */

const navigateur = (wakeLock?: unknown) => ({ wakeLock }) as unknown as Navigator;

describe("veillePossible", () => {
  test("dit non quand le navigateur ne connaît pas l'API", () => {
    // Safari sur iPhone ne l'a que depuis la 16.4, et un navigateur de bureau
    // ancien pas du tout.
    expect(veillePossible(navigateur(undefined))).toBe(false);
    expect(veillePossible(undefined)).toBe(false);
  });

  test("dit non quand l'objet existe sans la méthode", () => {
    // Une API partiellement implémentée est un cas réel, et `Boolean(objet)`
    // suffirait à la déclarer disponible.
    expect(veillePossible(navigateur({}))).toBe(false);
  });

  test("dit oui quand la méthode est là", () => {
    expect(veillePossible(navigateur({ request: () => Promise.resolve({}) }))).toBe(true);
  });
});

describe("poserVeille", () => {
  test("demande le verrou de l'ÉCRAN", () => {
    const request = jest.fn().mockResolvedValue({ release: jest.fn() });
    return poserVeille(navigateur({ request })).then(() => {
      expect(request).toHaveBeenCalledWith("screen");
    });
  });

  /**
   * Un refus n'est pas une panne.
   *
   * Le navigateur refuse quand l'onglet passe en arrière-plan, quand la
   * batterie est basse, ou parce qu'il ne veut pas. On ne le dit à personne —
   * c'est un confort, pas une fonctionnalité — et surtout la séance ne doit
   * pas tomber avec lui.
   */
  test("rend null sur un refus, sans lever", async () => {
    const request = jest.fn().mockRejectedValue(new Error("NotAllowedError"));
    await expect(poserVeille(navigateur({ request }))).resolves.toBeNull();
  });

  test("rend null quand l'API n'existe pas", async () => {
    await expect(poserVeille(navigateur(undefined))).resolves.toBeNull();
    await expect(poserVeille(undefined)).resolves.toBeNull();
  });
});

describe("retirerVeille", () => {
  test("relâche ce qui a été posé", async () => {
    const release = jest.fn().mockResolvedValue(undefined);
    await retirerVeille({ release });
    expect(release).toHaveBeenCalled();
  });

  /**
   * Le navigateur relâche LUI-MÊME le verrou quand l'onglet passe en
   * arrière-plan : `release()` sur une sentinelle déjà relâchée rejette sur
   * certains navigateurs. Une séance ne peut pas tomber parce qu'on a rangé
   * son téléphone dans sa poche.
   */
  test("ne lève pas sur une sentinelle déjà relâchée", async () => {
    const release = jest.fn().mockRejectedValue(new Error("InvalidStateError"));
    await expect(retirerVeille({ release })).resolves.toBeUndefined();
  });

  test("ne fait rien quand rien n'a été posé", async () => {
    await expect(retirerVeille(null)).resolves.toBeUndefined();
  });
});
