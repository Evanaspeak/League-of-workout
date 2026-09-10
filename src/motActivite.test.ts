import { readFileSync } from "node:fs";
import { join } from "node:path";

import { RACINE_I18N, fichiersLangue } from "@/test/fichiersLangue";

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
 *
 * CE QU'IL NE PEUT PAS VOIR, et c'est écrit parce que le cas s'est produit :
 * le FRANÇAIS lui-même qui n'a pas été repris. Le discriminant ci-dessous
 * demande que le français dise « partie » — donc « Cette activité n'a pas de
 * résultat », rendu par `/api/games/[id]` et fidèlement traduit dans les cinq
 * autres langues, lui est invisible. Sabotage fait : le défaut remis à
 * l'identique laisse les deux contrôles au vert.
 *
 * Un garde de cette forme-là n'est pas écrivable. Le mot a deux sens dans ce
 * produit — une partie, et l'activité PHYSIQUE du calcul de calories — et rien
 * dans le français seul ne les sépare : « il ne dit rien de votre activité »,
 * dans la politique de confidentialité, est parfaitement juste. Quinze
 * occurrences françaises recensées, quatorze couvertes par « physique »,
 * « niveau d' » ou « estimation d' », une qui ne l'est pas. Ce qui l'attrape
 * est de LIRE, et c'est ainsi que celle-ci a été trouvée.
 */

/**
 * Le balayage porte sur `src/lib/i18n` ENTIER, pas sur `dictionaries/` seul.
 *
 * Huit modules portent du texte par langue un dossier au-dessus — les messages
 * d'API, les deux courriels, les trois images, la source de diffusion, les
 * métadonnées. Ils ont la MÊME forme que ceux du sous-dossier, langue au
 * premier niveau : rien ne justifiait la frontière, et c'est par elle que
 * « Cette activité n'a pas de résultat » a survécu à deux passes de renommage.
 *
 * Ce que ce recensement élargi a trouvé, écrit plutôt que laissé à refaire :
 * RIEN pour la règle ci-dessous — aucune traduction ne dit « activité » là où
 * le français dit « partie ». Le défaut trouvé était d'une autre nature, et il
 * est nommé dans la limite plus bas.
 */

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

/**
 * La SECONDE forme, et c'est celle où le défaut vivait.
 *
 * `apiErrors.ts` n'a pas de bloc `fr: {` : la clé EST le message français,
 * parce que c'est lui qui circule sur le réseau. Le découpage en blocs ne
 * trouve donc rien et saute le fichier entier — élargir la RACINE ne suffisait
 * pas, il fallait aussi que le garde connaisse la forme.
 *
 * La règle, elle, ne change pas : le français d'un côté, ses traductions de
 * l'autre, la même paire.
 */
export function pairesParCle(source: string): [string, string, string][] {
  const out: [string, string, string][] = [];
  for (const m of source.matchAll(/^ {2}"((?:[^"\\]|\\.)*)":\s*\{([\s\S]*?)^ {2}\},/gm)) {
    const fr = m[1];
    for (const t of m[2].matchAll(/\b(\w+):\s*"((?:[^"\\]|\\.)*)"/g)) out.push([fr, t[1], t[2]]);
  }
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
    let parCle = 0;
    for (const f of fichiersLangue()) {
      const source = readFileSync(join(RACINE_I18N, f), "utf8");
      const b = blocs(source);
      if (!b.fr) {
        for (const [frTexte, l, valeur] of pairesParCle(source)) {
          const motif = MOTS[l];
          if (!motif) continue;
          examinees += 1;
          parCle += 1;
          if (fautif(frTexte, valeur, motif)) fautifs.push(`${f} [${l}] ${frTexte.slice(0, 40)} → ${valeur.slice(0, 60)}`);
        }
        continue;
      }
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
    // Et un témoin SÉPARÉ pour la seconde forme : le premier est satisfait par
    // les cinquante-neuf fichiers de `dictionaries/` à lui seul, donc il
    // resterait vert le jour où `pairesParCle` cesserait de trouver quoi que
    // ce soit — c'est-à-dire là où le défaut a vécu.
    expect(parCle).toBeGreaterThan(200);
    expect(fautifs).toEqual([]);
  });
});
