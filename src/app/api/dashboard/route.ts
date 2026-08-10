import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import {
  isExerciceId, parseRepartition, partPourExercice, toExerciceIds, RAPPEL_SEUIL_DEFAUT,
} from "@/lib/exercices";
import { toTypeJeu, type TypeJeu } from "@/lib/jeux";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [toutesLesGames, goal] = await Promise.all([
    prisma.game.findMany({ where: { userId: user.id }, orderBy: { date: "asc" } }),
    prisma.goal.findUnique({ where: { userId: user.id } }),
  ]);

  const params = new URL(req.url).searchParams;

  // Filtre optionnel : consulter les statistiques d'un seul exercice, ce qui
  // rend les graphiques lisibles dans une unité unique.
  const filtreBrut = params.get("exercice");
  const filtre = isExerciceId(filtreBrut) ? filtreBrut : null;

  // Filtre optionnel par jeu. Les jeux ne se comparent pas : une soirée
  // Minecraft et une ranked League ne produisent pas la même sorte de dette.
  const jeuBrut = params.get("jeu");
  const filtreJeu = jeuBrut && jeuBrut.trim() ? jeuBrut.trim() : null;

  /** Ce que chaque partie doit, exercice par exercice. */
  const ventilationDe = (g: (typeof toutesLesGames)[number]) =>
    parseRepartition(g.repartition, g.exercice, g.pompesCalculees);

  const games = toutesLesGames.filter(
    (g) =>
      // Une partie payée en pompes ET en boxe apparaît sous les deux filtres,
      // pour la seule part qui revient à l'exercice consulté.
      (filtre === null || partPourExercice(ventilationDe(g), filtre) > 0) &&
      (filtreJeu === null || g.jeu === filtreJeu),
  );

  /**
   * Coût d'une partie dans le périmètre consulté : sa part quand on regarde un
   * exercice en particulier, son total sinon.
   */
  const pts = (g: (typeof toutesLesGames)[number]) =>
    filtre === null ? g.pompesCalculees : partPourExercice(ventilationDe(g), filtre);

  // Les jeux « au temps » n'ont ni victoire ni défaite : les compter dans le
  // winrate le ferait chuter à chaque soirée de survie. Tout ce qui touche au
  // résultat, au rôle, au KDA et aux champions se calcule donc sur les seules
  // parties compétitives.
  const parties = games.filter((g) => toTypeJeu(g.typeJeu) === "parties");
  const toutesLesParties = toutesLesGames.filter((g) => toTypeJeu(g.typeJeu) === "parties");

  const totalGames = games.length;
  const wins = parties.filter((g) => g.result === "V").length;
  const winrate = parties.length > 0 ? Math.round((wins / parties.length) * 100) : 0;
  const totalPompes = games.reduce((s, g) => s + pts(g), 0);
  // Temps de jeu cumulé sur le périmètre consulté (jeux au temps uniquement).
  const tempsJoueSec = games.reduce((s, g) => s + (g.dureeSec ?? 0), 0);

  // Compteurs d'en-tête : toujours sur l'ensemble des parties, pour qu'ils ne
  // bougent pas quand on consulte un exercice en particulier.
  const globalGames = toutesLesGames.length;
  const globalWins = toutesLesParties.filter((g) => g.result === "V").length;
  const globalWinrate = toutesLesParties.length > 0
    ? Math.round((globalWins / toutesLesParties.length) * 100)
    : 0;
  const globalTotalPoints = toutesLesGames.reduce((s, g) => s + g.pompesCalculees, 0);
  const globalTempsJoueSec = toutesLesGames.reduce((s, g) => s + (g.dureeSec ?? 0), 0);
  const recordPompes = games.length > 0 ? Math.max(...games.map(pts)) : 0;

  // Catalogue des jeux réellement joués : sert à peupler le filtre, et à savoir
  // si l'utilisateur a assez de jeux différents pour que le filtre ait un sens.
  const jeuxAgg = new Map<string, { nom: string; type: TypeJeu; games: number; points: number }>();
  for (const g of toutesLesGames) {
    const nom = g.jeu || "League of Legends";
    const courant = jeuxAgg.get(nom) ?? { nom, type: toTypeJeu(g.typeJeu), games: 0, points: 0 };
    courant.games++;
    courant.points += g.pompesCalculees;
    jeuxAgg.set(nom, courant);
  }
  const jeuxJoues = [...jeuxAgg.values()].sort((a, b) => b.games - a.games);
  const typeJeuFiltre: TypeJeu | null = filtreJeu ? (jeuxAgg.get(filtreJeu)?.type ?? null) : null;

  // Ventilation par exercice : des répétitions et des minutes ne s'additionnent
  // pas, le total doit donc rester détaillé exercice par exercice.
  const pointsParExercice: Record<string, number> = {};
  for (const g of toutesLesGames) {
    for (const [ex, part] of Object.entries(ventilationDe(g))) {
      pointsParExercice[ex] = (pointsParExercice[ex] || 0) + (part ?? 0);
    }
  }
  // La partie la plus coûteuse, avec l'exercice qui lui correspond.
  const gameRecord = games.reduce<typeof games[number] | null>(
    (best, g) => (best === null || pts(g) > pts(best) ? g : best),
    null,
  );
  // Sans filtre, une partie partagée entre exercices n'a pas d'unité unique :
  // on retient celle de son exercice principal.
  const recordExercice = gameRecord
    ? (filtre ?? toExerciceIds([gameRecord.exercice])[0])
    : null;

  // Dette et volume par jeu : la vue d'ensemble d'un joueur multi-jeux.
  const pompesByJeu: Record<string, number> = {};
  const gamesByJeu: Record<string, number> = {};
  for (const g of games) {
    const nom = g.jeu || "League of Legends";
    pompesByJeu[nom] = (pompesByJeu[nom] || 0) + pts(g);
    gamesByJeu[nom] = (gamesByJeu[nom] || 0) + 1;
  }

  const pompesByRole: Record<string, number> = {};
  const gamesByRole: Record<string, number> = {};
  const pompesByNiveau: Record<number, number> = {};
  const champAgg: Record<string, { games: number; kills: number; deaths: number; assists: number; pompes: number }> = {};

  for (const g of games) {
    pompesByNiveau[g.niveauCalcule] = (pompesByNiveau[g.niveauCalcule] || 0) + pts(g);
  }

  // Rôles et champions n'existent que pour les jeux à parties : une session
  // Minecraft n'a ni l'un ni l'autre et polluerait les graphiques.
  for (const g of parties) {
    pompesByRole[g.role] = (pompesByRole[g.role] || 0) + pts(g);
    gamesByRole[g.role] = (gamesByRole[g.role] || 0) + 1;

    const champ = g.champion;
    if (!champ) continue;
    if (!champAgg[champ]) champAgg[champ] = { games: 0, kills: 0, deaths: 0, assists: 0, pompes: 0 };
    champAgg[champ].games++;
    champAgg[champ].kills += g.kills;
    champAgg[champ].deaths += g.deaths;
    champAgg[champ].assists += g.assists;
    champAgg[champ].pompes += pts(g);
  }

  const champList = Object.entries(champAgg).map(([name, s]) => ({
    name,
    games: s.games,
    avgKills: +(s.kills / s.games).toFixed(1),
    avgDeaths: +(s.deaths / s.games).toFixed(1),
    avgAssists: +(s.assists / s.games).toFixed(1),
    kda: s.deaths === 0 ? null : +((s.kills + s.assists) / s.deaths).toFixed(2),
    avgPompes: Math.round(s.pompes / s.games),
  }));

  const mostPlayed = champList.length > 0
    ? champList.reduce((a, b) => b.games > a.games ? b : a)
    : null;

  const leastEfficient = champList.length > 0
    ? champList.reduce((a, b) => b.avgPompes > a.avgPompes ? b : a)
    : null;

  // Cumul par date pour le graphique
  const cumulByDate: { date: string; cumul: number }[] = [];
  let cumul = 0;
  for (const g of games) {
    cumul += pts(g);
    cumulByDate.push({ date: g.date.toISOString().slice(0, 10), cumul });
  }

  // Moyennes par période (heure / jour de semaine / mois)
  const byHour: Record<number, { total: number; count: number }> = {};
  const byWeekday: Record<number, { total: number; count: number }> = {};
  const byMonth: Record<number, { total: number; count: number }> = {};

  for (const g of games) {
    const d = new Date(g.date);
    const h = d.getHours();
    const wd = d.getDay();
    const mo = d.getMonth();
    byHour[h] = byHour[h] ?? { total: 0, count: 0 };
    byHour[h].total += pts(g);
    byHour[h].count++;
    byWeekday[wd] = byWeekday[wd] ?? { total: 0, count: 0 };
    byWeekday[wd].total += pts(g);
    byWeekday[wd].count++;
    byMonth[mo] = byMonth[mo] ?? { total: 0, count: 0 };
    byMonth[mo].total += pts(g);
    byMonth[mo].count++;
  }

  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];
  const weekdayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const monthLabels = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

  const statsByPeriod = {
    hour: Array.from({ length: 24 }, (_, h) => ({
      label: `${h}h`,
      avg: byHour[h] ? Math.round(byHour[h].total / byHour[h].count) : 0,
      total: byHour[h]?.total ?? 0,
    })).filter((_, h) => !!byHour[h]),
    weekday: weekdayOrder.map((wd, i) => ({
      label: weekdayLabels[i],
      avg: byWeekday[wd] ? Math.round(byWeekday[wd].total / byWeekday[wd].count) : 0,
      total: byWeekday[wd]?.total ?? 0,
    })),
    month: monthLabels.map((label, i) => ({
      label,
      avg: byMonth[i] ? Math.round(byMonth[i].total / byMonth[i].count) : 0,
      total: byMonth[i]?.total ?? 0,
    })).filter((_, i) => !!byMonth[i]),
  };

  const byDayTotal: Record<string, number> = {};
  for (const g of games) {
    const day = g.date.toISOString().slice(0, 10);
    byDayTotal[day] = (byDayTotal[day] || 0) + pts(g);
  }
  const dailyPompes = Object.entries(byDayTotal)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({ date, total }));

  return NextResponse.json({
    totalGames,
    wins,
    winrate,
    totalPompes,
    recordPompes,
    pompesByRole,
    gamesByRole,
    pompesByJeu,
    gamesByJeu,
    pompesByNiveau,
    cumulByDate,
    statsByPeriod,
    dailyPompes,
    mostPlayed,
    leastEfficient,
    objectifTotalPompes: goal?.objectifTotalPompes ?? 1000,
    niveau: user?.gainageMaxSec ?? 45,
    // Exercices sélectionnés : servent à convertir les points d'effort à
    // l'affichage et à ventiler les totaux.
    exercices: toExerciceIds(user?.exercices),
    global: {
      totalGames: globalGames,
      wins: globalWins,
      winrate: globalWinrate,
      totalPoints: globalTotalPoints,
      tempsJoueSec: globalTempsJoueSec,
      // Nombre de parties compétitives : le winrate ne porte que sur celles-ci.
      totalParties: toutesLesParties.length,
    },
    pointsParExercice,
    filtreExercice: filtre,
    // ── Multi-jeu ──
    jeuxJoues,
    filtreJeu,
    typeJeuFiltre,
    tempsJoueSec,
    totalParties: parties.length,
    recordExercice,
    rappelSeuilPoints: user?.rappelSeuilPoints ?? RAPPEL_SEUIL_DEFAUT,
  });
}
