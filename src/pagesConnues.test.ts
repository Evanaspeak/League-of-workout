import fs from "node:fs";
import path from "node:path";
import { PAGES_CONNUES, estPageConnue } from "@/lib/pagesConnues";
import { tousLesSlugs } from "@/lib/slugJeu";

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
    /**
     * Le segment dynamique du calculateur est développé en clair dans la
     * liste, jeu par jeu — le middleware doit distinguer un jeu qui existe
     * d'un jeu inventé, sans quoi ce dernier passe pour une page connue et
     * rend la 404 de Next au lieu de la nôtre. Le dossier, lui, n'en connaît
     * qu'un seul, écrit `*`.
     */
    const nus = [...new Set([...PAGES_CONNUES].map(
      (p) => (p.startsWith("/calculateur/") ? "/calculateur/*" : p)))].sort();
    expect(nus).toEqual(dossier);
  });

  it("connaît chaque jeu du catalogue, et lui seul", () => {
    for (const { slug } of tousLesSlugs()) {
      expect(estPageConnue(`/calculateur/${slug}`)).toBe(true);
    }
    // Un jeu inventé n'est pas une page : sans ça, il traverse le middleware
    // et c'est le ROUTEUR qui le refuse — ce qui rend la 404 intégrée de Next,
    // sans langue et en anglais.
    expect(estPageConnue("/calculateur/jeu-invente")).toBe(false);
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
    expect(estPageConnue(`/calculateur/${tousLesSlugs()[0].slug}`)).toBe(true);
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

  it("range ses trois questions dans le bon ordre", () => {
    /**
     * « Existe-t-elle ? », puis « est-elle publique ? », puis « y a-t-il une
     * session ? ».
     *
     * L'existence passe en premier parce qu'une page publique couvre ses
     * enfants : `/calculateur` couvre `/calculateur/<jeu>`, donc un jeu inventé
     * sortait par la porte publique avant qu'on ait pu constater qu'il n'existe
     * pas. Ça ne relâche rien — une adresse qui n'existe pas n'a pas de contenu
     * à protéger.
     *
     * Le contrôle de session, lui, reste DERNIER : le remonter rendrait
     * publique toute page connue.
     */
    const existe = source.indexOf("estPageConnue(chemin)");
    const publique = source.indexOf("if (estCheminPublic(chemin))");
    const session = source.indexOf("if (!req.auth)");
    expect(existe).toBeLessThan(publique);
    expect(publique).toBeLessThan(session);
  });
});
