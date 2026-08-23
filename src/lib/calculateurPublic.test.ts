import { calculerPublic } from "./calculateurPublic";
import { NIVEAUX_DEFAUT } from "./scoringDefaut";

/**
 * Le calculateur public.
 *
 * Il tourne sans compte et sans base, sur la configuration livrée avec
 * l'application. Ce qui est éprouvé ici, c'est qu'il ne ment pas : le chiffre
 * annoncé à un visiteur doit être celui qu'un compte neuf paierait vraiment.
 */

const BASE = { jeu: "League of Legends", pompesMax: 15, role: "Mid" as const };

describe("League of Legends", () => {
  it("une défaite coûte plus cher qu'une victoire, à statistiques égales", () => {
    const perdu = calculerPublic({ ...BASE, kills: 2, deaths: 9, assists: 4, result: "D" });
    const gagne = calculerPublic({ ...BASE, kills: 2, deaths: 9, assists: 4, result: "V" });
    expect(perdu.points).toBeGreaterThan(gagne.points);
  });

  it("mourir plus coûte plus", () => {
    const peu = calculerPublic({ ...BASE, kills: 5, deaths: 2, assists: 5, result: "D" });
    const beaucoup = calculerPublic({ ...BASE, kills: 5, deaths: 12, assists: 5, result: "D" });
    expect(beaucoup.points).toBeGreaterThan(peu.points);
  });

  it("le support paie moins qu'un ADC pour la même ligne de statistiques", () => {
    // C'est tout l'objet des poids par rôle, et c'est ce qu'un visiteur vient
    // vérifier : la réponse doit refléter le vrai barème, pas une moyenne.
    const stats = { kills: 1, deaths: 8, assists: 20, result: "D" as const };
    const support = calculerPublic({ ...BASE, role: "Support", ...stats });
    const adc = calculerPublic({ ...BASE, role: "ADC", ...stats });
    expect(support.points).toBeLessThan(adc.points);
  });

  it("le niveau vient du nombre de pompes d'affilée", () => {
    const debutant = calculerPublic({ ...BASE, pompesMax: 5, kills: 0, deaths: 8, assists: 0, result: "D" });
    const costaud = calculerPublic({ ...BASE, pompesMax: 60, kills: 0, deaths: 8, assists: 0, result: "D" });
    expect(debutant.niveau).toBe(1);
    expect(costaud.niveau).toBe(5);
    expect(costaud.points).toBeGreaterThan(debutant.points);
  });

  it("annonce le niveau et le multiplicateur du barème livré", () => {
    const r = calculerPublic({ ...BASE, kills: 0, deaths: 1, assists: 0, result: "D" });
    const attendu = NIVEAUX_DEFAUT.find((n) => n.niveau === r.niveau);
    expect(r.multiplicateur).toBe(attendu?.multiplicateur);
  });

  it("ne compte aucune surcharge de maîtrise", () => {
    // Un visiteur n'a pas d'historique. Annoncer une surcharge qu'il ne paiera
    // pas encore reviendrait à promettre plus cher que la réalité.
    const r = calculerPublic({ ...BASE, kills: 0, deaths: 10, assists: 0, result: "D" });
    const sansRole = calculerPublic({ ...BASE, role: "Mid", kills: 0, deaths: 10, assists: 0, result: "D" });
    expect(r.points).toBe(sansRole.points);
  });
});

describe("battle royale", () => {
  it("finir dernier coûte plus cher que finir premier", () => {
    const dernier = calculerPublic({ jeu: "Apex Legends", pompesMax: 15, placement: 20, kills: 0 });
    const premier = calculerPublic({ jeu: "Apex Legends", pompesMax: 15, placement: 1, kills: 0 });
    expect(dernier.points).toBeGreaterThan(premier.points);
  });

  it("les éliminations allègent la note", () => {
    const sans = calculerPublic({ jeu: "Apex Legends", pompesMax: 15, placement: 12, kills: 0 });
    const avec = calculerPublic({ jeu: "Apex Legends", pompesMax: 15, placement: 12, kills: 6 });
    expect(avec.points).toBeLessThan(sans.points);
  });
});

describe("Rocket League", () => {
  it("une victoire ne coûte rien", () => {
    const r = calculerPublic({ jeu: "Rocket League", pompesMax: 15, result: "V", kills: 0, arrets: 0, assists: 0 });
    expect(r.points).toBe(0);
  });
});

describe("jeux comptés au temps", () => {
  it("deux heures coûtent le double d'une heure, à l'arrondi près", () => {
    // L'arrondi porte sur le total, pas sur chaque heure : 33,4 puis 66,8
    // donnent 33 et 67, et non 33 et 66. Exiger le double exact ferait
    // échouer un calcul juste.
    const une = calculerPublic({ jeu: "Minecraft", pompesMax: 15, dureeSec: 3600 });
    const deux = calculerPublic({ jeu: "Minecraft", pompesMax: 15, dureeSec: 7200 });
    expect(Math.abs(deux.points - une.points * 2)).toBeLessThanOrEqual(1);
  });

  it("ne rend rien pour une durée nulle", () => {
    expect(calculerPublic({ jeu: "Minecraft", pompesMax: 15, dureeSec: 0 }).points).toBe(0);
  });
});

describe("saisies aberrantes", () => {
  it("ne rend jamais de nombre négatif ni de valeur non finie", () => {
    const cas = [
      { jeu: "League of Legends", pompesMax: -5, kills: -3, deaths: -2, assists: -1, result: "D" as const },
      { jeu: "Apex Legends", pompesMax: 0, placement: 0, joueurs: 0, kills: -1 },
      { jeu: "Minecraft", pompesMax: 15, dureeSec: -3600 },
    ];
    for (const saisie of cas) {
      const r = calculerPublic(saisie);
      expect(Number.isFinite(r.points)).toBe(true);
      expect(r.points).toBeGreaterThanOrEqual(0);
    }
  });

  it("retombe sur un rôle connu quand celui fourni n'existe pas", () => {
    const r = calculerPublic({ ...BASE, role: "Empereur", kills: 1, deaths: 5, assists: 1, result: "D" });
    expect(Number.isFinite(r.points)).toBe(true);
    expect(r.points).toBeGreaterThan(0);
  });
});
