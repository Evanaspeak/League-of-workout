import { readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Les fichiers qui portent du texte par langue, et leur racine.
 *
 * Six gardes de langue balayaient `src/lib/i18n/dictionaries` SEUL, alors que
 * quinze modules porteurs de texte vivent un dossier au-dessus — `apiErrors`,
 * `courriels`, `metadonnees`, `notifications`, les trois images, la source de
 * diffusion. C'est ce trou qui a laissé « Cette activité n'a pas de résultat »
 * six jours après son renommage, et deux descriptions Google vouvoyer sous des
 * écrans qui tutoient.
 *
 * Le balayage vit ICI plutôt que recopié dans chaque garde : cinq exemplaires
 * d'une même règle finissent avec quatre versions en retard, et c'est le motif
 * que ce dépôt paie le plus souvent.
 *
 * Les chemins rendus sont RELATIFS à la racine, et c'est la condition d'une
 * dispense qui désigne quelque chose : `notifications.ts` existe dans LES DEUX
 * dossiers, donc une dispense portée par le nom de base en couvrirait deux.
 */
export const RACINE_I18N = join(process.cwd(), "src", "lib", "i18n");

/** Les `.ts` de la racine, sous-dossiers compris, tests exclus. */
export function fichiersLangue(dossier = RACINE_I18N, prefixe = ""): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dossier, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const rel = prefixe ? `${prefixe}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...fichiersLangue(join(dossier, e.name), rel));
    else if (e.name.endsWith(".ts") && !e.name.includes(".test.")) out.push(rel);
  }
  return out;
}

/**
 * TOUS les blocs français d'un fichier, à n'importe quelle indentation.
 *
 * Le lecteur de `registre.test.ts` n'en cherchait qu'un, à deux espaces.
 * `metadonnees.ts` en porte huit à quatre espaces — une page par clé, puis les
 * six langues sous chacune — donc le fichier entier était sauté, et c'est par
 * là que deux descriptions vouvoyantes ont survécu à un écran qui tutoie.
 */
export function blocsFrancais(source: string): string[] {
  // `[\s\S]` plutôt que le drapeau `s` : la cible de compilation du projet est
  // antérieure à ES2018, et `tsc` refuse le drapeau.
  const out: string[] = [];
  for (const m of source.matchAll(/\n( +)fr: \{([\s\S]*?)\n\1[a-z]{2}: \{/g)) out.push(m[2]);
  return out;
}

/**
 * Le français d'`apiErrors.ts`, qui n'a pas de bloc du tout : la clé EST le
 * message français, parce que c'est lui qui circule sur le réseau.
 */
export function clesFrancaises(source: string): string[] {
  // La LIGNE entière, guillemets compris : les deux formes deviennent
  // homogènes, et `cleDeLigne` sait alors lire l'une comme l'autre. Rendre la
  // clé nue faisait perdre les tolérances — elle ne ressemblait plus à une clé.
  return [...source.matchAll(/^ {2}"(?:[^"\\]|\\.)*":\s*\{/gm)].map((m) => m[0]);
}

/** Le français d'un fichier, quelle que soit sa forme. */
export function francais(source: string): string[] {
  const blocs = blocsFrancais(source);
  return blocs.length ? blocs : clesFrancaises(source);
}

/**
 * La clé d'une ligne, dans les DEUX formes.
 *
 * Un identifiant nu dans les dictionnaires (`veilleJour: "…"`), et une chaîne
 * entre guillemets dans `apiErrors.ts`, où le message français EST la clé.
 */
export function cleDeLigne(ligne: string): string {
  return /^\s*"((?:[^"\\]|\\.)*)"\s*:/.exec(ligne)?.[1]
    ?? /^\s*([A-Za-z0-9_]+)\s*:/.exec(ligne)?.[1]
    ?? "";
}
