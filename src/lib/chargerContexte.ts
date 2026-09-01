"use client";

/**
 * Un seul appel de contexte par chargement de page, partagé par tous.
 *
 * `useIdCompte` mémorisait déjà `/api/user` au niveau du module, pour la même
 * raison : plusieurs composants ont besoin de savoir qui est connecté, et
 * chacun le demandait de son côté. La mémoire vit ici maintenant, un cran plus
 * haut, pour que le fournisseur de contexte et cette mémoire-là ne fassent pas
 * DEUX appels là où il en faut un.
 *
 * La promesse vit le temps du chargement de la page — exactement la durée
 * pendant laquelle l'identité ne peut pas changer, puisqu'en changer impose de
 * recharger. Ce qui change, la dette, se redemande par `rafraichir()`.
 */
export type ContexteCompte = {
  user: (Record<string, unknown> & { id?: string; estAdmin?: boolean }) | null;
  dette: Record<string, unknown> | null;
  consentement: Record<string, unknown> | null;
};

let enCours: Promise<ContexteCompte | null> | null = null;

function demander(): Promise<ContexteCompte | null> {
  return fetch("/api/contexte")
    .then((r) => (r.ok ? r.json() : null))
    .then((c) => (c && typeof c === "object" ? (c as ContexteCompte) : null))
    // Hors ligne, ou session expirée : `null` plutôt qu'une promesse rejetée
    // que chaque appelant devrait rattraper de son côté.
    .catch(() => null);
}

export function chargerContexte(): Promise<ContexteCompte | null> {
  if (!enCours) enCours = demander();
  return enCours;
}

/** Redemande au serveur et remplace ce que tout le monde lira ensuite. */
export function rafraichirContexte(): Promise<ContexteCompte | null> {
  enCours = demander();
  return enCours;
}

/** Pour les tests : la mémoire ne doit pas traverser deux cas. */
export function oublierContexte(): void {
  enCours = null;
}
