"use client";
import { useEffect, useState } from "react";
import { ChampionIcon } from "@/components/ChampionIcon";
import { ChampionInput } from "@/components/ChampionInput";
import { findChampion } from "@/lib/champions";
import { useT, useDateLocale, useLocale } from "@/lib/i18n/LocaleContext";
import { history } from "@/lib/i18n/dictionaries/history";
import { translateApiError } from "@/lib/i18n/apiErrors";

// ─── Types ───────────────────────────────────────────────────────────────────

type Game = {
  id: string;
  date: string;
  role: string;
  champion: string | null;
  kills: number;
  deaths: number;
  assists: number;
  result: string;
  niveauCalcule: number;
  scoreCalcule: number;
  malusCalcule: number;
  surchargeCalculee: number;
  pompesCalculees: number;
  source: string;
};

type MatchEntry = {
  matchId: string;
  champion: string;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  result: string;
  date: string;
  alreadyLogged: boolean;
  pompesCalculees: number | null;
  indisponible?: boolean;
};

type Scoring = {
  niveau: number;
  multiplicateur: number;
  scoreBase: number;
  malus: number;
  surcharge: number;
  pompesFinales: number;
};

type PreviewResult = { scoring: Scoring; partiesAvant: number; gainageSec: number };

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLES_FILTER = ["Tous", "Top", "Jungle", "Mid", "ADC", "Support", "ARAM", "Arena"];
const ROLES_FORM = ["Top", "Jungle", "Mid", "ADC", "Support", "ARAM", "Arena"];

