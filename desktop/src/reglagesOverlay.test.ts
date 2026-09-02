
// Fait de ce fichier un MODULE : sans ça, TypeScript le traite comme un
// script et ses noms de premier niveau entrent dans la portée globale, où
// ils entrent en collision avec ceux d'un autre fichier de test. Jest ne
// s'en aperçoit pas — chaque fichier y a sa propre portée — c'est `tsc` qui
// le dit.
export {};
const {
  JEU_DEFAUT, overlayNeutre, overlayTable, overlayDuJeu, tableApresPatch,
} = require("./reglagesOverlay");

const COINS = ["haut-droite", "haut-gauche", "bas-droite", "bas-gauche"];

/**
 * Le placement est la seule chose qui puisse rendre la pastille invisible, et
 * la reprise de l'ancien format n'était éprouvée par rien.
 */
describe("la table des réglages de pastille", () => {
  it("reprend l'ancien format à plat comme défaut de tous les jeux", () => {
    // Une mise à jour ne doit pas déplacer la pastille de quelqu'un qui l'avait
    // rangée dans un coin : c'est le cas qui a motivé cette extraction.
    const table = overlayTable(
      { overlay: true, overlayCoin: "bas-gauche", overlayPosition: { x: 12, y: 40 } },
      COINS,
    );
    expect(table[JEU_DEFAUT]).toEqual({
      actif: true, coin: "bas-gauche", position: { x: 12, y: 40 },
    });
  });

  it("considère l'absence de réglage comme « pastille activée »", () => {
    // `!== false` et non `=== true` : quelqu'un qui n'a jamais rien réglé doit
    // voir la pastille, sinon la fonction principale du produit n'apparaît pas.
    expect(overlayTable({}, COINS)[JEU_DEFAUT].actif).toBe(true);
    expect(overlayTable({ overlay: false }, COINS)[JEU_DEFAUT].actif).toBe(false);
  });

  it("refuse un coin inventé et retombe sur le premier", () => {
    // Un fichier de réglages édité à la main peut dire n'importe quoi : un coin
    // inconnu poserait la pastille hors de tout écran.
    expect(overlayTable({ overlayCoin: "au-milieu" }, COINS)[JEU_DEFAUT].coin)
      .toBe("haut-droite");
  });

  it("ne réécrit pas le défaut quand il existe déjà", () => {
    const table = overlayTable(
      { overlayJeux: { [JEU_DEFAUT]: { actif: false, coin: "bas-droite", position: null } },
        overlay: true, overlayCoin: "haut-gauche" },
      COINS,
    );
    // L'ancien format ne doit pas écraser le nouveau : il ne sert qu'à combler.
    expect(table[JEU_DEFAUT]).toEqual({ actif: false, coin: "bas-droite", position: null });
  });

  it("ignore un overlayJeux qui n'est pas une table", () => {
    for (const bancal of [null, "oui", 42, []]) {
      const table = overlayTable({ overlayJeux: bancal }, COINS);
      expect(table[JEU_DEFAUT]).toBeDefined();
    }
  });
});

describe("le réglage d'un jeu", () => {
  const reglages = {
    overlayJeux: {
      [JEU_DEFAUT]: { actif: true, coin: "haut-droite", position: null },
      apex: { coin: "bas-gauche" },
    },
  };

  it("complète par le défaut ce que le jeu ne dit pas", () => {
    // Apex ne fixe que son coin : le reste vient du défaut, sinon régler un
    // coin désactiverait la pastille par effet de bord.
    expect(overlayDuJeu(reglages, COINS, "apex"))
      .toEqual({ actif: true, coin: "bas-gauche", position: null });
  });

  it("rend le défaut pour un jeu inconnu", () => {
    expect(overlayDuJeu(reglages, COINS, "un-jeu-jamais-vu").coin).toBe("haut-droite");
    expect(overlayDuJeu(reglages, COINS, null).coin).toBe("haut-droite");
  });

  it("part d'une base saine quand il n'y a aucun réglage", () => {
    expect(overlayDuJeu({}, COINS, "apex")).toEqual(overlayNeutre(COINS));
  });
});

describe("modifier un jeu", () => {
  it("ne touche qu'à lui", () => {
    const reglages = {
      overlayJeux: {
        [JEU_DEFAUT]: { actif: true, coin: "haut-droite", position: null },
        apex: { actif: true, coin: "bas-gauche", position: null },
      },
    };
    const table = tableApresPatch(reglages, COINS, "apex", { actif: false });
    expect(table.apex).toEqual({ actif: false, coin: "bas-gauche", position: null });
    expect(table[JEU_DEFAUT].actif).toBe(true);
  });

  it("range sous le défaut quand aucun jeu n'est désigné", () => {
    // Le réglage se fait parfois hors partie : il doit valoir pour la suite.
    const table = tableApresPatch({}, COINS, null, { coin: "bas-droite" });
    expect(table[JEU_DEFAUT].coin).toBe("bas-droite");
  });

  it("ne perd pas ce que le patch ne mentionne pas", () => {
    const reglages = { overlayJeux: { apex: { actif: true, coin: "bas-gauche", position: { x: 5, y: 9 } } } };
    const table = tableApresPatch(reglages, COINS, "apex", { coin: "haut-gauche" });
    expect(table.apex.position).toEqual({ x: 5, y: 9 });
    expect(table.apex.actif).toBe(true);
  });
});
