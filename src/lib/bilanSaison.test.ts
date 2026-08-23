import { calculerBilan, JOURS_SAISON, type PartieBilan } from "./bilanSaison";

/**
 * Le bilan de saison.
 *
 * Ce sont des chiffres qu'on met sur une image et qu'on montre à quelqu'un :
 * ils n'ont pas le droit d'être approximatifs, et personne ne les recalculera
 * pour vérifier.
 */

const jourDe = (d: Date) => d.toISOString().slice(0, 10);

const partie = (champs: Partial<PartieBilan> = {}): PartieBilan => ({
  date: new Date("2026-06-01T12:00:00Z"),
  result: "D",
  pompesCalculees: 20,
  jeu: "League of Legends",
  champion: "Ahri",
  ...champs,
});

const bilan = (parties: PartieBilan[], paiements: { points: number; jour: string }[] = []) =>
  calculerBilan(parties, paiements, "2026-06-01", "2026-08-30", jourDe);

describe("les totaux", () => {
  test("compte les parties, les victoires et le taux", () => {
    const b = bilan([
      partie({ result: "V" }), partie({ result: "V" }), partie({ result: "D" }), partie({ result: "D" }),
    ]);
    expect(b.parties).toBe(4);
    expect(b.victoires).toBe(2);
    expect(b.winrate).toBe(50);
  });

  test("sans partie, il n'y a pas de taux plutôt qu'un taux de zéro", () => {
    // Zéro pour cent se lit comme « il a tout perdu ». Il n'a rien joué.
    expect(bilan([]).winrate).toBeNull();
  });

  test("additionne l'effort produit et l'effort payé séparément", () => {
    const b = bilan(
      [partie({ pompesCalculees: 30 }), partie({ pompesCalculees: 12 })],
      [{ points: 25, jour: "2026-06-01" }],
    );
    expect(b.pointsDus).toBe(42);
    expect(b.pointsPayes).toBe(25);
  });

  test("ignore un coût négatif plutôt que de le soustraire", () => {
    // Aucun chemin ne devrait en produire ; si l'un le fait, un bilan qui
    // affiche moins que zéro est pire qu'un bilan qui l'ignore.
    expect(bilan([partie({ pompesCalculees: -50 }), partie({ pompesCalculees: 10 })]).pointsDus).toBe(10);
  });
});

describe("les jours", () => {
  test("compte les jours distincts où quelque chose a été payé", () => {
    const b = bilan([], [
      { points: 10, jour: "2026-06-01" },
      { points: 5, jour: "2026-06-01" },
      { points: 8, jour: "2026-06-03" },
    ]);
    expect(b.joursActifs).toBe(2);
  });

  test("un paiement de zéro point ne fait pas un jour actif", () => {
    expect(bilan([], [{ points: 0, jour: "2026-06-01" }]).joursActifs).toBe(0);
  });

  test("trouve la plus longue suite de jours consécutifs", () => {
    const b = bilan([], [
      { points: 1, jour: "2026-06-01" },
      { points: 1, jour: "2026-06-02" },
      { points: 1, jour: "2026-06-03" },
      { points: 1, jour: "2026-06-08" },
    ]);
    expect(b.meilleureSerie).toBe(3);
  });

  test("désigne la journée la plus chère", () => {
    const b = bilan([
      partie({ date: new Date("2026-06-01T10:00:00Z"), pompesCalculees: 30 }),
      partie({ date: new Date("2026-06-02T10:00:00Z"), pompesCalculees: 40 }),
      partie({ date: new Date("2026-06-02T22:00:00Z"), pompesCalculees: 35 }),
    ]);
    expect(b.pireJour).toEqual({ jour: "2026-06-02", points: 75 });
  });

  test("sans journée coûteuse, il n'y en a pas", () => {
    expect(bilan([partie({ pompesCalculees: 0 })]).pireJour).toBeNull();
    expect(bilan([]).pireJour).toBeNull();
  });

  test("le jour vient de la fonction passée, jamais de l'heure UTC", () => {
    // Une partie jouée à une heure du matin à Paris est du jour précédent en
    // UTC. Le bilan doit suivre le fuseau de la personne, pas celui du serveur.
    const b = calculerBilan(
      [partie({ date: new Date("2026-06-02T01:00:00Z"), pompesCalculees: 10 })],
      [], "2026-06-01", "2026-08-30",
      () => "2026-06-01",
    );
    expect(b.pireJour?.jour).toBe("2026-06-01");
  });
});

describe("le jeu et le champion les plus joués", () => {
  test("désignent le plus fréquent", () => {
    const b = bilan([
      partie({ jeu: "Valorant", champion: "Jett" }),
      partie({ jeu: "Valorant", champion: "Sage" }),
      partie({ jeu: "League of Legends", champion: "Ahri" }),
    ]);
    expect(b.jeuPrincipal).toEqual({ nom: "Valorant", parties: 2 });
    expect(b.championPrincipal?.parties).toBe(1);
  });

  test("ignorent les parties sans nom", () => {
    const b = bilan([partie({ champion: null }), partie({ champion: null }), partie({ champion: "Ahri" })]);
    expect(b.championPrincipal).toEqual({ nom: "Ahri", parties: 1 });
  });

  test("rendent le même résultat deux fois de suite à égalité", () => {
    // Un bilan qui change d'une lecture à l'autre sur les mêmes données est un
    // bilan auquel on ne peut pas se fier.
    const parties = [partie({ jeu: "A" }), partie({ jeu: "B" })];
    expect(bilan(parties).jeuPrincipal).toEqual(bilan(parties).jeuPrincipal);
  });

  test("sans aucune partie nommée, il n'y a pas de principal", () => {
    expect(bilan([partie({ jeu: null, champion: null })]).jeuPrincipal).toBeNull();
  });
});

test("la saison dure quatre-vingt-dix jours", () => {
  // L'ordre de grandeur d'un split classé. Ce n'est pas la vraie date de fin
  // de saison : l'application suit une quinzaine de jeux, pas un seul.
  expect(JOURS_SAISON).toBe(90);
});
