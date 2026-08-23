// Aucune importation, et c'est le point.
//
// Ces constantes sont lues par les pages publiques du calculateur, qui tournent
// dans le navigateur. Les garder dans `seed-defaults` y tirait le client Prisma
// tout entier — et un module qui n'a besoin que de cinq nombres n'a pas à faire
// entrer une base de données dans le paquet livré.

/**
 * La configuration de scoring livrée avec l'application.
 *
 * Elle vit ici, exportée, et non enfouie dans la fonction qui l'écrit en base :
 * les pages publiques du calculateur s'en servent sans compte et sans base, et
 * une seconde copie aurait divergé de celle-ci au premier réglage changé —
 * sans que rien ne le signale, puisque les deux compilent.
 */
export const ROLES_DEFAUT = [
  { role: "Top",     poidsMort: 3.0, poidsKill: 1.2, poidsAssist: 0.8, maitriseActive: true },
  { role: "Jungle",  poidsMort: 3.0, poidsKill: 1.0, poidsAssist: 1.0, maitriseActive: true },
  { role: "Mid",     poidsMort: 3.0, poidsKill: 1.3, poidsAssist: 1.0, maitriseActive: true },
  { role: "ADC",     poidsMort: 3.2, poidsKill: 1.3, poidsAssist: 0.9, maitriseActive: true },
  { role: "Support", poidsMort: 2.2, poidsKill: 0.6, poidsAssist: 1.6, maitriseActive: true },
  { role: "ARAM",    poidsMort: 1.8, poidsKill: 0.8, poidsAssist: 1.0, maitriseActive: false },
  { role: "Arena",   poidsMort: 2.0, poidsKill: 1.0, poidsAssist: 1.0, maitriseActive: false },
];

/**
 * `seuilPompes` est le critère actuel : le nombre de pompes d'affilée jusqu'
 * auquel le niveau s'applique. `seuilGainageSec` reste renseigné pour les
 * parties enregistrées avant le passage au test de pompes.
 */
export const NIVEAUX_DEFAUT = [
  { niveau: 1, seuilGainageSec: 45,   seuilPompes: 10,  multiplicateur: 1.0,  malusDefaite: 5  },
  { niveau: 2, seuilGainageSec: 90,   seuilPompes: 20,  multiplicateur: 1.67, malusDefaite: 8  },
  { niveau: 3, seuilGainageSec: 150,  seuilPompes: 35,  multiplicateur: 2.33, malusDefaite: 12 },
  { niveau: 4, seuilGainageSec: 240,  seuilPompes: 50,  multiplicateur: 3.33, malusDefaite: 15 },
  { niveau: 5, seuilGainageSec: 9999, seuilPompes: 999, multiplicateur: 4.67, malusDefaite: 20 },
];

export const MAITRISE_DEFAUT = { surchargeMax: 0.5, partiesPourMax: 100 };