function getLevelLabel(sec: number, locale: "fr" | "en"): string {
  const prefix = locale === "fr" ? "Niv." : "Lvl.";
  if (sec <= 45) return `${prefix} 1`;
  if (sec <= 90) return `${prefix} 2`;
  if (sec <= 150) return `${prefix} 3`;
  if (sec <= 240) return `${prefix} 4`;
  return `${prefix} 5`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const t = useT(history);
  const dateLocale = useDateLocale();
  const { locale } = useLocale();
  const [view, setView] = useState<"parties" | "pompes">("parties");

  // ── Pompes view ──
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [filterRole, setFilterRole] = useState("Tous");
  const [filterResult, setFilterResult] = useState("Tous");
  const [sortBy, setSortBy] = useState<"date" | "pompes">("date");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Parties view ──
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);

  // ── Add form ──
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    role: "Jungle", champion: "", kills: "", deaths: "", assists: "", result: "D", gainageSec: "60",
  });
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [addLogging, setAddLogging] = useState(false);
  const [addLogged, setAddLogged] = useState(false);
  const [addError, setAddError] = useState("");

  // ── Date editing ──
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editDateVal, setEditDateVal] = useState("");

  // ── Riot manual fetch ──
  const [riotLoading, setRiotLoading] = useState(false);
  const [riotError, setRiotError] = useState("");

  // ─── Load localStorage on mount ──────────────────────────────────────────
  useEffect(() => {
    const savedSec = localStorage.getItem("lastGainageSec");
    const savedRole = localStorage.getItem("lastRole");
    setAddForm((f) => ({
      ...f,
      ...(savedSec ? { gainageSec: savedSec } : {}),
      ...(savedRole ? { role: savedRole } : {}),
    }));
  }, []);

  // ─── Chargement initial (games + parties Riot) ───────────────────────────
  useEffect(() => {
    const loadGames = async () => {
      const data = await fetch("/api/games").then((r) => r.json());
      if (Array.isArray(data)) setGames(data);
      setLoadingGames(false);
    };
    const loadMatches = async () => {
      setLoadingMatches(true);
      try {
        const data = await fetch("/api/riot/match-history").then((r) => r.json());
        if (Array.isArray(data)) setMatches(data);
        else setMatchError(data.error ? translateApiError(data.error, locale) : t.unexpectedApiResponse);
      } catch {
        setMatchError(t.loadError);
      }
      setLoadingMatches(false);
    };
    loadGames();
    loadMatches();
  }, []);

  // ─── Quick-add from Riot history ─────────────────────────────────────────
  const handleQuickAdd = async (m: MatchEntry) => {
    setAddingId(m.matchId);
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: m.role, champion: m.champion,
        kills: m.kills, deaths: m.deaths, assists: m.assists,
        result: m.result, source: "riot_api", riotMatchId: m.matchId,
      }),
    });
    if (res.ok) {
      const { game, scoring } = await res.json();
      setMatches((prev) => prev.map((x) =>
        x.matchId === m.matchId
          ? { ...x, alreadyLogged: true, pompesCalculees: scoring.pompesFinales }
          : x
      ));
      // Sync immédiate de la vue Pompes (pas besoin de changer d'onglet).
      setGames((prev) => [{ ...game, pompesCalculees: scoring.pompesFinales }, ...prev]);
    }
    setAddingId(null);
  };

  // ─── Manual add form ─────────────────────────────────────────────────────
  const openAddForm = (role?: string) => {
    const savedRole = localStorage.getItem("lastRole") ?? "Jungle";
    setAddForm((f) => ({ ...f, role: role ?? savedRole }));
    setPreview(null);
    setAddLogged(false);
    setAddError("");
    setShowAddForm(true);
  };

  const handlePreview = async () => {
    if (!addForm.kills || !addForm.deaths || !addForm.assists) return;
    setPreviewLoading(true);
    const res = await fetch("/api/games/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...addForm,
        kills: Number(addForm.kills),
        deaths: Number(addForm.deaths),
        assists: Number(addForm.assists),
        gainageSec: Number(addForm.gainageSec) || 60,
      }),
    });
    setPreview(await res.json());
    setPreviewLoading(false);
  };

  const handleAddLog = async () => {
    setAddLogging(true);
    setAddError("");
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...addForm,
        kills: Number(addForm.kills),
        deaths: Number(addForm.deaths),
        assists: Number(addForm.assists),
        gainageSec: Number(addForm.gainageSec) || 60,
        source: "manuel",
      }),
    });
    if (res.ok) {
      const { game, scoring } = await res.json();
      setGames((prev) => [{ ...game, pompesCalculees: scoring.pompesFinales }, ...prev]);
      setAddLogged(true);
      setPreview(null);
      setAddForm((f) => ({ ...f, champion: "", kills: "", deaths: "", assists: "", result: "D" }));
    } else {
      const err = await res.json();
      setAddError(err.error ? translateApiError(err.error, locale) : t.logError);
    }
    setAddLogging(false);
  };

  // ─── Riot manual fetch ───────────────────────────────────────────────────
  const handleRiotFetch = async () => {
    setRiotLoading(true);
    setRiotError("");
    const res = await fetch("/api/riot/last-game");
    if (res.ok) {
      const data = await res.json();
      setAddForm((f) => ({
        ...f,
        role: data.role,
        champion: data.champion,
        kills: String(data.kills),
        deaths: String(data.deaths),
        assists: String(data.assists),
        result: data.result,
      }));
      setPreview(null);
      setShowAddForm(true);
    } else {
      const err = await res.json();
      setRiotError(err.error ? translateApiError(err.error, locale) : t.riotApiError);
    }
    setRiotLoading(false);
  };

  // ─── Edit game date ──────────────────────────────────────────────────────
  const handleEditDate = async (id: string) => {
    if (!editDateVal) return;
    await fetch(`/api/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: editDateVal }),
    });
    setGames((prev) => prev.map((g) => g.id === id ? { ...g, date: editDateVal } : g));
    setEditingDateId(null);
  };

  // ─── Delete pompe entry ──────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/games/${id}`, { method: "DELETE" });
    setGames((prev) => prev.filter((g) => g.id !== id));
    setDeletingId(null);
  };

  // ─── Filtered pompe games ─────────────────────────────────────────────────
  const filtered = games
    .filter((g) => filterRole === "Tous" || g.role === filterRole)
    .filter((g) => filterResult === "Tous" || g.result === filterResult)
    .sort((a, b) =>
      sortBy === "date"
        ? new Date(b.date).getTime() - new Date(a.date).getTime()
        : b.pompesCalculees - a.pompesCalculees
    );
  const totalPompes = filtered.reduce((s, g) => s + g.pompesCalculees, 0);

  const isChampionValid = !addForm.champion || !!findChampion(addForm.champion);
  const isAddReady = addForm.kills !== "" && addForm.deaths !== "" && addForm.assists !== "" && isChampionValid;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <h1 style={{ fontFamily: "var(--font-heading, 'Russo One', sans-serif)", fontSize: "1.5rem", color: "#C8AA6E", letterSpacing: "0.18em" }}>{t.pageTitle}</h1>

      {/* Tab toggle */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(200,170,110,0.14)" }}>
        {(["parties", "pompes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            style={{
              position: "relative",
              padding: "6px 22px 8px",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${view === tab ? "#C8AA6E" : "transparent"}`,
              marginBottom: -1,
              color: view === tab ? "#C8AA6E" : "rgba(240,230,211,0.4)",
              fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
              fontSize: "0.75rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {tab === "parties" ? t.tabParties : t.tabPompes}
          </button>
        ))}
      </div>

      {/* ═══ PARTIES VIEW ══════════════════════════════════════════════════ */}
      {view === "parties" && (
        <div className="space-y-4">

          {/* ARAM du chaos banner */}
          <div className="lol-panel p-4 flex items-start gap-3" style={{ borderColor: "rgba(200,170,110,0.25)" }}>
            <span className="text-lg" style={{ lineHeight: 1.2 }}>⚠️</span>
            <div className="flex-1 space-y-2">
              <p className="text-sm" style={{ color: "rgba(240,230,211,0.75)" }}>
                <span className="gold-text font-semibold">{t.aramTitle}</span>{" "}
                {t.aramDesc}
              </p>
              <button className="lol-btn text-xs px-4 py-1" onClick={() => openAddForm("ARAM")}>
                {t.aramAddBtn}
              </button>
            </div>
          </div>

          {/* Riot fetch + add form trigger */}
          <div className="flex gap-2">
            <button className="lol-btn lol-btn-blue flex-1 text-sm" onClick={handleRiotFetch} disabled={riotLoading}>
              {riotLoading ? t.fetchingLastGame : t.fetchLastGameBtn}
            </button>
            <button
              className="lol-btn text-sm px-4"
              onClick={() => openAddForm()}
              style={{ background: "rgba(200,170,110,0.15)" }}
            >
              {t.addBtn}
            </button>
          </div>
          {riotError && <p className="text-sm loss-text">{riotError}</p>}

          {/* Manual add form */}
          {showAddForm && (
            <div className="lol-panel p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">{t.addGameTitle}</h2>
                <button
                  onClick={() => { setShowAddForm(false); setPreview(null); setAddLogged(false); }}
                  style={{ color: "rgba(240,230,211,0.4)", background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }}
                >✕</button>
              </div>

              {addLogged && (
                <div className="text-center p-3 rounded" style={{ background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.3)" }}>
                  <span className="win-text font-semibold">{t.gameLogged}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>{t.role}</label>
                  <select className="lol-select w-full" value={addForm.role}
                    onChange={(e) => {
                      setAddForm((f) => ({ ...f, role: e.target.value }));
                      localStorage.setItem("lastRole", e.target.value);
                      setPreview(null);
                    }}>
                    {ROLES_FORM.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>{t.champion}</label>
                  <ChampionInput
                    value={addForm.champion}
                    onChange={(val) => setAddForm((f) => ({ ...f, champion: val }))}
                    onReset={() => setPreview(null)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(["kills", "deaths", "assists"] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>
                      {field === "kills" ? t.kills : field === "deaths" ? t.deaths : t.assists}
                    </label>
                    <input type="number" min="0" className="lol-input text-center" value={addForm[field]}
                      onChange={(e) => { setAddForm((f) => ({ ...f, [field]: e.target.value })); setPreview(null); }} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>{t.result}</label>
                  <div className="flex gap-2">
                    {(["V", "D"] as const).map((r) => (
                      <button key={r} className="flex-1 py-2 rounded text-sm font-bold"
                        style={{
                          background: addForm.result === r ? (r === "V" ? "rgba(76,175,80,0.25)" : "rgba(239,83,80,0.25)") : "rgba(200,170,110,0.08)",
                          border: `1px solid ${addForm.result === r ? (r === "V" ? "#4caf50" : "#ef5350") : "rgba(200,170,110,0.2)"}`,
                          color: addForm.result === r ? (r === "V" ? "#4caf50" : "#ef5350") : "rgba(240,230,211,0.6)",
                        }}
                        onClick={() => { setAddForm((f) => ({ ...f, result: r })); setPreview(null); }}>
                        {r === "V" ? t.victory : t.defeat}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>
                    {t.gainageTime}
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" className="lol-input text-center" value={addForm.gainageSec}
                      onChange={(e) => {
                        setAddForm((f) => ({ ...f, gainageSec: e.target.value }));
                        localStorage.setItem("lastGainageSec", e.target.value);
                        setPreview(null);
                      }} />
                    <span className="text-xs gold-text shrink-0">{getLevelLabel(Number(addForm.gainageSec) || 60, locale)}</span>
                  </div>
                </div>
              </div>

              <button className="lol-btn w-full" onClick={handlePreview} disabled={!isAddReady || previewLoading}>
                {previewLoading ? t.calculating : t.calculatePompes}
              </button>

              {preview && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between p-2 rounded" style={{ background: "rgba(200,170,110,0.08)" }}>
                      <span style={{ color: "rgba(240,230,211,0.6)" }}>{t.level}</span>
                      <span className="gold-text font-bold">{preview.scoring.niveau}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded" style={{ background: "rgba(200,170,110,0.08)" }}>
                      <span style={{ color: "rgba(240,230,211,0.6)" }}>{t.multiplier}</span>
                      <span className="gold-text font-bold">×{preview.scoring.multiplicateur}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded" style={{ background: "rgba(200,170,110,0.08)" }}>
                      <span style={{ color: "rgba(240,230,211,0.6)" }}>{t.baseScore}</span>
                      <span className="gold-text font-bold">{preview.scoring.scoreBase}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded" style={{ background: "rgba(200,170,110,0.08)" }}>
                      <span style={{ color: "rgba(240,230,211,0.6)" }}>{t.defeatMalus}</span>
                      <span className={preview.scoring.malus > 0 ? "loss-text font-bold" : "gold-text font-bold"}>+{preview.scoring.malus}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded col-span-2" style={{ background: "rgba(200,170,110,0.08)" }}>
                      <span style={{ color: "rgba(240,230,211,0.6)" }}>{t.mastery(preview.partiesAvant)}</span>
                      <span className="blue-text font-bold">+{Math.round(preview.scoring.surcharge * 100)}%</span>
                    </div>
                  </div>
                  <div className="text-center p-4 rounded" style={{ background: "rgba(200,170,110,0.1)", border: "1px solid rgba(200,170,110,0.3)" }}>
                    <div className="text-4xl font-bold gold-text">{preview.scoring.pompesFinales}</div>
                    <div className="text-sm mt-1" style={{ color: "rgba(240,230,211,0.6)" }}>{t.pompesLabel}</div>
                  </div>
                  <button className="lol-btn w-full" onClick={handleAddLog} disabled={addLogging}>
                    {addLogging ? t.saving : t.logThisGame}
                  </button>
                  {addError && <p className="text-sm loss-text text-center">{addError}</p>}
                </div>
              )}
            </div>
          )}

          {/* Riot match history list */}
          {loadingMatches ? (
            <div className="text-center py-10 gold-text">{t.loadingRiotGames}</div>
          ) : matchError ? (
            <div className="lol-panel p-6 text-center loss-text">{matchError}</div>
          ) : matches.length === 0 ? (
            <div className="lol-panel p-8 text-center">
              <p style={{ color: "rgba(240,230,211,0.5)" }}>{t.noGameFound}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: "rgba(240,230,211,0.4)" }}>
                {t.last20Games}
              </p>
              {matches.map((m, i) => (
                <div
                  key={m.matchId}
                  className="lol-panel px-4 py-3 flex items-center gap-3"
                  style={{ background: "var(--bg-raised)" }}
                >
                  <span className="text-xs w-5 text-center shrink-0" style={{ color: "rgba(200,170,110,0.4)" }}>{i + 1}</span>

                  <ChampionIcon name={m.champion} size={38} />

                  <span
                    className="font-bold text-sm w-16 text-center rounded px-2 py-0.5 shrink-0"
                    style={{
                      background: m.result === "V" ? "rgba(70,180,100,0.15)" : "rgba(200,70,70,0.15)",
                      color: m.result === "V" ? "#4eb86e" : "#e05555",
                    }}
                  >
                    {m.result === "V" ? t.victory : m.result === "D" ? t.defeat : m.result}
                  </span>

                  <span className="gold-text font-semibold text-sm w-14 shrink-0">{m.role}</span>
                  <span className="text-sm w-24 shrink-0" style={{ color: "rgba(240,230,211,0.85)" }}>{m.champion}</span>
                  <span className="text-sm font-mono shrink-0" style={{ color: "rgba(240,230,211,0.7)" }}>
                    {m.kills} / <span style={{ color: "#e05555" }}>{m.deaths}</span> / {m.assists}
                  </span>
                  <span className="text-xs shrink-0" style={{ color: "rgba(240,230,211,0.35)" }}>
                    {(() => { try { return new Date(m.date).toLocaleDateString(dateLocale); } catch { return m.date; } })()}
                  </span>

                  <div className="ml-auto flex items-center gap-3 shrink-0">
                    {m.indisponible ? (
                      <span className="text-xs px-3 py-1 rounded" style={{ color: "rgba(240,230,211,0.35)" }}>{t.unavailable}</span>
                    ) : m.alreadyLogged ? (
                      <>
                        <span className="text-sm gold-text font-bold">{t.pompesCount(m.pompesCalculees ?? 0)}</span>
                        <span className="text-xs px-3 py-1 rounded" style={{ background: "rgba(200,170,110,0.1)", color: "rgba(200,170,110,0.5)" }}>
                          {t.loggedBadge}
                        </span>
                      </>
                    ) : (
                      <button
                        className="lol-btn text-xs px-4 py-1"
                        onClick={() => handleQuickAdd(m)}
                        disabled={addingId === m.matchId}
                      >
                        {addingId === m.matchId ? "…" : t.add}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ POMPES VIEW ════════════════════════════════════════════════════ */}
      {view === "pompes" && (
        <div className="space-y-4">
          {loadingGames ? (
            <div className="text-center py-10 gold-text">{t.loading}</div>
          ) : (
            <>
              {/* Filters */}
              <div className="lol-panel p-3 flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "rgba(200,170,110,0.6)" }}>{t.roleLabel}</span>
                  <select className="lol-select text-sm" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                    {ROLES_FILTER.map((r) => <option key={r} value={r}>{t.roleOptionLabel(r)}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "rgba(200,170,110,0.6)" }}>{t.resultLabel}</span>
                  <select className="lol-select text-sm" value={filterResult} onChange={(e) => setFilterResult(e.target.value)}>
                    <option value="Tous">{t.all}</option>
                    <option value="V">{t.victory}</option>
                    <option value="D">{t.defeat}</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "rgba(200,170,110,0.6)" }}>{t.sortLabel}</span>
                  <select className="lol-select text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as "date" | "pompes")}>
                    <option value="date">{t.date}</option>
                    <option value="pompes">{t.pompes}</option>
                  </select>
                </div>
                <span className="ml-auto text-sm gold-text font-semibold">{t.gamesAndPompes(filtered.length, totalPompes)}</span>
              </div>

              {filtered.length === 0 ? (
                <div className="lol-panel p-8 text-center">
                  <p style={{ color: "rgba(240,230,211,0.5)" }}>{t.noGameToDisplay}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: "0 4px" }}>
                    <thead>
                      <tr style={{ color: "rgba(200,170,110,0.6)" }} className="text-xs uppercase tracking-wider">
                        <th className="text-left px-3 py-1">{t.tableDate}</th>
                        <th className="text-left px-3 py-1">{t.tableRole}</th>
                        <th className="text-left px-3 py-1">{t.tableChampion}</th>
                        <th className="text-center px-3 py-1">{t.tableKda}</th>
                        <th className="text-center px-3 py-1">{t.tableResult}</th>
                        <th className="text-center px-3 py-1">{t.tableLevel}</th>
                        <th className="text-center px-3 py-1">{t.tableScore}</th>
                        <th className="text-center px-3 py-1">{t.tableMalus}</th>
                        <th className="text-center px-3 py-1">{t.tableMastery}</th>
                        <th className="text-right px-3 py-1">{t.tablePompes}</th>
                        <th className="text-right px-3 py-1">{t.tableCumul}</th>
                        <th className="px-3 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // Calcul des cumuls : on part de la fin (game la plus ancienne)
                        // vers le début pour que la ligne la plus récente affiche le total.
                        const cumulMap = new Map<string, number>();
                        let running = 0;
                        for (let i = filtered.length - 1; i >= 0; i--) {
                          running += filtered[i].pompesCalculees;
                          cumulMap.set(filtered[i].id, running);
                        }
                        return filtered.map((g) => {
                          const cumul = cumulMap.get(g.id) ?? 0;
                          return (
                            <tr key={g.id} style={{ background: "var(--bg-raised)", borderBottom: "1px solid rgba(200,170,110,0.08)" }}>
                              <td className="px-3 py-2" style={{ color: "rgba(240,230,211,0.6)" }}>
                                {editingDateId === g.id ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <input
                                      type="datetime-local"
                                      className="lol-input"
                                      style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                                      value={editDateVal}
                                      onChange={(e) => setEditDateVal(e.target.value)}
                                    />
                                    <button onClick={() => handleEditDate(g.id)} style={{ color: "#4caf50", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem" }}>✓</button>
                                    <button onClick={() => setEditingDateId(null)} style={{ color: "#e05555", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem" }}>✕</button>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span>{new Date(g.date).toLocaleDateString(dateLocale)}</span>
                                    <button
                                      onClick={() => {
                                        const d = new Date(g.date);
                                        const offset = d.getTimezoneOffset() * 60000;
                                        setEditDateVal(new Date(d.getTime() - offset).toISOString().slice(0, 16));
                                        setEditingDateId(g.id);
                                      }}
                                      title={t.editDateTitle}
                                      style={{ color: "rgba(200,170,110,0.35)", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", lineHeight: 1 }}
                                    >✎</button>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 gold-text font-medium">{g.role}</td>
                              <td className="px-3 py-2">
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <ChampionIcon name={g.champion} size={26} />
                                  <span style={{ color: "rgba(240,230,211,0.8)" }}>{g.champion ?? "—"}</span>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-center" style={{ color: "rgba(240,230,211,0.8)" }}>
                                {g.kills}/{g.deaths}/{g.assists}
                              </td>
                              <td className="px-3 py-2 text-center font-bold">
                                <span className={g.result === "V" ? "win-text" : "loss-text"}>
                                  {g.result === "V" ? t.victory : t.defeat}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-center gold-text">{g.niveauCalcule}</td>
                              <td className="px-3 py-2 text-center" style={{ color: "rgba(240,230,211,0.7)" }}>{g.scoreCalcule}</td>
                              <td className="px-3 py-2 text-center loss-text">+{g.malusCalcule}</td>
                              <td className="px-3 py-2 text-center blue-text">+{Math.round(g.surchargeCalculee * 100)}%</td>
                              <td className="px-3 py-2 text-right gold-text font-bold">{g.pompesCalculees}</td>
                              <td className="px-3 py-2 text-right" style={{ color: "rgba(200,170,110,0.6)" }}>{cumul}</td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  onClick={() => handleDelete(g.id)}
                                  disabled={deletingId === g.id}
                                  title={t.deleteGameTitle}
                                  style={{ color: "rgba(220,80,80,0.7)", lineHeight: 1, background: "none", border: "none", cursor: "pointer", fontSize: "1rem", padding: "2px 6px", borderRadius: "4px" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(220,80,80,1)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(220,80,80,0.7)")}
                                >
                                  {deletingId === g.id ? "…" : "✕"}
                                </button>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
