"use client";
import { useEffect, useState } from "react";

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

function getLevelLabel(sec: number): string {
  if (sec <= 45) return "Niv. 1";
  if (sec <= 90) return "Niv. 2";
  if (sec <= 150) return "Niv. 3";
  if (sec <= 240) return "Niv. 4";
  return "Niv. 5";
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HistoryPage() {
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
  const [matchesLoaded, setMatchesLoaded] = useState(false);
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

  // ── Riot manual fetch ──
  const [riotLoading, setRiotLoading] = useState(false);
  const [riotError, setRiotError] = useState("");

  // ─── Load pompe games on mount ───────────────────────────────────────────
  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then((data) => { setGames(data); setLoadingGames(false); });
  }, []);

  // ─── Load matches when "parties" view first activated ────────────────────
  useEffect(() => {
    if (view === "parties" && !matchesLoaded) {
      setLoadingMatches(true);
      fetch("/api/riot/match-history")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setMatches(data);
          else setMatchError(data.error ?? "Réponse inattendue de l'API.");
          setLoadingMatches(false);
          setMatchesLoaded(true);
        })
        .catch(() => { setMatchError("Erreur de chargement."); setLoadingMatches(false); });
    }
  }, [view, matchesLoaded]);

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
      const { scoring } = await res.json();
      setMatches((prev) => prev.map((x) =>
        x.matchId === m.matchId
          ? { ...x, alreadyLogged: true, pompesCalculees: scoring.pompesFinales }
          : x
      ));
    }
    setAddingId(null);
  };

  // ─── Manual add form ─────────────────────────────────────────────────────
  const openAddForm = (role?: string) => {
    setAddForm((f) => ({ ...f, role: role ?? "Jungle" }));
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
      setAddForm({ role: "Jungle", champion: "", kills: "", deaths: "", assists: "", result: "D", gainageSec: "60" });
    } else {
      const err = await res.json();
      setAddError(err.error ?? "Erreur lors du log");
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
      setRiotError(err.error ?? "Erreur Riot API");
    }
    setRiotLoading(false);
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

  const isAddReady = addForm.kills !== "" && addForm.deaths !== "" && addForm.assists !== "";

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold gold-text tracking-widest">HISTORIQUE</h1>

      {/* Tab toggle */}
      <div className="flex gap-2">
        {(["parties", "pompes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            className="px-5 py-2 rounded text-sm font-semibold transition-all"
            style={{
              background: view === tab ? "rgba(200,170,110,0.18)" : "rgba(200,170,110,0.06)",
              color: view === tab ? "#c8aa6e" : "rgba(240,230,211,0.5)",
              border: `1px solid ${view === tab ? "rgba(200,170,110,0.5)" : "rgba(200,170,110,0.15)"}`,
            }}
          >
            {tab === "parties" ? "Parties" : "Pompes"}
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
                <span className="gold-text font-semibold">L&apos;ARAM du chaos n&apos;apparaît pas ici.</span>{" "}
                L&apos;API de Riot ne renvoie pas ce mode — ces parties doivent être ajoutées à la main.
              </p>
              <button className="lol-btn text-xs px-4 py-1" onClick={() => openAddForm("ARAM")}>
                ➕ Ajouter une ARAM du chaos (manuel)
              </button>
            </div>
          </div>

          {/* Riot fetch + add form trigger */}
          <div className="flex gap-2">
            <button className="lol-btn lol-btn-blue flex-1 text-sm" onClick={handleRiotFetch} disabled={riotLoading}>
              {riotLoading ? "Récupération..." : "⟳ Récupérer ma dernière game (Riot)"}
            </button>
            <button
              className="lol-btn text-sm px-4"
              onClick={() => openAddForm()}
              style={{ background: "rgba(200,170,110,0.15)" }}
            >
              ➕ Ajouter
            </button>
          </div>
          {riotError && <p className="text-sm loss-text">{riotError}</p>}

          {/* Manual add form */}
          {showAddForm && (
            <div className="lol-panel p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">Ajouter une game</h2>
                <button
                  onClick={() => { setShowAddForm(false); setPreview(null); setAddLogged(false); }}
                  style={{ color: "rgba(240,230,211,0.4)", background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }}
                >✕</button>
              </div>

              {addLogged && (
                <div className="text-center p-3 rounded" style={{ background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.3)" }}>
                  <span className="win-text font-semibold">✓ Game loggée !</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Rôle</label>
                  <select className="lol-select w-full" value={addForm.role}
                    onChange={(e) => { setAddForm((f) => ({ ...f, role: e.target.value })); setPreview(null); }}>
                    {ROLES_FORM.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Champion</label>
                  <input className="lol-input" placeholder="ex: Lee Sin" value={addForm.champion}
                    onChange={(e) => { setAddForm((f) => ({ ...f, champion: e.target.value })); setPreview(null); }} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(["kills", "deaths", "assists"] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>
                      {field === "kills" ? "Kills" : field === "deaths" ? "Morts" : "Assists"}
                    </label>
                    <input type="number" min="0" className="lol-input text-center" value={addForm[field]}
                      onChange={(e) => { setAddForm((f) => ({ ...f, [field]: e.target.value })); setPreview(null); }} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Résultat</label>
                  <div className="flex gap-2">
                    {(["V", "D"] as const).map((r) => (
                      <button key={r} className="flex-1 py-2 rounded text-sm font-bold"
                        style={{
                          background: addForm.result === r ? (r === "V" ? "rgba(76,175,80,0.25)" : "rgba(239,83,80,0.25)") : "rgba(200,170,110,0.08)",
                          border: `1px solid ${addForm.result === r ? (r === "V" ? "#4caf50" : "#ef5350") : "rgba(200,170,110,0.2)"}`,
                          color: addForm.result === r ? (r === "V" ? "#4caf50" : "#ef5350") : "rgba(240,230,211,0.6)",
                        }}
                        onClick={() => { setAddForm((f) => ({ ...f, result: r })); setPreview(null); }}>
                        {r === "V" ? "Victoire" : "Défaite"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>
                    Temps de gainage (sec)
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" className="lol-input text-center" value={addForm.gainageSec}
                      onChange={(e) => { setAddForm((f) => ({ ...f, gainageSec: e.target.value })); setPreview(null); }} />
                    <span className="text-xs gold-text shrink-0">{getLevelLabel(Number(addForm.gainageSec) || 60)}</span>
                  </div>
                </div>
              </div>

              <button className="lol-btn w-full" onClick={handlePreview} disabled={!isAddReady || previewLoading}>
                {previewLoading ? "Calcul..." : "Calculer les pompes"}
              </button>

              {preview && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between p-2 rounded" style={{ background: "rgba(200,170,110,0.08)" }}>
                      <span style={{ color: "rgba(240,230,211,0.6)" }}>Niveau</span>
                      <span className="gold-text font-bold">{preview.scoring.niveau}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded" style={{ background: "rgba(200,170,110,0.08)" }}>
                      <span style={{ color: "rgba(240,230,211,0.6)" }}>Multiplicateur</span>
                      <span className="gold-text font-bold">×{preview.scoring.multiplicateur}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded" style={{ background: "rgba(200,170,110,0.08)" }}>
                      <span style={{ color: "rgba(240,230,211,0.6)" }}>Score de base</span>
                      <span className="gold-text font-bold">{preview.scoring.scoreBase}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded" style={{ background: "rgba(200,170,110,0.08)" }}>
                      <span style={{ color: "rgba(240,230,211,0.6)" }}>Malus défaite</span>
                      <span className={preview.scoring.malus > 0 ? "loss-text font-bold" : "gold-text font-bold"}>+{preview.scoring.malus}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded col-span-2" style={{ background: "rgba(200,170,110,0.08)" }}>
                      <span style={{ color: "rgba(240,230,211,0.6)" }}>Maîtrise ({preview.partiesAvant} parties)</span>
                      <span className="blue-text font-bold">+{Math.round(preview.scoring.surcharge * 100)}%</span>
                    </div>
                  </div>
                  <div className="text-center p-4 rounded" style={{ background: "rgba(200,170,110,0.1)", border: "1px solid rgba(200,170,110,0.3)" }}>
                    <div className="text-4xl font-bold gold-text">{preview.scoring.pompesFinales}</div>
                    <div className="text-sm mt-1" style={{ color: "rgba(240,230,211,0.6)" }}>POMPES</div>
                  </div>
                  <button className="lol-btn w-full" onClick={handleAddLog} disabled={addLogging}>
                    {addLogging ? "Enregistrement..." : "Logger cette game"}
                  </button>
                  {addError && <p className="text-sm loss-text text-center">{addError}</p>}
                </div>
              )}
            </div>
          )}

          {/* Riot match history list */}
          {loadingMatches ? (
            <div className="text-center py-10 gold-text">Chargement des parties Riot...</div>
          ) : matchError ? (
            <div className="lol-panel p-6 text-center loss-text">{matchError}</div>
          ) : matches.length === 0 ? (
            <div className="lol-panel p-8 text-center">
              <p style={{ color: "rgba(240,230,211,0.5)" }}>Aucune partie trouvée.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: "rgba(240,230,211,0.4)" }}>
                20 dernières parties du compte Riot · Cliquez sur &quot;Ajouter&quot; pour comptabiliser les pompes
              </p>
              {matches.map((m, i) => (
                <div
                  key={m.matchId}
                  className="lol-panel px-4 py-3 flex items-center gap-3"
                  style={{ background: "var(--lol-dark-light)" }}
                >
                  <span className="text-xs w-5 text-center" style={{ color: "rgba(200,170,110,0.4)" }}>{i + 1}</span>

                  <span
                    className="font-bold text-sm w-16 text-center rounded px-2 py-0.5 shrink-0"
                    style={{
                      background: m.result === "V" ? "rgba(70,180,100,0.15)" : "rgba(200,70,70,0.15)",
                      color: m.result === "V" ? "#4eb86e" : "#e05555",
                    }}
                  >
                    {m.result === "V" ? "Victoire" : m.result === "D" ? "Défaite" : m.result}
                  </span>

                  <span className="gold-text font-semibold text-sm w-16 shrink-0">{m.role}</span>
                  <span className="text-sm w-28 shrink-0" style={{ color: "rgba(240,230,211,0.85)" }}>{m.champion}</span>
                  <span className="text-sm font-mono shrink-0" style={{ color: "rgba(240,230,211,0.7)" }}>
                    {m.kills} / <span style={{ color: "#e05555" }}>{m.deaths}</span> / {m.assists}
                  </span>
                  <span className="text-xs shrink-0" style={{ color: "rgba(240,230,211,0.35)" }}>
                    {(() => { try { return new Date(m.date).toLocaleDateString("fr-FR"); } catch { return m.date; } })()}
                  </span>

                  <div className="ml-auto flex items-center gap-3 shrink-0">
                    {m.indisponible ? (
                      <span className="text-xs px-3 py-1 rounded" style={{ color: "rgba(240,230,211,0.35)" }}>Indisponible</span>
                    ) : m.alreadyLogged ? (
                      <>
                        <span className="text-sm gold-text font-bold">{m.pompesCalculees} pompes</span>
                        <span className="text-xs px-3 py-1 rounded" style={{ background: "rgba(200,170,110,0.1)", color: "rgba(200,170,110,0.5)" }}>
                          ✓ Loggée
                        </span>
                      </>
                    ) : (
                      <button
                        className="lol-btn text-xs px-4 py-1"
                        onClick={() => handleQuickAdd(m)}
                        disabled={addingId === m.matchId}
                      >
                        {addingId === m.matchId ? "…" : "+ Ajouter"}
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
            <div className="text-center py-10 gold-text">Chargement...</div>
          ) : (
            <>
              {/* Filters */}
              <div className="lol-panel p-3 flex flex-wrap gap-3 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "rgba(200,170,110,0.6)" }}>Rôle</span>
                  <select className="lol-select text-sm" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                    {ROLES_FILTER.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "rgba(200,170,110,0.6)" }}>Résultat</span>
                  <select className="lol-select text-sm" value={filterResult} onChange={(e) => setFilterResult(e.target.value)}>
                    <option value="Tous">Tous</option>
                    <option value="V">Victoire</option>
                    <option value="D">Défaite</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: "rgba(200,170,110,0.6)" }}>Trier</span>
                  <select className="lol-select text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as "date" | "pompes")}>
                    <option value="date">Date</option>
                    <option value="pompes">Pompes</option>
                  </select>
                </div>
                <span className="ml-auto text-sm gold-text font-semibold">{filtered.length} games · {totalPompes} pompes</span>
              </div>

              {filtered.length === 0 ? (
                <div className="lol-panel p-8 text-center">
                  <p style={{ color: "rgba(240,230,211,0.5)" }}>Aucune game à afficher.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: "0 4px" }}>
                    <thead>
                      <tr style={{ color: "rgba(200,170,110,0.6)" }} className="text-xs uppercase tracking-wider">
                        <th className="text-left px-3 py-1">Date</th>
                        <th className="text-left px-3 py-1">Rôle</th>
                        <th className="text-left px-3 py-1">Champion</th>
                        <th className="text-center px-3 py-1">KDA</th>
                        <th className="text-center px-3 py-1">Résultat</th>
                        <th className="text-center px-3 py-1">Niv.</th>
                        <th className="text-center px-3 py-1">Score</th>
                        <th className="text-center px-3 py-1">Malus</th>
                        <th className="text-center px-3 py-1">Maîtrise</th>
                        <th className="text-right px-3 py-1">Pompes</th>
                        <th className="text-right px-3 py-1">Cumul</th>
                        <th className="px-3 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let cumul = 0;
                        return filtered.map((g) => {
                          cumul += g.pompesCalculees;
                          return (
                            <tr key={g.id} className="lol-panel" style={{ background: "var(--lol-dark-light)" }}>
                              <td className="px-3 py-2" style={{ color: "rgba(240,230,211,0.6)" }}>
                                {new Date(g.date).toLocaleDateString("fr-FR")}
                              </td>
                              <td className="px-3 py-2 gold-text font-medium">{g.role}</td>
                              <td className="px-3 py-2" style={{ color: "rgba(240,230,211,0.8)" }}>{g.champion ?? "—"}</td>
                              <td className="px-3 py-2 text-center" style={{ color: "rgba(240,230,211,0.8)" }}>
                                {g.kills}/{g.deaths}/{g.assists}
                              </td>
                              <td className="px-3 py-2 text-center font-bold">
                                <span className={g.result === "V" ? "win-text" : "loss-text"}>
                                  {g.result === "V" ? "Victoire" : "Défaite"}
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
                                  title="Supprimer cette game"
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
