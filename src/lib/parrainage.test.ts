import { decisionParrainage, LONGUEUR_CODE, normaliserCode, nouveauCode } from "@/lib/parrainage";

const CODE = "ABCD2345";

describe("ce qu'on fait d'un code reçu", () => {
  /**
   * La règle qui gouverne toutes les autres. Chaque cas fautif est éprouvé
   * séparément : les rassembler dirait « ça ne casse pas » sans dire lequel.
   */
  it.each([
    ["absent", undefined],
    ["absent", null],
    ["absent", ""],
    ["illisible", "trop-court"],
    ["illisible", "ABCD2345XXXX"],
    ["illisible", 42],
    ["illisible", { code: CODE }],
  ])("un code %s ne lie rien, et ne fait pas échouer l'inscription", (_, brut) => {
    expect(decisionParrainage(brut, { id: "parrain" }).quoi).toBe("ignore");
  });

  it("un code lisible que personne ne porte ne lie rien", () => {
    expect(decisionParrainage(CODE, null)).toEqual({ quoi: "ignore", raison: "inconnu" });
  });

  it("un code lisible et porté lie les deux comptes", () => {
    expect(decisionParrainage(CODE, { id: "parrain" }))
      .toEqual({ quoi: "lie", parrainId: "parrain" });
  });

  it("on ne se parraine pas soi-même", () => {
    expect(decisionParrainage(CODE, { id: "moi" }, "moi"))
      .toEqual({ quoi: "ignore", raison: "soi-meme" });
  });

  /**
   * Le code se lit comme on l'écrit : en minuscules, avec le tiret que les
   * gens ajoutent en le recopiant. Sans ça, un code parfaitement valide tapé
   * à la main ne lie rien et personne ne comprend pourquoi.
   */
  it("se lit en minuscules et avec un tiret, comme on le recopie", () => {
    expect(decisionParrainage("abcd-2345", { id: "p" }))
      .toEqual({ quoi: "lie", parrainId: "p" });
  });

  it("la raison de chaque refus est distincte : sinon on ne diagnostique rien", () => {
    const raisons = [
      decisionParrainage(undefined, null),
      decisionParrainage("xx", null),
      decisionParrainage(CODE, null),
      decisionParrainage(CODE, { id: "moi" }, "moi"),
    ].map((d) => (d.quoi === "ignore" ? d.raison : null));
    expect(raisons).toEqual(["absent", "illisible", "inconnu", "soi-meme"]);
  });
});

describe("le code lui-même", () => {
  it("réemploie celui des groupes plutôt que d'en écrire un second", () => {
    const code = nouveauCode();
    expect(code).toHaveLength(LONGUEUR_CODE);
    expect(normaliserCode(code)).toBe(code);
  });
});
