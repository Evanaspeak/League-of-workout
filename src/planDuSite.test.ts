import fs from "fs";
import path from "path";
import sitemap from "@/app/sitemap";
import { metadonneesPage, metadonneesJeu } from "@/lib/i18n/metadonnees";
import { estCheminPublic } from "@/lib/routesPubliques";
import { LANGUES } from "@/lib/i18n/langues";
import { tousLesSlugs } from "@/lib/slugJeu";

/**
 * Le plan du site regarde le DOSSIER des pages, pas une liste tenue à la main.
 *
 * Trois états sont permis pour une page, et un seul est une décision par
 * défaut acceptable :
 *
 * - elle est dans le plan du site, donc on veut la voir sortir ;
 * - elle porte `noindex`, donc on a décidé qu'elle ne sortirait pas ;
 * - elle est derrière la porte, donc un explorateur ne la voit jamais.
 *
 * Ce qui n'est aucun des trois est un accident : publique, explorable, absente
 * du plan, sans refus. Elle s'indexe alors depuis n'importe quel lien et
 * paraît sans titre ni description. `/connexion-app` était exactement dans cet
 * état, et rien ne le signalait — c'est la leçon écrite dans `robots.ts` au
 * départ de `/waitlist`, restée sans garde.
 */

const RACINE = path.join(process.cwd(), "src", "app", "[locale]");

/** Le chemin d'une page, tel qu'il s'écrit dans une adresse. */
function cheminDePage(fichier: string): string {
  const relatif = path.relative(RACINE, path.dirname(fichier)).split(path.sep).join("/");
  return relatif === "" ? "/" : `/${relatif}`;
}

function pagesDuDossier(dossier = RACINE): string[] {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const complet = path.join(dossier, e.name);
    if (e.isDirectory()) return pagesDuDossier(complet);
    return e.name === "page.tsx" ? [complet] : [];
  });
}

/**
 * Le refus d'indexation se cherche aussi chez les ancêtres.
 *
 * `/recuperation/valider` ne le porte pas elle-même : elle l'hérite de la mise
 * en page de `/recuperation`. Ne regarder que le fichier de la page rendrait
 * le test faux sur le cas le plus légitime.
 */
function refuseLIndexation(fichier: string): boolean {
  let dossier = path.dirname(fichier);
  for (;;) {
    for (const nom of ["page.tsx", "layout.tsx"]) {
      const f = path.join(dossier, nom);
      if (fs.existsSync(f) && /index:\s*false/.test(fs.readFileSync(f, "utf8"))) return true;
    }
    if (path.resolve(dossier) === path.resolve(RACINE)) return false;
    dossier = path.dirname(dossier);
  }
}

/** Les chemins que le plan du site annonce, sans leur langue ni le domaine. */
function cheminsDuPlan(): Set<string> {
  const nus = new Set<string>();
  for (const { url } of sitemap()) {
    const chemin = new URL(url).pathname;
    const [, langue, ...reste] = chemin.split("/");
    expect(LANGUES).toContain(langue);
    nus.add(reste.length ? `/${reste.join("/")}` : "/");
  }
  return nus;
}

describe("le plan du site", () => {
  it("annonce chaque page dans les six langues", () => {
    const entrees = sitemap();
    // Sans ce contrôle, un plan vide passerait tous les tests suivants.
    expect(entrees.length).toBeGreaterThan(100);
    expect(entrees.length % LANGUES.length).toBe(0);
  });

  it("donne à chaque entrée ses six alternates et un x-default", () => {
    for (const { url, alternates } of sitemap()) {
      const langues = alternates?.languages ?? {};
      for (const l of LANGUES) expect(Object.keys(langues)).toContain(l);
      // Sans x-default, un moteur choisit lui-même pour une langue qu'on ne
      // propose pas — et il choisit la plus anciennement connue, donc le
      // français, y compris pour une recherche faite en portugais.
      expect(Object.keys(langues)).toContain("x-default");
      expect(String(langues["x-default"])).not.toMatch(
        new RegExp(`/(${LANGUES.join("|")})(/|$)`),
      );
      expect(url).toMatch(/^https:\/\/winorworkout\.com\//);
    }
  });
});

describe("les métadonnées d'une page", () => {
  it("portent un x-default, page publique comme page par jeu", () => {
    for (const meta of [
      metadonneesPage("cgu", "de", "/cgu"),
      metadonneesJeu("League of Legends", "ja", "/calculateur/league-of-legends"),
    ]) {
      const langues = meta.alternates?.languages ?? {};
      for (const l of LANGUES) expect(Object.keys(langues)).toContain(l);
      expect(Object.keys(langues)).toContain("x-default");
    }
  });
});

describe("chaque page est rangée quelque part", () => {
  it("est dans le plan, ou refuse l'indexation, ou est derrière la porte", () => {
    const plan = cheminsDuPlan();
    const pages = pagesDuDossier();
    // Un dossier renommé rendrait le test vert sur zéro page lue : c'est
    // exactement la forme d'erreur qu'on cherche à empêcher ailleurs.
    expect(pages.length).toBeGreaterThan(10);

    const orphelines = pages.filter((fichier) => {
      const brut = cheminDePage(fichier);
      // Un segment dynamique s'éprouve sur un exemplaire réel : le plan
      // annonce les quinze jeux, pas la forme `[jeu]`.
      const chemin = brut.includes("[")
        ? brut.replace("[jeu]", tousLesSlugs()[0].slug)
        : brut;
      if (plan.has(chemin)) return false;
      if (refuseLIndexation(fichier)) return false;
      // Derrière la porte : un explorateur reçoit une redirection vers la
      // connexion, qui refuse elle-même l'indexation.
      if (!estCheminPublic(chemin)) return false;
      return true;
    });

    expect(orphelines.map((f) => cheminDePage(f))).toEqual([]);
  });
});
