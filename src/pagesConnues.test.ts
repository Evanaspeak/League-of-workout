import fs from "node:fs";
import path from "node:path";
import { FICHIERS_DE_CONVENTION, PAGES_CONNUES, estFichierDeConvention, estPageConnue } from "@/lib/pagesConnues";
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
       * Un attrape-tout n'est pas une page, c'est l'absence de page.
       *
       * L'inscrire parmi les pages connues rendrait `estPageConnue` vrai pour
       * n'importe quelle adresse, et le middleware redeviendrait exactement ce
       * qu'on a corrigé : incapable de distinguer « protégé » de
       * « inexistant ».
       *
       * Le dépôt n'en contient aucun aujourd'hui — la 404 est une page
       * ordinaire, `[locale]/introuvable`, vers laquelle le middleware réécrit.
       * Le contrôle reste : c'est la forme qu'on serait tenté de reprendre.
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
    // La condition s'ouvre sur `echappeAuPrefixe` et se ferme sur
    // `estPageConnue` ; ce qu'il y a entre les deux ne peut que RESTREINDRE
    // encore, jamais élargir — c'est le sens de la conjonction.
    expect(branche).toMatch(/!echappeAuPrefixe\(pathname\)\s*&&/);
    expect(branche).toMatch(/&&\s*!estPageConnue\(chemin\)\s*\)/);
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

/**
 * Les fichiers engendrés par convention de nom.
 *
 * Ils ne sont pas des pages — donc pas dans `PAGES_CONNUES`, qui se compare au
 * dossier des `page.tsx` — et ils doivent pourtant échapper à la question
 * « cette adresse existe-t-elle ». Sans quoi le middleware les réécrit vers la
 * 404, et un lien partagé perd sa vignette en silence.
 *
 * La liste se compare au DOSSIER, comme celle des pages : un fichier renommé
 * ou supprimé la rendrait fausse sans que rien ne le dise.
 */
describe("les fichiers de convention", () => {
  it("désignent chacun un fichier qui existe sous [locale]", () => {
    expect(FICHIERS_DE_CONVENTION.length).toBeGreaterThanOrEqual(3);
    const manquants = FICHIERS_DE_CONVENTION.filter((nom) => {
      const base = path.join(RACINE, nom.slice(1));
      return !fs.existsSync(`${base}.tsx`) && !fs.existsSync(`${base}.ts`);
    });
    expect({ manquants }).toEqual({ manquants: [] });
  });

  it("sont reconnus, et rien d'autre ne l'est", () => {
    for (const nom of FICHIERS_DE_CONVENTION) expect(estFichierDeConvention(nom)).toBe(true);
    // Sans ce contrôle, une reconnaissance trop large ferait échapper des
    // adresses inconnues à la 404, ce qui est le défaut inverse.
    expect(estFichierDeConvention("/cgu")).toBe(false);
    expect(estFichierDeConvention("/opengraph-image/vole")).toBe(false);
  });
});
