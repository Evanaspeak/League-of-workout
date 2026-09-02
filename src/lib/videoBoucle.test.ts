/**
 * La vidéo de démonstration, et l'ordre dans lequel on propose ses formats.
 *
 * Elle n'existe pas encore : le module rend `null` et la page joue la version
 * dessinée. C'est précisément pourquoi ce test compte — le jour où le fichier
 * arrive, personne ne relira ce module, et une inversion des deux formats ne
 * casserait rien de visible. Elle ferait juste télécharger le MP4 à tout le
 * monde, y compris aux navigateurs qui savent lire le WebM, qui pèse nettement
 * moins.
 *
 * La présence est constatée au CHARGEMENT du module — c'est voulu, la page est
 * rendue à la construction — donc chaque cas doit réimporter le module après
 * avoir posé son disque.
 */
jest.mock("node:fs", () => ({ existsSync: jest.fn() }));
import { existsSync } from "node:fs";

const present = existsSync as unknown as jest.Mock;

/** Charge le module en lui donnant le disque décrit par `fichiers`. */
function avecDisque(fichiers: string[]) {
  present.mockReset();
  present.mockImplementation((c: string) => fichiers.some((f) => c.endsWith(f)));
  let mod!: typeof import("@/lib/videoBoucle");
  jest.isolateModules(() => { mod = require("@/lib/videoBoucle"); });
  return mod.videoBoucle();
}

describe("videoBoucle", () => {
  /** L'état d'aujourd'hui : aucun fichier déposé, aucune balise posée. */
  it("rend null tant qu'aucune vidéo n'est déposée", () => {
    expect(avecDisque([])).toBeNull();
  });

  it("rend null quand il n'y a qu'une affiche, sans vidéo", () => {
    expect(avecDisque(["boucle.jpg"])).toBeNull();
  });

  /** Le cœur : le WebM passe devant, à qualité égale il pèse nettement moins. */
  it("propose le WebM avant le MP4", () => {
    expect(avecDisque(["boucle.mp4", "boucle.webm"])?.sources).toEqual([
      { src: "/videos/boucle.webm", type: "video/webm" },
      { src: "/videos/boucle.mp4", type: "video/mp4" },
    ]);
  });

  it("se contente du MP4 quand c'est le seul format", () => {
    expect(avecDisque(["boucle.mp4"])?.sources).toEqual([
      { src: "/videos/boucle.mp4", type: "video/mp4" },
    ]);
  });

  it("prend la première affiche disponible dans l'ordre déclaré", () => {
    expect(avecDisque(["boucle.mp4", "boucle.png", "boucle.webp"])?.affiche)
      .toBe("/videos/boucle.png");
    expect(avecDisque(["boucle.mp4", "boucle.webp"])?.affiche)
      .toBe("/videos/boucle.webp");
  });

  /** Une vidéo sans affiche reste une vidéo : c'est l'affiche qui manque. */
  it("rend la vidéo sans affiche quand il n'y en a pas", () => {
    const v = avecDisque(["boucle.webm"]);
    expect(v?.affiche).toBeNull();
    expect(v?.sources).toHaveLength(1);
  });
});
