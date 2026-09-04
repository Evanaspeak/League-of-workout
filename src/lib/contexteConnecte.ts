import {
  dureeAffichee, quantite, repartirPoints, toExerciceId, toExerciceIds,
} from "@/lib/exercices";

/**
 * Ce qu'un écran connecté a besoin de savoir sur le compte, dès l'ouverture.
 *
 * Trois routes rendaient ces trois blocs séparément, et chacune commençait par
 * la même chose : lire la session, puis lire le compte. Sur une page connectée,
 * elles partaient toutes les trois — soit trois allers-retours et trois
 * lectures du même enregistrement, à chaque chargement. En production, chaque
 * requête SQL est un appel HTTPS indépendant vers Neon.
 *
 * Les constructeurs de réponse vivent ici plutôt que dans les routes, pour que
 * `/api/contexte` et les trois routes d'origine rendent EXACTEMENT la même
 * chose. Recopier la mise en forme aurait produit deux vérités qui divergent à
 * la première correction — c'est le défaut le plus souvent rencontré sur ce
 * projet, six fois à ce jour.
 */

/**
 * Dette en attente, sur TOUS les exercices choisis.
 *
 * **Elle ne montrait que ceux comptés en temps**, en miroir de l'accumulation
 * qui ne comptait qu'eux. Les deux filtres se tenaient l'un l'autre, et
 * ensemble ils rendaient le produit muet pour qui fait des pompes : rien ne
 * montait, donc rien ne s'affichait, donc rien ne se payait, donc aucune ligne
 * `Paiement` n'existait — et tout l'étage social restait vide par
 * construction.
 *
 * Ce qui reste vrai du raisonnement d'origine — des pompes se font dans la
 * foulée, un round de boxe demande qu'on en réunisse quelques minutes — est
 * maintenant une affaire d'ÉCRAN : ce qui se compte en répétitions se solde
 * d'une tape, ce qui se compte en temps garde son chrono. Le registre, lui,
 * enregistre les deux.
 */
export function reponseDette(user: {
  dettePointsDus: number;
  rappelSeuilSec: number;
  exercices: string[];
}) {
  const exercices = toExerciceIds(user.exercices);
  // Sans exercice sélectionné du tout, il n'y a rien à répartir.
  const points = exercices.length > 0 ? Math.max(0, user.dettePointsDus) : 0;
  return {
    points,
    exercices,
    /** Ce qu'il y a à faire, exercice par exercice, en POINTS d'effort. */
    repartition: repartirPoints(points, exercices),
    /**
     * La même chose, déjà convertie : secondes pour un exercice au temps,
     * répétitions sinon.
     *
     * Elle est ici parce que l'écran la recalculait de son côté, à partir des
     * points et des ratios installés dans le navigateur. Deux conversions de
     * la même dette, sur deux machines, avec deux jeux de ratios qui peuvent
     * différer d'une minute : la pastille affichait « 3 min 35 » pendant que
     * le seuil d'alerte et la notification, eux, lisaient `dureeSec` et
     * voyaient 8 min 06. La pastille passait en alerte sous son propre seuil,
     * et la notification annonçait un chiffre que rien à l'écran ne montrait.
     *
     * Une seule conversion, faite là où les ratios font autorité. Le
     * navigateur affiche ce qu'on lui donne.
     */
    quantites: Object.fromEntries(
      Object.entries(repartirPoints(points, exercices))
        .map(([id, pts]) => [id, quantite(pts ?? 0, toExerciceId(id))]),
    ) as Record<string, number>,
    /**
     * Temps de travail que ça représente, en secondes.
     *
     * C'est la somme des `quantites` ci-dessus, et pas le temps exact : le
     * seuil d'alerte se compare à ce nombre, et il doit être celui qu'on
     * MONTRE. Sinon la pastille passe en alerte sous son propre seuil.
     */
    dureeSec: Math.round(dureeAffichee(points, exercices)),
    /** Seuil de déclenchement du rappel, en secondes d'effort. 0 = désactivé. */
    seuilSec: Math.max(0, user.rappelSeuilSec),
  };
}

export type EtatConsentement = "jamais" | "accepte" | "refuse";

export function etatConsentement(
  user: { santeConsentiLe: Date | null; santeRefuseLe: Date | null },
): EtatConsentement {
  if (user.santeConsentiLe) return "accepte";
  if (user.santeRefuseLe) return "refuse";
  return "jamais";
}

/**
 * L'état du consentement santé, et de quoi formuler la question.
 *
 * « A-t-il déjà des données ? » change le texte : on ne demande pas la même
 * chose à quelqu'un dont on détient déjà le poids qu'à quelqu'un qui n'a rien
 * donné.
 */
export function reponseConsentement(user: {
  santeConsentiLe: Date | null;
  santeRefuseLe: Date | null;
  genre: string | null;
  age: number | null;
  poids: number | null;
  taille: number | null;
  sportsHoursPerWeek: number | null;
}) {
  return {
    etat: etatConsentement(user),
    aDesDonnees: Boolean(
      user.genre || user.age || user.poids || user.taille || user.sportsHoursPerWeek,
    ),
    depuis: user.santeConsentiLe ?? user.santeRefuseLe ?? null,
  };
}

/**
 * La dette telle qu'elle arrive à l'écran.
 *
 * Déduite de `reponseDette` et non recopiée : elle était déclarée à la main
 * dans DEUX composants, et un champ ajouté au serveur ne les rejoignait ni
 * l'un ni l'autre. C'est le motif de règle écrite deux fois déjà trouvé sept
 * fois sur ce projet, appliqué à un type — la divergence y est encore plus
 * discrète, puisque le compilateur ne se plaint de rien.
 */
export type DettePourEcran = ReturnType<typeof reponseDette>;
