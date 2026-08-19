"use client";
import { useEffect, useState } from "react";
import { DesktopAuthHandler } from "@/components/DesktopAuthHandler";
import { ChampionIcon } from "@/components/ChampionIcon";
import { Icone } from "@/components/Icone";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { useSession } from "@/lib/SessionContext";
import { useT, useDateLocale, useLocale } from "@/lib/i18n/LocaleContext";
import { dashboard } from "@/lib/i18n/dictionaries/dashboard";
import { exercices as exercicesDict } from "@/lib/i18n/dictionaries/exercices";
import { translateApiError } from "@/lib/i18n/apiErrors";
import {
  EXERCICES, EXERCICE_DEFAUT, EXERCICE_IDS, formaterAxe, formaterCompact,
  toExerciceId, toExerciceIds, type ExerciceId,
} from "@/lib/exercices";
import { ExerciceSelector } from "@/components/ExerciceSelector";
import { jeux as jeuxDict } from "@/lib/i18n/dictionaries/jeux";
import { JEU_DEFAUT, capacitesDuJeu, formaterTempsJeu, typeDuJeu, type TypeJeu } from "@/lib/jeux";
import { JeuSelector } from "@/components/JeuSelector";
import { SessionChrono } from "@/components/SessionChrono";
import { AjoutActivite } from "@/components/AjoutActivite";
import { RailActions } from "@/components/RailLateral";
import { Modale } from "@/components/Modale";
import { TestPompes } from "@/components/TestPompes";
import { getLevelParPompes, testAFaire, type LevelCfg } from "@/lib/scoring";
import { StatCard, ChampionCard, type ChampSummary } from "@/components/dashboard/Cartes";
import {
  AXE_TICK, AXE_TICK_DENSE, AXE_TICK_FORT, AXE_TICK_FORT_DENSE, INFOBULLE,
  RAYON_BARRE, GRILLE_TRAIT, TEINTES,
} from "@/lib/graphiques";

type PeriodStat = { label: string; avg: number; total: number };

type DashData = {
  totalGames: number;
  wins: number;
  winrate: number;
  totalPompes: number;
  recordPompes: number;
  pompesByRole: Record<string, number>;
  gamesByRole: Record<string, number>;
  /** Battle royale : ventilation par mode d'équipe, indexée par taille de groupe. */
  pompesByMode?: Record<string, number>;
  gamesByMode?: Record<string, number>;
  pompesByJeu?: Record<string, number>;
  gamesByJeu?: Record<string, number>;
  cumulByDate: { date: string; cumul: number }[];
  /** Coût moyen d'une activité, semaine par semaine : le seul indicateur qui peut descendre. */
  moyenneParSemaine?: { semaine: string; moyenne: number; parties: number }[];
  statsByPeriod: { hour: PeriodStat[]; weekday: PeriodStat[]; month: PeriodStat[] };
  dailyPompes: { date: string; total: number }[];
  /** Effort accumulé aujourd'hui, et seuil au-delà duquel on prévient. */
  pointsAujourdhui?: number;
  plafondQuotidien?: number;
  mostPlayed: ChampSummary | null;
  leastEfficient: ChampSummary | null;
  objectifTotalPompes: number;
  exercices?: ExerciceId[];
  filtreExercice?: ExerciceId | null;
  global?: {
    totalGames: number; wins: number; winrate: number; totalPoints: number;
    tempsJoueSec?: number; totalParties?: number;
  };
  pointsParExercice?: Record<string, number>;
  recordExercice?: ExerciceId | null;
  // ── Multi-jeu ──
  jeuxJoues?: {
    nom: string; type: TypeJeu; games: number; points: number;
    wins: number; parties: number; tempsJoueSec: number;
    winrate: number | null; detteMoyenne: number;
  }[];
  filtreJeu?: string | null;
  typeJeuFiltre?: TypeJeu | null;
  tempsJoueSec?: number;
  totalParties?: number;
};

