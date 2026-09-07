import {
  compterDemandes, DEMANDES_MAX, examinerDemande, NOM_MAX, replier,
} from "./demandeJeu";

describe("la forme repliée d'un nom de jeu", () => {
  it("efface la casse, les accents et les blancs en trop", () => {
    // Sans ça, le compte de PERSONNES est faux : « apex » et « Apex » se
    // rangeraient séparément, et le même compte pourrait redemander
    // indéfiniment en changeant une majuscule.
    expect(replier("  Apex   Legends ")).toBe("apex legends");
    expect(replier("APEX LEGENDS")).toBe("apex legends");
    expect(replier("Pokémon")).toBe("pokemon");
  });
});

describe("ce qu'on accepte d'écrire", () => {
  it("refuse le vide et ce qui n'est pas du texte", () => {
    for (const cas of ["", "   ", null, 42, {}, []]) {
      expect(examinerDemande(cas)).toEqual({ ok: false, motif: "vide" });
    }
  });

  it("refuse un nom trop long", () => {
    expect(examinerDemande("x".repeat(NOM_MAX + 1)))
      .toEqual({ ok: false, motif: "trop long" });
    expect(examinerDemande("x".repeat(NOM_MAX)).ok).toBe(true);
  });

  it("refuse un jeu DÉJÀ au catalogue, quelle que soit sa graphie", () => {
    // La liste sert à décider quoi ajouter : la remplir de ce qu'on a déjà la
    // rendrait illisible, et la personne ne saurait pas qu'elle peut y jouer.
    for (const cas of ["League of Legends", "league of legends", " LEAGUE  OF LEGENDS "]) {
      expect(examinerDemande(cas)).toEqual({ ok: false, motif: "deja au catalogue" });
    }
  });

  it("accepte un jeu absent et rend ses deux formes", () => {
    expect(examinerDemande("  Dead by   Daylight "))
      .toEqual({ ok: true, nom: "Dead by Daylight", cle: "dead by daylight" });
  });

  it("plafonne à cinq demandes par compte", () => {
    // Le plafond remplace la modération : c'est la règle déjà posée pour les
    // demandes d'amitié.
    expect(DEMANDES_MAX).toBe(5);
  });
});

describe("le compte des demandes", () => {
  const l = (nom: string) => ({ nom, cle: replier(nom) });

  it("compte les personnes et range du plus réclamé au moins réclamé", () => {
    const r = compterDemandes([l("Fortnite"), l("fortnite"), l("Dead by Daylight"), l("FORTNITE")]);
    expect(r).toEqual([
      { nom: "Fortnite", personnes: 3 },
      { nom: "Dead by Daylight", personnes: 1 },
    ]);
  });

  it("montre la graphie la plus vue, pas la forme repliée", () => {
    const r = compterDemandes([l("fortnite"), l("Fortnite"), l("Fortnite")]);
    expect(r[0].nom).toBe("Fortnite");
  });

  it("départage les égalités par le nom, pour que l'ordre ne bouge pas", () => {
    // Un tableau qui se réordonne à chaque lecture se lit comme une donnée qui
    // change.
    const r = compterDemandes([l("Zelda"), l("Among Us")]);
    expect(r.map((x) => x.nom)).toEqual(["Among Us", "Zelda"]);
  });

  it("rend une liste vide sans rien inventer", () => {
    expect(compterDemandes([])).toEqual([]);
  });
});
