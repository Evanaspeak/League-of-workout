export type RoleWeights = {
  poidsMort: number;
  poidsKill: number;
  poidsAssist: number;
  maitriseActive: boolean;
};

export type LevelCfg = {
  niveau: number;
  seuilGainageSec: number;
  /** Nombre de pompes d'affilée jusqu'auquel ce niveau s'applique. */
  seuilPompes?: number;
  multiplicateur: number;
  malusDefaite: number;
};

export type MasteryCfg = {
  surchargeMax: number;
  partiesPourMax: number;
};

export type ScoringInput = {
  kills: number;
  deaths: number;
  assists: number;
  result: "V" | "D";
  gainageSec: number;
  partiesAvant: number;
  roleWeights: RoleWeights;
  levelConfigs: LevelCfg[];
  masteryConfig: MasteryCfg;
  /**
   * Durée de la partie, quand elle est connue. Sert à reconnaître un remake :
   * une partie de quatre minutes n'a pas été jouée, elle a été annulée.
   */
  dureeSec?: number | null;
  /** Partie classée : elle coûte plus cher, l'enjeu n'est pas le même. */
  classee?: boolean | null;
};

export type ScoringResult = {
  niveau: number;
  multiplicateur: number;
  scoreBase: number;
  malus: number;
  surcharge: number;
  pompesFinales: number;
  /** Vrai quand la partie a été annulée avant d'être jouée. */
  remake?: boolean;
};

/**
 * En deçà de cette durée, une partie n'a pas eu lieu.
 *
 * League annule une partie quand un joueur ne se connecte pas : elle se termine
 * en trois ou quatre minutes, sans vainqueur et sans conséquence de classement.
 * La compter comme une défaite fait payer un abandon qu'on n'a pas choisi, et
 * c'est le genre d'injustice qui fait fermer l'application pour de bon.
 *
 * Cinq minutes plutôt que quatre : le seuil de Riot est à trois minutes pour le
 * vote, mais l'écran de fin et le retour au lanceur prennent le reste, et la
 * durée relevée varie selon la source.
 */
export const DUREE_REMAKE_SEC = 300;

/** Une partie si courte qu'elle n'a pas été jouée. */
export function estRemake(dureeSec: number | null | undefined): boolean {
  const d = Number(dureeSec);
  // Une durée absente n'est pas une durée nulle : la plupart des parties
  // saisies à la main n'en portent pas, et les déclarer toutes annulées
  // effacerait la dette de tout le monde.
  if (!Number.isFinite(d) || d <= 0) return false;
  return d < DUREE_REMAKE_SEC;
}

/**
 * Ce qu'une partie classée coûte en plus.
 *
 * Choix de barème, pas de physique : une défaite en classée pèse davantage
 * qu'une défaite en normale, et le produit doit le refléter. Un quart de plus
 * se sent sans devenir dissuasif.
 */
export const MULT_CLASSEE = 1.25;

export function getLevel(gainageSec: number, levelConfigs: LevelCfg[]): LevelCfg {
  const sorted = [...levelConfigs].sort((a, b) => a.seuilGainageSec - b.seuilGainageSec);
  for (const cfg of sorted) {
    if (gainageSec <= cfg.seuilGainageSec) return cfg;
  }
  return sorted[sorted.length - 1];
}

/** Seuils retenus quand la configuration en base n'en fournit pas encore. */
const SEUILS_POMPES_DEFAUT: Record<number, number> = { 1: 10, 2: 20, 3: 35, 4: 50, 5: 999 };

/**
 * Niveau déduit du test de pompes maximales.
 *
 * C'est la mesure qui compte désormais : la monnaie de l'application est la
 * pompe, et tenir la planche quatre minutes ne dit pas qu'on sait en faire dix.
 * Un compte jamais testé reste au niveau le plus bas plutôt que d'hériter d'un
 * multiplicateur qu'il n'a pas mérité.
 */
export function getLevelParPompes(pompesMax: number, levelConfigs: LevelCfg[]): LevelCfg {
  const seuil = (c: LevelCfg) => c.seuilPompes ?? SEUILS_POMPES_DEFAUT[c.niveau] ?? 999;
  const sorted = [...levelConfigs].sort((a, b) => seuil(a) - seuil(b));
  const n = Math.max(0, Math.round(pompesMax));
  for (const cfg of sorted) {
    if (n <= seuil(cfg)) return cfg;
  }
  return sorted[sorted.length - 1];
}

/** Depuis combien de jours un test de pompes reste-t-il valable. */
export const VALIDITE_TEST_JOURS = 30;

