/**
 * Les unités viennent d'`Intl`, jamais d'une chaîne recollée à la main.
 *
 * Le défaut se lit dans une langue à écriture différente : l'écran des
 * réglages proposait « 2 min から » — une abréviation latine au milieu des
 * idéogrammes — deux blocs sous un « 1分55秒 » que le même écran rend
 * correctement depuis qu'on a corrigé l'unité de la DETTE. C'était la moitié
 * non réparée de cette correction, sur l'écran même qui la montre.
 *
 * Trois autres endroits l'écrivaient à la main : la notification envoyée
 * quand l'issue d'une partie n'a pas pu être lue (le seul message que le
 * produit envoie PENDANT qu'on joue), la pastille de session en cours, et les
 * trois mesures physiques du panneau d'administration.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { uniteLocalisee } from "@/lib/i18n/unite";
import { dureeLocalisee } from "@/lib/i18n/duree";

const LANGUES = ["fr", "en", "es", "de", "zh", "ja"] as const;

/** Les points de code d'une chaîne, pour comparer sans se fier à l'œil. */
const cp = (s: string) => [...s].map((c) => c.codePointAt(0)!.toString(16)).join(" ");

describe("les unités affichées", () => {
  it("sortent d'Intl, donc elles diffèrent d'une langue à l'autre", () => {
    /**
     * Le témoin qui compte : les six ne doivent PAS toutes rendre la même
     * chose, sinon `Intl` ne servirait à rien et une table écrite à la main
     * ferait aussi bien.
     */
    const heures = LANGUES.map((l) => uniteLocalisee(2, "hour", l));
    expect(new Set(heures).size).toBeGreaterThan(2);
    expect(uniteLocalisee(2, "hour", "de")).toContain("Std.");
    expect(uniteLocalisee(2, "hour", "zh")).toContain("小时");
    expect(uniteLocalisee(45, "second", "de")).toContain("Sek.");
    expect(uniteLocalisee(45, "second", "ja")).toContain("秒");
    expect(uniteLocalisee(2.4, "kilometer", "zh", 1)).toContain("公里");
    expect(uniteLocalisee(180, "centimeter", "zh")).toContain("厘米");
  });

  it("posent l'espace que la langue exige, aux points de code près", () => {
    /**
     * Le français veut une espace INSÉCABLE devant une unité, et `Intl` la
     * pose — étroite (U+202F) devant « km » et « s », normale (U+00A0) devant
     * « min ». Le code recollait une espace ORDINAIRE (U+0020).
     *
     * Le changement est invisible à l'œil et il est juste ; ce test l'écrit en
     * points de code plutôt que de laisser croire à une identité qui n'existe
     * pas. C'est la leçon déjà payée sur l'unité de la dette : un test écrit
     * sur les VALEURS attrape ce qu'un test écrit sur l'intention laisse
     * passer.
     */
    expect(cp(uniteLocalisee(2.4, "kilometer", "fr-FR", 1))).toBe("32 2c 34 202f 6b 6d");
    expect(cp(uniteLocalisee(45, "second", "fr-FR"))).toBe("34 35 202f 73");
    expect(cp(uniteLocalisee(2, "minute", "fr-FR"))).toBe("32 a0 6d 69 6e");
    // Et l'anglais, qui ne veut pas d'insécable devant « km ».
    expect(cp(uniteLocalisee(2.4, "kilometer", "en-US", 1))).toBe("32 2e 34 20 6b 6d");
  });

  it("bornent la décimale là où on le demande", () => {
    // Un compte de répétitions n'a pas de virgule ; une distance en a une.
    expect(uniteLocalisee(2.44, "kilometer", "en", 1)).toBe("2.4 km");
    expect(uniteLocalisee(2.44, "second", "en")).toBe("2 sec");
  });
});

