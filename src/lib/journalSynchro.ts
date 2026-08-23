/**
 * Le journal des synchronisations Riot.
 *
 * Question 194 : « que se passe-t-il quand Riot répond en erreur ? »  Réponse,
 * vérifiée dans le code : rien. La boucle faisait `if (!res.ok) return;` et
 * l'utilisateur ne voyait aucune différence entre « Riot est en panne », « la
 * clé est saturée » et « tu n'as pas encore joué ». Trois situations qui ne se
 * corrigent pas de la même façon.
 *
 * Le journal vit dans le navigateur et non en base : c'est une trace de
 * diagnostic, pas une donnée du compte. La garder côté serveur reviendrait à
 * écrire une ligne en base toutes les deux minutes par personne connectée,
 * pour une information dont plus personne n'a besoin le lendemain.
 */

export type Resultat = "partie" | "rien" | "erreur" | "refus";

export type Entree = {
  /** Instant, en millisecondes depuis l'époque. */
  quand: number;
  resultat: Resultat;
  /** Code HTTP quand il y en a un. */
  code?: number;
  /** Ce qu'on peut en dire, court. */
  detail?: string;
};

/** Au-delà, on ne diagnostique plus rien : on fait défiler. */
export const MAX_ENTREES = 20;

export const CLE = "low_journal_synchro";

/** Ajoute une entrée en tête, et oublie les plus vieilles. */
export function ajouter(journal: Entree[], entree: Entree): Entree[] {
  return [entree, ...journal].slice(0, MAX_ENTREES);
}

/**
 * Ce qu'un code HTTP veut dire pour la personne qui attend ses parties.
 *
 * Le code seul ne dit rien à qui n'écrit pas de logiciel. Et les trois cas se
 * corrigent différemment : attendre, changer un réglage, ou ne rien faire.
 */
export function lireCode(code: number): { resultat: Resultat; detail: string } {
  if (code === 429) {
    return { resultat: "refus", detail: "Trop de synchronisations, ou clé saturée. Ça repart tout seul." };
  }
  if (code === 400) {
    return { resultat: "erreur", detail: "Compte Riot mal renseigné. À corriger dans les réglages." };
  }
  if (code === 401 || code === 403) {
    return { resultat: "erreur", detail: "La clé Riot du serveur est refusée. Rien à faire de votre côté." };
  }
  if (code === 404) {
    return { resultat: "rien", detail: "Riot ne trouve aucune partie récente." };
  }
  if (code >= 500) {
    return { resultat: "erreur", detail: "Riot ne répond pas. Ça arrive, et ça repart." };
  }
  return { resultat: "erreur", detail: `Réponse inattendue (${code}).` };
}

/** Lit le journal du navigateur, sans jamais lever. */
export function charger(): Entree[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return [];
    const lu = JSON.parse(brut);
    if (!Array.isArray(lu)) return [];
    // Une entrée mal formée ne doit pas emporter tout le journal : on garde
    // ce qui se lit et on jette le reste.
    return lu
      .filter((e) => e && typeof e.quand === "number" && typeof e.resultat === "string")
      .slice(0, MAX_ENTREES);
  } catch {
    return [];
  }
}

/** Écrit le journal, sans jamais lever non plus. */
export function enregistrer(journal: Entree[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CLE, JSON.stringify(journal.slice(0, MAX_ENTREES)));
  } catch {
    // Stockage plein ou refusé : le journal est un confort, pas une donnée.
  }
}

/** Note une synchronisation, et rend le journal à jour. */
export function noter(entree: Omit<Entree, "quand"> & { quand?: number }): Entree[] {
  const complet: Entree = { quand: entree.quand ?? Date.now(), ...entree };
  const journal = ajouter(charger(), complet);
  enregistrer(journal);
  return journal;
}
