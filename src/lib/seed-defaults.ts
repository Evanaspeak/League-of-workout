import { prisma } from "./prisma";
import { MAITRISE_DEFAUT, NIVEAUX_DEFAUT, ROLES_DEFAUT } from "./scoringDefaut";

export { MAITRISE_DEFAUT, NIVEAUX_DEFAUT, ROLES_DEFAUT };

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
    await prisma.roleWeight.createMany({ data: ROLES_DEFAUT });
  }

  if (levelCount === 0) {
    await prisma.levelConfig.createMany({ data: NIVEAUX_DEFAUT });
  }

  if (masteryCount === 0) {
    await prisma.masteryConfig.create({ data: MAITRISE_DEFAUT });
  }
}
