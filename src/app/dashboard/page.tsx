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
import { translateApiError } from "@/lib/i18n/apiErrors";

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
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="stat-card p-4 flex flex-col gap-1 fade-in">
      <span style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(152,162,176,0.55)" }}>{label}</span>
      <span style={{ fontSize: "1.8rem", fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)", color: "#ECEFF4", lineHeight: 1.1 }}>{value}</span>
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
  const [gainageInput, setGainageInput] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("lastGainageSec") ?? "60";
    return "60";
  });

  const { sessionActive, sessionGames, sessionError, polling, countdown, sessionLevel, gainageSec, startSession, stopSession } = useSession();
  const { locale } = useLocale();

  const loadDash = () =>
    fetch("/api/dashboard").then(async (res) => {
      if (!res.ok) {
        // Session invalide (ex. cookie d'une ancienne base) → retour au login.
        if (res.status === 401 && typeof window !== "undefined") {
          window.location.href = "/login";
        }
        return;
      }
      setData(await res.json());
    });

  useEffect(() => { loadDash(); }, []);

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
    await startSession(sec);
  };

  if (!data) return <div className="text-center py-20 gold-text">{t.loading}</div>;

  const progress = data.objectifTotalPompes > 0
    ? Math.min(100, Math.round((data.totalPompes / data.objectifTotalPompes) * 100))
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

      {/* Stats globales */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t.gamesPlayed} value={data.totalGames} />
        <StatCard label={t.winrate} value={`${data.winrate}%`} sub={`${data.wins}V / ${data.totalGames - data.wins}D`} />
        <StatCard label={t.totalPompes} value={data.totalPompes} />
        <StatCard label={t.recordPerGame} value={data.recordPompes} sub={t.pompesUnit} />
      </div>

      {data.objectifTotalPompes > 0 && (
        <div className="lol-panel p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="gold-text font-semibold">{t.objective(data.objectifTotalPompes)}</span>
            <span className="blue-text">{progress}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(152,162,176,0.15)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: "linear-gradient(to right, #6E9BFF, #ECEFF4)" }}
            />
          </div>
          <div className="text-xs" style={{ color: "rgba(236,239,244,0.5)" }}>
            {t.objectiveProgress(data.totalPompes, data.objectifTotalPompes)}
            {data.objectifTotalPompes - data.totalPompes > 0
              ? t.objectiveRemaining(data.objectifTotalPompes - data.totalPompes)
              : t.objectiveReached}
          </div>
        </div>
      )}

      {/* Champion spotlights */}
      {(data.mostPlayed || data.leastEfficient) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.mostPlayed && (
            <ChampionCard champ={data.mostPlayed} badge={t.mostPlayedBadge} badgeColor="#ECEFF4" t={t} />
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
                    <YAxis tick={{ fill: "rgba(236,239,244,0.5)", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#1a2634", border: "1px solid #ECEFF440", color: "#ECEFF4" }} />
                    <Bar dataKey="pompes" fill="#6E9BFF" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {sessionGames.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs gold-text font-semibold">{t.detail(totalSessionPompes)}</p>
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
                {t.pompesByRole(roleView)}
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
                <YAxis tick={{ fill: "rgba(236,239,244,0.5)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1a2634", border: "1px solid #ECEFF440", color: "#ECEFF4" }}
                  formatter={(v) => [t.tooltipPompesLabel(v as number), roleView === "avg" ? t.tooltipAvgPerGame : t.tooltipTotal]}
                />
                <Bar dataKey="pompes" fill="#ECEFF4" radius={[2, 2, 0, 0]} />
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
                  <YAxis tick={{ fill: "rgba(236,239,244,0.5)", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#1a2634", border: "1px solid #ECEFF440", color: "#ECEFF4" }} />
                  <Line dataKey="cumul" stroke="#6E9BFF" strokeWidth={2} dot={false} />
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
                    <span className="gold-text font-bold">{dailySummary.total}</span> {t.pompesUnit} ·{" "}
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
                    <YAxis tick={{ fill: "rgba(236,239,244,0.5)", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ background: "#1a2634", border: "1px solid #ECEFF440", color: "#ECEFF4" }}
                      formatter={(v) => [t.tooltipPompesLabel(v as number), t.tooltipTotal]}
                    />
                    <Bar dataKey="total" fill="#6E9BFF" radius={[2, 2, 0, 0]} />
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
                <YAxis tick={{ fill: "rgba(236,239,244,0.5)", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#1a2634", border: "1px solid #ECEFF440", color: "#ECEFF4" }}
                  formatter={(v) => [t.tooltipPompesLabel(v as number), statsMode === "avg" ? t.tooltipAvgPerGameFull : t.tooltipTotal]}
                />
                <Bar dataKey={statsMode} fill="#ECEFF4" radius={[2, 2, 0, 0]} />
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
