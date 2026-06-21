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
