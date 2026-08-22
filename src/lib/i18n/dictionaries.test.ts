import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Les dictionnaires doivent se correspondre exactement.
 *
 * Une clé présente en français et absente en anglais ne casse rien à la
 * compilation : elle rend `undefined`, et l'écran affiche un trou. On ne s'en
 * aperçoit qu'en visitant la page dans la bonne langue, ce que personne ne
 * fait systématiquement. Le seul moyen fiable de le savoir est de comparer les
 * deux jeux de clés, à chaque fois.
 */

const DOSSIER = join(__dirname, "dictionaries");

/** Chemins de toutes les clés d'un objet, y compris imbriquées. */
function chemins(objet: unknown, prefixe = ""): string[] {
  if (objet === null || typeof objet !== "object" || Array.isArray(objet)) return [prefixe];
  const out: string[] = [];
  for (const [cle, valeur] of Object.entries(objet as Record<string, unknown>)) {
    out.push(...chemins(valeur, prefixe ? `${prefixe}.${cle}` : cle));
  }
  return out.sort();
}

/** Nature d'une valeur : une fonction et une chaîne ne s'emploient pas pareil. */
function nature(objet: unknown, chemin: string): string {
  let courant: unknown = objet;
  for (const morceau of chemin.split(".")) {
    if (courant === null || typeof courant !== "object") return "absent";
    courant = (courant as Record<string, unknown>)[morceau];
  }
  return typeof courant;
}

const fichiers = readdirSync(DOSSIER).filter((f) => f.endsWith(".ts")).sort();

describe("dictionnaires de traduction", () => {
  it("il y en a bien à vérifier", () => {
    expect(fichiers.length).toBeGreaterThan(20);
  });

  describe.each(fichiers)("%s", (fichier) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module = require(join(DOSSIER, fichier)) as Record<string, { fr?: unknown; en?: unknown }>;
    const exporte = Object.values(module).find((v) => v && typeof v === "object" && "fr" in v);

    it("exporte un dictionnaire à deux langues", () => {
      expect(exporte).toBeDefined();
      expect(exporte!.fr).toBeDefined();
      expect(exporte!.en).toBeDefined();
    });

    it("a exactement les mêmes clés dans les deux langues", () => {
      const fr = chemins(exporte!.fr);
      const en = chemins(exporte!.en);
      expect({ absentesEnAnglais: fr.filter((c) => !en.includes(c)) })
        .toEqual({ absentesEnAnglais: [] });
      expect({ absentesEnFrancais: en.filter((c) => !fr.includes(c)) })
        .toEqual({ absentesEnFrancais: [] });
    });

    it("emploie la même nature de valeur pour chaque clé", () => {
      // Une clé qui est une fonction d'un côté et une chaîne de l'autre casse
      // à l'appel, et seulement dans une des deux langues.
      const divergentes = chemins(exporte!.fr)
        .filter((c) => nature(exporte!.fr, c) !== nature(exporte!.en, c))
        .map((c) => `${c} : ${nature(exporte!.fr, c)} en français, ${nature(exporte!.en, c)} en anglais`);
      expect(divergentes).toEqual([]);
    });

    it("donne aux langues présentes exactement les mêmes clés", () => {
      // Le français et l'anglais sont exigés, les quatre autres se remplissent
      // au fil du temps. Mais une langue à demi traduite est pire que pas de
      // langue du tout : l'écran mélangerait alors deux idiomes sans logique.
      // Une langue présente doit donc l'être entièrement.
      const reference = chemins(exporte!.fr);
      for (const langue of ["es", "de", "zh", "ja"] as const) {
        const jeu = (exporte as Record<string, unknown>)[langue];
        if (jeu === undefined) continue;
        expect({ langue, manquantes: reference.filter((c) => !chemins(jeu).includes(c)) })
          .toEqual({ langue, manquantes: [] });
        expect({ langue, enTrop: chemins(jeu).filter((c) => !reference.includes(c)) })
          .toEqual({ langue, enTrop: [] });
        const divergentes = reference
          .filter((c) => nature(exporte!.fr, c) !== nature(jeu, c))
          .map((c) => `${c} : ${nature(exporte!.fr, c)} en français, ${nature(jeu, c)} en ${langue}`);
        expect(divergentes).toEqual([]);
      }
    });

    it("ne laisse aucune traduction vide des deux côtés", () => {
      // Une chaîne vide d'un seul côté peut être voulue : l'anglais déplace
      // parfois un mot d'un morceau de phrase à l'autre, et l'écran qui les
      // assemble prévoit le cas. Vide des DEUX côtés, en revanche, la clé ne
      // sert plus à rien et personne ne s'en apercevra.
      const morte: string[] = [];
      for (const c of chemins(exporte!.fr)) {
        const lire = (langue: "fr" | "en") => {
          let v: unknown = exporte![langue];
          for (const m of c.split(".")) v = (v as Record<string, unknown>)[m];
          return v;
        };
        const fr = lire("fr");
        const en = lire("en");
        if (typeof fr === "string" && typeof en === "string" && !fr.trim() && !en.trim()) {
          morte.push(c);
        }
      }
      expect(morte).toEqual([]);
    });
  });
});
