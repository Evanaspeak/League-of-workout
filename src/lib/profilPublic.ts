import { randomBytes } from "node:crypto";

/**
 * Le profil public, à adresse partageable.
 *
 * Réponse 121 : « Au choix ». C'est donc un réglage, et deux règles en
 * découlent immédiatement sur ce projet :
 *
 * - **le défaut est le plus FERMÉ.** Quelqu'un qui n'ouvre jamais ses réglages
 *   ne doit pas se mettre à publier une page parce qu'on a ajouté une
 *   fonctionnalité. C'est la règle déjà posée pour le partage aux amis ;
 * - **l'adresse ne s'énumère pas.** La mettre sur le pseudo permettrait
 *   d'essayer des pseudos jusqu'à trouver des pages ouvertes, c'est-à-dire de
 *   dresser la liste des comptes qui ont accepté d'être vus. Un jeton tiré au
 *   hasard ne dit rien de qui il désigne.
 *
 * **Éteindre, c'est révoquer.** Le jeton n'existe que tant que le profil est
 * public : le rallumer en tire un NOUVEAU, donc l'ancien lien reste mort. Ça
 * surprend une fois, et c'est le seul sens sûr — un lien qu'on croyait avoir
 * coupé et qui revient à la vie serait bien pire.
 */

/**
 * Longueur du jeton, en octets avant encodage.
 *
 * Le même choix que pour la source de diffusion : ce qui protège une adresse
 * publique n'est pas un contrôle, c'est le fait qu'on ne puisse pas la
 * deviner.
 */
const OCTETS = 24;

/** En dessous, ce n'est pas un jeton : inutile d'interroger la base. */
export const LONGUEUR_MIN_JETON = 24;

export function nouveauJetonProfil(source: () => Buffer = () => randomBytes(OCTETS)): string {
  return source().toString("base64url");
}

/**
 * Ce qu'un profil public montre.
 *
 * **Ni la dette, ni le retard**, et c'est une décision, pas un oubli. Une page
 * qu'on partage soi-même est une fierté : « j'ai payé douze mille points ». Y
 * publier ce qu'on doit et depuis combien de temps on est en retard en ferait
 * un pilori, et personne ne partagerait le lien — donc la fonctionnalité
 * n'existerait pas.
 *
 * C'est aussi ce qui la distingue du profil d'un AMI, qui montre le retard :
 * là, la pression sociale est le but et elle s'exerce entre gens qui se
 * connaissent. Ici, l'adresse peut finir n'importe où.
 */
export type ProfilPublic = {
  pseudo: string;
  /** Points d'effort payés, depuis toujours. */
  points: number;
  serie: number;
  meilleureSerie: number;
  parties: number;
  jeuFavori: string | null;
};

/**
 * Un jeton peut-il désigner un profil ?
 *
 * Sert à ne pas interroger la base sur une adresse qui n'a pas la forme d'un
 * jeton — une faute de frappe, un robot qui essaie des mots.
 */
export function jetonPlausible(brut: unknown): brut is string {
  return typeof brut === "string" && brut.length >= LONGUEUR_MIN_JETON;
}

/**
 * Ce que le réglage demande, et ce qu'il faut écrire.
 *
 * Une valeur qui n'est pas un booléen est REFUSÉE, jamais convertie : c'est un
 * réglage de confidentialité, et enregistrer « public » pour quelqu'un qui
 * vient de demander l'inverse est le seul résultat qu'on ne peut pas
 * rattraper — il croit avoir fermé sa page, et il ne le vérifiera jamais.
 */
export type DecisionProfilPublic =
  | { ok: true; jetonProfil: string | null }
  | { ok: false; erreur: string };

export function decisionProfilPublic(
  demande: unknown,
  jetonActuel: string | null,
  tirer: () => string = nouveauJetonProfil,
): DecisionProfilPublic {
  if (typeof demande !== "boolean") {
    return { ok: false, erreur: "Valeur invalide" };
  }
  if (!demande) return { ok: true, jetonProfil: null };
  // Déjà public : on ne retire pas le lien sous les pieds de quelqu'un qui
  // vient de le coller quelque part.
  return { ok: true, jetonProfil: jetonActuel ?? tirer() };
}
