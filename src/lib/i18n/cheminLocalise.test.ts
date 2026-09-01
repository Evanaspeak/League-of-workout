import {
  avecLocale, echappeAuPrefixe, localeDuChemin, negocierLocale, sansLocale, toutesLesLocales,
} from "./cheminLocalise";
import { LANGUES } from "./langues";

/**
 * Les règles d'adresse de la langue.
 *
 * Elles sont lues à trois endroits — le middleware, le plan du site, les
 * composants qui fabriquent un lien — et c'est précisément pour ça qu'elles
 * vivent dans un seul module : trois exemplaires d'une règle finissent
 * toujours par diverger, et ce projet l'a déjà payé quatre fois.
 */
describe("la langue dans l'adresse", () => {
  it("lit la langue du premier segment, et seulement une vraie", () => {
    expect(localeDuChemin("/fr/history")).toBe("fr");
    expect(localeDuChemin("/ja")).toBe("ja");
    expect(localeDuChemin("/history")).toBeNull();
    // « from » commence par « fr » : la comparaison porte sur le segment
    // entier, jamais sur les lettres. C'est la faute déjà corrigée dans le
    // middleware et dans l'application de bureau.
    expect(localeDuChemin("/from/history")).toBeNull();
    expect(localeDuChemin("/deutsch")).toBeNull();
  });

  it("retire la langue pour rendre le chemin que le reste du projet connaît", () => {
    expect(sansLocale("/fr/history")).toBe("/history");
    expect(sansLocale("/en/calculateur/league-of-legends")).toBe("/calculateur/league-of-legends");
    // La racine d'une langue est la racine : sans ça elle rendrait la chaîne
    // vide, qu'aucune des règles de chemin du projet ne reconnaît.
    expect(sansLocale("/fr")).toBe("/");
    expect(sansLocale("/history")).toBe("/history");
  });

  it("pose la langue, et la remplace au lieu de l'empiler", () => {
    expect(avecLocale("/history", "de")).toBe("/de/history");
    expect(avecLocale("/fr/history", "de")).toBe("/de/history");
    expect(avecLocale("/", "ja")).toBe("/ja");
    expect(avecLocale("/fr", "ja")).toBe("/ja");
  });

  it("laisse tranquille ce qui ne doit jamais porter de préfixe", () => {
    // Les préfixer casserait les rappels de Auth.js, l'application de bureau,
    // les déclencheurs programmés, et tous les liens de diffusion déjà collés
    // dans un logiciel de streaming.
    for (const chemin of ["/api/games", "/api/auth/callback/google", "/obs/abc123", "/_next/static/x", "/favicon.ico", "/sw.js"]) {
      expect(echappeAuPrefixe(chemin)).toBe(true);
      expect(avecLocale(chemin, "de")).toBe(chemin);
    }
  });

  it("compare par segments, là aussi", () => {
    // `startsWith("/api")` accepte `/apiculture`, et `startsWith("/obs")`
    // accepte `/obsolete` : rien de tel n'existe aujourd'hui, ce qui rend la
    // faute invisible et la laisse dépendre du prochain nom de page.
    expect(echappeAuPrefixe("/apiculture")).toBe(false);
    expect(echappeAuPrefixe("/obsolete")).toBe(false);
    expect(avecLocale("/apiculture", "es")).toBe("/es/apiculture");
  });
});

describe("la langue à servir à qui n'en demande aucune", () => {
  it("suit le choix déjà fait avant tout", () => {
    expect(negocierLocale("ja", "fr-FR,fr;q=0.9")).toBe("ja");
  });

  it("suit le navigateur quand aucun choix n'a été fait", () => {
    expect(negocierLocale(null, "de-AT,de;q=0.9,en;q=0.8")).toBe("de");
    // Les sous-étiquettes ne nous intéressent pas : « zh-Hant-TW » est du zh.
    expect(negocierLocale(null, "zh-Hant-TW")).toBe("zh");
  });

  it("respecte l'ordre de préférence, pas l'ordre d'écriture", () => {
    // Les DEUX langues doivent être des nôtres, sinon le test passe sans rien
    // éprouver : avec « pt-BR;q=0.9,es;q=1.0 », le portugais est ignoré de
    // toute façon et l'espagnol sort quel que soit l'ordre. Sabotage fait —
    // le tri retiré — et la première version restait verte.
    expect(negocierLocale(null, "de;q=0.3,es;q=0.9")).toBe("es");
    expect(negocierLocale(null, "es;q=0.3,de;q=0.9")).toBe("de");
  });

  it("rend l'anglais, jamais le français, quand il ne sait pas", () => {
    // Le défaut français envoyait tout le monde sur la version française, y
    // compris ceux qui n'avaient rien demandé. Celui qui écrit l'application
    // ne s'en aperçoit jamais : il la lit en français.
    expect(negocierLocale(null, null)).toBe("en");
    expect(negocierLocale(null, "pt-BR,ko;q=0.8")).toBe("en");
    expect(negocierLocale("klingon", null)).toBe("en");
  });

  it("ignore une qualité illisible au lieu de la faire passer devant", () => {
    expect(negocierLocale(null, "de;q=bientôt,es;q=0.5")).toBe("es");
  });
});

describe("le recensement des langues", () => {
  it("les rend toutes, et pas une liste vide", () => {
    // Un `generateStaticParams` qui rend une liste vide ne génère aucune page
    // et ne fait échouer aucune construction : le défaut ne se voit qu'en
    // production, sur une adresse qui répond 404.
    const params = toutesLesLocales();
    expect(params.map((p) => p.locale)).toEqual(LANGUES);
    expect(params.length).toBeGreaterThan(1);
  });
});
