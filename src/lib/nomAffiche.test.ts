import { NOM_DEFAUT, nomPublie, toChoixNom } from "@/lib/nomAffiche";

describe("le nom montré aux autres", () => {
  test("le défaut est le pseudo interne, pas le pseudo Riot", () => {
    // Le plus fermé : le pseudo Riot relie ce compte à une identité
    // extérieure, et personne ne doit se mettre à le publier parce qu'on a
    // ajouté un réglage.
    expect(NOM_DEFAUT).toBe("pseudo");
    expect(nomPublie({ pseudo: "Ana", riotId: "AnaLoL#EUW" })).toBe("Ana");
  });

  test("choisi, c'est le pseudo Riot", () => {
    expect(nomPublie({ pseudo: "Ana", riotId: "AnaLoL#EUW", nomAffiche: "riot" })).toBe("AnaLoL");
  });

  test("le discriminant ne s'affiche pas", () => {
    // « Nom#EUW » se lit mal dans une liste, et la partie après le dièse ne
    // distingue rien entre gens qui se connaissent.
    expect(nomPublie({ pseudo: "Ana", riotId: "Bob#1234", nomAffiche: "riot" })).toBe("Bob");
  });

  test("sans compte Riot rattaché, on retombe sur le pseudo", () => {
    // Le choix n'a rien à désigner, et ne rien afficher serait pire : une
    // ligne de classement sans nom.
    expect(nomPublie({ pseudo: "Ana", riotId: null, nomAffiche: "riot" })).toBe("Ana");
    expect(nomPublie({ pseudo: "Ana", riotId: "   ", nomAffiche: "riot" })).toBe("Ana");
    expect(nomPublie({ pseudo: "Ana", riotId: "#EUW", nomAffiche: "riot" })).toBe("Ana");
  });

  test("une valeur inconnue retombe sur le pseudo, jamais sur Riot", () => {
    // Le repli d'un réglage de confidentialité ne peut pas être plus
    // permissif que ce qu'on demandait.
    expect(nomPublie({ pseudo: "Ana", riotId: "X#1", nomAffiche: "n'importe quoi" })).toBe("Ana");
    expect(nomPublie({ pseudo: "Ana", riotId: "X#1", nomAffiche: null })).toBe("Ana");
    expect(toChoixNom("riott")).toBe("pseudo");
    expect(toChoixNom(42)).toBe("pseudo");
  });
});