/** Vrai si le test n'a jamais été fait, ou date de plus d'un mois. */
export function testAFaire(pompesMax: number, fait: Date | string | null | undefined): boolean {
  if (!pompesMax || pompesMax <= 0 || !fait) return true;
  const jours = (Date.now() - new Date(fait).getTime()) / 86_400_000;
  return jours > VALIDITE_TEST_JOURS;
}

/**
 * Coût d'une heure de jeu, en points d'effort (1 point = 1 pompe), pour un
 * joueur de niveau 1. Le multiplicateur de niveau s'applique ensuite, comme
 * pour les parties classées.
 *
 * Repère : 1 h de jeu ≈ 20 pompes au niveau 1, ≈ 93 au niveau 5.
 */
export const POINTS_PAR_HEURE = 20;

export type ScoringTempsInput = {
  dureeSec: number;
  gainageSec: number;
  levelConfigs: LevelCfg[];
};

export type ScoringTempsResult = {
  niveau: number;
  multiplicateur: number;
  pointsFinaux: number;
};

/**
 * Dette d'une session de jeu sans victoire ni défaite : elle croît
 * linéairement avec la durée — chaque seconde vaut autant que la précédente.
 */
export function calcScoreTemps(input: ScoringTempsInput): ScoringTempsResult {
  const { dureeSec, gainageSec, levelConfigs } = input;

  const levelCfg = getLevel(gainageSec, levelConfigs);
  const heures = Math.max(0, dureeSec) / 3600;
  const pointsFinaux = Math.round(heures * POINTS_PAR_HEURE * levelCfg.multiplicateur);

  return {
    niveau: levelCfg.niveau,
    multiplicateur: levelCfg.multiplicateur,
    pointsFinaux,
  };
}

/**
 * Pondérations à appliquer à un jeu qui n'a pas de lanes (Counter-Strike,
 * Valorant…). Plutôt que d'inventer des constantes qui vivraient dans une
 * échelle différente de celle du joueur, on prend la moyenne de ses propres
 * réglages : le coût d'une mort y reste comparable à ce qu'il vaut sur League,
 * et suivre ses ajustements est automatique.
 *
 * La maîtrise est désactivée : sans champion, il n'y a rien à maîtriser.
 */
export function profilNeutre(ponderations: RoleWeights[]): RoleWeights | null {
  if (ponderations.length === 0) return null;
  const moyenne = (get: (r: RoleWeights) => number) =>
    ponderations.reduce((s, r) => s + get(r), 0) / ponderations.length;
  return {
    poidsMort: moyenne((r) => r.poidsMort),
    poidsKill: moyenne((r) => r.poidsKill),
    poidsAssist: moyenne((r) => r.poidsAssist),
    maitriseActive: false,
  };
}

/**
 * Combien de « morts » vaut le pire classement possible. Dans un battle royale
 * on ne meurt qu'une fois : c'est la place finale qui dit comment s'est passée
 * la partie, pas le compteur de morts. On la convertit donc en morts
 * équivalentes pour rester dans la même échelle que les autres jeux — finir
 * dernier coûte autant que ECHELLE_BR morts, finir premier ne coûte rien.
 */
export const ECHELLE_BR = 10;

export type ScoringBrInput = {
  /** Place finale, 1 = victoire. */
  placement: number;
  /** Nombre de joueurs (ou d'équipes) dans la partie. */
  joueurs: number;
  kills: number;
  gainageSec: number;
  roleWeights: RoleWeights;
  levelConfigs: LevelCfg[];
};

/**
 * Dette d'une partie de battle royale. Le classement remplace le compteur de
 * morts, et les éliminations viennent l'alléger comme ailleurs.
 *
 * Pas de malus de défaite : la place encode déjà la performance de façon
 * continue, un malus binaire ferait double emploi et punirait autant un top 2
 * qu'un joueur mort dans les premières secondes.
 */
/**
 * Rocket League n'a aucune statistique qui pénalise : pas de morts, pas de
 * classement. Ce qui coûte, c'est la défaite ; ce qui rachète, c'est ce qu'on
 * a produit — buts, arrêts, passes décisives.
 *
 * L'échelle est exprimée en « morts équivalentes » comme pour les battle
 * royale, afin qu'une défaite y coûte le même ordre de grandeur qu'ailleurs.
 * Les trois coefficients ci-dessous sont un point de départ à valider sur le
 * terrain : un but pèse plus qu'un arrêt, qui pèse plus qu'une passe.
 */
export const ECHELLE_RL = 5;
export const RL_POIDS = { but: 1.5, arret: 1.0, passe: 0.75 } as const;

export type ScoringRocketInput = {
  buts: number;
  arrets: number;
  passes: number;
  result: "V" | "D";
  gainageSec: number;
  roleWeights: RoleWeights;
  levelConfigs: LevelCfg[];
};

