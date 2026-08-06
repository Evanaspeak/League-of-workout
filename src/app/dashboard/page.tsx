"use client";
import { useEffect, useState } from "react";
import { DesktopAuthHandler } from "@/components/DesktopAuthHandler";
import { ChampionIcon } from "@/components/ChampionIcon";
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

type PeriodStat = { label: string; avg: number; total: number };

type ChampSummary = {
  name: string;
  games: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  kda: number | null;
  avgPompes: number;
};

type DashData = {
  totalGames: number;
  wins: number;
  winrate: number;
  totalPompes: number;
  recordPompes: number;
  pompesByRole: Record<string, number>;
  gamesByRole: Record<string, number>;
  cumulByDate: { date: string; cumul: number }[];
  statsByPeriod: { hour: PeriodStat[]; weekday: PeriodStat[]; month: PeriodStat[] };
  dailyPompes: { date: string; total: number }[];
  mostPlayed: ChampSummary | null;
  leastEfficient: ChampSummary | null;
  objectifTotalPompes: number;
  exercices?: ExerciceId[];
  filtreExercice?: ExerciceId | null;
  global?: { totalGames: number; wins: number; winrate: number; totalPoints: number };
  pointsParExercice?: Record<string, number>;
  recordExercice?: ExerciceId | null;
};

function StatCard({ label, value, sub, lignes, i = 0 }: {
  label: string; value?: string | number; sub?: string;
  /** Ventilation par exercice : des répétitions et des minutes ne s'additionnent pas. */
  lignes?: { nom: string; valeur: string }[];
  i?: number;
}) {
  return (
    <div className="stat-card p-4 flex flex-col gap-1 rise" style={{ animationDelay: `${i * 80}ms` }}>
      <span style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(152,162,176,0.55)" }}>{label}</span>
      {lignes ? (
        <span style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
          {lignes.map((l) => (
            <span key={l.nom} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="mono-num" style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--amber)", lineHeight: 1.2 }}>{l.valeur}</span>
              <span style={{ fontSize: "0.7rem", color: "rgba(236,239,244,0.45)" }}>{l.nom.toLowerCase()}</span>
            </span>
          ))}
        </span>
      ) : (
        <span className="mono-num" style={{ fontSize: "1.7rem", fontWeight: 600, color: "var(--amber)", lineHeight: 1.15 }}>{value}</span>
      )}
      {sub && <span style={{ fontSize: "0.75rem", color: "rgba(236,239,244,0.45)" }}>{sub}</span>}
    </div>
  );
}

