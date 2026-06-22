"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

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

export default function GameHistoryPage() {
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/riot/match-history")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMatches(data);
        else setError(data.error ?? "Réponse inattendue de l'API.");
        setLoading(false);
      })
      .catch(() => { setError("Erreur de chargement."); setLoading(false); });
  }, []);

  const handleAdd = async (m: MatchEntry) => {
    setAddingId(m.matchId);
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: m.role,
        champion: m.champion,
        kills: m.kills,
        deaths: m.deaths,
        assists: m.assists,
        result: m.result,
        source: "riot_api",
        riotMatchId: m.matchId,
      }),
    });
    if (res.ok) {
      const { scoring } = await res.json();
      setMatches((prev) =>
        prev.map((x) =>
          x.matchId === m.matchId
            ? { ...x, alreadyLogged: true, pompesCalculees: scoring.pompesFinales }
            : x
        )
      );
    }
    setAddingId(null);
  };

  if (loading) return <div className="text-center py-20 gold-text">Chargement des parties Riot...</div>;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold gold-text tracking-widest">HISTORIQUE DE PARTIES</h1>
      <p className="text-sm" style={{ color: "rgba(240,230,211,0.4)" }}>
        20 dernières parties du compte Riot · Cliquez sur &quot;Ajouter&quot; pour comptabiliser les pompes
      </p>

      {/* ARAM du chaos : non fourni par l'API Riot → ajout manuel */}
      <div className="lol-panel p-4 flex items-start gap-3" style={{ borderColor: "rgba(200,170,110,0.25)" }}>
        <span className="text-lg" style={{ lineHeight: 1.2 }}>⚠️</span>
        <div className="flex-1 space-y-2">
          <p className="text-sm" style={{ color: "rgba(240,230,211,0.75)" }}>
            <span className="gold-text font-semibold">L&apos;ARAM du chaos n&apos;apparaît pas ici.</span>{" "}
            L&apos;API de Riot ne renvoie pas ce mode dans l&apos;historique — ces parties sont donc invisibles
            pour le site et doivent être ajoutées à la main.
          </p>
          <Link href="/game?role=ARAM" className="lol-btn inline-block text-xs px-4 py-1">
            ➕ Ajouter une ARAM du chaos (manuel)
          </Link>
        </div>
      </div>

      {error ? (
        <div className="lol-panel p-6 text-center loss-text">{error}</div>
      ) : matches.length === 0 ? (
        <div className="lol-panel p-8 text-center">
          <p style={{ color: "rgba(240,230,211,0.5)" }}>Aucune partie trouvée.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {matches.map((m, i) => (
            <div
              key={m.matchId}
              className="lol-panel px-4 py-3 flex items-center gap-3"
              style={{ background: "var(--lol-dark-light)" }}
            >
              <span className="text-xs w-5 text-center" style={{ color: "rgba(200,170,110,0.4)" }}>
                {i + 1}
              </span>

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

              <span className="text-sm w-28 shrink-0" style={{ color: "rgba(240,230,211,0.85)" }}>
                {m.champion}
              </span>

              <span className="text-sm font-mono shrink-0" style={{ color: "rgba(240,230,211,0.7)" }}>
                {m.kills} / <span style={{ color: "#e05555" }}>{m.deaths}</span> / {m.assists}
              </span>

              <span className="text-xs shrink-0" style={{ color: "rgba(240,230,211,0.35)" }}>
                {(() => {
                  try { return new Date(m.date).toLocaleDateString("fr-FR"); }
                  catch { return m.date; }
                })()}
              </span>

              <div className="ml-auto flex items-center gap-3 shrink-0">
                {m.indisponible ? (
                  <span className="text-xs px-3 py-1 rounded" style={{ color: "rgba(240,230,211,0.35)" }}>
                    Indisponible
                  </span>
                ) : m.alreadyLogged ? (
                  <>
                    <span className="text-sm gold-text font-bold">{m.pompesCalculees} pompes</span>
                    <span
                      className="text-xs px-3 py-1 rounded"
                      style={{ background: "rgba(200,170,110,0.1)", color: "rgba(200,170,110,0.5)" }}
                    >
                      ✓ Loggée
                    </span>
                  </>
                ) : (
                  <button
                    className="lol-btn text-xs px-4 py-1"
                    onClick={() => handleAdd(m)}
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
  );
}
