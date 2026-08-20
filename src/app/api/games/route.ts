import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifier } from "@/lib/push";
import {
  calcScore, calcScoreBattleRoyale, calcScoreRocketLeague, calcScoreTemps,
  getLevel, getLevelParPompes, profilNeutre,
} from "@/lib/scoring";
import { getCurrentUser } from "@/lib/auth-helpers";
import {
  dureeEffort, exercicesEnTemps, formaterDuree, isExerciceId, pointsEnTemps, repartirPoints, toExerciceIds, type Repartition,
} from "@/lib/exercices";
import { chargerRatios } from "@/lib/exercicesConfig";
import { capacitesDuJeu, normaliserNomJeu, typeDuJeu } from "@/lib/jeux";
import { analyserDatePartie } from "@/lib/dates";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const games = await prisma.game.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
  });
  return NextResponse.json(games);
}

export async function POST(req: Request) {
  // Enregistrer une partie fait franchir des seuils de rappel exprimés en
  // secondes : la conversion doit utiliser les ratios en vigueur.
  await chargerRatios();
  const body = await req.json();

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Écrire une partie coûte plusieurs requêtes en base. La route était sans
  // limite : un script authentifié pouvait la marteler jusqu'à épuiser le
  // quota de la base pour tout le monde. Le verrou porte sur le compte, avec
  // un budget très au-dessus de ce qu'une soirée de jeu consomme.
  if (await isRateLimited(user.id, "game-write")) {
    return NextResponse.json(
      { error: "Trop de parties enregistrées d'affilée. Réessaie dans quelques minutes." },
      { status: 429 },
    );
  }
  await recordAttempt(user.id, "game-write");

  // Une partie se joue avant d'être enregistrée.
  let dateSaisie: Date | null = null;
  if (body.date != null) {
    const analyse = analyserDatePartie(body.date);
    if (!analyse.ok) return NextResponse.json({ error: analyse.erreur }, { status: 400 });
    dateSaisie = analyse.date;
  }

  const jeu = normaliserNomJeu(body.jeu);
  const typeJeu = typeDuJeu(jeu, body.typeJeu);

  // Ce que le jeu permet de renseigner : un CS n'a ni lane ni champion.
  const capacites = capacitesDuJeu(jeu, body.typeJeu);

  const [ponderations, levelConfigs, masteryConfig] = await Promise.all([
    prisma.roleWeight.findMany(),
    prisma.levelConfig.findMany({ orderBy: { seuilGainageSec: "asc" } }),
    prisma.masteryConfig.findFirst(),
  ]);

  // Avec des lanes, on prend celle de la partie ; sans lanes, un profil neutre
  // dérivé des réglages du joueur.
  const roleWeights = capacites.roles
    ? (ponderations.find((r) => r.role === body.role) ?? null)
    : profilNeutre(ponderations);

  if (typeJeu === "parties" && (!roleWeights || !masteryConfig)) {
    return NextResponse.json({ error: "Config manquante" }, { status: 500 });
  }

  // Compte les parties avant avec ce champion
  let partiesAvant = 0;
  if (capacites.champions && body.champion && roleWeights?.maitriseActive) {
    partiesAvant = await prisma.game.count({
      where: { userId: user.id, champion: body.champion },
    });
  }

  /**
   * Le niveau vient désormais du test de pompes enregistré sur le compte.
   * `gainageSec` n'est conservé que comme repli pour les comptes qui n'ont pas
   * encore fait le test, et pour rester lisible dans l'historique.
   */
  const gainageSec = body.gainageSec != null ? Number(body.gainageSec) : user.gainageMaxSec;
  const niveauCfg = user.pompesMax > 0
    ? getLevelParPompes(user.pompesMax, levelConfigs)
    : getLevel(gainageSec, levelConfigs);
  // Les fonctions de scoring choisissent le niveau à partir des secondes : on
  // leur passe le seuil du niveau retenu, pour qu'elles retombent dessus.
  const gainageEquivalent = niveauCfg.seuilGainageSec;

  // Exercices retenus pour cette activité. Quand il y en a plusieurs, la dette
  // se partage entre eux : on fait un peu de chaque, plutôt que d'alterner
  // d'une partie à l'autre.
  const selection = isExerciceId(body.exercice)
    ? [body.exercice]
    : toExerciceIds(
        Array.isArray(body.exercices) && body.exercices.length > 0 ? body.exercices : user.exercices,
      );
  // `exercice` reste le premier : il porte l'unité d'affichage par défaut.
  const exercice = selection[0];

  /** Ventilation à stocker — nulle quand un seul exercice est concerné. */
  const ventilation = (total: number) =>
    selection.length > 1 ? JSON.stringify(repartirPoints(total, selection)) : null;

  if (typeJeu === "temps") {
    const dureeSec = Math.max(0, Math.round(Number(body.dureeSec) || 0));
    if (dureeSec <= 0) {
      return NextResponse.json({ error: "Durée invalide" }, { status: 400 });
    }
    const scoringTemps = calcScoreTemps({ dureeSec, gainageSec: gainageEquivalent, levelConfigs });

    const game = await prisma.game.create({
      data: {
        userId: user.id,
        // Une session au temps n'a ni rôle, ni champion, ni résultat : ces
        // colonnes restent obligatoires en base, on y met des valeurs neutres.
        role: "—",
        champion: null,
        kills: 0,
        deaths: 0,
        assists: 0,
        result: "N",
        gainageSec,
        niveauCalcule: scoringTemps.niveau,
        partiesAvantCalcule: 0,
        surchargeCalculee: 0,
        scoreCalcule: scoringTemps.pointsFinaux,
        malusCalcule: 0,
        pompesCalculees: scoringTemps.pointsFinaux,
        exercice,
        repartition: ventilation(scoringTemps.pointsFinaux),
        jeu,
        typeJeu,
        dureeSec,
        source: body.source || "manuel",
        riotMatchId: null,
        ...(dateSaisie ? { date: dateSaisie } : {}),
      },
    });

    const dus = await accumulerDette(user.id, repartirPoints(scoringTemps.pointsFinaux, selection));
    return NextResponse.json({
      game,
      scoring: { ...scoringTemps, pompesFinales: scoringTemps.pointsFinaux },
      repartition: repartirPoints(scoringTemps.pointsFinaux, selection),
      dettePointsDus: dus,
    });
  }

  if (!roleWeights || !masteryConfig) {
    return NextResponse.json({ error: "Config manquante" }, { status: 500 });
  }

  // Un jeu sans lane ni KDA n'envoie pas ces champs : on les ramène à des
  // valeurs sûres, sinon Prisma reçoit undefined ou NaN sur des colonnes
  // obligatoires.
  const role = capacites.roles && body.role ? String(body.role) : "—";
  // Un battle royale compte ses éliminations, mais ni morts ni assists.
  // Sur Rocket League, `kills` porte les buts et `assists` les passes : les
  // trois statistiques sont positives, aucune ne creuse la dette.
  const kills = capacites.kda || capacites.br || capacites.rl ? Number(body.kills) || 0 : 0;
  const deaths = capacites.kda ? Number(body.deaths) || 0 : 0;
  const assists = capacites.kda || capacites.rl ? Number(body.assists) || 0 : 0;
  const arrets = capacites.rl ? Math.max(0, Number(body.arrets) || 0) : null;
  const champion = capacites.champions && body.champion ? String(body.champion) : null;

  // Battle royale : la place finale remplace le compteur de morts, et la
  // victoire se déduit du classement plutôt que d'un bouton.
  const placement = capacites.br ? Math.max(1, Math.round(Number(body.placement) || 0)) : null;
  const joueurs = capacites.br ? Math.max(2, Math.round(Number(body.joueurs) || capacites.joueurs)) : null;
  if (capacites.br && !Number(body.placement)) {
    return NextResponse.json({ error: "Classement invalide" }, { status: 400 });
  }
  const resultat = capacites.br
    ? (placement === 1 ? "V" : "D")
    : (body.result === "V" ? "V" : "D");

  const scoring = capacites.br && placement !== null && joueurs !== null
    ? calcScoreBattleRoyale({ placement, joueurs, kills, gainageSec: gainageEquivalent, roleWeights, levelConfigs })
    : capacites.rl
    ? calcScoreRocketLeague({
        buts: kills, arrets: arrets ?? 0, passes: assists,
        result: resultat, gainageSec: gainageEquivalent, roleWeights, levelConfigs,
      })
    : calcScore({
        kills,
        deaths,
        assists,
        result: resultat,
        gainageSec: gainageEquivalent,
        partiesAvant,
        roleWeights,
        levelConfigs,
        masteryConfig,
      });

  const game = await prisma.game.create({
    data: {
      userId: user.id,
      role,
      champion,
      kills,
      deaths,
      assists,
      result: resultat,
      gainageSec,
      niveauCalcule: scoring.niveau,
      partiesAvantCalcule: partiesAvant,
      surchargeCalculee: scoring.surcharge,
      scoreCalcule: scoring.scoreBase,
      malusCalcule: scoring.malus,
      pompesCalculees: scoring.pompesFinales,
      // Fige les exercices retenus : l'historique reste fidèle même si la
      // sélection change plus tard.
      exercice,
      repartition: ventilation(scoring.pompesFinales),
      jeu,
      typeJeu,
      placement,
      joueurs,
      arrets,
      // Type de file, quand le lanceur League a pu le dire. Facultatif : une
      // saisie manuelle ou un autre jeu n'en ont pas.
      file: typeof body.fileNom === "string" ? body.fileNom.slice(0, 80) : null,
      fileClassee: typeof body.fileClassee === "boolean" ? body.fileClassee : null,
      source: body.source || "manuel",
      riotMatchId: body.riotMatchId || null,
    },
  });

  const dus = await accumulerDette(user.id, repartirPoints(scoring.pompesFinales, selection));
  return NextResponse.json({
    game,
    scoring,
    repartition: repartirPoints(scoring.pompesFinales, selection),
    dettePointsDus: dus,
  });
}

