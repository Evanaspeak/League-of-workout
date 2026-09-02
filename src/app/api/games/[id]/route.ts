import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chargerBareme } from "@/lib/baremeConfig";
import { ajouterALaDette, retirerDeLaDette } from "@/lib/dette";
import { getCurrentUser } from "@/lib/auth-helpers";
import {
  parseRepartition, pointsEnTemps, repartirPoints, toExerciceId,
  type ExerciceId,
} from "@/lib/exercices";
import { analyserDatePartie } from "@/lib/dates";
import { calcScore, calcScoreRocketLeague, getLevel, profilNeutre } from "@/lib/scoring";
import { capacitesDuJeu, toTypeJeu } from "@/lib/jeux";
import { seedDefaults } from "@/lib/seed-defaults";

/**
 * Corriger une partie déjà enregistrée : sa date, ou son résultat.
 *
 * Le résultat s'est ajouté après coup, et pour une raison précise : la
 * détection locale a enregistré des victoires en défaites tant qu'elle
 * inventait l'issue manquante. Ces parties-là existent, elles portent une
 * dette qui n'était pas due, et rien ne permettait de les reprendre autrement
 * qu'en les supprimant — c'est-à-dire en perdant la partie pour corriger une
 * lettre.
 *
 * Corriger un résultat n'est pas modifier un champ : c'est refaire le calcul.
 * Le barème est rejoué avec tout ce que la partie a gardé d'elle-même, et
 * l'écart de coût est porté au compteur de dette.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }

  if (body.result != null) return corrigerResultat(id, user.id, body.result);

  if (!body.date) return NextResponse.json({ error: "Date manquante" }, { status: 400 });
  // Corriger la date d'une partie ne doit pas permettre de la déplacer dans le
  // futur : la borne vaut ici comme à la création.
  const analyse = analyserDatePartie(body.date);
  if (!analyse.ok) return NextResponse.json({ error: analyse.erreur }, { status: 400 });
  const result = await prisma.game.updateMany({
    where: { id, userId: user.id },
    data: { date: analyse.date },
  });
  if (result.count === 0) return NextResponse.json({ error: "Game introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

/**
 * Rejoue le barème d'une partie avec un autre résultat, et reporte l'écart
 * sur la dette.
 *
 * Le niveau ne se recalcule PAS depuis le compte : il est relu sur la partie.
 * Quelqu'un qui a refait son test de force entre-temps ne doit pas voir une
 * vieille partie changer de coût pour une raison qui n'a rien à voir avec ce
 * qu'il vient de corriger. Même chose pour le nombre de parties jouées avec ce
 * champion, figé à l'enregistrement.
 */