export default function Dashboard() {
  const t = useT(dashboard);
  const tExo = useT(exercicesDict);
  const tJeux = useT(jeuxDict);
  const dateLocale = useDateLocale();
  const [data, setData] = useState<DashData | null>(null);
  /** Modale ouverte depuis le rail latéral. */
  const [modale, setModale] = useState<"session" | "ajout" | null>(null);
  const [statsPeriod, setStatsPeriod] = useState<"hour" | "weekday" | "month" | "daily">("weekday");
  const [statsMode, setStatsMode] = useState<"avg" | "total">("avg");
  const [calendarDate, setCalendarDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [dailyHourly, setDailyHourly] = useState<{ label: string; total: number }[] | null>(null);
  const [dailySummary, setDailySummary] = useState<{ total: number; games: number } | null>(null);
  // Jour dont le détail est effectivement affiché. Le chargement s'en déduit :
  // tant qu'il ne correspond pas à la date demandée, la réponse est en route.
  const [dailyCharge, setDailyCharge] = useState<string | null>(null);
  const [roleView, setRoleView] = useState<"total" | "avg">("total");
  const [exercicesSel, setExercicesSel] = useState<ExerciceId[]>([EXERCICE_DEFAUT]);
  const [filtreExo, setFiltreExo] = useState<ExerciceId | null>(null);
  const [filtreJeu, setFiltreJeu] = useState<string | null>(null);
  // Jeu de la prochaine session, mémorisé d'une fois sur l'autre.
  const [jeuChoisi, setJeuChoisi] = useState<string>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("lastJeu") ?? JEU_DEFAUT;
    return JEU_DEFAUT;
  });
  const [typeJeuChoisi, setTypeJeuChoisi] = useState<TypeJeu>(() => {
    if (typeof window !== "undefined") return typeDuJeu(localStorage.getItem("lastJeu") ?? JEU_DEFAUT);
    return "parties";
  });
  const [arretEnCours, setArretEnCours] = useState(false);
  // Test de force : le niveau n'est plus redemandé à chaque session, il vit sur
  // le compte. Chargé à l'ouverture de la modale, pas au chargement du tableau.
  const [pompesMax, setPompesMax] = useState(0);
  const [pompesMaxLe, setPompesMaxLe] = useState<string | null>(null);
  const [niveaux, setNiveaux] = useState<LevelCfg[]>([]);

  const {
    sessionActive, sessionGames, sessionError, polling, countdown, sessionNiveau,
    startSession, stopSession,
    typeSession, jeuSession, chronoSec, chronoErreur, arreterChrono, dettePoints,
  } = useSession();
  const { locale } = useLocale();

  const loadDash = (filtre: ExerciceId | null = filtreExo, jeu: string | null = filtreJeu) => {
    const qs = new URLSearchParams();
    if (filtre) qs.set("exercice", filtre);
    if (jeu) qs.set("jeu", jeu);
    const url = qs.toString() ? `/api/dashboard?${qs}` : "/api/dashboard";
    return fetch(url).then(async (res) => {
      if (!res.ok) {
        // Session invalide (ex. cookie d'une ancienne base) → retour au login.
        if (res.status === 401 && typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return;
      }
      const d = await res.json();
      setData(d);
      setExercicesSel(toExerciceIds(d?.exercices));
    });
  };

  // Charge au montage puis à chaque changement de périmètre consulté.
  useEffect(() => { loadDash(filtreExo, filtreJeu); }, [filtreExo, filtreJeu]);

  // Rafraîchit les stats globales à chaque nouvelle game loggée en session.
  useEffect(() => {
    if (sessionGames.length > 0) loadDash();
  }, [sessionGames.length]);

  useEffect(() => {
    if (statsPeriod !== "daily") return;
    // En changeant de date rapidement, une réponse tardive écrasait la plus
    // récente : on ignore celles dont on n'attend plus rien.
    let obsolete = false;
    fetch(`/api/dashboard/daily?date=${calendarDate}`)
      .then((r) => r.json())
      .then((d) => {
        if (obsolete) return;
        setDailyHourly(d.hourly ?? []);
        setDailySummary({ total: d.total ?? 0, games: d.games ?? 0 });
        setDailyCharge(calendarDate);
      })
      .catch(() => { if (!obsolete) setDailyCharge(calendarDate); });
    return () => { obsolete = true; };
  }, [statsPeriod, calendarDate]);

  const dailyLoading = statsPeriod === "daily" && dailyCharge !== calendarDate;

  // Le niveau vient du test de force enregistré sur le compte. Il se chargeait
  // à l'ouverture de la modale de session, pour épargner le tableau ; mais le
  // rappel du test s'affiche désormais sur la page elle-même, et il ne peut pas
  // décider s'il doit paraître sans connaître la date du dernier test.
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => {
        setNiveaux(s.levelConfigs ?? []);
        setPompesMax(s.user?.pompesMax ?? 0);
        setPompesMaxLe(s.user?.pompesMaxLe ?? null);
      })
      .catch(() => {});
  }, []);

  const handleSavePompesMax = async (valeur: number) => {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userPrefs: { pompesMax: valeur } }),
    });
    if (res.ok) {
      setPompesMax(valeur);
      setPompesMaxLe(new Date().toISOString());
    }
  };

  // Niveau affiché pendant la session : celui que le serveur appliquera, déduit
  // du test de force. Tant que le test n'est pas fait, le compte reste au plus bas.
  const niveauActuel =
    pompesMax > 0 && niveaux.length > 0 ? getLevelParPompes(pompesMax, niveaux).niveau : 1;

  const handleDemarrerSession = async () => {
    localStorage.setItem("lastJeu", jeuChoisi);
    // La fenêtre reste ouverte : elle bascule sur l'état de la session qui vient
    // de démarrer, ce qui confirme le lancement sans clic supplémentaire.
    // Le choix fait ici devient la préférence, pour l'ARAM du chaos comme pour
    // les prochaines sessions.
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userPrefs: { exercices: exercicesSel } }),
    }).catch(() => {});
    await startSession(niveauActuel, jeuChoisi);
  };

  // Fin d'une session chronométrée : la durée est écrite, puis les stats
  // rechargées pour que la nouvelle dette apparaisse tout de suite.
  const handleArreterChrono = async () => {
    setArretEnCours(true);
    const ok = await arreterChrono();
    setArretEnCours(false);
    if (ok) loadDash();
  };

  if (!data) return <div className="text-center py-20 gold-text">{t.loading}</div>;

  // Les données restent en POINTS D'EFFORT : on ne convertit qu'à l'affichage,
  // ce qui laisse les échelles des graphiques inchangées (conversion linéaire).
  const exercicesActifs = toExerciceIds(data.exercices);
  // Exercices réellement présents dans l'historique : ils seuls méritent un filtre.
  const exercicesJoues = EXERCICE_IDS.filter((id) => (data.pointsParExercice?.[id] ?? 0) > 0);
  const multi = filtreExo === null && exercicesJoues.length > 1;
  const exercice = filtreExo ?? (exercicesJoues[0] ?? exercicesActifs[0]);
  const nomsExo: Record<ExerciceId, string> = {
    pompes: tExo.pompesNom, squats: tExo.squatsNom, boxe: tExo.boxeNom,
  };
  // Ventilation du total : une ligne par exercice réellement utilisé.
  const lignesTotal = Object.entries(data.pointsParExercice ?? {})
    .filter(([, pts]) => pts > 0)
    .map(([ex, pts]) => ({
      nom: nomsExo[toExerciceId(ex)],
      valeur: formaterCompact(pts, toExerciceId(ex)),
    }));
  const exerciceRecord = toExerciceId(data.recordExercice ?? exercice);
  const globalStats = data.global ?? {
    totalGames: data.totalGames,
    wins: data.wins,
    winrate: data.winrate,
    totalPoints: data.totalPompes,
  };
  // ── Multi-jeu ──
  // Le filtre par jeu n'a de sens qu'à partir de deux jeux différents.
  const jeuxJoues = data.jeuxJoues ?? [];
  const typeConsulte = data.typeJeuFiltre ?? null;
  // Un jeu au temps n'a ni résultat, ni rôle, ni champion : afficher ces
  // sections reviendrait à montrer des graphiques vides ou faux.
  const vueTemps = typeConsulte === "temps";
  const aDuTemps = (data.global?.tempsJoueSec ?? 0) > 0;

  const fmt = (points: number) => formaterCompact(points, exercice);
  const fmtAxe = (points: number) => formaterAxe(points, exercice);

  const progress = data.objectifTotalPompes > 0
    ? Math.min(100, Math.round((globalStats.totalPoints / data.objectifTotalPompes) * 100))
    : 0;
  const roleData = Object.entries(data.pompesByRole ?? {}).map(([role, pompes]) => ({
    role,
    pompes: roleView === "avg"
      ? Math.round(pompes / (data.gamesByRole?.[role] || 1))
      : pompes,
  }));

  /**
   * Le jeu que la page décrit réellement. Les statistiques par rôle et par
   * champion n'ont de sens que sur un seul jeu — mais ne pas filtrer ne veut
   * pas dire « plusieurs jeux » : quand on n'en a joué qu'un, « tous les jeux »
   * désigne celui-là. Sans cette nuance, quelqu'un qui ne joue qu'à League ne
   * voyait jamais ses champions, faute de filtre à cliquer.
   */
  const jeuUnique = filtreJeu ?? (jeuxJoues.length === 1 ? jeuxJoues[0].nom : null);

  // Le plafond est un avertissement, pas une limite : il se déclenche une fois
  // franchi et n'empêche jamais d'enregistrer une partie de plus.
  const plafondDepasse =
    (data.plafondQuotidien ?? 0) > 0
    && (data.pointsAujourdhui ?? 0) > (data.plafondQuotidien ?? 0);

  // Sur un battle royale, les rôles n'existent pas : toutes les parties
  // tombent dans la même case et le graphique ne dit rien. On le remplace par
  // la ventilation solo / duo / trio / squad, qui elle distingue vraiment.
  const estBattleRoyale = jeuUnique !== null && capacitesDuJeu(jeuUnique).br;
  const modeData = Object.entries(data.pompesByMode ?? {})
    .map(([taille, pompes]) => ({
      taille: Number(taille),
      label: t.modeNom(Number(taille)),
      pompes: roleView === "avg"
        ? Math.round(pompes / (data.gamesByMode?.[taille] || 1))
        : pompes,
    }))
    .sort((a, b) => a.taille - b.taille);
  const repartitionData: { label: string; pompes: number }[] = estBattleRoyale
    ? modeData.map(({ label, pompes }) => ({ label, pompes }))
    : roleData.map(({ role, pompes }) => ({ label: role, pompes }));

  // Répartition par jeu : la lecture d'ensemble d'un joueur multi-jeux. Elle
  // n'a de sens qu'à partir de deux jeux, et pas quand on en filtre un seul.
  const jeuData = Object.entries(data.pompesByJeu ?? {})
    .map(([jeu, pompes]) => ({
      jeu,
      pompes: roleView === "avg"
        ? Math.round(pompes / (data.gamesByJeu?.[jeu] || 1))
        : pompes,
    }))
    .sort((a, b) => b.pompes - a.pompes);
  const afficherParJeu = filtreJeu === null && jeuData.length > 1;
  const totalSessionPompes = sessionGames.reduce((s, g) => s + g.pompes, 0);
  const sessionChartData = [...sessionGames].reverse().map((g, i) => ({ label: `G${i + 1}`, pompes: g.pompes }));

  return (
    <div className="space-y-6">
      <DesktopAuthHandler />
      <h1 style={{ fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)", fontSize: "1.5rem", color: "#ECEFF4", letterSpacing: "0.18em" }}>{t.pageTitle}</h1>

      {/* Bannière bêta — synchronisation en attente */}
      <div style={{
        padding: "12px 16px",
        borderRadius: 8,
        background: "rgba(110,155,255,0.06)",
        border: "1px solid rgba(110,155,255,0.25)",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}>
        <Icone nom="recharger" taille={17} couleur="#6E9BFF" style={{ marginTop: 1 }} />
        <div>
          <p style={{ fontSize: "0.82rem", color: "#6E9BFF", fontWeight: 600, marginBottom: 4 }}>
            {t.syncBannerTitle}
          </p>
          <p style={{ fontSize: "0.78rem", color: "rgba(236,239,244,0.55)", lineHeight: 1.6 }}>
            {t.syncBannerBody}
          </p>
        </div>
      </div>

      {/* Test de force, tant qu'il est à faire.
          Il ne vivait que dans les réglages et dans la modale de démarrage de
          session : deux endroits où l'on ne va pas de soi-même. Or c'est lui
          qui fixe le multiplicateur appliqué à TOUTE la dette — sans lui, tout
          le monde reste au niveau 1 sans savoir pourquoi. Il s'affiche donc
          ici, et disparaît dès qu'il est passé. */}
      {testAFaire(pompesMax, pompesMaxLe) && niveaux.length > 0 && (
        <div className="lol-panel p-5">
          <TestPompes
            autonome
            pompesMax={pompesMax}
            faitLe={pompesMaxLe}
            niveaux={niveaux}
            onEnregistre={handleSavePompesMax}
          />
        </div>
      )}

      {/* Avertissement de volume quotidien. Ce n'est pas un blocage : la dette
          reste due, on signale seulement qu'on a dépassé ce qu'on s'était fixé
          pour la journée, et on rappelle qu'on a le droit de s'arrêter là. */}
      {plafondDepasse && (
        <div style={{
          padding: "12px 16px",
          borderRadius: 8,
          background: "rgba(255,180,84,0.07)",
          border: "1px solid rgba(255,180,84,0.3)",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}>
          <Icone nom="alerte" taille={17} couleur="var(--amber)" style={{ marginTop: 1 }} />
          <div>
            <p style={{ fontSize: "0.82rem", color: "var(--amber)", fontWeight: 600, marginBottom: 4 }}>
              {t.plafondTitre}
            </p>
            <p style={{ fontSize: "0.78rem", color: "rgba(236,239,244,0.6)", lineHeight: 1.6 }}>
              {t.plafondCorps(
                fmt(data.pointsAujourdhui ?? 0),
                fmt(data.plafondQuotidien ?? 0),
              )}
            </p>
          </div>
        </div>
      )}

      {/* Vue d'ensemble — jamais filtrée : elle décrit toute l'activité */}
      <div data-visite="stats" className={`grid grid-cols-1 gap-3 ${aDuTemps ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
        <StatCard label={t.gamesPlayed} value={globalStats.totalGames} i={0} />
        <StatCard
          label={t.winrate}
          value={`${globalStats.winrate}%`}
          // Le dénominateur est le nombre de parties compétitives : les
          // sessions au temps n'ont pas de résultat et n'entrent pas au compte.
          sub={`${globalStats.wins}V / ${(globalStats.totalParties ?? globalStats.totalGames) - globalStats.wins}D`}
          i={1}
        />
        <StatCard
          label={t.totalPompes}
          value={lignesTotal.length <= 1 ? fmt(globalStats.totalPoints) : undefined}
          lignes={lignesTotal.length > 1 ? lignesTotal : undefined}
          i={2}
        />
        {aDuTemps && (
          <StatCard
            label={tJeux.tempsJoueLabel}
            value={formaterTempsJeu(data.global?.tempsJoueSec ?? 0)}
            i={3}
          />
        )}
      </div>

      {data.objectifTotalPompes > 0 && (
        <div className="lol-panel p-4 space-y-2 rise" style={{ animationDelay: "320ms" }}>
          <div className="flex justify-between text-sm">
            <span className="gold-text font-semibold">{t.objectiveLibre(fmt(data.objectifTotalPompes))}</span>
            <span className="mono-num" style={{ color: "var(--amber)", fontWeight: 600 }}>{progress}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(152,162,176,0.15)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: "var(--brand-gradient)",
                boxShadow: "0 0 12px rgba(255,138,61,0.45)",
                transition: "width 1s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </div>
          <div className="text-xs" style={{ color: "rgba(236,239,244,0.5)" }}>
            {t.objectiveProgressLibre(fmt(globalStats.totalPoints), fmt(data.objectifTotalPompes))}
            {data.objectifTotalPompes - globalStats.totalPoints > 0
              ? t.objectiveRemainingLibre(fmt(data.objectifTotalPompes - globalStats.totalPoints))
              : t.objectiveReached}
          </div>
        </div>
      )}

      {/* Filtre par jeu — n'apparaît qu'à partir de deux jeux différents */}
      {jeuxJoues.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap rise" style={{ animationDelay: "220ms" }}>
          <span className="text-xs" style={{ color: "rgba(152,162,176,0.7)" }}>{tJeux.filtreJeuTitre}</span>
          {[null, ...jeuxJoues.map((j) => j.nom)].map((nom) => {
            const actif = filtreJeu === nom;
            return (
              <button
                key={nom ?? "tous"}
                onClick={() => setFiltreJeu(nom)}
                aria-pressed={actif}
                style={{
                  padding: "5px 13px", borderRadius: 999, fontSize: "0.78rem", cursor: "pointer",
                  background: actif ? "rgba(110,155,255,0.1)" : "transparent",
                  border: `1px solid ${actif ? "var(--signal)" : "var(--line-strong)"}`,
                  color: actif ? "var(--signal)" : "rgba(236,239,244,0.6)",
                  transition: "all 0.15s",
                }}
              >
                {nom === null ? tJeux.filtreTousJeux : nom}
              </button>
            );
          })}
        </div>
      )}

      {/* Contexte : exercice consulté, et son record */}
      {exercicesJoues.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap justify-between rise" style={{ animationDelay: "260ms" }}>
          {exercicesJoues.length > 1 ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs" style={{ color: "rgba(152,162,176,0.7)" }}>{tExo.filtreTitre}</span>
              {[null, ...exercicesJoues].map((id) => {
                const actif = filtreExo === id;
                return (
                  <button
                    key={id ?? "tous"}
                    onClick={() => setFiltreExo(id)}
                    aria-pressed={actif}
                    style={{
                      padding: "5px 13px", borderRadius: 999, fontSize: "0.78rem", cursor: "pointer",
                      background: actif ? "rgba(255,180,84,0.1)" : "transparent",
                      border: `1px solid ${actif ? "var(--amber)" : "var(--line-strong)"}`,
                      color: actif ? "var(--amber)" : "rgba(236,239,244,0.6)",
                      transition: "all 0.15s",
                    }}
                  >
                    {id === null ? tExo.filtreTous : nomsExo[id]}
                  </button>
                );
              })}
            </div>
          ) : <span />}

          {vueTemps && (data.tempsJoueSec ?? 0) > 0 && (
            <div className="flex items-baseline gap-2" style={{
              padding: "7px 14px", borderRadius: 10,
              border: "1px solid var(--line)", background: "var(--carbon)",
            }}>
              <span style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(152,162,176,0.6)" }}>
                {tJeux.tempsJoueLabel}
              </span>
              <span className="mono-num" style={{ fontSize: "1rem", fontWeight: 600, color: "var(--signal)" }}>
                {formaterTempsJeu(data.tempsJoueSec ?? 0)}
              </span>
            </div>
          )}

          {data.totalGames > 0 && (
            <div className="flex items-baseline gap-2" style={{
              padding: "7px 14px", borderRadius: 10,
              border: "1px solid var(--line)", background: "var(--carbon)",
            }}>
              <span style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(152,162,176,0.6)" }}>
                {t.recordPerGame}
              </span>
              <span className="mono-num" style={{ fontSize: "1rem", fontWeight: 600, color: "var(--amber)" }}>
                {formaterCompact(data.recordPompes, exerciceRecord)}
              </span>
              {EXERCICES[exerciceRecord].unite === "reps" && (
                <span style={{ fontSize: "0.72rem", color: "rgba(236,239,244,0.45)" }}>{nomsExo[exerciceRecord].toLowerCase()}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Session et saisie vivent dans le rail latéral : la synthèse reste une
          synthèse, et les deux actions restent accessibles en permanence. */}
      <RailActions>
        <button
          type="button"
          className="rail-action lol-panel"
          data-visite="rail-session"
          onClick={() => setModale("session")}
          style={{ borderColor: sessionActive ? "rgba(47,217,138,0.5)" : undefined }}
        >
          <div style={{ fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.13em", color: sessionActive ? "var(--victory)" : "rgba(152,162,176,0.6)" }}>
            {t.sessionModeTitle}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            {sessionActive && (
              <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: "var(--victory)", animation: "pulse 1.5s ease-in-out infinite" }} />
            )}
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: sessionActive ? "var(--victory)" : "var(--bone)" }}>
              {sessionActive ? t.sessionActive : t.startSession}
            </span>
          </div>
          {sessionActive && sessionGames.length > 0 && (
            <div className="mono-num" style={{ fontSize: "0.66rem", marginTop: 3, color: "rgba(236,239,244,0.4)" }}>
              {t.railSessionGames(sessionGames.length, fmt(totalSessionPompes))}
            </div>
          )}
        </button>

        <button
          type="button"
          className="rail-action lol-panel"
          data-visite="rail-ajout"
          onClick={() => setModale("ajout")}
        >
          <div style={{ fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.13em", color: "rgba(152,162,176,0.6)" }}>
            {t.railAjoutSurtitre}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: "1.05rem", lineHeight: 1, color: "var(--amber)", fontWeight: 700 }}>+</span>
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--bone)" }}>
              {t.railAjoutTitre}
            </span>
          </div>
        </button>
      </RailActions>

      {modale === "session" && (
      <Modale titre={t.sessionModeTitle} onFermer={() => setModale(null)}>
      <div className="space-y-3">
        <p className="text-xs" style={{ color: "rgba(236,239,244,0.5)" }}>
          {t.sessionModeDesc}
        </p>

        {!sessionActive ? (
          <div className="space-y-4">
            {/* Le jeu détermine la nature de la session : suivi de parties via
                l'API Riot, ou simple chronomètre. */}
            <div className="space-y-2">
              <label className="block text-xs" style={{ color: "rgba(152,162,176,0.7)" }}>
                {tJeux.sessionQuelJeu}
              </label>
              <JeuSelector
                jeu={jeuChoisi}
                typeJeu={typeJeuChoisi}
                onChange={(j, ty) => { setJeuChoisi(j); setTypeJeuChoisi(ty); }}
              />
            </div>

            {/* Le niveau ne se ressaisit plus à chaque session : il découle du
                test de force, qu'on peut refaire ici sans quitter la modale. */}
            <TestPompes
              pompesMax={pompesMax}
              faitLe={pompesMaxLe}
              niveaux={niveaux}
              onEnregistre={handleSavePompesMax}
            />

            <div className="space-y-2">
              <label className="block text-xs" style={{ color: "rgba(152,162,176,0.7)" }}>
                {tExo.choisirTitre}
              </label>
              <ExerciceSelector selection={exercicesSel} onChange={setExercicesSel} compact />
              {exercicesSel.length > 1 && (
                <p className="text-xs" style={{ color: "var(--amber)" }}>{tExo.partageActif(exercicesSel.length)}</p>
              )}
            </div>

            <button
              className="lol-btn w-full"
              onClick={handleDemarrerSession}
              disabled={jeuChoisi.trim().length === 0}
            >
              {t.start}
            </button>
          </div>
        ) : typeSession === "temps" ? (
          <SessionChrono
            jeu={jeuSession}
            niveau={t.levelLabel(sessionNiveau)}
            chronoSec={chronoSec}
            dette={fmt(dettePoints)}
            erreur={chronoErreur}
            enregistrement={arretEnCours}
            onArreter={handleArreterChrono}
            onAnnuler={stopSession}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded" style={{ background: "rgba(47,217,138,0.1)", border: "1px solid rgba(47,217,138,0.3)" }}>
              <div className="w-2 h-2 rounded-full" style={{ background: "#2FD98A", boxShadow: "0 0 6px #2FD98A", animation: "pulse 1.5s infinite" }} />
              <span className="text-sm win-text font-semibold">{t.sessionActive}</span>
              <span className="text-xs gold-text">{t.levelLabel(sessionNiveau)}</span>
              <span className="ml-auto text-xs" style={{ color: "rgba(236,239,244,0.4)" }}>
                {polling ? t.checking : t.nextCheck(countdown)}
              </span>
            </div>

            {sessionGames.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <div className="lol-panel p-3 text-center" style={{ background: "rgba(152,162,176,0.06)" }}>
                  <div className="text-2xl font-bold gold-text">{sessionGames.length}</div>
                  <div className="text-xs" style={{ color: "rgba(236,239,244,0.5)" }}>games</div>
                </div>
                <div className="lol-panel p-3 text-center" style={{ background: "rgba(152,162,176,0.06)" }}>
                  <div className="text-2xl font-bold gold-text">{totalSessionPompes}</div>
                  <div className="text-xs" style={{ color: "rgba(236,239,244,0.5)" }}>pompes</div>
                </div>
                <div className="lol-panel p-3 text-center" style={{ background: "rgba(152,162,176,0.06)" }}>
                  <div className="text-2xl font-bold win-text">
                    {sessionGames.filter((g) => g.result === "V").length}V
                  </div>
                  <div className="text-xs loss-text">
                    {sessionGames.filter((g) => g.result === "D").length}D
                  </div>
                </div>
              </div>
            )}

            {sessionGames.length > 0 && (
              <div className="lol-panel p-3" style={{ background: "rgba(152,162,176,0.04)" }}>
                <h3 className="text-xs uppercase tracking-widest mb-2" style={{ color: "rgba(152,162,176,0.6)" }}>
                  {t.pompesPerGameSession}
                </h3>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={sessionChartData}>
                    <XAxis dataKey="label" tick={AXE_TICK_DENSE} />
                    <YAxis tickFormatter={fmtAxe} tick={AXE_TICK_DENSE} />
                    <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={INFOBULLE} />
                    <Bar dataKey="pompes" fill={TEINTES.periode} radius={RAYON_BARRE} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {sessionGames.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs gold-text font-semibold">{t.detail(fmt(totalSessionPompes))}</p>
                {sessionGames.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded text-sm"
                    style={{ background: "rgba(152,162,176,0.06)", border: "1px solid rgba(152,162,176,0.1)" }}>
                    <span className={g.result === "V" ? "win-text font-bold" : "loss-text font-bold"}>
                      {g.result === "V" ? "V" : "D"}
                    </span>
                    <ChampionIcon name={g.champion} size={30} />
                    <span className="gold-text font-medium">{g.champion}</span>
                    <span className="text-xs" style={{ color: "rgba(236,239,244,0.5)" }}>{g.role}</span>
                    <span className="text-xs" style={{ color: "rgba(236,239,244,0.6)" }}>{g.kills}/{g.deaths}/{g.assists}</span>
                    <span className="ml-auto gold-text font-bold">{g.pompes}</span>
                  </div>
                ))}
              </div>
            )}

            {sessionGames.length === 0 && !polling && (
              <p className="text-xs text-center" style={{ color: "rgba(236,239,244,0.4)" }}>
                {t.waitingNextGame}
              </p>
            )}

            {sessionError && <p className="text-sm loss-text">{translateApiError(sessionError, locale)}</p>}

            <button
              className="lol-btn lol-btn-danger w-full"
              onClick={stopSession}
            >
              {t.stopSession}
            </button>
          </div>
        )}
      </div>
      </Modale>
      )}

      {modale === "ajout" && (
        <Modale titre={t.railAjoutTitre} onFermer={() => setModale(null)} largeur="40rem">
          <AjoutActivite onAjout={() => loadDash()} enModale />
        </Modale>
      )}

      {/* Comparaison entre jeux — uniquement en vue d'ensemble. Sur un jeu
          filtré, c'est sa synthèse propre qui prend le relais plus bas. */}
      {filtreJeu === null && jeuxJoues.length > 1 && (
        <div className="lol-panel p-4 space-y-3">
          <div>
            <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">{t.comparatifTitre}</h2>
            <p className="text-xs mt-1" style={{ color: "rgba(236,239,244,0.4)" }}>{t.comparatifAide}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: "0 4px", minWidth: 620 }}>
              <thead>
                <tr style={{ color: "rgba(152,162,176,0.6)" }} className="text-xs uppercase tracking-wider">
                  <th className="text-left px-3 py-1">{t.colJeu}</th>
                  <th className="text-right px-3 py-1">{t.colActivites}</th>
                  <th className="text-right px-3 py-1">{t.colWinrate}</th>
                  <th className="text-right px-3 py-1">{t.colDette}</th>
                  <th className="text-right px-3 py-1">{t.colDetteMoy}</th>
                  <th className="text-right px-3 py-1">{t.colTemps}</th>
                </tr>
              </thead>
              <tbody>
                {jeuxJoues.map((j) => (
                  <tr key={j.nom} style={{ background: "var(--bg-raised)" }}>
                    <td className="px-3 py-2" style={{ whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => setFiltreJeu(j.nom)}
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--signal)" }}
                      >
                        {j.nom}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right mono-num" style={{ color: "rgba(236,239,244,0.8)" }}>{j.games}</td>
                    {/* Un jeu au temps n'a pas de winrate, un jeu à parties n'a
                        pas de durée : la case reste vide plutôt que de mentir. */}
                    <td className="px-3 py-2 text-right mono-num" style={{ color: j.winrate === null ? "rgba(152,162,176,0.35)" : "rgba(236,239,244,0.8)" }}>
                      {j.winrate === null ? t.sansObjet : `${j.winrate}%`}
                    </td>
                    <td className="px-3 py-2 text-right mono-num gold-text font-semibold">{fmt(j.points)}</td>
                    <td className="px-3 py-2 text-right mono-num" style={{ color: "rgba(236,239,244,0.6)" }}>{fmt(j.detteMoyenne)}</td>
                    <td className="px-3 py-2 text-right mono-num" style={{ color: j.tempsJoueSec > 0 ? "rgba(236,239,244,0.8)" : "rgba(152,162,176,0.35)" }}>
                      {j.tempsJoueSec > 0 ? formaterTempsJeu(j.tempsJoueSec) : t.sansObjet}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Statistiques globales */}
      <h2 style={{ fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)", fontSize: "0.72rem", color: "rgba(152,162,176,0.55)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
        {t.globalStats}
      </h2>
      <div className={`grid gap-4 ${afficherParJeu ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
        {afficherParJeu && (
          <div className="lol-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">
                {t.detteParJeu(roleView)}
              </h2>
              <div className="flex gap-1">
                {(["total", "avg"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setRoleView(key)}
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      background: roleView === key ? "rgba(152,162,176,0.25)" : "rgba(152,162,176,0.06)",
                      color: roleView === key ? "#ECEFF4" : "rgba(236,239,244,0.4)",
                      border: `1px solid ${roleView === key ? "rgba(152,162,176,0.5)" : "rgba(152,162,176,0.12)"}`,
                    }}
                  >
                    {key === "total" ? t.total : t.average}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={jeuData}>
                <XAxis dataKey="jeu" tick={AXE_TICK_FORT_DENSE} interval={0} />
                <YAxis tickFormatter={fmtAxe} tick={AXE_TICK} />
                <Tooltip
                  contentStyle={INFOBULLE}
                  formatter={(v) => [fmt(Number(v)), roleView === "avg" ? t.tooltipAvgPerActivite : t.tooltipTotal]}
                />
                <Bar dataKey="pompes" fill={TEINTES.jeux} radius={RAYON_BARRE} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {(data.cumulByDate ?? []).length > 0 && (() => {
          const dateCount: Record<string, number> = {};
          const cumulData = (data.cumulByDate ?? []).map((d) => {
            const shortDate = new Date(d.date.slice(0, 10) + "T12:00:00").toLocaleDateString(dateLocale, { day: "numeric", month: "short" });
            dateCount[shortDate] = (dateCount[shortDate] || 0) + 1;
            const label = dateCount[shortDate] === 1 ? shortDate : `${shortDate} (${dateCount[shortDate]})`;
            return { ...d, label };
          });
          return (
            <div className="lol-panel p-4">
              <h2 className="gold-text text-sm font-semibold uppercase tracking-widest mb-3">{t.cumulativeProgress}</h2>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={cumulData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={GRILLE_TRAIT} />
                  <XAxis dataKey="label" tick={AXE_TICK_DENSE} />
                  <YAxis tickFormatter={fmtAxe} tick={AXE_TICK} />
                  <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={INFOBULLE} />
                  <Line dataKey="cumul" stroke={TEINTES.dette} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })()}

        {/* Coût moyen par activité, semaine après semaine. C'est le seul
            graphique qui peut descendre : le cumul ne fait que monter et le
            total par jour suit surtout le temps qu'on a joué. */}
        {(data.moyenneParSemaine ?? []).length > 1 && (
          <div className="lol-panel p-4" data-visite="graphique">
            <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">
              {t.progressionTitre}
            </h2>
            <p className="text-xs mt-1 mb-3" style={{ color: "rgba(236,239,244,0.4)" }}>
              {t.progressionAide}
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                data={(data.moyenneParSemaine ?? []).map((s) => ({
                  ...s,
                  label: new Date(s.semaine + "T12:00:00").toLocaleDateString(dateLocale, {
                    day: "numeric", month: "short",
                  }),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRILLE_TRAIT} />
                <XAxis dataKey="label" tick={AXE_TICK_DENSE} />
                <YAxis tickFormatter={fmtAxe} tick={AXE_TICK} />
                <Tooltip
                  contentStyle={INFOBULLE}
                  formatter={(v, _n, p) => [
                    `${fmt(Number(v))} · ${t.surNParties(Number(p?.payload?.parties ?? 0))}`,
                    t.progressionSerie,
                  ]}
                />
                <Line dataKey="moyenne" stroke={TEINTES.moyenne} strokeWidth={2} dot={{ r: 3, fill: TEINTES.moyenne }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Analytiques par période */}
      {data.statsByPeriod && data.totalGames > 0 && (
        <div className="lol-panel p-4">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">
              {statsPeriod === "daily" ? t.dailyDetail : statsMode === "avg" ? t.avgPompesPerGame : t.totalPompesLabel}
            </h2>
            <div className="flex gap-1 flex-wrap">
              {statsPeriod !== "daily" && (
                <>
                  {(["avg", "total"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setStatsMode(m)}
                      className="text-xs px-2 py-1 rounded"
                      style={{
                        background: statsMode === m ? "rgba(110,155,255,0.2)" : "rgba(152,162,176,0.06)",
                        color: statsMode === m ? "#6E9BFF" : "rgba(236,239,244,0.35)",
                        border: `1px solid ${statsMode === m ? "rgba(110,155,255,0.4)" : "rgba(152,162,176,0.12)"}`,
                      }}
                    >
                      {m === "avg" ? t.average : t.total}
                    </button>
                  ))}
                  <span style={{ width: 1, background: "rgba(152,162,176,0.15)", margin: "0 2px" }} />
                </>
              )}
              {(["hour", "weekday", "month", "daily"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setStatsPeriod(key)}
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    background: statsPeriod === key ? "rgba(152,162,176,0.25)" : "rgba(152,162,176,0.06)",
                    color: statsPeriod === key ? "#ECEFF4" : "rgba(236,239,244,0.4)",
                    border: `1px solid ${statsPeriod === key ? "rgba(152,162,176,0.5)" : "rgba(152,162,176,0.12)"}`,
                  }}
                >
                  {key === "hour" ? t.hour : key === "weekday" ? t.weekday : key === "month" ? t.month : t.calendar}
                </button>
              ))}
            </div>
          </div>

          {statsPeriod === "daily" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  className="lol-input"
                  style={{ fontSize: "0.85rem", width: "auto" }}
                  value={calendarDate}
                  onChange={(e) => setCalendarDate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                />
                {dailySummary && !dailyLoading && (
                  <span className="text-sm" style={{ color: "rgba(236,239,244,0.5)" }}>
                    <span className="gold-text font-bold">{fmt(dailySummary.total)}</span> ·{" "}
                    <span style={{ color: "rgba(236,239,244,0.35)" }}>{t.gamesCount(dailySummary.games)}</span>
                  </span>
                )}
              </div>
              {dailyLoading ? (
                <div className="text-center py-8 gold-text text-sm">{t.loading}</div>
              ) : dailyHourly && dailyHourly.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyHourly}>
                    <XAxis dataKey="label" tick={AXE_TICK_DENSE} />
                    <YAxis tickFormatter={fmtAxe} tick={AXE_TICK} />
                    <Tooltip
                      contentStyle={INFOBULLE}
                      formatter={(v) => [fmt(Number(v)), t.tooltipTotal]}
                    />
                    <Bar dataKey="total" fill={TEINTES.periode} radius={RAYON_BARRE} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8" style={{ color: "rgba(236,239,244,0.3)", fontSize: "0.85rem" }}>
                  {t.noGameThisDay}
                </div>
              )}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.statsByPeriod[statsPeriod]}>
                <XAxis dataKey="label" tick={AXE_TICK_DENSE} />
                <YAxis tickFormatter={fmtAxe} tick={AXE_TICK} />
                <Tooltip
                  contentStyle={INFOBULLE}
                  formatter={(v) => [fmt(Number(v)), statsMode === "avg" ? t.tooltipAvgPerGameFull : t.tooltipTotal]}
                />
                <Bar dataKey={statsMode} fill={TEINTES.dette} radius={RAYON_BARRE} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {data.totalGames === 0 && (
        <div className="lol-panel p-8 text-center space-y-2">
          <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}>
            <span aria-hidden style={{ width: 10, height: 34, background: "var(--ember)", transform: "skewX(-18deg)", borderRadius: 2, display: "inline-block" }} />
          </div>
          <p className="gold-text font-semibold">{t.noGameLogged}</p>
          <p className="text-sm" style={{ color: "rgba(236,239,244,0.5)" }}>
            {t.goToHistoryStart} <strong>{t.historyLabel}</strong> {t.goToHistoryEnd}
          </p>
        </div>
      )}

      {/* Rôles et champions ne veulent dire quelque chose que rapportés à un
          seul jeu : on les regroupe sous son nom plutôt que de les laisser
          passer pour des statistiques générales. */}
      {jeuUnique !== null && (repartitionData.length > 0 || data.mostPlayed || data.leastEfficient) && (
        <div className="space-y-3">
          <div>
            <h2 style={{ fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)", fontSize: "0.72rem", color: "rgba(152,162,176,0.55)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
              {t.syntheseDe(jeuUnique)}
            </h2>
            <p className="text-xs mt-1" style={{ color: "rgba(236,239,244,0.35)" }}>
              {estBattleRoyale ? t.sectionBrDesc : t.sectionLeagueDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
        {repartitionData.length > 0 && (
          <div className="lol-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">
                {estBattleRoyale
                  ? (multi ? t.pompesByMode(roleView) : t.parModeDe(nomsExo[exercice], roleView))
                  : (multi ? t.pompesByRole(roleView) : t.parRoleDe(nomsExo[exercice], roleView))}
              </h2>
              <div className="flex gap-1">
                {(["total", "avg"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setRoleView(key)}
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      background: roleView === key ? "rgba(152,162,176,0.25)" : "rgba(152,162,176,0.06)",
                      color: roleView === key ? "#ECEFF4" : "rgba(236,239,244,0.4)",
                      border: `1px solid ${roleView === key ? "rgba(152,162,176,0.5)" : "rgba(152,162,176,0.12)"}`,
                    }}
                  >
                    {key === "total" ? t.total : t.average}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={repartitionData}>
                <XAxis dataKey="label" tick={AXE_TICK_FORT} />
                <YAxis tickFormatter={fmtAxe} tick={AXE_TICK} />
                <Tooltip
                  contentStyle={INFOBULLE}
                  formatter={(v) => [fmt(Number(v)), roleView === "avg" ? t.tooltipAvgPerGame : t.tooltipTotal]}
                />
                <Bar dataKey="pompes" fill={TEINTES.dette} radius={RAYON_BARRE} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
          </div>

      {/* Champion spotlights */}
      {(data.mostPlayed || data.leastEfficient) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.mostPlayed && (
            <ChampionCard champ={data.mostPlayed} badge={t.mostPlayedBadge} badgeColor="#FFB454" t={t} />
          )}
          {data.leastEfficient && (
            <ChampionCard champ={data.leastEfficient} badge={t.leastEfficientBadge} badgeColor="#FF5A47" t={t} />
          )}
        </div>
      )}
        </div>
      )}

    </div>
  );
}