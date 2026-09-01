import fs from "node:fs";
import path from "node:path";
import { PAGES_CONNUES, estPageConnue } from "@/lib/pagesConnues";

/**
 * La liste des pages qui existent, comparée au dossier des pages.
 *
 * C'est le motif de `porteRoutes.test.ts` appliqué aux pages : regarder la
 * SOURCE plutôt qu'une liste tenue à la main. Une page ajoutée demain sans être
 * inscrite ici répondrait 404 au lieu d'emmener à la connexion — un défaut
 * visible et sans fuite, mais un défaut.
 */
const RACINE = path.join(process.cwd(), "src", "app", "[locale]");

function cheminsDuDossier(dossier = RACINE): string[] {
  const sortie: string[] = [];
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const complet = path.join(dossier, e.name);
    if (e.isDirectory()) sortie.push(...cheminsDuDossier(complet));
    else if (e.name === "page.tsx") {
      const relatif = path.relative(RACINE, dossier).split(path.sep).join("/");
      /**
       * L'attrape-tout n'est pas une page, c'est l'absence de page.
       *
       * `[...introuvable]` existe pour que Next rende NOTRE 404 plutôt que le
       * sien. L'inscrire parmi les pages connues rendrait `estPageConnue` vrai
       * pour n'importe quelle adresse, et le middleware redeviendrait
       * exactement ce qu'on vient de corriger : incapable de distinguer
       * « protégé » de « inexistant ».
       */
      if (relatif.includes("[...")) continue;
      // Un segment dynamique devient une étoile : le middleware ne sait pas
      // quels jeux existent, et n'a pas à le savoir — c'est la page qui rend
      // 404 sur un slug inconnu.
      sortie.push(relatif === "" ? "/" : `/${relatif}`.replace(/\[[^\]]+\]/g, "*"));
    }
  }
  return sortie;
}

describe("les pages connues", () => {
  it("sont exactement celles du dossier", () => {
    const dossier = cheminsDuDossier().sort();
    // Un dossier renommé rendrait le test vert sur zéro page : c'est la forme
    // d'erreur que ce genre de recensement doit refuser en premier.
    expect(dossier.length).toBeGreaterThan(10);
    expect([...PAGES_CONNUES].sort()).toEqual(dossier);
  });

  it("se comparent par segments, jamais par lettres", () => {
    expect(estPageConnue("/settings")).toBe(true);
    // `startsWith("/settings")` accepterait celui-ci. C'est la faute déjà
    // corrigée trois fois sur ce projet — middleware, application de bureau,
    // routes publiques.
    expect(estPageConnue("/settingsprivees")).toBe(false);
    expect(estPageConnue("/settings/avance")).toBe(false);
  });

  it("une étoile couvre un segment, pas plusieurs", () => {
    expect(estPageConnue("/calculateur/valorant")).toBe(true);
    expect(estPageConnue("/calculateur/a/b")).toBe(false);
  });

  it("ne connaît pas ce qui n'existe pas", () => {
    for (const invente of ["/nimportequoi", "/xx/cgu", "/dashboard/secret", "/waitlist"]) {
      expect(estPageConnue(invente)).toBe(false);
    }
  });
});

describe("le middleware", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "middleware.ts"), "utf8");

  it("ne laisse tomber dans le 404 que des PAGES", () => {
    /**
     * Le garde le plus important du lot, et le seul dont l'oubli serait grave.
     *
     * Sans la condition sur `echappeAuPrefixe`, une adresse d'API absente de
     * la liste des pages — c'est-à-dire TOUTES — traverserait le contrôle de
     * session. Le reste de ce fichier ne coûterait alors plus rien.
     */
    const branche = source.slice(source.indexOf("estPageConnue(chemin)") - 200,
                                 source.indexOf("estPageConnue(chemin)") + 80);
    expect(branche).toMatch(/!echappeAuPrefixe\(pathname\)\s*&&\s*!estPageConnue\(chemin\)/);
  });

  it("refuse toujours par défaut une page connue sans session", () => {
    // La chute dans le 404 vient APRÈS le contrôle des pages publiques et
    // AVANT celui de la session : inverser les deux derniers rendrait toute
    // page inconnue accessible ET toute page connue publique.
    expect(source.indexOf("estPageConnue(chemin)")).toBeLessThan(source.indexOf("if (!req.auth)"));
    expect(source.indexOf("estCheminPublic(chemin)")).toBeLessThan(source.indexOf("estPageConnue(chemin)"));
  });
});