export function calcScoreRocketLeague(input: ScoringRocketInput): ScoringResult {
  const { buts, arrets, passes, result, gainageSec, roleWeights, levelConfigs } = input;
  const levelCfg = getLevel(gainageSec, levelConfigs);

  // Une victoire ne coûte rien d'office : seule la défaite ouvre une dette.
  const base = result === "D" ? ECHELLE_RL * roleWeights.poidsMort : 0;

  const produit =
    Math.max(0, buts) * RL_POIDS.but * roleWeights.poidsKill
    + Math.max(0, arrets) * RL_POIDS.arret * roleWeights.poidsKill
    + Math.max(0, passes) * RL_POIDS.passe * roleWeights.poidsAssist;

  const scoreBase = Math.round(Math.max(0, base - produit) * levelCfg.multiplicateur);

  return {
    niveau: levelCfg.niveau,
    multiplicateur: levelCfg.multiplicateur,
    scoreBase,
    malus: 0,
    surcharge: 0,
    pompesFinales: scoreBase,
  };
}

export function calcScoreBattleRoyale(input: ScoringBrInput): ScoringResult {
  const { placement, joueurs, kills, gainageSec, roleWeights, levelConfigs } = input;

  const levelCfg = getLevel(gainageSec, levelConfigs);
  const total = Math.max(2, Math.round(joueurs));
  const place = Math.min(total, Math.max(1, Math.round(placement)));

  // 0 pour la première place, 1 pour la dernière.
  const position = (place - 1) / (total - 1);
  const mortsEquivalentes = ECHELLE_BR * position;

  const raw = roleWeights.poidsMort * mortsEquivalentes - roleWeights.poidsKill * Math.max(0, kills);
  const scoreBase = Math.round(Math.max(0, raw) * levelCfg.multiplicateur);

  /**
   * La première place est moitié moins chère — et, dans les faits, gratuite.
   *
   * Ce n'est pas la division qui la rend gratuite : à la première place,
   * `position` vaut zéro, donc `mortsEquivalentes` aussi, donc `raw` est au
   * mieux nul et le maximum le ramène à zéro. La moitié de zéro reste zéro.
   * La règle « une victoire coûte moitié moins », vraie dans les autres jeux,
   * ne peut donc jamais s'appliquer ici.
   *
   * Elle reste écrite quand même : un poids d'élimination négatif, que le
   * panneau d'administration accepte, rendrait `raw` positif à la première
   * place. C'est le seul chemin qui l'atteint, et il vaut mieux qu'il tombe
   * sur la règle habituelle que sur le plein tarif.
   */
  const pompesFinales = place === 1 ? Math.round(scoreBase / 2) : scoreBase;

  return {
    niveau: levelCfg.niveau,
    multiplicateur: levelCfg.multiplicateur,
    scoreBase,
    malus: 0,
    surcharge: 0,
    pompesFinales,
  };
}

export function calcScore(input: ScoringInput): ScoringResult {
  const { kills, deaths, assists, result, gainageSec, partiesAvant, roleWeights, levelConfigs, masteryConfig } = input;

  const levelCfg = getLevel(gainageSec, levelConfigs);
  const niveau = levelCfg.niveau;
  const multiplicateur = levelCfg.multiplicateur;

  /**
   * Le remake sort ici, avant tout calcul.
   *
   * Il vit dans la fonction de barème et non dans les routes : l'aperçu et
   * l'enregistrement l'appellent tous les deux, et une règle posée dans une
   * seule des deux routes finit par ne valoir que pour l'une d'elles. Cette
   * divergence-là a déjà coûté une soirée.
   */
  if (estRemake(input.dureeSec)) {
    return {
      niveau, multiplicateur, scoreBase: 0, malus: 0, surcharge: 0,
      pompesFinales: 0, remake: true,
    };
  }

  const raw = roleWeights.poidsMort * deaths - roleWeights.poidsKill * kills - roleWeights.poidsAssist * assists;
  const scoreBase = Math.round(Math.max(0, raw) * multiplicateur);

  const malus = result === "D" ? levelCfg.malusDefaite : 0;

  let surcharge = 0;
  if (roleWeights.maitriseActive) {
    surcharge = masteryConfig.surchargeMax * Math.min(1, partiesAvant / masteryConfig.partiesPourMax);
  }

  const baseForPompes = result === "V" ? scoreBase / 2 : scoreBase + malus;
  // La classée majore le total, jamais le score de base : c'est l'enjeu de la
  // partie qui pèse, pas la façon d'y jouer.
  const enjeu = input.classee ? MULT_CLASSEE : 1;
  const pompesFinales = Math.round(baseForPompes * (1 + surcharge) * enjeu);

  return { niveau, multiplicateur, scoreBase, malus, surcharge, pompesFinales, remake: false };
}
