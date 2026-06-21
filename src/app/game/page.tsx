"use client";
import { useState } from "react";

const ROLES = ["Top", "Jungle", "Mid", "ADC", "Support", "ARAM", "Arena"];

type Scoring = {
  niveau: number;
  multiplicateur: number;
  scoreBase: number;
  malus: number;
  surcharge: number;
  pompesFinales: number;
};

type PreviewResult = {
  scoring: Scoring;
  partiesAvant: number;
  gainageSec: number;
};

type RiotData = {
  matchId: string;
  champion: string;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  result: "V" | "D";
};

export default function GamePage() {
  const [form, setForm] = useState({ role: "Jungle", champion: "", kills: "", deaths: "", assists: "", result: "D" });
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [riotLoading, setRiotLoading] = useState(false);
  const [riotData, setRiotData] = useState<RiotData | null>(null);
  const [riotError, setRiotError] = useState("");
  const [logged, setLogged] = useState(false);
  const [logError, setLogError] = useState("");

  const handleChange = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setPreview(null);
  };

  const handlePreview = async () => {
    if (!form.kills || !form.deaths || !form.assists) return;
    setLoading(true);
    const res = await fetch("/api/games/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, kills: Number(form.kills), deaths: Number(form.deaths), assists: Number(form.assists) }),
    });
    const data = await res.json();
    setPreview(data);
    setLoading(false);
  };

  const handleLog = async () => {
    setLoading(true);
    setLogError("");
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        kills: Number(form.kills), deaths: Number(form.deaths), assists: Number(form.assists),
        source: riotData ? "riot_api" : "manuel",
        riotMatchId: riotData?.matchId ?? null,
      }),
    });
    if (res.ok) {
      setLogged(true);
      setPreview(null);
      setRiotData(null);
      setForm({ role: "Jungle", champion: "", kills: "", deaths: "", assists: "", result: "D" });
    } else {
      const err = await res.json();
      setLogError(err.error ?? "Erreur lors du log");
    }
    setLoading(false);
  };

  const handleRiotFetch = async () => {
    setRiotLoading(true);
    setRiotError("");
    setRiotData(null);
    const res = await fetch("/api/riot/last-game");
    if (res.ok) {
      const data: RiotData = await res.json();
      setRiotData(data);
      setForm((f) => ({
        ...f,
        role: data.role,
        champion: data.champion,
        kills: String(data.kills),
        deaths: String(data.deaths),
        assists: String(data.assists),
        result: data.result,
      }));
      setPreview(null);
    } else {
      const err = await res.json();
      setRiotError(err.error ?? "Erreur Riot API");
    }
    setRiotLoading(false);
  };

  const isReady = form.kills !== "" && form.deaths !== "" && form.assists !== "";

  if (logged) {
    return (
      <div className="max-w-lg mx-auto lol-panel p-8 text-center space-y-4 mt-10">
        <div className="text-5xl">💪</div>
        <h2 className="gold-text font-bold text-xl">Game loggée !</h2>
        <p className="text-sm" style={{ color: "rgba(240,230,211,0.6)" }}>
          {preview?.scoring.pompesFinales ?? ""} pompes à faire.
        </p>
        <button className="lol-btn" onClick={() => setLogged(false)}>Logger une autre game</button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold gold-text tracking-widest">DERNIÈRE GAME</h1>

      {/* Riot API */}
      <div className="lol-panel p-4 space-y-3">
        <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">Récupérer depuis Riot</h2>
        <button
          className="lol-btn lol-btn-blue w-full"
          onClick={handleRiotFetch}
          disabled={riotLoading}
        >
          {riotLoading ? "Récupération..." : "⟳ Récupérer ma dernière game"}
        </button>
        {riotData && (
          <div className="text-sm p-2 rounded" style={{ background: "rgba(11,196,227,0.08)", border: "1px solid rgba(11,196,227,0.3)" }}>
            <span className="blue-text font-semibold">✓ Game récupérée</span>
            {" — "}
            {riotData.champion} ({riotData.role}) · {riotData.kills}/{riotData.deaths}/{riotData.assists}
            {" · "}
            <span className={riotData.result === "V" ? "win-text" : "loss-text"}>{riotData.result === "V" ? "Victoire" : "Défaite"}</span>
          </div>
        )}
        {riotError && <p className="text-sm loss-text">{riotError}</p>}
      </div>

      {/* Saisie manuelle */}
      <div className="lol-panel p-4 space-y-4">
        <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">Saisie manuelle</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Rôle</label>
            <select className="lol-select w-full" value={form.role} onChange={(e) => handleChange("role", e.target.value)}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Champion</label>
            <input className="lol-input" placeholder="ex: Lee Sin" value={form.champion} onChange={(e) => handleChange("champion", e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {(["kills", "deaths", "assists"] as const).map((field) => (
            <div key={field}>
              <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>
                {field === "kills" ? "Kills" : field === "deaths" ? "Morts" : "Assists"}
              </label>
              <input
                type="number" min="0" className="lol-input text-center"
                value={form[field]} onChange={(e) => handleChange(field, e.target.value)}
              />
            </div>
          ))}
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: "rgba(200,170,110,0.7)" }}>Résultat</label>
          <div className="flex gap-3">
            {(["V", "D"] as const).map((r) => (
              <button
                key={r}
                className="flex-1 py-2 rounded text-sm font-bold transition-all"
                style={{
                  background: form.result === r
                    ? (r === "V" ? "rgba(76,175,80,0.25)" : "rgba(239,83,80,0.25)")
                    : "rgba(200,170,110,0.08)",
                  border: `1px solid ${form.result === r ? (r === "V" ? "#4caf50" : "#ef5350") : "rgba(200,170,110,0.2)"}`,
                  color: form.result === r ? (r === "V" ? "#4caf50" : "#ef5350") : "rgba(240,230,211,0.6)",
                }}
                onClick={() => handleChange("result", r)}
              >
                {r === "V" ? "Victoire" : "Défaite"}
              </button>
            ))}
          </div>
        </div>

        <button className="lol-btn w-full" onClick={handlePreview} disabled={!isReady || loading}>
          Calculer
        </button>
      </div>

      {/* Résultat du calcul */}
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
              <span className={preview.scoring.malus > 0 ? "loss-text font-bold" : "gold-text font-bold"}>
                +{preview.scoring.malus}
              </span>
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
