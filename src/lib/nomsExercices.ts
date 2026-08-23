import { EXERCICE_IDS, type ExerciceId } from "@/lib/exercices";

/**
 * Le nom et la description de chaque exercice, dans la langue active.
 *
 * Six écrans recopiaient la même correspondance à la main :
 *
 *     const noms = { pompes: t.pompesNom, squats: t.squatsNom, boxe: t.boxeNom };
 *
 * Ajouter un exercice demandait donc de retrouver ces six endroits, et d'en
 * oublier un ne se voyait qu'à l'usage — un écran affichait alors « undefined »
 * là où les autres nommaient l'exercice. Le compilateur a servi de liste cette
 * fois-ci, mais uniquement parce que le type est exhaustif ; il ne dira rien
 * du septième endroit qu'on écrira demain.
 */
type Textes = Record<string, unknown>;

/** Ce que porte le dictionnaire pour un exercice : `pompesNom`, `pompesDesc`. */
function texte(t: Textes, cle: string): string {
  const valeur = t[cle];
  return typeof valeur === "string" ? valeur : "";
}

export function nomsExercices(t: Textes): Record<ExerciceId, string> {
  const out = {} as Record<ExerciceId, string>;
  for (const id of EXERCICE_IDS) out[id] = texte(t, `${id}Nom`);
  return out;
}

export function descriptionsExercices(t: Textes): Record<ExerciceId, string> {
  const out = {} as Record<ExerciceId, string>;
  for (const id of EXERCICE_IDS) out[id] = texte(t, `${id}Desc`);
  return out;
}
