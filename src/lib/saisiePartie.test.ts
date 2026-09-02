import { dureeEnSecondes, saisieComplete, type SaisiePartie } from "./saisiePartie";

const TOUT = { champions: true, kda: true, br: false };
const base = (champs: Partial<SaisiePartie> = {}): SaisiePartie => ({
  typeJeu: "parties", jeu: "League of Legends", dureeSec: 0,
  capacites: TOUT, champion: "Ahri", championValide: true,
  kills: "5", deaths: "3", assists: "7", placement: "",
  ...champs,
});

describe("la durée d'une séance au temps", () => {
  it("additionne heures et minutes", () => {
    expect(dureeEnSecondes("2", "30")).toBe(9000);
    expect(dureeEnSecondes("", "45")).toBe(2700);
    expect(dureeEnSecondes("1", "")).toBe(3600);
  });

  it("traite un champ illisible comme un champ vide", () => {
    // Un champ vide vaut zéro heure : c'est le bon comportement ici. Les
    // valeurs aberrantes, elles, sont refusées par le serveur (`bornesSaisie`),
    // et c'est à lui de le faire — pas au bouton d'enregistrement.
    expect(dureeEnSecondes("abc", "10")).toBe(600);
    expect(dureeEnSecondes("", "")).toBe(0);
  });

  it("ne laisse pas passer un infini", () => {
    // `Number("1e999")` vaut l'infini, et `Infinity || 0` le garde : la durée
    // partait telle quelle vers l'aperçu.
    expect(dureeEnSecondes("1e999", "0")).toBe(0);
    expect(dureeEnSecondes("0", "-Infinity")).toBe(0);
  });
});

describe("une séance au temps", () => {
  const seance = (champs: Partial<SaisiePartie> = {}) =>
    base({ typeJeu: "temps", jeu: "Minecraft", dureeSec: 3600, ...champs });

  it("ne demande qu'un jeu et une durée", () => {
    // Ni score, ni champion, ni classement : les exiger éteindrait le bouton
    // pour toujours sur les jeux qui n'en ont pas.
    expect(saisieComplete(seance({
      champion: "", championValide: false, kills: "", deaths: "", assists: "",
    }))).toBe(true);
  });

  it("refuse une durée nulle", () => {
    expect(saisieComplete(seance({ dureeSec: 0 }))).toBe(false);
  });

  it("refuse un jeu vide, espaces compris", () => {
    expect(saisieComplete(seance({ jeu: "   " }))).toBe(false);
  });
});

describe("une partie", () => {
  it("s'enregistre quand tout est là", () => {
    expect(saisieComplete(base())).toBe(true);
  });

  it("accepte un champion vide, et refuse un champion inconnu", () => {
    // Le champ est facultatif : exiger un nom obligerait à en inventer un.
    // Renseigné, il doit être reconnu — c'est ce champ qui décide de la
    // maîtrise, donc du coût de la partie.
    expect(saisieComplete(base({ champion: "", championValide: false }))).toBe(true);
    expect(saisieComplete(base({ champion: "Ahrii", championValide: false }))).toBe(false);
  });

  it("exige les trois nombres du KDA quand le jeu en a un", () => {
    for (const manquant of ["kills", "deaths", "assists"] as const) {
      expect(saisieComplete(base({ [manquant]: "" }))).toBe(false);
    }
    // Zéro est une valeur, pas une absence : mourir zéro fois se saisit.
    expect(saisieComplete(base({ kills: "0", deaths: "0", assists: "0" }))).toBe(true);
  });

  it("ignore le KDA et le champion sur un jeu qui n'en a pas", () => {
    // Rocket League n'a pas même de KDA : demander trois nombres qu'aucun
    // champ n'affiche éteindrait le bouton sans rien dire.
    expect(saisieComplete(base({
      capacites: { champions: false, kda: false, br: false },
      jeu: "Rocket League", champion: "", championValide: false,
      kills: "", deaths: "", assists: "",
    }))).toBe(true);
  });

  it("exige un classement à partir de un en battle royale", () => {
    const br = (placement: string) => saisieComplete(base({
      capacites: { champions: false, kda: true, br: true },
      jeu: "Apex Legends", champion: "", championValide: false, placement,
    }));
    expect(br("")).toBe(false);
    // « Zéro » n'est pas une place, et un classement négatif offrait la partie
    // avant que les bornes de saisie n'existent.
    expect(br("0")).toBe(false);
    expect(br("-3")).toBe(false);
    expect(br("1")).toBe(true);
    expect(br("57")).toBe(true);
  });

  it("refuse un jeu vide", () => {
    expect(saisieComplete(base({ jeu: "" }))).toBe(false);
  });
});