function ChampionCard({ champ, badge, badgeColor, t }: { champ: ChampSummary; badge: string; badgeColor: string; t: ReturnType<typeof useT<typeof dashboard>> }) {
  const kdaLabel = champ.kda === null ? "Perfect" : champ.kda.toFixed(2);
  return (
    <div className="lol-panel p-4 fade-in" style={{ position: "relative" }}>
      <span style={{
        position: "absolute", top: 10, right: 12,
        fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em",
        color: badgeColor, textTransform: "uppercase",
        border: `1px solid ${badgeColor}55`, borderRadius: 4,
        padding: "2px 7px", background: `${badgeColor}14`,
      }}>{badge}</span>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <ChampionIcon name={champ.name} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
            fontSize: "1.05rem", color: "#ECEFF4", lineHeight: 1.1,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{champ.name}</div>
          <div style={{ fontSize: "0.7rem", color: "rgba(236,239,244,0.45)", marginTop: 2 }}>
            {t.gamesCount(champ.games)}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(152,162,176,0.5)", marginBottom: 3 }}>{t.kda}</div>
          <div style={{ fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)", fontSize: "0.95rem", color: "#ECEFF4" }}>{kdaLabel}</div>
          <div style={{ fontSize: "0.65rem", color: "rgba(236,239,244,0.4)" }}>
            {champ.avgKills}/{champ.avgDeaths}/{champ.avgAssists}
          </div>
        </div>
        <div style={{ textAlign: "center", borderLeft: "1px solid rgba(152,162,176,0.12)", borderRight: "1px solid rgba(152,162,176,0.12)" }}>
          <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(152,162,176,0.5)", marginBottom: 3 }}>{t.avgPompes}</div>
          <div style={{ fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)", fontSize: "0.95rem", color: badgeColor }}>{champ.avgPompes}</div>
          <div style={{ fontSize: "0.65rem", color: "rgba(236,239,244,0.4)" }}>{t.perGame}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(152,162,176,0.5)", marginBottom: 3 }}>{t.games}</div>
          <div style={{ fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)", fontSize: "0.95rem", color: "rgba(236,239,244,0.8)" }}>{champ.games}</div>
          <div style={{ fontSize: "0.65rem", color: "rgba(236,239,244,0.4)" }}>{t.played}</div>
        </div>
      </div>
    </div>
  );
}

function getLevelLabel(sec: number, t: ReturnType<typeof useT<typeof dashboard>>): string {
  if (sec <= 45) return t.levelLabel(1);
  if (sec <= 90) return t.levelLabel(2);
  if (sec <= 150) return t.levelLabel(3);
  if (sec <= 240) return t.levelLabel(4);
  return t.levelLabel(5);
}

export default function Dashboard() {
  const t = useT(dashboard);
  const tExo = useT(exercicesDict);
  const dateLocale = useDateLocale();
  const [data, setData] = useState<DashData | null>(null);
  const [showGainageModal, setShowGainageModal] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<"hour" | "weekday" | "month" | "daily">("weekday");
  const [statsMode, setStatsMode] = useState<"avg" | "total">("avg");
  const [calendarDate, setCalendarDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [dailyHourly, setDailyHourly] = useState<{ label: string; total: number }[] | null>(null);
  const [dailySummary, setDailySummary] = useState<{ total: number; games: number } | null>(null);
  const [dailyLoading, setDailyLoading] = useState(false);
  const [roleView, setRoleView] = useState<"total" | "avg">("total");
  const [exercicesSel, setExercicesSel] = useState<ExerciceId[]>([EXERCICE_DEFAUT]);
  const [filtreExo, setFiltreExo] = useState<ExerciceId | null>(null);
  const [gainageInput, setGainageInput] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("lastGainageSec") ?? "60";
    return "60";
  });

  const { sessionActive, sessionGames, sessionError, polling, countdown, sessionLevel, gainageSec, startSession, stopSession } = useSession();
  const { locale } = useLocale();

  const loadDash = (filtre: ExerciceId | null = filtreExo) =>
    fetch(filtre ? `/api/dashboard?exercice=${filtre}` : "/api/dashboard").then(async (res) => {
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

  // Charge au montage puis à chaque changement d'exercice consulté.
  useEffect(() => { loadDash(filtreExo); }, [filtreExo]);

  // Rafraîchit les stats globales à chaque nouvelle game loggée en session.
  useEffect(() => {
    if (sessionGames.length > 0) loadDash();
  }, [sessionGames.length]);

  useEffect(() => {
    if (statsPeriod !== "daily") return;
    setDailyLoading(true);
    fetch(`/api/dashboard/daily?date=${calendarDate}`)
      .then((r) => r.json())
      .then((d) => {
        setDailyHourly(d.hourly ?? []);
        setDailySummary({ total: d.total ?? 0, games: d.games ?? 0 });
        setDailyLoading(false);
      })
      .catch(() => setDailyLoading(false));
  }, [statsPeriod, calendarDate]);

  const handleConfirmGainage = async () => {
    const sec = Math.max(1, Number(gainageInput) || 60);
    localStorage.setItem("lastGainageSec", String(sec));
    setShowGainageModal(false);
    // Le choix fait ici devient la préférence, pour l'ARAM du chaos comme pour
    // les prochaines sessions.
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userPrefs: { exercices: exercicesSel } }),
    }).catch(() => {});
    await startSession(sec);
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
        <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: 1 }}>⏳</span>
        <div>
          <p style={{ fontSize: "0.82rem", color: "#6E9BFF", fontWeight: 600, marginBottom: 4 }}>
            {t.syncBannerTitle}
          </p>
          <p style={{ fontSize: "0.78rem", color: "rgba(236,239,244,0.55)", lineHeight: 1.6 }}>
            {t.syncBannerBodyStart}{" "}
            <a href="/history" style={{ color: "#6E9BFF", textDecoration: "underline" }}>
              {t.syncBannerLink}
            </a>
            {" "}{t.syncBannerBodyEnd}
          </p>
        </div>
      </div>

      {/* Vue d'ensemble — jamais filtrée : elle décrit toute l'activité */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard label={t.gamesPlayed} value={globalStats.totalGames} i={0} />
        <StatCard
          label={t.winrate}
          value={`${globalStats.winrate}%`}
          sub={`${globalStats.wins}V / ${globalStats.totalGames - globalStats.wins}D`}
          i={1}
        />
        <StatCard
          label={t.totalPompes}
          value={lignesTotal.length <= 1 ? fmt(globalStats.totalPoints) : undefined}
          lignes={lignesTotal.length > 1 ? lignesTotal : undefined}
          i={2}
        />
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

      {/* Mode Session */}
      <div className="lol-panel p-4 space-y-3">
        <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">{t.sessionModeTitle}</h2>
        <p className="text-xs" style={{ color: "rgba(236,239,244,0.5)" }}>
          {t.sessionModeDesc}
        </p>

        {!sessionActive ? (
          <button className="lol-btn w-full" onClick={() => setShowGainageModal(true)}>
            {t.startSession}
          </button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded" style={{ background: "rgba(47,217,138,0.1)", border: "1px solid rgba(47,217,138,0.3)" }}>
              <div className="w-2 h-2 rounded-full" style={{ background: "#2FD98A", boxShadow: "0 0 6px #2FD98A", animation: "pulse 1.5s infinite" }} />
              <span className="text-sm win-text font-semibold">{t.sessionActive}</span>
              <span className="text-xs gold-text">{sessionLevel} · {t.gainageLabel(gainageSec)}</span>
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
                    <XAxis dataKey="label" tick={{ fill: "rgba(236,239,244,0.5)", fontSize: 10 }} />
                    <YAxis tickFormatter={fmtAxe} tick={{ fill: "rgba(236,239,244,0.5)", fontSize: 10 }} />
                    <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: "#191D23", border: "1px solid rgba(236,239,244,0.15)", color: "#ECEFF4" }} />
                    <Bar dataKey="pompes" fill="#9D7CFF" radius={[2, 2, 0, 0]} />
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
                    <span className="ml-auto gold-text font-bold">{g.pompes} 💪</span>
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

      {/* Statistiques globales */}
      <h2 style={{ fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)", fontSize: "0.72rem", color: "rgba(152,162,176,0.55)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
        {t.globalStats}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roleData.length > 0 && (
          <div className="lol-panel p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">
                {multi ? t.pompesByRole(roleView) : t.parRoleDe(nomsExo[exercice], roleView)}
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
              <BarChart data={roleData}>
                <XAxis dataKey="role" tick={{ fill: "#ECEFF4", fontSize: 11 }} />
                <YAxis tickFormatter={fmtAxe} tick={{ fill: "rgba(236,239,244,0.5)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#191D23", border: "1px solid rgba(236,239,244,0.15)", color: "#ECEFF4" }}
                  formatter={(v) => [fmt(Number(v)), roleView === "avg" ? t.tooltipAvgPerGame : t.tooltipTotal]}
                />
                <Bar dataKey="pompes" fill="#FFB454" radius={[2, 2, 0, 0]} />
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
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(152,162,176,0.1)" />
                  <XAxis dataKey="label" tick={{ fill: "rgba(236,239,244,0.4)", fontSize: 10 }} />
                  <YAxis tickFormatter={fmtAxe} tick={{ fill: "rgba(236,239,244,0.5)", fontSize: 11 }} />
                  <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={{ background: "#191D23", border: "1px solid rgba(236,239,244,0.15)", color: "#ECEFF4" }} />
                  <Line dataKey="cumul" stroke="#FFB454" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
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
                    <XAxis dataKey="label" tick={{ fill: "rgba(236,239,244,0.5)", fontSize: 10 }} />
                    <YAxis tickFormatter={fmtAxe} tick={{ fill: "rgba(236,239,244,0.5)", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#191D23", border: "1px solid rgba(236,239,244,0.15)", color: "#ECEFF4" }}
                      formatter={(v) => [fmt(Number(v)), t.tooltipTotal]}
                    />
                    <Bar dataKey="total" fill="#9D7CFF" radius={[2, 2, 0, 0]} />
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
                <XAxis dataKey="label" tick={{ fill: "rgba(236,239,244,0.5)", fontSize: 10 }} />
                <YAxis tickFormatter={fmtAxe} tick={{ fill: "rgba(236,239,244,0.5)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#191D23", border: "1px solid rgba(236,239,244,0.15)", color: "#ECEFF4" }}
                  formatter={(v) => [fmt(Number(v)), statsMode === "avg" ? t.tooltipAvgPerGameFull : t.tooltipTotal]}
                />
                <Bar dataKey={statsMode} fill="#FFB454" radius={[2, 2, 0, 0]} />
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

      {/* Modal test de gainage */}
      {showGainageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowGainageModal(false); }}
        >
          <div className="lol-panel p-6 w-full max-w-sm mx-4 space-y-5">
            <h2 className="gold-text font-bold text-lg uppercase tracking-widest">{t.gainageModalTitle}</h2>
            <p className="text-sm" style={{ color: "rgba(236,239,244,0.7)" }}>
              {t.gainageModalDesc}
            </p>
            <div>
              <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>
                {t.durationSeconds}
              </label>
              <input
                type="number" min="1"
                className="lol-input text-center text-2xl font-bold"
                value={gainageInput}
                onChange={(e) => setGainageInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConfirmGainage()}
                autoFocus
              />
            </div>
            {gainageInput && Number(gainageInput) > 0 && (
              <div className="text-center p-3 rounded" style={{ background: "rgba(152,162,176,0.1)", border: "1px solid rgba(152,162,176,0.3)" }}>
                <span className="gold-text font-bold text-xl">{getLevelLabel(Number(gainageInput), t)}</span>
                <span className="text-sm ml-2" style={{ color: "rgba(236,239,244,0.5)" }}>{t.forThisSession}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs" style={{ color: "rgba(152,162,176,0.7)" }}>
                {tExo.choisirTitre}
              </label>
              <ExerciceSelector selection={exercicesSel} onChange={setExercicesSel} compact />
              {exercicesSel.length > 1 && (
                <p className="text-xs" style={{ color: "var(--amber)" }}>{tExo.rotationActive(exercicesSel.length)}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 py-2 rounded text-sm"
                style={{ background: "rgba(152,162,176,0.1)", color: "rgba(236,239,244,0.6)", border: "1px solid rgba(152,162,176,0.2)" }}
                onClick={() => setShowGainageModal(false)}
              >
                {t.cancel}
              </button>
              <button
                className="lol-btn flex-1"
                onClick={handleConfirmGainage}
                disabled={!gainageInput || Number(gainageInput) < 1}
              >
                {t.start}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
