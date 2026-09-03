/**
 * Le parrainage : un lien qui amène quelqu'un, et ce que les deux y gagnent.
 *
 * Réponse 119, et c'est le seul canal d'acquisition du plan qui travaille sans
 * qu'on s'en occupe. Le retour reçu de Reddit — « ça fait trop IA » — dit
 * assez que la page seule ne suffit pas : ce qui amène du monde, ici, c'est
 * quelqu'un qui invite quelqu'un.
 *
 * **La règle qui gouverne tout le reste : un code fautif ne fait JAMAIS échouer
 * l'inscription.** Un lien tronqué par un client de messagerie, recopié à la
 * main, ou dont le parrain a supprimé son compte, doit laisser passer la
 * création du compte. Refuser reviendrait à perdre exactement la personne
 * qu'on venait de convaincre, et à lui dire que c'est SA faute. C'est la même
 * décision que pour l'objectif par défaut à l'inscription : une décoration qui
 * manque ne refuse pas un compte.
 */
import { LONGUEUR_CODE, normaliserCode, nouveauCode } from "@/lib/social";

/**
 * Le code de parrainage réemploie celui des groupes.
 *
 * Même problème, même solution : un code se dicte en vocal avant de se taper,
 * donc l'alphabet écarte ce qui se confond à la lecture, et le tirage rejette
 * les octets hors d'un multiple de la taille de l'alphabet plutôt que de
 * prendre un modulo. L'écrire une seconde fois aurait été le septième cas de
 * règle dupliquée de ce projet.
 */
export { LONGUEUR_CODE, normaliserCode, nouveauCode };

export type DecisionParrainage =
  /** Aucun lien à poser : le compte se crée seul, et c'est très bien. */
  | { quoi: "ignore"; raison: "absent" | "illisible" | "inconnu" | "soi-meme" }
  /** Le lien se pose, et l'amitié avec. */
  | { quoi: "lie"; parrainId: string };

/**
 * Ce qu'on fait d'un code reçu à l'inscription.
 *
 * `parrain` est le compte que le code désigne, ou `null` s'il n'en désigne
 * aucun — c'est l'appelant qui va le chercher, parce que lui seul parle à la
 * base.
 *
 * Le cas « soi-même » ne peut pas arriver à l'inscription, où le compte
 * n'existe pas encore. Il est traité quand même : la fonction sert aussi à
 * dire ce qu'un lien vaut, et un jour quelqu'un l'appellera ailleurs.
 */
export function decisionParrainage(
  codeBrut: unknown,
  parrain: { id: string } | null,
  filleulId: string | null = null,
): DecisionParrainage {
  if (codeBrut === undefined || codeBrut === null || codeBrut === "") {
    return { quoi: "ignore", raison: "absent" };
  }
  if (normaliserCode(codeBrut) === null) return { quoi: "ignore", raison: "illisible" };
  if (!parrain) return { quoi: "ignore", raison: "inconnu" };
  if (filleulId !== null && parrain.id === filleulId) {
    return { quoi: "ignore", raison: "soi-meme" };
  }
  return { quoi: "lie", parrainId: parrain.id };
}

/**
 * L'avantage, et pourquoi c'est celui-là.
 *
 * Le produit n'a ni monnaie ni palier payant : l'avantage ne peut donc être
 * qu'une chose qui existe déjà. Deux candidats ont été écartés, et la raison
 * vaut d'être écrite parce qu'elle est la même :
 *
 *  * **offrir des points d'effort** — ils sont l'unité de la dette, et un
 *    point donné est une pompe que personne n'a faite. Ça fausserait le
 *    classement, les paliers et le bilan d'un coup ;
 *  * **retirer de la dette** — même chose, à l'envers.
 *
 * Ce qui reste, et qui ne coûte rien au registre : **les deux comptes
 * deviennent amis.** Le filleul arrive avec quelqu'un dans son classement au
 * lieu de la phrase « tu es seul ici », et le parrain gagne la personne qu'il
 * a fait venir. C'est immédiat, c'est réciproque, et ça se retire des deux
 * côtés comme n'importe quelle amitié.
 *
 * Ce que ça N'EST PAS : un ajout non sollicité. Le filleul a cliqué le lien du
 * parrain, et le parrain l'a publié — les deux ont consenti à ce que ce lien
 * fasse quelque chose. Le plafond d'amis vaut toujours : quelqu'un qui colle
 * son lien partout ne dépasse pas cent.
 */
export const AVANTAGE = "amitie" as const;
