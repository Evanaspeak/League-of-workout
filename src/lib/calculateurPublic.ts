import {
  calcScore, calcScoreBattleRoyale, calcScoreRocketLeague, calcScoreTemps,
  getLevelParPompes, profilNeutre,
} from "@/lib/scoring";
import { capacitesDuJeu, typeDuJeu } from "@/lib/jeux";
import { MAITRISE_DEFAUT, NIVEAUX_DEFAUT, ROLES_DEFAUT } from "@/lib/scoringDefaut";

/**
 * Le calcul, sans compte et sans base.
 *
 * Les pages publiques du calculateur doivent tourner pour un visiteur qui n'a
 * rien : pas de session, pas de test de force enregistré, pas de configuration
 * personnelle. Elles emploient donc la configuration livrée avec
 * l'application — la même que celle semée au premier démarrage, importée et
 * non recopiée.
 *
 * Le chiffre annoncé est donc celui d'un compte neuf. C'est honnête, et c'est
 * le seul qu'on puisse promettre à quelqu'un qui n'a pas encore de compte.
 */

export type SaisiePublique = {
  jeu: string;
  /** Nombre de pompes d'affilée : c'est ce qui fixe le niveau. */
  pompesMax: number;
  role?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  result?: "V" | "D";
  placement?: number;
  joueurs?: number;
  arrets?: number;
  dureeSec?: number;
};

export type ResultatPublic = {
  points: number;
  niveau: number;
  multiplicateur: number;
};

/** Le calcul public, dans la même unité que l'application : le point d'effort. */
export function calculerPublic(saisie: SaisiePublique): ResultatPublic {
  const capacites = capacitesDuJeu(saisie.jeu);
  const type = typeDuJeu(saisie.jeu);

  const niveauCfg = getLevelParPompes(saisie.pompesMax, NIVEAUX_DEFAUT);
  // Les fonctions de scoring choisissent le niveau à partir des secondes : on
  // leur passe le seuil du niveau retenu, comme le font les routes.
  const gainageSec = niveauCfg.seuilGainageSec;
  const commun = { niveau: niveauCfg.niveau, multiplicateur: niveauCfg.multiplicateur };

  if (type === "temps") {
    const r = calcScoreTemps({
      dureeSec: Math.max(0, saisie.dureeSec ?? 0),
      gainageSec,
      levelConfigs: NIVEAUX_DEFAUT,
    });
    return { points: r.pointsFinaux, ...commun };
  }

  // `profilNeutre` peut rendre `null` sur une liste vide ; la nôtre est une
  // constante non vide, mais on ne s'appuie pas sur ce qu'on sait ici.
  const roleWeights = (capacites.roles
    ? ROLES_DEFAUT.find((r) => r.role === saisie.role)
    : profilNeutre(ROLES_DEFAUT)) ?? ROLES_DEFAUT[0];

  if (capacites.br) {
    const r = calcScoreBattleRoyale({
      placement: Math.max(1, saisie.placement ?? 1),
      joueurs: Math.max(2, saisie.joueurs ?? capacites.joueurs),
      kills: Math.max(0, saisie.kills ?? 0),
      gainageSec, roleWeights, levelConfigs: NIVEAUX_DEFAUT,
    });
    return { points: r.pompesFinales, ...commun };
  }

  if (capacites.rl) {
    const r = calcScoreRocketLeague({
      buts: Math.max(0, saisie.kills ?? 0),
      arrets: Math.max(0, saisie.arrets ?? 0),
      passes: Math.max(0, saisie.assists ?? 0),
      result: saisie.result === "V" ? "V" : "D",
      gainageSec, roleWeights, levelConfigs: NIVEAUX_DEFAUT,
    });
    return { points: r.pompesFinales, ...commun };
  }

  const r = calcScore({
    kills: capacites.kda ? Math.max(0, saisie.kills ?? 0) : 0,
    deaths: capacites.kda ? Math.max(0, saisie.deaths ?? 0) : 0,
    assists: capacites.kda ? Math.max(0, saisie.assists ?? 0) : 0,
    result: saisie.result === "V" ? "V" : "D",
    gainageSec,
    // Un visiteur n'a pas d'historique : aucune surcharge de maîtrise. C'est
    // aussi le chiffre le plus bas, donc celui qu'on peut annoncer sans
    // promettre moins que ce qui sera réellement dû.
    partiesAvant: 0,
    roleWeights,
    levelConfigs: NIVEAUX_DEFAUT,
    masteryConfig: MAITRISE_DEFAUT,
  });
  return { points: r.pompesFinales, ...commun };
}
