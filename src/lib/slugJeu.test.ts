import { JEUX } from "@/lib/jeux";
import { jeuDepuisSlug, slugDeJeu, tousLesSlugs, voisinsDe, VOISINS_PROPOSES } from "./slugJeu";

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

/**
 * Le maillage entre les pages, et pas seulement leurs adresses.
 *
 * Chaque page propose « d'autres jeux » en bas. Elle en prenait les huit
 * PREMIERS du catalogue, donc les huit MÊMES sur les seize pages. Mesuré :
 * huit jeux recevaient quinze liens entrants, un en recevait huit, et **sept
 * n'en recevaient aucun** — Rocket League, Teamfight Tactics, Minecraft,
 * World of Warcraft, GTA V, Elden Ring et Les Sims n'étaient atteignables que
 * depuis l'index.
 *
 * Rien ne pouvait le signaler : chaque page était juste, et c'est le GRAPHE
 * qui était faux. Une page vers laquelle rien ne pointe reste parfaitement
 * lisible — elle est seulement introuvable, sur les seules pages du produit
 * qui existent pour être trouvées.
 */
describe("le maillage des pages par jeu", () => {
  const tous = tousLesSlugs();
  const entrants = () => {
    const compte = new Map(tous.map((j) => [j.slug, 0]));
    for (const j of tous) {
      for (const v of voisinsDe(j.slug)) compte.set(v.slug, (compte.get(v.slug) ?? 0) + 1);
    }
    return [...compte.values()];
  };

  it("ne propose jamais la page où l'on est", () => {
    for (const j of tous) {
      expect(voisinsDe(j.slug).map((v) => v.slug)).not.toContain(j.slug);
    }
  });

  it("propose autant de voisins depuis chaque page", () => {
    const attendu = Math.min(VOISINS_PROPOSES, tous.length - 1);
    for (const j of tous) expect(voisinsDe(j.slug)).toHaveLength(attendu);
  });

  it("laisse chaque page recevoir des liens, et le même nombre", () => {
    const compte = entrants();
    expect(Math.min(...compte)).toBeGreaterThan(0);
    // La fenêtre est circulaire, donc la répartition est exacte ; on tolère un
    // écart d'un pour un catalogue dont la taille ne divise pas la fenêtre.
    expect(Math.max(...compte) - Math.min(...compte)).toBeLessThanOrEqual(1);
    expect(compte).toHaveLength(tous.length); // témoin : le recensement a compté
  });

  it("rend quand même des voisins pour une adresse inconnue", () => {
    // La page n'appelle jamais ce cas — le routeur referme le catalogue — mais
    // une liste vide serait le pire résultat possible ici, et un repli qu'on ne
    // voit jamais est un repli qu'on ne vérifie jamais.
    expect(voisinsDe("jeu-invente").length).toBeGreaterThan(0);
  });
});
