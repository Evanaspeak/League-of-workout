import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Le canal de connexion local, et les quatre choses qu'il écrit deux fois.
 *
 * L'application de bureau ouvre Chrome pour la connexion Google, puis attend
 * le jeton sur un serveur local. Le site le lui pousse en NAVIGUANT vers
 * `http://127.0.0.1:<port><chemin>?<jeton>=…&<alea>=…` — une navigation et non
 * un `fetch`, pour contourner les restrictions de Chrome sur HTTPS→HTTP.
 *
 * Les quatre valeurs sont donc écrites des deux côtés, et la coquille Electron
 * ne peut PAS importer le site : elle se construit sans son paquet. C'est la
 * situation des six langues de `desktop/src/langue.js` et de la table des
 * processus de `desktop/src/jeuxProcessus.js`, et la même réponse — ce qui ne
 * peut pas s'importer se compare.
 *
 * Ce qu'une divergence coûte, et pourquoi elle est pire qu'ailleurs :
 *
 * - le symptôme est TOTAL et MUET. Le site navigue vers une adresse que
 *   personne ne sert, Chrome montre sa propre page d'erreur, et la connexion
 *   par Google depuis l'application installée devient impossible. Rien dans le
 *   dépôt ne peut le dire : `tsc` ne voit qu'une chaîne, les parcours posent
 *   un FAUX pont, et la seule machine capable de constater la panne est celle
 *   de quelqu'un d'autre ;
 * - et le port fait partie du CONTRAT AVEC LES COPIES DÉJÀ INSTALLÉES. Une
 *   copie installée écoute le port qu'elle connaît : le changer côté site
 *   casse toutes celles d'avant, le changer côté coquille casse toutes celles
 *   d'après jusqu'à la mise à jour. C'est le raisonnement déjà écrit pour
 *   `/login`, qui se RÉÉCRIT au lieu de se rediriger pour cette raison exacte.
 *
 * Le test ne l'interdit pas — il exige que les deux moitiés bougent ensemble,
 * et le jour où elles bougent il rappelle ce que ça coûte aux installations.
 *
 * Ce qu'il fait si le canal change de FORME — si le site repassait au `POST`
 * que la coquille sert encore, par exemple : le motif ne trouve plus
 * d'adresse, le témoin tombe, et il faut venir reprendre le garde. C'est le
 * bon sens de l'échec ; l'autre aurait été de rendre deux ensembles vides qui
 * s'accordent.
 */

const SITE = join(process.cwd(), "src", "components", "DesktopAuthHandler.tsx");
const COQUILLE = join(process.cwd(), "desktop", "src", "main.js");

/** Ce que le SITE vise : le port, le chemin, et le nom de ses paramètres. */
function cotéSite(): { port: string; chemin: string; parametres: string[] } {
  const texte = readFileSync(SITE, "utf8");
  // On part de l'adresse et on lit jusqu'à la fin de l'expression : le second
  // paramètre vit dans un gabarit CONCATÉNÉ au premier, donc sur une autre
  // ligne. Une lecture ligne à ligne n'en verrait qu'un.
  // Le « ? » reste DANS la capture : consommé par le motif extérieur, le
  // premier paramètre n'aurait plus de séparateur devant lui et le
  // recensement n'en verrait qu'un sur deux — c'est-à-dire qu'il laisserait
  // passer un renommage du jeton, qui est le plus grave des deux.
  const m = /http:\/\/127\.0\.0\.1:(\d+)(\/[A-Za-z0-9/_-]+)(\?[\s\S]*?)\);/.exec(texte);
  if (!m) return { port: "", chemin: "", parametres: [] };
  const params = [...m[3].matchAll(/[?&]([A-Za-z0-9_]+)=/g)].map((p) => p[1]);
  return { port: m[1], chemin: m[2], parametres: params };
}

/** Ce que la COQUILLE sert : le port, les chemins, et ce qu'elle lit dans l'adresse. */
function cotéCoquille(): { port: string; chemins: string[]; parametres: string[] } {
  const texte = readFileSync(COQUILLE, "utf8");
  const port = /const AUTH_PORT\s*=\s*(\d+)\s*;/.exec(texte)?.[1] ?? "";
  const chemins = [...texte.matchAll(/chemin === "([^"]+)"/g)].map((m) => m[1]);
  const parametres = [...texte.matchAll(/searchParams\.get\("([^"]+)"\)/g)].map((m) => m[1]);
  return { port, chemins, parametres };
}

describe("le canal de connexion local", () => {
  it("se lit vraiment des deux côtés", () => {
    /**
     * Le témoin, et il porte tout le reste : l'état sain de ce fichier est
     * « les deux moitiés s'accordent », donc un extracteur devenu aveugle
     * rendrait deux ensembles vides qui s'accordent parfaitement. Le contrôle
     * passerait au vert en ne comparant rien.
     */
    const site = cotéSite();
    const coquille = cotéCoquille();
    expect(site.port).toMatch(/^\d{2,5}$/);
    expect(site.chemin).toMatch(/^\/\S+$/);
    expect(site.parametres.length).toBeGreaterThanOrEqual(2);
    expect(coquille.port).toMatch(/^\d{2,5}$/);
    expect(coquille.chemins.length).toBeGreaterThanOrEqual(1);
    expect(coquille.parametres.length).toBeGreaterThanOrEqual(2);
  });

  it("vise le port que la coquille écoute", () => {
    // Le plus cher des quatre : c'est celui qui fait partie du contrat avec
    // les copies déjà installées.
    expect(cotéSite().port).toBe(cotéCoquille().port);
  });

  it("vise un chemin que la coquille sert", () => {
    // La coquille compare le chemin EXACTEMENT — `startsWith` laissait passer
    // `/set-sessionXYZ`, et c'est écrit dans son commentaire. Une comparaison
    // exacte des deux côtés est donc la seule qui dise quelque chose.
    expect(cotéCoquille().chemins).toContain(cotéSite().chemin);
  });

  it("nomme ses paramètres comme la coquille les lit", () => {
    /**
     * Le jeton ET l'aléa. L'aléa est ce qui empêche n'importe quelle page du
     * web de pousser une session dans l'application : renommé d'un seul côté,
     * la coquille lit `null`, `nonceValide` refuse, et la connexion échoue en
     * 403 — un refus parfaitement correct pour une requête parfaitement
     * légitime.
     */
    const lus = cotéCoquille().parametres;
    const oublies = cotéSite().parametres.filter((p) => !lus.includes(p));
    expect(oublies).toEqual([]);
  });
});
