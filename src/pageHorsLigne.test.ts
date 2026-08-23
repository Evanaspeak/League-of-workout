/**
 * La page de secours hors ligne doit être autonome.
 *
 * C'est exactement au moment où plus rien ne se charge qu'on en a besoin :
 * une page de secours qui référence une feuille de style, une police ou un
 * script s'affiche nue, ou pas du tout. Rien ne le signalerait — elle ne
 * paraît jamais pendant qu'on développe, puisque le réseau y répond toujours.
 */
import fs from "node:fs";
import path from "node:path";

const page = fs.readFileSync(
  path.join(process.cwd(), "public", "hors-ligne.html"), "utf8");

const sw = fs.readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");

describe("page hors ligne", () => {
  it("ne charge aucune ressource extérieure", () => {
    // `src=`, `href=` et `url(` couvrent images, scripts, feuilles de style,
    // polices et arrière-plans. Seules les ancres internes sont tolérées.
    const liens = [...page.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)]
      .map((m) => m[1])
      .filter((u) => !u.startsWith("#"));
    expect(liens).toEqual([]);
    expect(page).not.toMatch(/url\(/);
  });

  it("parle français et anglais", () => {
    // Les deux langues exigées partout ailleurs. Les quatre autres retombent
    // dessus, comme pour les CGU.
    expect(page).toMatch(/lang="fr"/);
    expect(page).toMatch(/lang="en"/);
  });

  it("offre un moyen de repartir", () => {
    // Sans bouton, il faut connaître le geste de rechargement du navigateur —
    // sur téléphone, il n'est pas évident.
    expect(page).toMatch(/location\.reload/);
  });
});

describe("service worker", () => {
  it("met la page de secours en cache à l'installation", () => {
    expect(sw).toMatch(/caches\.open/);
    expect(sw).toMatch(/hors-ligne\.html/);
  });

  it("n'intercepte que les navigations", () => {
    // Intercepter les scripts et les styles ferait servir des fragments
    // périmés à des pages neuves, sur une application qui se redéploie
    // plusieurs fois par jour.
    expect(sw).toMatch(/request\.mode !== "navigate"/);
  });

  it("ne met en cache que cette page", () => {
    // Une seule entrée : tout `cache.put` ou `cache.addAll` supplémentaire
    // ferait entrer des assets dans le cache, ce que ce fichier s'interdit.
    expect(sw).not.toMatch(/cache\.put|cache\.addAll/);
  });
});
