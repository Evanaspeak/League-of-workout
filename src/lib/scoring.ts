export type RoleWeights = {
  poidsMort: number;
  poidsKill: number;
  poidsAssist: number;
  maitriseActive: boolean;
};

export type LevelCfg = {
  niveau: number;
  seuilGainageSec: number;
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
};

export type ScoringResult = {
  niveau: number;
  multiplicateur: number;
  scoreBase: number;
  malus: number;
  surcharge: number;
  pompesFinales: number;
};

export function getLevel(gainageSec: number, levelConfigs: LevelCfg[]): LevelCfg {
  const sorted = [...levelConfigs].sort((a, b) => a.seuilGainageSec - b.seuilGainageSec);
  for (const cfg of sorted) {
    if (gainageSec <= cfg.seuilGainageSec) return cfg;
  }
  return sorted[sorted.length - 1];
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

  // Une victoire reste moitié moins chère, comme dans les autres jeux.
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

  const raw = roleWeights.poidsMort * deaths - roleWeights.poidsKill * kills - roleWeights.poidsAssist * assists;
  const scoreBase = Math.round(Math.max(0, raw) * multiplicateur);

  const malus = result === "D" ? levelCfg.malusDefaite : 0;

  let surcharge = 0;
  if (roleWeights.maitriseActive) {
    surcharge = masteryConfig.surchargeMax * Math.min(1, partiesAvant / masteryConfig.partiesPourMax);
  }

  const baseForPompes = result === "V" ? scoreBase / 2 : scoreBase + malus;
  const pompesFinales = Math.round(baseForPompes * (1 + surcharge));

  return { niveau, multiplicateur, scoreBase, malus, surcharge, pompesFinales };
}
