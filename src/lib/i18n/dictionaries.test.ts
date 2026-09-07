import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dashboard } from "./dictionaries/dashboard";

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
    const charge = require(join(DOSSIER, fichier)) as Record<string, { fr?: unknown; en?: unknown }>;
    const exporte = Object.values(charge).find((v) => v && typeof v === "object" && "fr" in v);

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

    it("n'emploie que les écritures des six langues", () => {
      // Une frappe qui dérape passe tous les autres contrôles : les clés se
      // correspondent, les natures aussi, et un mot russe au milieu d'une
      // phrase japonaise s'affiche sans rien casser. Le cyrillique, le hangul
      // et le thaï n'appartiennent à aucune des six langues : leur présence
      // est forcément un accident.
      const etrangeres = /[\u0400-\u04FF\uAC00-\uD7AF\u0E00-\u0E7F]/;
      const fautes: string[] = [];
      for (const langue of ["fr", "en", "es", "de", "zh", "ja"] as const) {
        const jeu = (exporte as Record<string, unknown>)[langue];
        if (jeu === undefined) continue;
        for (const c of chemins(jeu)) {
          let v: unknown = jeu;
          for (const m of c.split(".")) v = (v as Record<string, unknown>)[m];
          if (typeof v === "string" && etrangeres.test(v)) fautes.push(`${langue}.${c}`);
        }
      }
      expect(fautes).toEqual([]);
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

/**
 * Un dictionnaire que personne ne lit.
 *
 * Deux fichiers de langue ont survécu six semaines à la suppression de leurs
 * écrans. Rien ne le signalait : les clés se correspondaient d'une langue à
 * l'autre, les natures aussi, et TypeScript ne se plaint pas d'un module que
 * personne n'importe. On s'en est aperçu en les traduisant en quatre langues
 * de plus — 364 lignes de texte pour des pages qui n'existent plus.
 */
describe("dictionnaires effectivement employés", () => {
  const RACINE = join(__dirname, "..", "..", "..");

  /** Tous les fichiers source du dépôt, hors dossiers engendrés. */
  function sources(dossier: string, out: string[] = []): string[] {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      if (entree.name.startsWith(".") || entree.name === "node_modules") continue;
      const chemin = join(dossier, entree.name);
      if (entree.isDirectory()) sources(chemin, out);
      else if (/\.(ts|tsx)$/.test(entree.name)) out.push(chemin);
    }
    return out;
  }

  it("chaque dictionnaire est importé quelque part", () => {
    const fichiersSource = [
      ...sources(join(RACINE, "src")),
      ...sources(join(RACINE, "e2e")),
    ].filter((f) => !f.startsWith(DOSSIER));
    const contenu = fichiersSource.map((f) => readFileSync(f, "utf8")).join("\n");

    const orphelins = fichiers
      .filter((f) => !f.endsWith(".test.ts"))
      .map((f) => f.replace(/\.ts$/, ""))
      .filter((nom) => !contenu.includes(`dictionaries/${nom}"`));

    expect(orphelins).toEqual([]);
  });
});

/**
 * Le nombre de jours de retard est écrit UNE fois, dans le titre.
 *
 * `retardTitre` est une fonction du nombre réel — « En retard depuis 5 jours ».
 * `retardTexte`, deux lignes plus bas dans le même panneau, disait « Ta dette
 * court depuis trois jours », en dur, dans les six langues : c'est le SEUIL de
 * retard, vrai le jour du franchissement et faux tous les jours suivants. Le
 * panneau se contredisait donc lui-même dès le quatrième jour.
 *
 * Trouvé en lisant le tableau de bord en japonais sur un compte en retard de
 * cinq jours : 「5 日の遅れ」 au-dessus de 「負債が3日続いています」. En français
 * les deux lignes se lisent vite et l'écart ne saute pas aux yeux.
 *
 * La correction retire le nombre de la phrase plutôt que d'en faire une
 * seconde fonction : le titre le porte déjà, et un texte qui répète le titre
 * n'apprend rien — c'est la solution retenue pour le titre du classement, qui
 * ne nomme plus la période puisque les onglets s'en chargent.
 *
 * **Ce garde est étroit, et ça se mesure.** La règle générale — « un libellé
 * constant ne nomme pas un nombre quand son voisin de même préfixe est une
 * fonction » — rend NEUF paires dans le dépôt, dont huit parfaitement justes :
 * « une fois par semaine », « Deux objectifs », « il ne s'affichera qu'une
 * fois ». Un garde de cette forme ferait huit faux positifs le jour de son
 * écriture, donc il serait dispensé avant d'être lu.
 */
describe("la phrase du retard", () => {
  /**
   * « Un » est ÉCARTÉ des quatre langues à article indéfini.
   *
   * Mon premier motif le contenait, et il accusait les trois corrections que
   * je venais d'écrire : « Une dette qui court », « Una deuda que sigue »,
   * « Eine laufende Schuld ». Rien ne distingue l'article du numéral en
   * français, en espagnol ni en allemand — c'est une question de sens, pas de
   * forme, et un garde qui crie sur ce qui va bien finit par ne plus se lire.
   *
   * L'angle mort est écrit plutôt que laissé à découvrir : un seuil de retard
   * ramené à UN jour et écrit en dur passerait. Il est étroit et il vaut mieux
   * que quatre faux positifs. Les idéogrammes, eux, gardent 一 : il n'y est
   * pas un article.
   */
  const NUMERAUX =
    /\b\d+\b|\b(?:deux|trois|quatre|cinq|sept|huit|neuf|dix)\b|\b(?:two|three|four|five|six|seven|eight|nine|ten)\b|\b(?:dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b|\b(?:zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn)\b|[一二三四五六七八九十]/i;

  it("ne nomme aucun nombre de jours, dans aucune langue", () => {
    const fautifs = Object.entries(dashboard)
      .map(([langue, bloc]) => [langue, (bloc as { retardTexte: string }).retardTexte] as const)
      .filter(([, texte]) => NUMERAUX.test(texte))
      .map(([langue, texte]) => `${langue} : ${texte}`);
    expect(fautifs).toEqual([]);
  });

  it("et le motif sait reconnaître un numéral, sinon il ne garde rien", () => {
    // Le témoin. Sans lui, un motif devenu aveugle rendrait le contrôle vert
    // en n'examinant rien — c'est l'état sain du dépôt qui l'exige, puisqu'il
    // ne contient plus aucun cas fautif.
    for (const cas of [
      "Ta dette court depuis trois jours.",
      "running for three days",
      "lleva tres días",
      "seit drei Tagen",
      "已经拖了三天",
      "負債が3日続いています",
    ]) {
      expect({ cas, vu: NUMERAUX.test(cas) }).toEqual({ cas, vu: true });
    }
  });

  it("c'est bien le TITRE qui porte le nombre", () => {
    // Les deux moitiés ensemble : le jour où le titre cesserait de le dire, la
    // règle changerait de sens et il faudrait reprendre la phrase.
    for (const bloc of Object.values(dashboard)) {
      const titre = (bloc as { retardTitre: unknown }).retardTitre;
      expect(typeof titre).toBe("function");
      expect((titre as (n: number) => string)(5)).toMatch(/5/);
    }
  });
});
