import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * « Activité » ne désigne plus une partie, et pas seulement en français.
 *
 * Le mot désignait une PARTIE dans tout le produit, et il était exact le jour
 * où il a été écrit. Le propriétaire l'a lu de travers pendant des semaines :
 * « comment ça se fait que j'ai plus de 900 pt d'activité et que je suis que
 * niveau 5 » — le chiffre qu'il regardait était de la DETTE, exprimée en
 * pompes. Onze clés ont été renommées en « partie ».
 *
 * Le renommage n'a touché que le FRANÇAIS. Une première reprise en a rattrapé
 * vingt-quatre en allemand ; celle-ci en trouve vingt-cinq de plus, dans cinq
 * dictionnaires et cinq langues — dont l'écran d'export des données, qui
 * annonçait « toutes tes activités » en japonais sous un français qui dit
 * « l'intégralité de tes parties ».
 *
 * C'est le motif que ce projet paie en boucle, et il ne prend jamais la forme
 * d'une copie qu'on remarque : il prend celle d'une correction qui n'en répare
 * qu'une part.
 */

const DICOS = join(process.cwd(), "src", "lib", "i18n", "dictionaries");
const LANGUES = ["fr", "en", "es", "de", "zh", "ja"] as const;

/**
 * Les mots de l'ACTIVITÉ dans chaque langue.
 *
 * L'anglais, l'espagnol et l'allemand demandent une frontière de mot :
 * « Aktivitätsgrad » est un autre mot, et le refuser recalerait le niveau
 * d'activité physique, qui est légitime. Le chinois et le japonais n'ont pas
 * de frontière de mot — c'est le bloc français qui les disculpe.
 */
const MOTS: Record<string, RegExp> = {
  en: /\bactivit(y|ies)\b/i,
  es: /\bactividad(es)?\b/i,
  de: /\bAktivität(en)?\b/,
  zh: /活动/,
  ja: /アクティビティ/,
};

/**
 * Le discriminant, et c'est le bloc FRANÇAIS qui le porte.
 *
 * Le même mot a deux sens dans ce produit : une PARTIE, et l'activité
 * PHYSIQUE du calcul de calories. Les distinguer par le texte de la langue
 * examinée est impossible — « Aktivitätsgrad » et « Aktivitäten » se
 * ressemblent trop, et le chinois n'a pas d'espace. Ce qui tranche est ce que
 * dit le français POUR LA MÊME CLÉ : s'il dit « partie », la traduction ne
 * peut pas dire « activité ». S'il dit lui-même « activité », c'est l'autre
 * sens, et il n'y a rien à reprocher.
 */
export function fautif(fr: string, traduction: string, motif: RegExp): boolean {
  return motif.test(traduction) && /\bpartie/i.test(fr);
}

function blocs(source: string): Record<string, string> {
  const out: Record<string, string> = {};
  const pos: [number, string][] = [];
  for (const l of LANGUES) {
    const m = new RegExp(`^  ${l}: \\{`, "m").exec(source);
    if (m) pos.push([m.index, l]);
  }
  pos.sort((a, b) => a[0] - b[0]);
  pos.forEach(([p, l], i) => {
    out[l] = source.slice(p, i + 1 < pos.length ? pos[i + 1][0] : source.length);
  });
  return out;
}

function entrees(bloc: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of bloc.matchAll(/^ {4}(\w+):\s*"((?:[^"\\]|\\.)*)"/gm)) out[m[1]] = m[2];
  return out;
}

describe("le mot « activité »", () => {
  it("distingue les deux sens par ce que dit le français", () => {
    // Éprouvé sur des cas FABRIQUÉS : les fichiers réels ne contiennent, une
    // fois corrigés, que des cas que le discriminant accepte — donc ils ne le
    // distinguent pas d'un discriminant cassé.
    expect(fautif("Toutes les parties", "Alle Aktivitäten", MOTS.de)).toBe(true);
    expect(fautif("Ton niveau d'activité", "Dein Aktivitätsgrad", MOTS.de)).toBe(false);
    expect(fautif("Une ligne par partie", "一次活动一行", MOTS.zh)).toBe(true);
    expect(fautif("Ton niveau d'activité", "你的活动水平", MOTS.zh)).toBe(false);
    // Et une traduction sans le mot ne se reproche rien, quoi que dise le
    // français.
    expect(fautif("Toutes les parties", "Alle Runden", MOTS.de)).toBe(false);
  });

  it("ne survit dans aucune langue là où le français dit « partie »", () => {
    const fautifs: string[] = [];
    let examinees = 0;
    for (const f of readdirSync(DICOS).filter((x) => x.endsWith(".ts"))) {
      const b = blocs(readFileSync(join(DICOS, f), "utf8"));
      if (!b.fr) continue;
      const fr = entrees(b.fr);
      for (const [l, motif] of Object.entries(MOTS)) {
        if (!b[l]) continue;
        for (const [cle, valeur] of Object.entries(entrees(b[l]))) {
          if (!(cle in fr)) continue;
          examinees += 1;
          if (fautif(fr[cle], valeur, motif)) fautifs.push(`${f} [${l}] ${cle} → ${valeur.slice(0, 60)}`);
        }
      }
    }
    // Témoin : sans lui, un découpage de blocs cassé rendrait le contrôle vert
    // en n'ayant comparé aucune entrée.
    expect(examinees).toBeGreaterThan(2000);
    expect(fautifs).toEqual([]);
  });
});
