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

  /**
   * Les trois écritures sont idempotentes, et pas seulement gardées par le
   * comptage qui précède.
   *
   * Sur une base neuve, plusieurs requêtes arrivent ensemble : un démarrage à
   * froid en sert souvent une poignée d'un coup, et le garde de processus ne
   * vaut que pour SON processus. Les trois comptages rendaient alors zéro
   * partout, les trois semis partaient en même temps, et le second tombait sur
   * une violation de clé primaire — `role` et `niveau` sont des identifiants.
   * La requête rendait 500, sur le premier chargement d'un environnement qu'on
   * vient de monter, c'est-à-dire au moment le plus déroutant possible.
   *
   * `skipDuplicates` fait de la course une non-affaire : celui qui arrive
   * second n'écrit rien et ne dit rien.
   */
  if (roleCount === 0) {
    await prisma.roleWeight.createMany({ data: ROLES_DEFAUT, skipDuplicates: true });
  }

  if (levelCount === 0) {
    await prisma.levelConfig.createMany({ data: NIVEAUX_DEFAUT, skipDuplicates: true });
  }

  if (masteryCount === 0) {
    // L'identifiant est écrit en clair : `createMany` ne peut ignorer un
    // doublon que s'il sait sur quoi porte l'unicité, et la valeur par défaut
    // du schéma vaut 1.
    await prisma.masteryConfig.createMany({
      data: [{ id: 1, ...MAITRISE_DEFAUT }],
      skipDuplicates: true,
    });
  }
}
