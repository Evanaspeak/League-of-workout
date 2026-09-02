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

/**
 * Mémorise l'appel en vol, mais pas son échec.
 *
 * La mémoire existe pour qu'un seul appel serve à tout le monde. Retenir
 * l'ÉCHEC, c'est autre chose : une coupure d'une seconde au chargement rendait
 * `null` à tous les composants pour toute la durée de la page — compteur de
 * dette vide, lien d'administration absent, demande de consentement reposée.
 * Rien n'est perdu, mais l'écran ment jusqu'au prochain `rafraichir`, qui peut
 * ne jamais venir.
 *
 * On efface donc la mémoire quand la réponse n'est pas venue, et le prochain
 * composant qui se monte retente. Les montages d'un même écran ont lieu dans
 * le même tour de boucle et partagent l'appel en vol : il n'y a pas de tempête
 * à craindre.
 */
function memoriser(p: Promise<ContexteCompte | null>): Promise<ContexteCompte | null> {
  enCours = p;
  void p.then((c) => { if (c === null && enCours === p) enCours = null; });
  return p;
}

export function chargerContexte(): Promise<ContexteCompte | null> {
  return enCours ?? memoriser(demander());
}

/** Redemande au serveur et remplace ce que tout le monde lira ensuite. */
export function rafraichirContexte(): Promise<ContexteCompte | null> {
  return memoriser(demander());
}

/** Pour les tests : la mémoire ne doit pas traverser deux cas. */
export function oublierContexte(): void {
  enCours = null;
}