/**
 * Le recensement, sur la couche d'AFFICHAGE seule.
 *
 * Il ne descend pas dans `src/lib` : `formaterDuree` et `formaterDelai` y
 * composent des cadrans — « 5 min 07 », « 2 h 10 », « 4 j 3 h » — qu'`Intl`
 * ne sait pas faire (`Intl.DurationFormat` n'existe pas dans le Node de ce
 * projet, vérifié plutôt que supposé). Ce qu'ils écrivent à la main est la
 * COMPOSITION, pas l'unité, et le premier délègue déjà l'unité à `Intl` dès
 * qu'on lui donne une étiquette de langue.
 */
function fichiersAffichage(dossier: string, sortie: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) {
      if (e.name === "generated" || e.name === "node_modules") continue;
      fichiersAffichage(chemin, sortie);
    } else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

/** Une unité recollée à une interpolation : `${x} min`, `${x}s`, `${x} kg`. */
export const UNITE_A_LA_MAIN = /\$\{[^{}]*\}\s?(?:min|sec|s|h|km|kg|cm)`/;

/** Rend les gabarits fautifs d'une source. */
export function uniteRecollee(source: string): string[] {
  return (source.match(/`[^`]*`/g) ?? []).filter((g) => UNITE_A_LA_MAIN.test(g));
}

describe("aucun composant ne recolle une unité à la main", () => {
  const SRC = join(__dirname);
  const sources = fichiersAffichage(SRC).map((f) => [f, readFileSync(f, "utf8")] as const);

  it("le recensement est vide", () => {
    const fautifs = sources.flatMap(([f, s]) =>
      uniteRecollee(s).map((g) => `${f.replace(SRC, "src")} : ${g}`),
    );
    expect(fautifs).toEqual([]);
  });

  it("et il a réellement lu quelque chose", () => {
    // Sans ce témoin, un dossier renommé rendrait le contrôle vert.
    expect(sources.length).toBeGreaterThan(40);
    expect(sources.flatMap(([, s]) => s.match(/`[^`]*`/g) ?? []).length).toBeGreaterThan(100);
  });

  it("le tri se comporte comme annoncé sur des cas fabriqués", () => {
    // L'état sain est ZÉRO trouvaille : les fichiers réels ne distinguent pas
    // un motif juste d'un motif aveugle.
    for (const cas of [
      "`${seuil / 60} min`", "`${countdown}s`", "`${u.poids} kg`",
      "`${h} h`", "`${q} km`", "`${t} cm`",
    ]) expect(uniteRecollee(cas)).toHaveLength(1);
    for (const cas of [
      "`${formaterDuree(seuil, etiquette)}`",
      "`${uniteLocalisee(q, \"kilometer\", l, 1)}`",
      "`${pseudo} a payé`",          // un mot qui commence par « s » ne compte pas
      "`${n} secondes de plus`",     // un mot entier non plus
      "`rien à voir`",
    ]) expect(uniteRecollee(cas)).toHaveLength(0);
  });
});

describe("la forme ronde et la forme composée s'accordent", () => {
  it("dans les deux langues qui portent leur propre composé", () => {
    /**
     * Elles se croisent sur le même écran : les réglages proposent un seuil
     * rond — « 2分から » — au-dessus d'un exemple de dette composé —
     * « 1分55秒 ». `Intl` rendait « 2 分 » avec une espace, donc deux
     * typographies pour la même unité, à quinze lignes d'écart.
     */
    expect(dureeLocalisee(120, "ja")).toBe("2分");
    expect(dureeLocalisee(115, "ja")).toBe("1分55秒");
    expect(dureeLocalisee(120, "zh")).toBe("2分钟");
    expect(dureeLocalisee(115, "zh")).toBe("1分55秒");
  });

  it("et les quatre langues européennes n'ont pas eu besoin d'être reprises", () => {
    // `Intl` y rend déjà les deux formes d'accord entre elles : la ronde est
    // « 2 min », la composée « 1 min 55 », et la seconde réemploie la
    // première. Le vérifier évite d'ajouter une table dont on n'a pas besoin.
    for (const l of ["fr", "en", "es", "de"]) {
      const rond = dureeLocalisee(120, l);
      expect(dureeLocalisee(115, l).startsWith(rond.replace(/\d+/, "1"))).toBe(true);
    }
  });
});
