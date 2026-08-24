// Ce que les deux lectures locales doivent rendre, et surtout ce qu'elles ne
// doivent JAMAIS rendre : un résultat qu'elles n'ont pas lu.

const {
  issueDeLEvenement,
  issueDeFinDePartie,
  fusionnerReleve,
} = require("./issueLocale");

const evenements = (liste: unknown[]) => ({ events: { Events: liste } });

describe("l'événement de fin de l'API de partie", () => {
  it("lit une victoire", () => {
    expect(issueDeLEvenement(evenements([{ EventName: "GameEnd", Result: "Win" }])))
      .toEqual({ resultat: "V", motif: null });
  });

  it("lit une défaite", () => {
    expect(issueDeLEvenement(evenements([{ EventName: "GameEnd", Result: "Lose" }])))
      .toEqual({ resultat: "D", motif: null });
  });

  it("ne conclut rien quand l'événement n'est pas encore publié", () => {
    expect(issueDeLEvenement(evenements([{ EventName: "ChampionKill" }])))
      .toEqual({ resultat: null, motif: "inconnu" });
  });

  it("ne conclut rien sur une valeur qu'elle ne connaît pas", () => {
    // Le repli d'avant rangeait tout ce qui n'était pas « Win » du côté
    // défaite : un changement de vocabulaire chez Riot aurait fait payer
    // toutes les parties.
    expect(issueDeLEvenement(evenements([{ EventName: "GameEnd", Result: "Surrender" }])))
      .toEqual({ resultat: null, motif: "inconnu" });
  });

  it("ne tombe pas sur une réponse vide", () => {
    expect(issueDeLEvenement(null).resultat).toBeNull();
    expect(issueDeLEvenement({}).resultat).toBeNull();
  });
});

describe("l'écran de fin du lanceur", () => {
  const bloc = (partiel: Record<string, unknown>) => ({
    teams: [{ isPlayerTeam: false, isWinningTeam: false }, { isPlayerTeam: true, isWinningTeam: true }],
    localPlayer: { stats: { WIN: 1 } },
    ...partiel,
  });

  it("lit une victoire quand les deux sources s'accordent", () => {
    expect(issueDeFinDePartie(bloc({}))).toEqual({ resultat: "V", motif: null });
  });

  it("lit une défaite quand les deux sources s'accordent", () => {
    expect(issueDeFinDePartie({
      teams: [{ isPlayerTeam: true, isWinningTeam: false }],
      localPlayer: { stats: { WIN: 0 } },
    })).toEqual({ resultat: "D", motif: null });
  });

  it("se contente d'une seule source quand l'autre manque", () => {
    expect(issueDeFinDePartie({ teams: [{ isPlayerTeam: true, isWinningTeam: true }] }))
      .toEqual({ resultat: "V", motif: null });
    expect(issueDeFinDePartie({ localPlayer: { stats: { WIN: 0 } } }))
      .toEqual({ resultat: "D", motif: null });
  });

  it("refuse de trancher quand les deux sources se contredisent", () => {
    expect(issueDeFinDePartie({
      teams: [{ isPlayerTeam: true, isWinningTeam: true }],
      localPlayer: { stats: { WIN: 0 } },
    })).toEqual({ resultat: null, motif: "desaccord" });
  });

  it("appelle un remake un remake, et pas une défaite", () => {
    expect(issueDeFinDePartie({
      teams: [{ isPlayerTeam: true, isWinningTeam: false }],
      localPlayer: { stats: { WIN: 0, GAME_ENDED_IN_EARLY_SURRENDER: 1 } },
    })).toEqual({ resultat: null, motif: "remake" });
  });

  it("lit les drapeaux écrits en texte sans se tromper de sens", () => {
    // `Boolean("0")` vaut vrai : une défaite écrite « 0 » passerait pour une
    // victoire si on convertissait à la légère.
    expect(issueDeFinDePartie({ localPlayer: { stats: { WIN: "0" } } }))
      .toEqual({ resultat: "D", motif: null });
    expect(issueDeFinDePartie({ localPlayer: { stats: { WIN: "1" } } }))
      .toEqual({ resultat: "V", motif: null });
  });

  it("ne conclut rien sur un bloc vide ou d'une autre forme", () => {
    expect(issueDeFinDePartie(null)).toEqual({ resultat: null, motif: "inconnu" });
    expect(issueDeFinDePartie({ teams: [] })).toEqual({ resultat: null, motif: "inconnu" });
    expect(issueDeFinDePartie({ teams: [{ isPlayerTeam: false, isWinningTeam: true }] }))
      .toEqual({ resultat: null, motif: "inconnu" });
  });
});

describe("le relevé gardé pour la fin de partie", () => {
  const score = { kills: 5, deaths: 2, assists: 7, cs: 100, champion: "Ahri" };

  it("garde l'issue une fois lue, même si le relevé suivant ne la porte plus", () => {
    // C'est la perte qui faisait enregistrer des victoires en défaites : un
    // seul relevé sans l'événement suffisait à effacer la lecture d'avant.
    const avec = fusionnerReleve(null, { dureeSec: 1800, score, resultat: "V" });
    const apres = fusionnerReleve(avec, { dureeSec: 1805, score, resultat: null });
    expect(apres.resultat).toBe("V");
  });

  it("ne remplace pas un relevé complet par un relevé sans score", () => {
    const avec = fusionnerReleve(null, { dureeSec: 1800, score, resultat: "V" });
    expect(fusionnerReleve(avec, { dureeSec: 1805, score: null, resultat: null })).toBe(avec);
  });

  it("prend bien la dernière durée et le dernier score", () => {
    const avec = fusionnerReleve(null, { dureeSec: 1800, score, resultat: null });
    const apres = fusionnerReleve(avec, { dureeSec: 1805, score: { ...score, kills: 6 }, resultat: "D" });
    expect(apres).toEqual({ dureeSec: 1805, score: { ...score, kills: 6 }, resultat: "D" });
  });
});
