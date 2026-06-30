"use client";
import { useEffect, useState } from "react";

type UserStat = {
  id: string;
  email: string | null;
  pseudo: string;
  betaRank: number | null;
  riotId: string | null;
  riotRegion: string;
  gainageMaxSec: number;
  createdAt: string;
  totalGames: number;
  totalPompes: number;
  avgPompes: number;
  winrate: number;
  lastGame: string | null;
  gamesThisWeek: number;
  gamesThisMonth: number;
  lastLevel: number | null;
  niveauActuel: number | null;
  multiplicateur: number | null;
  malusDefaite: number | null;
};

function daysSince(date: string | null) {
  if (!date) return null;
  const diff = Date.now() - new Date(date).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "aujourd'hui";
  if (days === 1) return "hier";
  return `il y a ${days}j`;
}

function ActivityDot({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? value / max : 0;
  const color = ratio === 0 ? "rgba(200,170,110,0.1)" : ratio < 0.3 ? "#ef5350" : ratio < 0.7 ? "#C8AA6E" : "#4caf50";
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: color, flexShrink: 0,
    }} />
  );
}

export default function AdminUserList() {
  const [users, setUsers] = useState<UserStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then(r => r.json())
      .then(d => { if (d.users) setUsers(d.users); })
      .finally(() => setLoading(false));
  }, []);

  const maxWeekly = Math.max(...users.map(u => u.gamesThisWeek), 1);

  const filtered = users.filter(u =>
    search === "" ||
    u.pseudo.toLowerCase().includes(search.toLowerCase()) ||
    (u.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  async function deleteUser(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== id));
      setExpanded(null);
    }
    setDeleting(null);
    setConfirmDelete(null);
  }

  if (loading) return <div style={{ color: "rgba(240,230,211,0.4)", padding: 16 }}>Chargement...</div>;

  return (
    <div className="lol-panel p-4" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", color: "#C8AA6E", letterSpacing: "0.1em" }}>
          BÊTA-TESTEURS ({users.length})
        </h2>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher par pseudo ou email…"
        style={{
          width: "100%", marginBottom: 16, padding: "8px 12px", borderRadius: 6,
          background: "rgba(240,230,211,0.04)", border: "1px solid rgba(200,170,110,0.2)",
          color: "#F0E6D3", fontSize: "0.85rem", outline: "none", boxSizing: "border-box",
        }}
      />

      {filtered.length === 0 && (
        <p style={{ color: "rgba(240,230,211,0.3)", fontSize: "0.85rem", padding: "12px 0" }}>Aucun résultat.</p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map(u => (
          <div key={u.id} style={{ border: "1px solid rgba(200,170,110,0.12)", borderRadius: 8, overflow: "hidden" }}>
            {/* Row */}
            <div
              onClick={() => setExpanded(expanded === u.id ? null : u.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                cursor: "pointer", background: expanded === u.id ? "rgba(200,170,110,0.04)" : "transparent",
              }}
            >
              <ActivityDot value={u.gamesThisWeek} max={maxWeekly} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.88rem", color: "#F0E6D3", fontWeight: 600 }}>{u.pseudo}</div>
                <div style={{ fontSize: "0.72rem", color: "rgba(240,230,211,0.4)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {u.email}
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0, fontSize: "0.78rem" }}>
                <span style={{ color: "#0bc4e3" }}>{u.totalGames} parties</span>
                <span style={{ color: "#C8AA6E" }}>{u.totalPompes} pompes</span>
                <span style={{ color: "rgba(240,230,211,0.3)" }}>
                  {u.gamesThisWeek > 0 ? `${u.gamesThisWeek}/sem` : "inactif"}
                </span>
              </div>
            </div>

            {/* Expanded */}
            {expanded === u.id && (
              <div style={{
                padding: "14px 18px 18px",
                borderTop: "1px solid rgba(200,170,110,0.1)",
                background: "rgba(4,8,16,0.4)",
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 14 }}>
                  <Stat label="Total parties" value={String(u.totalGames)} />
                  <Stat label="Total pompes" value={String(u.totalPompes)} />
                  <Stat label="Moy. pompes/partie" value={u.totalGames > 0 ? String(u.avgPompes) : "—"} />
                  <Stat label="Winrate" value={u.totalGames > 0 ? `${u.winrate}%` : "—"} />
                  <Stat label="Parties (7j)" value={String(u.gamesThisWeek)} />
                  <Stat label="Parties (30j)" value={String(u.gamesThisMonth)} />
                  <Stat label="Dernière partie" value={daysSince(u.lastGame) ?? "jamais"} />
                  <Stat label="Dernier niveau" value={u.lastLevel ? `Niv. ${u.lastLevel}` : "—"} />
                </div>
                <div style={{ borderTop: "1px solid rgba(200,170,110,0.08)", paddingTop: 12, marginBottom: 14 }}>
                  <p style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,170,110,0.4)", marginBottom: 8 }}>
                    Coefficients personnels
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                    <Stat label="Gainage max (s)" value={`${u.gainageMaxSec}s`} />
                    <Stat label="Niveau actuel" value={u.niveauActuel ? `Niv. ${u.niveauActuel}` : "—"} />
                    <Stat label="Multiplicateur" value={u.multiplicateur != null ? `×${u.multiplicateur}` : "—"} />
                    <Stat label="Malus défaite" value={u.malusDefaite != null ? `${u.malusDefaite} pompes` : "—"} />
                    <Stat label="Riot ID" value={u.riotId ?? "non renseigné"} />
                    <Stat label="Région" value={u.riotRegion} />
                    <Stat label="Inscrit le" value={new Date(u.createdAt).toLocaleDateString("fr-FR")} />
                  </div>
                </div>

                {/* Delete zone */}
                <div style={{ borderTop: "1px solid rgba(239,83,80,0.15)", paddingTop: 12 }}>
                  {confirmDelete === u.id ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: "0.78rem", color: "#ef5350" }}>
                        Supprimer définitivement ce compte et toutes ses données ?
                      </span>
                      <button
                        onClick={() => deleteUser(u.id)}
                        disabled={deleting === u.id}
                        style={{
                          padding: "5px 12px", borderRadius: 5, fontSize: "0.78rem", cursor: "pointer",
                          background: "rgba(239,83,80,0.15)", border: "1px solid rgba(239,83,80,0.5)",
                          color: "#ef5350", fontWeight: 600,
                        }}
                      >
                        {deleting === u.id ? "..." : "Confirmer"}
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        style={{
                          padding: "5px 10px", borderRadius: 5, fontSize: "0.78rem", cursor: "pointer",
                          background: "transparent", border: "1px solid rgba(240,230,211,0.15)",
                          color: "rgba(240,230,211,0.5)",
                        }}
                      >
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDelete(u.id); }}
                      style={{
                        padding: "5px 12px", borderRadius: 5, fontSize: "0.75rem", cursor: "pointer",
                        background: "transparent", border: "1px dashed rgba(239,83,80,0.3)",
                        color: "rgba(239,83,80,0.6)",
                      }}
                    >
                      Supprimer ce compte
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.67rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,170,110,0.4)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "0.88rem", color: "rgba(240,230,211,0.8)" }}>{value}</div>
    </div>
  );
}