async function corrigerResultat(id: string, userId: string, brut: unknown) {
  if (brut !== "V" && brut !== "D") {
    return NextResponse.json({ error: "Résultat invalide" }, { status: 400 });
  }
  const resultat: "V" | "D" = brut;

  const game = await prisma.game.findFirst({
    where: { id, userId },
    select: {
      role: true, kills: true, deaths: true, assists: true, arrets: true,
      result: true, gainageSec: true, niveauCalcule: true, partiesAvantCalcule: true,
      pompesCalculees: true, exercice: true, repartition: true,
      jeu: true, typeJeu: true, dureeSec: true, fileClassee: true,
    },
  });
  if (!game) return NextResponse.json({ error: "Game introuvable" }, { status: 404 });

  // Une séance au temps n'a pas de résultat, et un battle royale déduit le
  // sien du classement. Les laisser passer écrirait une lettre que plus rien
  // ne recalculerait — c'est-à-dire un affichage qui ment sur le coût.
  if (toTypeJeu(game.typeJeu) !== "parties") {
    return NextResponse.json({ error: "Cette activité n'a pas de résultat" }, { status: 400 });
  }
  const capacites = capacitesDuJeu(game.jeu, game.typeJeu);
  if (capacites.br) {
    return NextResponse.json({ error: "Le résultat se déduit du classement" }, { status: 400 });
  }

  // Rien à faire, et surtout rien à toucher à la dette : redemander la même
  // correction deux fois ne doit pas la payer deux fois.
  if (game.result === resultat) {
    return NextResponse.json({ ok: true, inchange: true });
  }

  await seedDefaults();
  /**
   * Le barème vient du cache mémoire : trois tables globales, identiques pour
   * tout le monde, qui changent quand un administrateur y touche. Elles étaient
   * relues à chaque appel — trois allers-retours vers la base pour des valeurs
   * qui ne bougent pas d'un mois sur l'autre.
   */
  const bareme = await chargerBareme();
  const ponderations = bareme.roleWeights;
  const masteryConfig = bareme.masteryConfig;
  // Le tri par seuil de gainage est ce que `getLevel` attend : il lit le
  // dernier palier franchi. L'ordre par niveau donnerait le même résultat tant
  // que les deux progressent ensemble — ce qui est vrai aujourd'hui et n'est
  // écrit nulle part. On trie donc explicitement.
  const levelConfigs = [...bareme.levelConfigs]
    .sort((a, b) => a.seuilGainageSec - b.seuilGainageSec);

  if (levelConfigs.length === 0 || ponderations.length === 0) {
    return NextResponse.json({ error: "Config manquante" }, { status: 500 });
  }
  const roleWeights = capacites.roles
    ? (ponderations.find((r) => r.role === game.role) ?? null)
    : profilNeutre(ponderations);
  if (capacites.roles && !roleWeights) {
    return NextResponse.json({ error: "Rôle inconnu" }, { status: 400 });
  }
  if (!roleWeights || !masteryConfig) {
    return NextResponse.json({ error: "Config manquante" }, { status: 500 });
  }

  // Le niveau de la partie, tel qu'il a été retenu le jour où elle a été
  // enregistrée. Les fonctions de barème choisissent leur palier à partir des
  // secondes : on leur repasse le seuil de celui-là pour qu'elles retombent
  // dessus. Si le palier a disparu de la configuration, on retombe sur le
  // gainage stocké, qui est la seule autre trace du niveau d'alors.
  const palier = levelConfigs.find((c) => c.niveau === game.niveauCalcule);
  const gainageEquivalent = palier
    ? palier.seuilGainageSec
    : getLevel(game.gainageSec, levelConfigs).seuilGainageSec;

  const scoring = capacites.rl
    ? calcScoreRocketLeague({
        buts: game.kills, arrets: game.arrets ?? 0, passes: game.assists,
        result: resultat, gainageSec: gainageEquivalent, roleWeights, levelConfigs,
      })
    : calcScore({
        kills: game.kills,
        deaths: game.deaths,
        assists: game.assists,
        result: resultat,
        gainageSec: gainageEquivalent,
        partiesAvant: game.partiesAvantCalcule,
        dureeSec: game.dureeSec,
        classee: game.fileClassee,
        roleWeights,
        levelConfigs,
        masteryConfig,
      });

  // La ventilation garde les MÊMES exercices : ils ont été figés à
  // l'enregistrement pour que l'historique reste fidèle même si la sélection
  // change plus tard. Seul le total qu'on répartit entre eux bouge.
  const ancienne = parseRepartition(game.repartition, game.exercice, game.pompesCalculees);
  const selection = Object.keys(ancienne).map(toExerciceId) as ExerciceId[];
  const nouvelle = repartirPoints(scoring.pompesFinales, selection);

  const maj = await prisma.game.updateMany({
    where: { id, userId },
    data: {
      result: resultat,
      niveauCalcule: scoring.niveau,
      surchargeCalculee: scoring.surcharge,
      scoreCalcule: scoring.scoreBase,
      malusCalcule: scoring.malus,
      pompesCalculees: scoring.pompesFinales,
      repartition: selection.length > 1 ? JSON.stringify(nouvelle) : null,
    },
  });
  if (maj.count === 0) return NextResponse.json({ error: "Game introuvable" }, { status: 404 });

  /**
   * L'écart de dette, et rien d'autre.
   *
   * Seule la part comptée en temps était entrée au compteur : les pompes se
   * font dans la foulée de la partie. On lui reprend, ou on lui rend, la
   * différence entre les deux ventilations.
   *
   * Aucune notification de seuil ne part d'ici, même quand la dette grimpe :
   * on est en train de regarder l'écran qui l'affiche. Prévenir par surprise
   * de ce qu'on vient soi-même de provoquer est la meilleure façon de faire
   * couper les notifications.
   */
  const ecart = pointsEnTemps(nouvelle) - pointsEnTemps(ancienne);
  let dettePointsDus: number | null = null;
  try {
    if (ecart > 0) dettePointsDus = await ajouterALaDette(prisma, userId, ecart);
    else if (ecart < 0) dettePointsDus = await retirerDeLaDette(prisma, userId, -ecart);
  } catch { /* la partie est corrigée : le compteur se rattrapera */ }

  return NextResponse.json({
    ok: true,
    result: resultat,
    pompesCalculees: scoring.pompesFinales,
    dettePointsDus,
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // On relit la partie avant de la supprimer : c'est elle qui dit combien de
  // temps d'effort elle avait ajouté au compteur en attente.
  const game = await prisma.game.findFirst({
    where: { id, userId: user.id },
    select: { exercice: true, repartition: true, pompesCalculees: true },
  });
  if (!game) return NextResponse.json({ error: "Game introuvable" }, { status: 404 });

  const result = await prisma.game.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Game introuvable" }, { status: 404 });
  }

  // Une saisie erronée ne doit pas laisser sa dette derrière elle : on retire
  // du compteur exactement ce que cette partie y avait mis. Seule la part en
  // temps compte — les pompes n'y étaient jamais entrées.
  const aRetirer = pointsEnTemps(
    parseRepartition(game.repartition, game.exercice, game.pompesCalculees),
  );
  let dettePointsDus = null;
  if (aRetirer > 0) {
    try {
      // Le retrait est atomique : lire puis écrire une valeur absolue perdait
      // une partie enregistrée entre les deux. Voir `src/lib/dette.ts`.
      dettePointsDus = await retirerDeLaDette(prisma, user.id, aRetirer);
    } catch { /* la partie est supprimée : on ne fait pas échouer pour autant */ }
  }

  return NextResponse.json({ ok: true, dettePointsDus });
}
