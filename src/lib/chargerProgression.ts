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
  exploits?: unknown;
  defi?: unknown;
  defisMois?: unknown;
  collectif?: unknown;
};

let enCours: Promise<Progression | null> | null = null;
/** Le jour de la réponse mémorisée : passé minuit, ce n'est plus la bonne. */
let jourEnCours: string | null = null;

function demander(jour: string): Promise<Progression | null> {
  return fetch(`/api/progression?jour=${jour}`)
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
}

/**
 * La mémoire porte le JOUR demandé, et ne retient pas un échec.
 *
 * Deux défauts dans la première version, tous deux muets. Le jour était ignoré
 * après le premier appel : un onglet laissé ouvert pendant la nuit gardait la
 * série de la veille, avec son état de retard. Et l'échec était mémorisé comme
 * une réponse : une coupure d'une seconde effaçait les paliers et la série
 * pour toute la durée de la page.
 */
export function chargerProgression(jour: string): Promise<Progression | null> {
  if (!enCours || jourEnCours !== jour) return rafraichirProgression(jour);
  return enCours;
}

/** Redemande au serveur : après un paiement, la série et les paliers bougent. */
export function rafraichirProgression(jour: string): Promise<Progression | null> {
  const p = demander(jour);
  enCours = p;
  jourEnCours = jour;
  void p.then((r) => { if (r === null && enCours === p) { enCours = null; jourEnCours = null; } });
  return p;
}

/** Pour les tests : la mémoire ne doit pas traverser deux cas. */
export function oublierProgression(): void {
  enCours = null;
  jourEnCours = null;
}
