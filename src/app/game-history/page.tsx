"use client";
import { useEffect, useState } from "react";

type Game = {
  id: string;
  date: string;
  role: string;
  champion: string | null;
  kills: number;
  deaths: number;
  assists: number;
  result: string;
  pompesCalculees: number;
  source: string;
};

export default function GameHistoryPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then((data: Game[]) => {
        setGames(data.slice(0, 20));
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="text-center py-20 gold-text">Chargement...</div>;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold gold-text tracking-widest">HISTORIQUE DE PARTIES</h1>
      <p className="text-sm" style={{ color: "rgba(240,230,211,0.4)" }}>20 dernières parties enregistrées</p>

      {games.length === 0 ? (
        <div className="lol-panel p-8 text-center">
          <p style={{ color: "rgba(240,230,211,0.5)" }}>Aucune game à afficher.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {games.map((g, i) => (
            <div
              key={g.id}
              className="lol-panel px-4 py-3 flex items-center gap-4"
              style={{ background: "var(--lol-dark-light)" }}
            >
              <span className="text-xs w-5 text-center" style={{ color: "rgba(200,170,110,0.4)" }}>
                {i + 1}
              </span>

              <span
                className="font-bold text-sm w-16 text-center rounded px-2 py-0.5"
                style={{
                  background: g.result === "V" ? "rgba(70,180,100,0.15)" : "rgba(200,70,70,0.15)",
                  color: g.result === "V" ? "#4eb86e" : "#e05555",
                }}
              >
                {g.result === "V" ? "Victoire" : "Défaite"}
              </span>

              <span className="gold-text font-semibold text-sm w-16">{g.role}</span>

              <span className="text-sm flex-1" style={{ color: "rgba(240,230,211,0.85)" }}>
                {g.champion ?? <span style={{ color: "rgba(240,230,211,0.3)" }}>—</span>}
              </span>

              <span className="text-sm font-mono" style={{ color: "rgba(240,230,211,0.7)" }}>
                {g.kills} / <span style={{ color: "#e05555" }}>{g.deaths}</span> / {g.assists}
              </span>

              <span className="text-sm gold-text font-bold w-20 text-right">
                {g.pompesCalculees} pompes
              </span>

              <span className="text-xs w-20 text-right" style={{ color: "rgba(240,230,211,0.35)" }}>
                {new Date(g.date).toLocaleDateString("fr-FR")}
              </span>

              {g.source === "riot_api" && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(80,150,220,0.15)", color: "rgba(80,150,220,0.8)" }}>
                  Riot
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
