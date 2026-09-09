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

/**
 * Elle doit encore être ATTEIGNABLE, et ça se prouve à part.
 *
 * Tout ce qui précède éprouve son CONTENU — autonome, bilingue, avec un moyen
 * de repartir. La page était parfaite et le service worker n'a jamais pu la
 * mettre en cache : le middleware la traitait comme une page protégée, donc
 * elle répondait **307 vers `/en/login`** à qui n'a pas de session. Mesuré des
 * deux côtés : 200 avec un cookie de session, 307 sans.
 *
 * Et l'état sans session est celui qui compte. Le service worker s'enregistre
 * au chargement de N'IMPORTE QUELLE page, la page d'accueil comprise ; c'est
 * même tout l'intérêt de la page de secours, puisque Chrome n'émet
 * l'invitation à installer que si un service worker sait répondre hors ligne.
 * `cache.add` suivait donc la redirection et n'avait plus que l'écran de
 * connexion à mettre en cache.
 *
 * Le parcours navigateur ne pouvait pas le voir : il ouvre son contexte AVEC
 * une session, c'est-à-dire dans le seul état où le défaut n'existe pas.
 */
describe("le middleware", () => {
  const middleware = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");

  /** Le motif du `matcher`, tel qu'il tourne, reconstruit depuis la source. */
  const motif = (() => {
    const trouve = middleware.match(/"(\/\(\(\?![^"]+)"/);
    if (!trouve) throw new Error("matcher introuvable dans middleware.ts");
    return new RegExp(`^${trouve[1].replace(/\\\\/g, "\\")}$`);
  })();

  it("laisse passer la page de secours sans la protéger", () => {
    expect(motif.test("/hors-ligne.html")).toBe(false);
  });

  it("garde bien les pages — sans quoi le contrôle d'au-dessus ne prouve rien", () => {
    // Un motif mal extrait laisserait TOUT échapper, et la ligne précédente
    // passerait au vert en ne gardant plus rien.
    expect(motif.test("/fr/dashboard")).toBe(true);
    expect(motif.test("/api/games")).toBe(true);
    // Et ce qui échappait déjà continue d'échapper.
    expect(motif.test("/sw.js")).toBe(false);
    expect(motif.test("/images/jeux/league.png")).toBe(false);
  });
});
