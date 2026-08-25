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
import { ecrire, lire } from "./stockage";

export type Resultat = "partie" | "rien" | "erreur" | "refus";

export type Entree = {
  /** Instant, en millisecondes depuis l'époque. */
  quand: number;
  resultat: Resultat;
  /** Code HTTP quand il y en a un. */
  code?: number;
  /** Ce qu'on peut en dire, sous forme de clé de traduction. */
  motif?: MotifSynchro;
  /**
   * Ancienne phrase française, écrite en dur avant que le journal ne soit
   * traduit. Les entrées déjà rangées dans le navigateur la portent encore :
   * on la lit à défaut de motif, plutôt que de vider leur colonne.
   */
  detail?: string;
  /**
   * Combien de fois de suite la même chose s'est produite.
   *
   * Sans clé Riot de production, la boucle rend le même refus toutes les deux
   * minutes : le journal devenait vingt lignes identiques, c'est-à-dire vingt
   * fois rien. Or ce qui se diagnostique, c'est « depuis quand » et « combien
   * de fois », pas la vingtième copie. Absent vaut « une fois ».
   */
  repetitions?: number;
};

/** Au-delà, on ne diagnostique plus rien : on fait défiler. */
export const MAX_ENTREES = 20;

export const CLE = "low_journal_synchro";

/**
 * Ajoute une entrée en tête, et oublie les plus vieilles.
 *
 * Une entrée identique à celle du dessus ne s'empile pas : elle incrémente son
 * compteur et rafraîchit son instant. « Identique » se juge sur ce qui
 * explique — résultat, code, motif, détail —, jamais sur l'instant, sinon rien
 * ne serait jamais identique.
 */
export function ajouter(journal: Entree[], entree: Entree): Entree[] {
  const tete = journal[0];
  if (tete && memeCause(tete, entree)) {
    const fusionnee: Entree = {
      ...entree,
      repetitions: (tete.repetitions ?? 1) + 1,
    };
    return [fusionnee, ...journal.slice(1)];
  }
  return [entree, ...journal].slice(0, MAX_ENTREES);
}

function memeCause(a: Entree, b: Entree): boolean {
  return a.resultat === b.resultat
    && a.code === b.code
    && a.motif === b.motif
    && a.detail === b.detail;
}

/**
 * Ce qu'un code HTTP veut dire pour la personne qui attend ses parties.
 *
 * Le code seul ne dit rien à qui n'écrit pas de logiciel. Et les cas se
 * corrigent différemment : attendre, changer un réglage, ou ne rien faire.
 *
 * La fonction rend une **clé**, pas une phrase. Les phrases étaient écrites
 * ici, en français, dans un module sans React : quelqu'un qui lit
 * l'application en allemand voyait son journal en français. La traduction se
 * fait à l'affichage, où le dictionnaire est disponible.
 */
export type MotifSynchro =
  | "saturee" | "compteMalRenseigne" | "cleRefusee" | "sessionExpiree" | "indisponible"
  | "resultatIllisible"
  | "riotMuet" | "aucunePartie" | "inattendu";

export function lireCode(code: number): { resultat: Resultat; motif: MotifSynchro } {
  if (code === 429) return { resultat: "refus", motif: "saturee" };
  if (code === 400) return { resultat: "erreur", motif: "compteMalRenseigne" };
  /**
   * 401 et 403 ne disent pas la même chose, et ils le disaient.
   *
   * 401 est le code de NOTRE porte : « pas de session ». Les routes Riot
   * renvoyaient en plus le code de Riot tel quel, donc un 401 pouvait aussi
   * vouloir dire « Riot a refusé notre clé » — et le journal annonçait « clé
   * refusée » à quelqu'un dont la session venait simplement d'expirer. Les
   * routes traduisent maintenant (`src/lib/riotStatut.ts`) : 403 pour la clé,
   * 401 pour la session, un sens par code.
   */
  if (code === 401) return { resultat: "erreur", motif: "sessionExpiree" };
  if (code === 403) return { resultat: "erreur", motif: "cleRefusee" };
  if (code === 404) return { resultat: "rien", motif: "aucunePartie" };
  /**
   * 422 : la partie est là, son résultat ne se lit pas.
   *
   * Un remake, ou deux sources Riot qui se contredisent. Ce n'est ni une
   * panne ni une absence de partie : c'est un refus délibéré d'enregistrer
   * plutôt que de deviner du côté « défaite », qui coûte une dette.
   */
  if (code === 422) return { resultat: "refus", motif: "resultatIllisible" };
  /**
   * 503 : c'est NOUS qui ne sommes pas prêts, pas Riot.
   *
   * Sans clé de production, la route rendait 500, et le journal annonçait
   * « Riot ne répond pas ». C'est faux, et c'est la situation du lancement :
   * on aurait imputé à Riot une case vide de notre côté, pendant des jours.
   */
  if (code === 503) return { resultat: "erreur", motif: "indisponible" };
  if (code >= 500) return { resultat: "erreur", motif: "riotMuet" };
  return { resultat: "erreur", motif: "inattendu" };
}

/** Lit le journal du navigateur, sans jamais lever. */
export function charger(): Entree[] {
  // Plus de garde `typeof localStorage` ici : la disponibilité du stockage est
  // le travail de `src/lib/stockage.ts`, qui rend `null` quand il n'y a rien à
  // ouvrir. Le garde était devenu faux — il regardait un objet global que le
  // module ne lit plus.
  try {
    const brut = lire(CLE);
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
  try {
    ecrire(CLE, JSON.stringify(journal.slice(0, MAX_ENTREES)));
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