/**
 * Ajoute à la dette en attente la seule part qui se compte en temps. Les
 * pompes et les squats se font dans la foulée de la partie ; la boxe, elle,
 * n'a d'intérêt qu'une fois quelques minutes accumulées.
 *
 * Un échec ici ne doit pas faire perdre la partie déjà écrite : le compteur
 * se rattrapera à la partie suivante.
 */
async function accumulerDette(userId: string, repartition: Repartition): Promise<number | null> {
  const points = pointsEnTemps(repartition);
  if (points <= 0) return null;
  try {
    const avant = await prisma.user.findUnique({
      where: { id: userId },
      select: { dettePointsDus: true, rappelSeuilSec: true, exercices: true },
    });
    const maj = await prisma.user.update({
      where: { id: userId },
      data: { dettePointsDus: { increment: points } },
      select: { dettePointsDus: true },
    });

    // La notification part au franchissement du seuil, jamais à chaque partie :
    // prévenir dix fois dans la soirée ferait couper les notifications.
    if (avant) {
      const exercices = exercicesEnTemps(toExerciceIds(avant.exercices));
      const seuil = Math.max(0, avant.rappelSeuilSec);
      if (exercices.length > 0 && seuil > 0) {
        const avantSec = dureeEffort(Math.max(0, avant.dettePointsDus), exercices);
        const apresSec = dureeEffort(Math.max(0, maj.dettePointsDus), exercices);
        if (avantSec < seuil && apresSec >= seuil) {
          // Sans await : une notification lente ne doit pas retarder la réponse.
          notifier(userId, {
            titre: "Tu as de quoi faire",
            corps: `${formaterDuree(apresSec)} en attente. C'est le moment, entre deux parties.`,
            tag: "wow-dette",
          }).catch(() => {});
        }
      }
    }

    return maj.dettePointsDus;
  } catch {
    return null;
  }
}
