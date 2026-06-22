"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const ROLES = ["Top", "Jungle", "Mid", "ADC", "Support", "ARAM", "Arena"];
const POLL_MS = 2 * 60 * 1000;

type Scoring = { niveau: number; multiplicateur: number; scoreBase: number; malus: number; surcharge: number; pompesFinales: number };
type PreviewResult = { scoring: Scoring; partiesAvant: number; gainageSec: number };
type RiotData = { matchId: string; champion: string; role: string; kills: number; deaths: number; assists: number; result: "V" | "D" };
type SessionGame = { champion: string; role: string; kills: number; deaths: number; assists: number; result: string; pompes: number };

export default function GamePage() {
  const [form, setForm] = useState({ role: "Jungle", champion: "", kills: "", deaths: "", assists: "", result: "D" });
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [riotLoading, setRiotLoading] = useState(false);
  const [riotData, setRiotData] = useState<RiotData | null>(null);
  const [riotError, setRiotError] = useState("");
  const [logged, setLogged] = useState(false);
  const [logError, setLogError] = useState("");

  const [sessionActive, setSessionActive] = useState(false);
  const [sessionGames, setSessionGames] = useState<SessionGame[]>([]);
  const [sessionError, setSessionError] = useState("");
  const [polling, setPolling] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopSession = useCallback(() => {
    setSessionActive(false);
    setPolling(false);
    setCountdown(0);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const doPoll = useCallback(async () => {
    setPolling(true);
    setCountdown(POLL_MS / 1000);
    try {
      const res = await fetch("/api/riot/last-game");
      if (res.status === 409) { setPolling(false); return; }
      if (res.status === 400) {
        setSessionError("PUUID manquant. Configure ton Riot ID dans Profil.");
        stopSession();
        return;
      }
      if (!res.ok) { setPolling(false); return; }
      const data: RiotData = await res.json();
      const logRes = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: data.role, champion: data.champion,
          kills: data.kills, deaths: data.deaths, assists: data.assists,
          result: data.result, source: "riot_api", riotMatchId: data.matchId,
        }),
      });
      if (logRes.ok) {
        const { scoring } = await logRes.json();
        setSessionGames(prev => [{ champion: data.champion, role: data.role, kills: data.kills, deaths: data.deaths, assists: data.assists, result: data.result, pompes: scoring.pompesFinales }, ...prev]);
      }
    } catch { /* retry next poll */ }
    setPolling(false);
  }, [stopSession]);

  const startSession = useCallback(() => {
    setSessionActive(true);
    setSessionGames([]);
    setSessionError("");
    doPoll();
    intervalRef.current = setInterval(doPoll, POLL_MS);
    setCountdown(POLL_MS / 1000);
    countdownRef.current = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
  }, [doPoll]);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const handleChange = (field: string, value: string) => {
    setForm(f => ({ ...f, [field]: value }));
    setPreview(null);
  };

  const handlePreview = async () => {
    if (!form.kills || !form.deaths || !form.assists) return;
    setLoading(true);
    const res = await fetch("/api/games/preview", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, kills: Number(form.kills), deaths: Number(form.deaths), assists: Number(form.assists) }),
    });
    setPreview(await res.json());
    setLoading(false);
  };

  const handleLog = async () => {
    setLoading(true); setLogError("");
    const res = await fetch("/api/games", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, kills: Number(form.kills), deaths: Number(form.deaths), assists: Number(form.assists), source: riotData ? "riot_api" : "manuel", riotMatchId: riotData?.matchId ?? null }),
    });
    if (res.ok) {
      setLogged(true); setPreview(null); setRiotData(null);
      setForm({ role: "Jungle", champion: "", kills: "", deaths: "", assists: "", result: "D" });
    } else {
      const err = await res.json();
      setLogError(err.error ?? "Erreur lors du log");
    }
    setLoading(false);
  };

  const handleRiotFetch = async () => {
    setRiotLoading(true); setRiotError(""); setRiotData(null);
    const res = await fetch("/api/riot/last-game");
    if (res.ok) {
      const data: RiotData = await res.json();
      setRiotData(data);
      setForm(f => ({ ...f, role: data.role, champion: data.champion, kills: String(data.kills), deaths: String(data.deaths), assists: String(data.assists), result: data.result }));
      setPreview(null);
    } else {
      const err = await res.json();
      setRiotError(err.error ?? "Erreur Riot API");
    }
    setRiotLoading(false);
  };

  const isReady = form.kills !== "" && form.deaths !== "" && form.assists !== "";
  const totalSessionPompes = sessionGames.reduce((s, g) => s + g.pompes, 0);

  if (logged) {
    return (
      <div className="max-w-lg mx-auto lol-panel p-8 text-center space-y-4 mt-10">
        <div className="text-5xl">💪</div>
        <h2 className="gold-text font-bold text-xl">Game loggée !</h2>
        <button className="lol-btn" onClick={() => setLogged(false)}>Logger une autre game</button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold gold-text tracking-widest">DERNIÈRE GAME</h1>

      {/* MODE SESSION */}
      <div className="lol-panel p-4 space-y-3">
        <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">Mode Session</h2>
        <p className="text-xs" style={{ color: "rgba(240,230,211,0.5)" }}>
          Lance une session avant de jouer — chaque partie est détectée et loggée automatiquement toutes les 2 min.
        </p>

        {!sessionActive ? (
          <button className="lol-btn w-full" onClick={startSession}>▶ Démarrer une session</button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded" style={{ background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.3)" }}>
              <div className="w-2 h-2 rounded-full" style={{ background: "#4caf50", boxShadow: "0 0 6px #4caf50", animation: "pulse 1.5s infinite" }} />
              <span className="text-sm win-text font-semibold">Session active</span>
              <span className="ml-auto text-xs" style={{ color: "rgba(240,230,211,0.4)" }}>
                {polling ? "⟳ Vérification en cours..." : `Prochaine vérif. dans ${countdown}s`}
              </span>
            </div>

            {sessionGames.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs gold-text font-semibold">
                  {sessionGames.length} game{sessionGames.length > 1 ? "s" : ""} loggée{sessionGames.length > 1 ? "s" : ""} · {totalSessionPompes} pompes
                </p>
                {sessionGames.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded text-sm"
                    style={{ background: "rgba(200,170,110,0.06)", border: "1px solid rgba(200,170,110,0.1)" }}>
                    <span className={g.result === "V" ? "win-text font-bold" : "loss-text font-bold"}>
                      {g.result === "V" ? "V" : "D"}
                    </span>
                    <span className="gold-text font-medium">{g.champion}</span>
                    <span className="text-xs" style={{ color: "rgba(240,230,211,0.5)" }}>{g.role}</span>
                    <span className="text-xs" style={{ color: "rgba(240,230,211,0.6)" }}>{g.kills}/{g.deaths}/{g.assists}</span>
                    <span className="ml-auto gold-text font-bold">{g.pompes} 💪</span>
                  </div>
                ))}
              </div>
            )}

            {sessionGames.length === 0 && !polling && (
              <p className="text-xs text-center" style={{ color: "rgba(240,230,211,0.4)" }}>
                En attente de la prochaine partie...
              </p>
            )}

            {sessionError && <p className="text-sm loss-text">{sessionError}</p>}

            <button className="lol-btn w-full"
              style={{ background: "linear-gradient(to bottom, #c23b22, #8b2515)", color: "#f0e6d3" }}
              onClick={stopSession}>
              ⏹ Arrêter la session
            </button>
          </div>
        )}
      </div>

      {/* RÉCUP RIOT */}
      <div className="lol-panel p-4 space-y-3">
        <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">Récupérer depuis Riot</h2>
        <button className="lol-btn lol-btn-blue w-full" onClick={handleRiotFetch} disabled={riotLoading}>
          {riotLoading ? "Récupération..." : "⟳ Récupérer ma dernière game"}
        </button>
        {riotData && (
          <div className="text-sm p-2 rounded" style={{ background: "rgba(11,196,227,0.08)", border: "1px solid rgba(11,196,227,0.3)" }}>
            <span className="blue-text font-semibold">✓ Game récupérée</span>{" — "}
            {riotData.champion} ({riotData.role}) · {riotData.kills}/{riotData.deaths}/{riotData.assists}{" · "}
            <span className={riotData.result === "V" ? "win-text" : "loss-text"}>
              {riotData.result === "V" ? "Victoire" : "Défaite"}
            </span>
          </div>
        )}
        {riotError && <p className="text-sm loss-text">{riotError}</p>}
      </div>

      {/* SAISIE MANUELLE */}
      <div className="lol-panel p-4 space-y-4">
        <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">Saisie manuelle</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Rôle</label>
            <select className="lol-select w-full" value={form.role} onChange={e => handleChange("role", e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Champion</label>
            <input className="lol-input" placeholder="ex: Lee Sin" value={form.champion} onChange={e => handleChange("champion", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {(["kills", "deaths", "assists"] as const).map(field => (
            <div key={field}>
              <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>
                {field === "kills" ? "Kills" : field === "deaths" ? "Morts" : "Assists"}
              </label>
              <input type="number" min="0" className="lol-input text-center" value={form[field]} onChange={e => handleChange(field, e.target.value)} />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Résultat</label>
          <div className="flex gap-3">
            {(["V", "D"] as const).map(r => (
              <button key={r} className="flex-1 py-2 rounded text-sm font-bold transition-all"
                style={{
                  background: form.result === r ? (r === "V" ? "rgba(76,175,80,0.25)" : "rgba(239,83,80,0.25)") : "rgba(200,170,110,0.08)",
                  border: `1px solid ${form.result === r ? (r === "V" ? "#4caf50" : "#ef5350") : "rgba(200,170,110,0.2)"}`,
                  color: form.result === r ? (r === "V" ? "#4caf50" : "#ef5350") : "rgba(240,230,211,0.6)",
                }}
                onClick={() => handleChange("result", r)}>
                {r === "V" ? "Victoire" : "Défaite"}
              </button>
            ))}
          </div>
        </div>
        <button className="lol-btn w-full" onClick={handlePreview} disabled={!isReady || loading}>Calculer</button>
      </div>

      {/* PRÉVIEw calcul */}
      {preview && (
        <div className="lol-panel p-4 space-y-4">
          <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">Détail du calcul</h2>
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
            <div className="flex justify-between p-2 rounded" style={{ background: "rgba(200,170,110,0.08)" }}>
              <span style={{ color: "rgba(240,230,211,0.6)" }}>Maîtrise ({preview.partiesAvant} parties)</span>
              <span className="blue-text font-bold">+{Math.round(preview.scoring.surcharge * 100)}%</span>
            </div>
          </div>
          <div className="text-center p-4 rounded" style={{ background: "rgba(200,170,110,0.1)", border: "1px solid rgba(200,170,110,0.3)" }}>
            <div className="text-4xl font-bold gold-text">{preview.scoring.pompesFinales}</div>
            <div className="text-sm mt-1" style={{ color: "rgba(240,230,211,0.6)" }}>POMPES</div>
          </div>
          <button className="lol-btn w-full" onClick={handleLog} disabled={loading}>
            {loading ? "Enregistrement..." : "Logger cette game"}
          </button>
          {logError && <p className="text-sm loss-text text-center">{logError}</p>}
        </div>
      )}
    </div>
  );
}
