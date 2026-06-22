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
  niveauCalcule: number;
  scoreCalcule: number;
  malusCalcule: number;
  surchargeCalculee: number;
  pompesCalculees: number;
  source: string;
};

const ROLES = ["Tous", "Top", "Jungle", "Mid", "ADC", "Support", "ARAM", "Arena"];

export default function HistoryPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState("Tous");
  const [filterResult, setFilterResult] = useState("Tous");
  const [sortBy, setSortBy] = useState<"date" | "pompes">("date");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/games").then((r) => r.json()).then((data) => { setGames(data); setLoading(false); });
  }, []);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/games/${id}`, { method: "DELETE" });
    setGames((prev) => prev.filter((g) => g.id !== id));
    setDeletingId(null);
  };

  const filtered = games
    .filter((g) => filterRole === "Tous" || g.role === filterRole)
    .filter((g) => filterResult === "Tous" || g.result === filterResult)
    .sort((a, b) => sortBy === "date"
      ? new Date(b.date).getTime() - new Date(a.date).getTime()
      : b.pompesCalculees - a.pompesCalculees
    );

  const totalPompes = filtered.reduce((s, g) => s + g.pompesCalculees, 0);

  if (loading) return <div className="text-center py-20 gold-text">Chargement...</div>;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold gold-text tracking-widest">HISTORIQUE</h1>

      {/* Filtres */}
      <div className="lol-panel p-3 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "rgba(200,170,110,0.6)" }}>Rôle</span>
          <select className="lol-select text-sm" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
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
        <div className="space-y-2">
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
        </div>
      )}
    </div>
  );
}
