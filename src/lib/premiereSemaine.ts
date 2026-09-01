/**
 * L'objectif de première semaine.
 *
 * Ce que quelqu'un fait dans ses sept premiers jours décide s'il reviendra ;
 * le reste du produit n'y peut plus grand-chose après. L'objectif est donc
 * volontairement petit — cinq parties, ce qu'on enregistre en une soirée — et
 * il ne demande rien de plus que ce que l'application fait déjà. Un objectif
 * qui exige un geste nouveau ajoute une marche au lieu d'en enlever une.
 *
 * Il disparaît au bout de sept jours, atteint ou non. Un objectif raté qui
 * reste affiché n'est plus un objectif, c'est un reproche.
 *
 * **Atteint, il ne disparaît plus tout de suite.** Il s'effaçait à la seconde
 * où on l'atteignait : réussir et ignorer produisaient exactement le même
 * écran, c'est-à-dire rien. Quelqu'un qui enregistre ses cinq parties le
 * premier soir voyait sa récompense s'évanouir sans un mot. Il reste jusqu'à
 * la fin de la fenêtre, dans son état atteint — un objectif raté qu'on laisse
 * est un reproche, un objectif réussi qu'on laisse est un trophée, et les deux
 * ne se traitent pas pareil.
 */

/** Parties à enregistrer. */
export const OBJECTIF_PARTIES = 5;

/** Durée de la fenêtre, en jours. */
export const JOURS_FENETRE = 7;

const JOUR_MS = 24 * 3600_000;

export type EtatPremiereSemaine = {
  /** Parties enregistrées depuis l'inscription. */
  parties: number;
  /** Ce qu'il reste à faire, jamais négatif. */
  restantes: number;
  /** Jours entiers restants avant la fin de la fenêtre, 0 le dernier jour. */
  joursRestants: number;
  atteint: boolean;
  /** Faut-il montrer quelque chose ? */
  visible: boolean;
};

export function premiereSemaine(
  inscritLe: Date | string | null | undefined,
  parties: number,
  maintenant: Date = new Date(),
): EtatPremiereSemaine {
  const debut = inscritLe ? new Date(inscritLe) : null;
  const valide = debut && Number.isFinite(debut.getTime());
  const n = Number.isFinite(parties) ? Math.max(0, Math.floor(parties)) : 0;
  const atteint = n >= OBJECTIF_PARTIES;

  const ecoule = valide ? (maintenant.getTime() - debut!.getTime()) / JOUR_MS : Infinity;
  const dansLaFenetre = ecoule >= 0 && ecoule < JOURS_FENETRE;

  return {
    parties: n,
    restantes: Math.max(0, OBJECTIF_PARTIES - n),
    joursRestants: dansLaFenetre ? Math.max(0, Math.ceil(JOURS_FENETRE - ecoule) - 1) : 0,
    atteint,
    // Une date d'inscription illisible ne doit pas faire apparaître l'objectif
    // pour toujours : sans elle, on ne sait pas où en est la fenêtre, et ne
    // rien montrer est la seule réponse honnête.
    //
    // `atteint` ne le cache plus : c'est l'écran qui change d'état, pas le
    // bloc qui s'efface.
    visible: dansLaFenetre,
  };
}
