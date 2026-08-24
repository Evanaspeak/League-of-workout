import { lireResultat } from "./riotResultat";

/** Une réponse Riot saine, dont on fait varier une pièce à la fois. */
const info = (equipes: unknown, extra: Record<string, unknown> = {}) =>
  ({ teams: equipes, ...extra });
const EQUIPES = [
  { teamId: 100, win: true },
  { teamId: 200, win: false },
];

describe("le résultat d'une partie Riot", () => {
  it("lit une victoire quand les deux sources s'accordent", () => {
    expect(lireResultat(info(EQUIPES), { teamId: 100, win: true }))
      .toEqual({ resultat: "V" });
  });

  it("lit une défaite quand les deux sources s'accordent", () => {
    expect(lireResultat(info(EQUIPES), { teamId: 200, win: false }))
      .toEqual({ resultat: "D" });
  });

  /**
   * Le cas qui coûtait de la dette : `undefined ? "V" : "D"` rendait
   * « défaite » pour une victoire dont le champ n'était pas arrivé.
   */
  it("se rabat sur l'équipe quand le participant n'a pas de résultat", () => {
    expect(lireResultat(info(EQUIPES), { teamId: 100 }))
      .toEqual({ resultat: "V" });
  });

  it("se rabat sur le participant quand les équipes sont inexploitables", () => {
    expect(lireResultat(info(undefined), { teamId: 100, win: true }))
      .toEqual({ resultat: "V" });
    expect(lireResultat(info([{ teamId: 100 }]), { teamId: 100, win: true }))
      .toEqual({ resultat: "V" });
  });

  it("ne devine pas quand aucune source ne dit rien", () => {
    expect(lireResultat(info(undefined), { teamId: 100 }))
      .toEqual({ resultat: null, motif: "inconnu" });
  });

  it("refuse de trancher quand les deux sources se contredisent", () => {
    expect(lireResultat(info(EQUIPES), { teamId: 100, win: false }))
      .toEqual({ resultat: null, motif: "desaccord" });
  });

  /**
   * Riot met `win: false` aux dix joueurs d'un remake. Les deux sources
   * s'accordent donc parfaitement, et le contrôle de désaccord ne peut pas
   * l'attraper : c'est pour ça que le remake se lit en premier.
   */
  describe("le remake", () => {
    it("n'est ni victoire ni défaite, drapeau porté par le participant", () => {
      expect(lireResultat(
        info([{ teamId: 100, win: false }, { teamId: 200, win: false }]),
        { teamId: 100, win: false, gameEndedInEarlySurrender: true },
      )).toEqual({ resultat: null, motif: "remake" });
    });

    it("se lit aussi quand le drapeau est sur la partie", () => {
      expect(lireResultat(
        info(EQUIPES, { gameEndedInEarlySurrender: true }),
        { teamId: 100, win: true },
      )).toEqual({ resultat: null, motif: "remake" });
    });

    it("passe avant le désaccord, qui serait aveugle à ce cas", () => {
      // Sans la priorité, ce cas ressortirait « desaccord » et non « remake ».
      expect(lireResultat(
        info(EQUIPES, { gameEndedInEarlySurrender: true }),
        { teamId: 100, win: false },
      )).toEqual({ resultat: null, motif: "remake" });
    });
  });

  /**
   * Le drapeau ne se lit pas comme un booléen souple : `"false"` est une
   * chaîne, et une chaîne non vide est vraie. Un remake inventé refuserait
   * d'enregistrer des parties bien réelles.
   */
  it("n'accepte comme drapeau de remake que le booléen vrai", () => {
    expect(lireResultat(info(EQUIPES), {
      teamId: 100, win: true, gameEndedInEarlySurrender: "false",
    })).toEqual({ resultat: "V" });
  });
});
