/**
 * Quel fichier sert de logo, quand plusieurs formats du même jeu coexistent.
 *
 * L'ordre est une préférence de QUALITÉ — vectoriel, puis WebP, puis PNG — et
 * elle est écrite dans le module sans que rien ne la tienne. Le cas où ça se
 * voit est précis : un jeu dont on a récupéré un SVG propre ET un PNG hérité
 * de la première version. Si le PNG l'emporte, la bande des jeux de l'accueil
 * s'affiche floue à l'agrandissement, et rien ne le signale — les deux
 * fichiers sont là, l'image se charge.
 *
 * `readdirSync` est doublé : ce qu'on éprouve est le TRI, pas le disque.
 */
jest.mock("node:fs", () => ({ readdirSync: jest.fn() }));
import { readdirSync } from "node:fs";
import { logosDisponibles } from "@/lib/logosJeux";

const lire = readdirSync as unknown as jest.Mock;
beforeEach(() => lire.mockReset());

describe("logosDisponibles", () => {
  it("range chaque fichier sous le code de son jeu", () => {
    lire.mockReturnValue(["lol.svg", "valorant.webp", "apex.png"]);
    expect(logosDisponibles()).toEqual({
      lol: "lol.svg", valorant: "valorant.webp", apex: "apex.png",
    });
  });

  /** Le cœur : le vectoriel passe devant, quel que soit l'ordre du dossier. */
  it("préfère le SVG au WebP et au PNG", () => {
    lire.mockReturnValue(["lol.png", "lol.webp", "lol.svg"]);
    expect(logosDisponibles()).toEqual({ lol: "lol.svg" });
  });

  it("préfère le WebP au PNG faute de SVG", () => {
    lire.mockReturnValue(["lol.png", "lol.webp"]);
    expect(logosDisponibles()).toEqual({ lol: "lol.webp" });
  });

  /** Ce qui n'est pas une image ne devient pas un logo. */
  it("ignore les fichiers d'un autre format", () => {
    lire.mockReturnValue(["lol.svg", "README.md", "sources.txt", ".gitkeep"]);
    expect(logosDisponibles()).toEqual({ lol: "lol.svg" });
  });

  /**
   * Dossier absent : la bande garde ses glyphes. C'est le cas nominal tant
   * qu'aucun logo n'a été déposé, pas une panne — la page doit s'afficher.
   */
  it("rend une liste vide quand le dossier n'existe pas", () => {
    lire.mockImplementation(() => { throw new Error("ENOENT"); });
    expect(logosDisponibles()).toEqual({});
  });

  it("rend une liste vide sur un dossier vide", () => {
    lire.mockReturnValue([]);
    expect(logosDisponibles()).toEqual({});
  });
});
