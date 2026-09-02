import {
  normaliserRatios, quantite, toExerciceId,
  type ExerciceId, type RatiosExercices,
} from "@/lib/exercices";

/**
 * Le barème sous lequel une partie a été chiffrée.
 *
 * Les points d'effort ne dépendent d'aucun ratio : `pompesCalculees` vaut
 * autant de pompes, et le ratio ne sert qu'à dire combien de secondes de boxe
 * ou de squats cela représente. C'est donc l'AFFICHAGE que cette colonne gèle,
 * et c'est bien lui qui bougeait : changer le prix d'une seconde de boxe dans
 * le panneau d'administration réécrivait tout l'historique de tout le monde.
 * Une soirée qui avait coûté 4 min 25 en affichait 8 min 50, et l'effort déjà
 * fourni ne correspondait plus à rien.
 *
 * Un barème s'applique à partir du moment où on le change, jamais en arrière.
 *
 * Rend `null` pour les parties qui n'en portent pas — celles d'avant la
 * colonne — et pour un JSON illisible. La conversion retombe alors sur les
 * ratios en vigueur, ce qui est le seul repli possible et celui qui ne change
 * rien à ce qui était affiché jusque-là.
 */
export function baremeDeLaPartie(brut: unknown): RatiosExercices | null {
  if (typeof brut !== "string" || brut.length === 0) return null;
  try {
    return normaliserRatios(JSON.parse(brut));
  } catch {
    return null;
  }
}

/** Une partie, réduite à ce qu'il faut pour cumuler : sa ventilation et son barème. */
export type LigneCumulable = {
  id: string;
  parts: Record<string, number | undefined>;
  ratios?: string | null;
};

/**
 * Le cumul par exercice, en QUANTITÉS, à l'instant de chaque partie.
 *
 * Additionner les points puis convertir la somme reviendrait à réévaluer tout
 * le passé au barème du jour — c'est-à-dire à refaire exactement ce qu'on
 * corrige. On convertit donc partie par partie, sous son propre barème, puis
 * on additionne des répétitions et des secondes.
 *
 * Les parties sont attendues de la PLUS RÉCENTE à la plus ancienne, comme
 * l'historique les affiche ; le cumul se construit en les remontant.
 */
export function cumulsParExercice(
  parties: LigneCumulable[],
): Map<string, Record<string, number>> {
  const cumuls = new Map<string, Record<string, number>>();
  const courant: Record<string, number> = {};
  for (let i = parties.length - 1; i >= 0; i--) {
    const ligne = parties[i];
    const bareme = baremeDeLaPartie(ligne.ratios);
    for (const [ex, pts] of Object.entries(ligne.parts)) {
      const id: ExerciceId = toExerciceId(ex);
      courant[ex] = (courant[ex] ?? 0) + quantite(pts ?? 0, id, bareme);
    }
    const instantane: Record<string, number> = {};
    for (const ex of Object.keys(ligne.parts)) instantane[ex] = courant[ex];
    cumuls.set(ligne.id, instantane);
  }
  return cumuls;
}
