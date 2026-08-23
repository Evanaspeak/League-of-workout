import { JEUX } from "@/lib/jeux";
import { jeuDepuisSlug, slugDeJeu, tousLesSlugs } from "./slugJeu";

describe("adresses des pages de jeu", () => {
  it("ne garde que des lettres, des chiffres et des tirets", () => {
    for (const { slug } of tousLesSlugs()) {
      expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it("fait le tour complet pour chaque jeu du catalogue", () => {
    for (const jeu of JEUX) {
      expect(jeuDepuisSlug(slugDeJeu(jeu.nom))).toBe(jeu.nom);
    }
  });

  it("n'attribue pas deux jeux à la même adresse", () => {
    // Deux jeux qui se ramèneraient au même slug rendraient l'une des deux
    // pages inatteignable, sans que rien ne le signale.
    const slugs = tousLesSlugs().map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("traite les deux points et les espaces", () => {
    expect(slugDeJeu("Call of Duty: Warzone")).toBe("call-of-duty-warzone");
  });

  it("retire les accents plutôt que de les encoder", () => {
    // Une adresse en %C3%A9 est illisible dans un résultat de recherche, et
    // ces pages n'existent que pour être trouvées.
    expect(slugDeJeu("Les Sims")).toBe("les-sims");
    expect(slugDeJeu("Éveil Étrange")).toBe("eveil-etrange");
  });

  it("ne reconnaît pas une adresse inventée", () => {
    expect(jeuDepuisSlug("minecraft-2")).toBeNull();
    expect(jeuDepuisSlug("")).toBeNull();
  });
});
