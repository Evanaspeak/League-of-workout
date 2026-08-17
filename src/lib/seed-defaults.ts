import { prisma } from "./prisma";

/**
 * Une seule initialisation par instance. Sans ce garde, chaque chargement de
 * page déclenchait trois requêtes de comptage — pour un travail qui n'a de
 * sens qu'au tout premier démarrage. En cas d'échec, la promesse est oubliée
 * pour que l'appel suivant retente.
 */
let enCours: Promise<void> | null = null;

export function seedDefaults(): Promise<void> {
  if (!enCours) {
    enCours = semer().catch((err) => {
      enCours = null;
      throw err;
    });
  }
  return enCours;
}

// Initialise la configuration de scoring GLOBALE (partagée par tous les joueurs).
// Les comptes utilisateurs sont créés par l'authentification, plus ici.
async function semer() {
  const [roleCount, levelCount, masteryCount] = await Promise.all([
    prisma.roleWeight.count(),
    prisma.levelConfig.count(),
    prisma.masteryConfig.count(),
  ]);

  if (roleCount === 0) {
    await prisma.roleWeight.createMany({
      data: [
        { role: "Top",     poidsMort: 3.0, poidsKill: 1.2, poidsAssist: 0.8, maitriseActive: true },
        { role: "Jungle",  poidsMort: 3.0, poidsKill: 1.0, poidsAssist: 1.0, maitriseActive: true },
        { role: "Mid",     poidsMort: 3.0, poidsKill: 1.3, poidsAssist: 1.0, maitriseActive: true },
        { role: "ADC",     poidsMort: 3.2, poidsKill: 1.3, poidsAssist: 0.9, maitriseActive: true },
        { role: "Support", poidsMort: 2.2, poidsKill: 0.6, poidsAssist: 1.6, maitriseActive: true },
        { role: "ARAM",    poidsMort: 1.8, poidsKill: 0.8, poidsAssist: 1.0, maitriseActive: false },
        { role: "Arena",   poidsMort: 2.0, poidsKill: 1.0, poidsAssist: 1.0, maitriseActive: false },
      ],
    });
  }

  if (levelCount === 0) {
    await prisma.levelConfig.createMany({
      data: [
        // `seuilPompes` est le critère actuel : le nombre de pompes d'affilée
        // jusqu'auquel le niveau s'applique. `seuilGainageSec` reste renseigné
        // pour les parties enregistrées avant le passage au test de pompes.
        { niveau: 1, seuilGainageSec: 45,   seuilPompes: 10,  multiplicateur: 1.0,  malusDefaite: 5  },
        { niveau: 2, seuilGainageSec: 90,   seuilPompes: 20,  multiplicateur: 1.67, malusDefaite: 8  },
        { niveau: 3, seuilGainageSec: 150,  seuilPompes: 35,  multiplicateur: 2.33, malusDefaite: 12 },
        { niveau: 4, seuilGainageSec: 240,  seuilPompes: 50,  multiplicateur: 3.33, malusDefaite: 15 },
        { niveau: 5, seuilGainageSec: 9999, seuilPompes: 999, multiplicateur: 4.67, malusDefaite: 20 },
      ],
    });
  }

  if (masteryCount === 0) {
    await prisma.masteryConfig.create({ data: { surchargeMax: 0.5, partiesPourMax: 100 } });
  }
}
