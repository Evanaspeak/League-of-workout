import { prochainPalier, tousLesBadges } from "@/lib/badges";
import { avancementNiveau, titrePorte } from "@/lib/niveauCompte";
import { etatRetard, longueurSerie, meilleureSerie } from "@/lib/serie";

/**
 * Les paliers et la série, lus une seule fois.
 *
 * `/api/badges` et `/api/serie` partaient toutes les deux à chaque chargement
 * du tableau de bord, et toutes les deux après chaque paiement — elles
 * écoutent le même événement. Or elles lisaient **exactement la même
 * requête** : les huit cents derniers jours payés du compte, triés du plus
 * récent au plus ancien.
 *
 * En production chaque requête SQL est un appel HTTPS indépendant vers Neon :
 * deux lectures identiques coûtent deux allers-retours, et il y en avait quatre
 * par soirée dès qu'on payait sa dette.
 *
 * La mise en forme vit ici pour que la route fusionnée et les deux d'origine
 * rendent la même chose. C'est le motif déjà employé pour `/api/contexte`, et
 * la raison est la même : deux exemplaires d'une règle divergent à la première
 * correction.
 */

/** Ce qu'on lit en base, et rien d'autre. */
export type SourceProgression = {
  /** Effort GÉNÉRÉ, c'est-à-dire ce que les parties ont coûté. Les paliers. */
  totalPoints: number;
  parties: number;
  jours: string[];
  /**
   * Effort PAYÉ, pour le niveau et le titre.
   *
   * Ce n'est pas le même chiffre que `totalPoints`, et c'est toute la raison
   * pour laquelle il porte un autre nom : les paliers récompensent le volume
   * joué, le niveau récompense ce qui a été fait. Confondre les deux ferait
   * monter de niveau celui qui perd sans jamais payer, sur un produit dont le
   * sujet est de payer.
   */
  pointsPayes: number;
};

export function reponseBadges(src: SourceProgression) {
  const source = {
    totalPoints: src.totalPoints,
    parties: src.parties,
    meilleureSerie: meilleureSerie(src.jours),
    // Un même jour peut porter plusieurs paiements : ce qui compte est le
    // nombre de JOURS où l'on a fait quelque chose.
    joursPayes: new Set(src.jours).size,
  };
  return {
    source,
    badges: tousLesBadges(source),
    prochain: prochainPalier(source),
    /**
     * Le niveau et le titre partent d'ici, et pas d'une route à eux.
     *
     * Ils se déduisent EXACTEMENT de `source`, que cette route compose déjà :
     * leur donner une adresse ferait un aller-retour de plus vers Neon pour
     * relire les mêmes lignes. C'est le défaut corrigé en fusionnant
     * `/api/badges` et `/api/serie`, et il ne se refait pas.
     */
    niveau: avancementNiveau(src.pointsPayes),
    titre: titrePorte({
      pointsPayes: src.pointsPayes,
      parties: source.parties,
      meilleureSerie: source.meilleureSerie,
      joursPayes: source.joursPayes,
    }),
  };
}

export function reponseSerie(
  src: SourceProgression,
  aujourdhui: string,
  compte: { detteDepuis: Date | null; dettePointsDus: number },
) {
  const retard = etatRetard(compte.detteDepuis, compte.dettePointsDus);
  return {
    serie: longueurSerie(src.jours, aujourdhui),
    meilleure: meilleureSerie(src.jours),
    payeAujourdhui: src.jours.includes(aujourdhui),
    enRetard: retard.enRetard,
    joursDeRetard: retard.jours,
  };
}
