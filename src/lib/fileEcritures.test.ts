import { creerFile } from "./fileEcritures";

/**
 * Les trois propriétés de la file, éprouvées séparément.
 *
 * Un jeu de données qui les confond ne distingue rien : deux tâches
 * instantanées s'exécutent dans l'ordre même sans file, et une file qui ne
 * ferait rien passerait. Chaque cas est donc construit pour que son absence
 * déplace quelque chose.
 */

/** Une tâche qui met le temps qu'on lui dit, et qui note quand elle s'ouvre et se ferme. */
function tache(nom: string, ms: number, journal: string[], echoue = false) {
  return async () => {
    journal.push(`ouvre:${nom}`);
    await new Promise((r) => setTimeout(r, ms));
    journal.push(`ferme:${nom}`);
    if (echoue) throw new Error(nom);
    return nom;
  };
}

describe("la file d'écritures", () => {
  it("n'en laisse jamais deux en vol", async () => {
    const journal: string[] = [];
    const enfiler = creerFile();
    // La PREMIÈRE est la plus lente : sans file, la deuxième s'ouvre avant
    // que la première ne se ferme, et c'est exactement le relevé du
    // navigateur — quatre en vol à la fois.
    await Promise.all([
      enfiler(tache("a", 40, journal)),
      enfiler(tache("b", 5, journal)),
      enfiler(tache("c", 5, journal)),
    ]);
    expect(journal).toEqual([
      "ouvre:a", "ferme:a", "ouvre:b", "ferme:b", "ouvre:c", "ferme:c",
    ]);
  });

  it("envoie dans l'ordre des appels", async () => {
    const journal: string[] = [];
    const enfiler = creerFile();
    // Les durées vont à REBOURS de l'ordre d'appel : sans file, l'ordre de
    // fermeture serait c, b, a. C'est le seul jeu de données qui distingue
    // « en file » de « au plus rapide ».
    await Promise.all([
      enfiler(tache("a", 30, journal)),
      enfiler(tache("b", 20, journal)),
      enfiler(tache("c", 10, journal)),
    ]);
    expect(journal.filter((l) => l.startsWith("ferme"))).toEqual([
      "ferme:a", "ferme:b", "ferme:c",
    ]);
  });

  it("laisse passer les suivantes quand l'une échoue", async () => {
    const journal: string[] = [];
    const enfiler = creerFile();
    const premiere = enfiler(tache("a", 10, journal, true));
    const seconde = enfiler(tache("b", 5, journal));
    // L'échec est rendu à SON appelant…
    await expect(premiere).rejects.toThrow("a");
    // …et pas au voisin, qui a bien tourné.
    await expect(seconde).resolves.toBe("b");
    expect(journal).toEqual(["ouvre:a", "ferme:a", "ouvre:b", "ferme:b"]);
  });

  it("donne une file par appel, pas une file partagée", async () => {
    // Deux écrans ne se bloquent pas l'un l'autre : c'est ce qui distingue
    // `creerFile()` d'une file de module, et ce qui permet de la poser dans
    // un `useRef` sans qu'un second onglet en pâtisse.
    const journal: string[] = [];
    const une = creerFile();
    const autre = creerFile();
    await Promise.all([
      une(tache("a", 30, journal)),
      autre(tache("b", 5, journal)),
    ]);
    expect(journal.indexOf("ferme:b")).toBeLessThan(journal.indexOf("ferme:a"));
  });
});
