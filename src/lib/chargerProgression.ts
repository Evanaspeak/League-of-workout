"use client";

/**
 * Les paliers et la série, demandés une fois pour les deux composants.
 *
 * `Paliers` et `SerieEtRetard` vivent tous deux sur le tableau de bord et
 * écoutent tous deux `wow-dette-changee`. Chacun demandait sa route, et les
 * deux routes lisaient la même requête de paiements : deux allers-retours au
 * chargement, deux de plus après chaque paiement.
 *
 * Même mémoire de module que `chargerContexte`, et pour la même raison : ce
 * n'est pas la route fusionnée qui économise l'appel, c'est le fait qu'un seul
 * appelant le fasse.
 */
export type Progression = {
  badges: unknown;
  serie: unknown;
};

let enCours: Promise<Progression | null> | null = null;

function demander(jour: string): Promise<Progression | null> {
  return fetch(`/api/progression?jour=${jour}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

export function chargerProgression(jour: string): Promise<Progression | null> {
  if (!enCours) enCours = demander(jour);
  return enCours;
}

/** Redemande au serveur : après un paiement, la série et les paliers bougent. */
export function rafraichirProgression(jour: string): Promise<Progression | null> {
  enCours = demander(jour);
  return enCours;
}
