import { duree, horloge, secondesAnnoncees, seuilFranchi } from "./compteurDette";

describe("l'horloge du décompte", () => {
  it("écrit les minutes et les secondes", () => {
    expect(horloge(272)).toBe("4:32");
    expect(horloge(60)).toBe("1:00");
    expect(horloge(5)).toBe("0:05");
  });

  /**
   * L'arrondi va vers le HAUT, à la différence de la durée. Un décompte qui
   * affiche « 0:00 » alors qu'il reste une demi-seconde ment sur ce qui reste,
   * et c'est la seconde où l'on relâche l'effort.
   */
  it("arrondit vers le haut", () => {
    expect(horloge(0.4)).toBe("0:01");
    expect(horloge(59.1)).toBe("1:00");
    expect(horloge(0)).toBe("0:00");
  });

  it("ne descend jamais sous zéro", () => {
    // Une horloge négative n'existe pas, et le chrono peut déborder.
    expect(horloge(-30)).toBe("0:00");
  });
});

describe("la durée d'un libellé", () => {
  it("donne des secondes sous la minute", () => {
    // « 0 min 45 » se lit comme une erreur d'affichage.
    expect(duree(45)).toBe("45 s");
    expect(duree(0)).toBe("0 s");
    expect(duree(59)).toBe("59 s");
  });

  it("passe aux minutes à partir de soixante secondes", () => {
    expect(duree(60)).toBe("1 min");
    expect(duree(320)).toBe("5 min 20");
  });

  it("écrit les secondes sur deux chiffres", () => {
    // Sans le remplissage, « 5 min 7 » se lit comme cinq minutes et sept
    // minutes.
    expect(duree(307)).toBe("5 min 07");
  });

  it("tait les secondes quand il n'y en a pas", () => {
    expect(duree(600)).toBe("10 min");
  });

  it("ne rend jamais de durée négative", () => {
    expect(duree(-10)).toBe("0 s");
  });
});

describe("le seuil de séance", () => {
  it("prévient quand la dette atteint le seuil", () => {
    expect(seuilFranchi({ dureeSec: 300, seuilSec: 300 })).toBe(true);
    expect(seuilFranchi({ dureeSec: 301, seuilSec: 300 })).toBe(true);
  });

  it("se tait en dessous", () => {
    expect(seuilFranchi({ dureeSec: 299, seuilSec: 300 })).toBe(false);
  });

  /**
   * Un seuil à zéro veut dire « pas de seuil », pas « préviens tout de
   * suite ». Sans cette distinction, un compte qui n'a rien réglé recevrait
   * une notification à la première seconde due.
   */
  it("ne prévient pas quand aucun seuil n'est réglé", () => {
    expect(seuilFranchi({ dureeSec: 3600, seuilSec: 0 })).toBe(false);
  });

  it("ne prévient pas sans dette", () => {
    expect(seuilFranchi(null)).toBe(false);
  });
});

/**
 * Le décompte compte ce que l'écran a annoncé.
 *
 * La pastille et l'en-tête de la fenêtre affichent une quantité convertie côté
 * navigateur et arrondie au pas de l'exercice — cinq secondes pour la boxe. Le
 * décompte partait de `dureeSec`, calculé au serveur à la seconde près : les
 * deux nombres décrivent la même dette et ne tombaient jamais tout à fait
 * pareil.
 */
describe("les secondes annoncées", () => {
  it("compte ce que l'écran affiche, pas la durée du serveur", () => {
    // La pastille annonce 75 s ; `dureeSec` en vaut 77. C'est le nombre
    // annoncé qu'on décompte, sinon le chrono démarre au-dessus de sa
    // propre étiquette.
    expect(secondesAnnoncees([{ secondes: 75 }], 77)).toBe(75);
  });

  it("additionne les exercices quand la dette est partagée", () => {
    expect(secondesAnnoncees([{ secondes: 75 }, { secondes: 20 }], 999)).toBe(95);
  });

  it("retombe sur la durée du serveur quand rien n'est ventilé", () => {
    // Mieux vaut un décompte que pas de décompte : le repli existe pour ça.
    expect(secondesAnnoncees([], 77)).toBe(77);
  });

  it("ne rend jamais de durée négative", () => {
    expect(secondesAnnoncees([], -10)).toBe(0);
  });
});
