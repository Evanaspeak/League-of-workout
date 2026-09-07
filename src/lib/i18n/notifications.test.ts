import { langueDuCompte, rangDuJour, textesNotification } from "./notifications";
import { LANGUES } from "./langues";

/** Trois jours qui se suivent, donc trois formulations différentes. */
const JOURS = ["2026-09-07", "2026-09-08", "2026-09-09"];

describe("langue du compte", () => {
  it("retient les six langues", () => {
    for (const l of LANGUES) expect(langueDuCompte(l)).toBe(l);
  });

  it("retombe sur l'anglais et non sur le français", () => {
    // Le défaut français envoyait des notifications françaises à des gens qui
    // n'avaient jamais vu un écran français.
    for (const rebut of [null, undefined, "", "it", 42, {}]) {
      expect(langueDuCompte(rebut)).toBe("en");
    }
  });
});

describe("textes de notification", () => {
  it("existent dans les six langues, dans TOUTES leurs formulations", () => {
    /**
     * Le balayage porte sur les trois jours, et c'est ce qui a changé.
     *
     * N'éprouver que la formulation du jour reviendrait à ne garder qu'un
     * tiers des textes : les deux autres pourraient perdre leur durée, leur
     * titre ou leur traduction sans que rien ne tombe, et elles partiraient
     * un jour sur trois.
     */
    for (const l of LANGUES) {
      for (const jour of JOURS) {
        for (const cle of ["seuil", "matin"] as const) {
          const t = textesNotification(l, jour)[cle]("5 min");
          expect(t.titre.trim()).not.toBe("");
          expect(t.corps).toContain("5 min");
        }
        const r = textesNotification(l, jour).relance(21);
        expect(r.titre).toContain("21");
        expect(r.corps.trim()).not.toBe("");
        expect(textesNotification(l, jour).pesee().corps.trim()).not.toBe("");
        // Pas de longueur minimale : un titre chinois tient en trois
        // caractères, et un seuil en nombre de signes aurait refusé une
        // traduction juste.
      }
    }
  });

  it("disent six choses différentes", () => {
    // Une langue qui retomberait silencieusement sur une autre passerait le
    // contrôle ci-dessus sans qu'on s'en aperçoive.
    for (const jour of JOURS) {
      for (const cle of ["seuil", "matin"] as const) {
        const vus = LANGUES.map((l) => textesNotification(l, jour)[cle]("5 min").corps);
        expect(new Set(vus).size).toBe(LANGUES.length);
      }
      const relances = LANGUES.map((l) => textesNotification(l, jour).relance(21).corps);
      expect(new Set(relances).size).toBe(LANGUES.length);
    }
  });

  it("ne disent pas la même chose le soir et le matin", () => {
    // Le rappel du matin existe pour dire autre chose que le rappel du seuil :
    // recopier le second dans le premier ferait deux notifications identiques.
    for (const l of LANGUES) {
      for (const jour of JOURS) {
        const t = textesNotification(l, jour);
        expect(t.matin("5 min").corps).not.toBe(t.seuil("5 min").corps);
      }
    }
  });

  it("ne félicitent ni n'encouragent, dans aucune formulation", () => {
    // Le ton est celui du reste de l'application : direct, sans moquerie et
    // sans encouragement de façade. C'est la VOIX du produit, et la variété
    // demandée par la réponse 100 ne l'autorise pas à changer.
    for (const l of LANGUES) {
      for (const jour of JOURS) {
        const t = textesNotification(l, jour);
        const tout = [t.seuil("5 min"), t.matin("5 min"), t.relance(21), t.pesee()]
          .map((n) => `${n.titre} ${n.corps}`).join(" ");
        expect(tout).not.toMatch(/bravo|super|génial|well done|keep it up|加油|頑張/i);
      }
    }
  });
});

/**
 * La variété, qui est ce que la ligne 100 demande.
 *
 * « Elles sont fades » ne reproche pas la voix : un texte juste devient fade
 * parce qu'on le reçoit mot pour mot tous les matins. À la troisième fois on
 * ne le lit plus, à la cinquième on coupe le canal.
 */
describe("trois formulations, et jamais deux fois la même de suite", () => {
  it("changent d'un jour à l'autre, dans les six langues", () => {
    for (const l of LANGUES) {
      for (const cle of ["seuil", "matin"] as const) {
        const vus = JOURS.map((j) => textesNotification(l, j)[cle]("5 min").corps);
        // Trois jours consécutifs, trois textes distincts : c'est la promesse
        // que le rang tiré du jour permet de tenir sans rien ranger.
        expect(new Set(vus).size).toBe(3);
      }
      const relances = JOURS.map((j) => textesNotification(l, j).relance(21).corps);
      expect(new Set(relances).size).toBe(3);
      const pesees = JOURS.map((j) => textesNotification(l, j).pesee().corps);
      expect(new Set(pesees).size).toBe(3);
    }
  });

  it("ne se répètent jamais deux jours de suite, sur une année entière", () => {
    /**
     * Le témoin de la propriété, et pas d'un exemple : deux jours consécutifs
     * ont des numéros qui se suivent, donc des restes qui se suivent. Un
     * tirage au hasard tomberait une fois sur trois sur le même texte, ce qui
     * est exactement ce qu'on corrige.
     */
    let veille = -1;
    let tours = 0;
    const d = new Date(Date.UTC(2026, 0, 1));
    for (let i = 0; i < 365; i++) {
      const jour = d.toISOString().slice(0, 10);
      const r = rangDuJour(jour, 3);
      expect(r).not.toBe(veille);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(3);
      veille = r;
      tours += 1;
      d.setUTCDate(d.getUTCDate() + 1);
    }
    // Sans ce compte, une boucle vidée rendrait le contrôle vert sur zéro jour.
    expect(tours).toBe(365);
  });

  it("couvrent les trois rangs plutôt que d'en préférer un", () => {
    const vus = new Set<number>();
    const d = new Date(Date.UTC(2026, 0, 1));
    for (let i = 0; i < 10; i++) {
      vus.add(rangDuJour(d.toISOString().slice(0, 10), 3));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    expect([...vus].sort()).toEqual([0, 1, 2]);
  });

  it("rendent zéro plutôt que NaN sur un jour illisible", () => {
    /**
     * Une notification qui ne part pas parce qu'une date était mal écrite
     * serait une panne bien plus chère que la répétition qu'on corrige. Et
     * `NaN` en indice de tableau rend `undefined`, donc un appel de fonction
     * sur rien : le canal entier tomberait.
     */
    for (const rebut of ["", "hier", "2026-9-7", "9999-99-99xx", "2026/09/07"]) {
      expect(rangDuJour(rebut, 3)).toBe(0);
    }
    // Et un tableau vide ne fait pas diviser par zéro.
    expect(rangDuJour("2026-09-07", 0)).toBe(0);
  });

  it("et la formulation d'un jour illisible reste utilisable", () => {
    // Le repli n'est pas seulement « pas de plantage » : le texte rendu doit
    // être un vrai texte, pas une case vide.
    for (const l of LANGUES) {
      const t = textesNotification(l, "pas une date");
      expect(t.seuil("5 min").corps).toContain("5 min");
      expect(t.pesee().titre.trim()).not.toBe("");
    }
  });
});
