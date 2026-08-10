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
