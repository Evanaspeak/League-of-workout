"use client";
import { useEffect, useState } from "react";

type Application = {
  id: string;
  createdAt: string;
  pseudo: string;
  email: string;
  riotId: string;
  region: string;
  genre: string;
  age: number;
  poids: number;
  hoursPerWeek: string;
  sportsHoursPerWeek: number;
  currentSport: string | null;
  motivation: string;
  discovery: string;
  engagement: number;
  status: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "#C8AA6E",
  accepted: "#4caf50",
  rejected: "#ef5350",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  accepted: "Accepté",
  rejected: "Refusé",
};

function exportToCSV(apps: Application[]) {
  const headers = [
    "Pseudo", "Email", "Riot ID", "Région", "Genre", "Âge", "Poids (kg)",
    "Jeu / semaine", "Sport / semaine (h)", "Sport pratiqué",
    "Motivation", "Source", "Engagement (/5)", "Statut", "Date",
  ];
  const rows = apps.map(app => [
    app.pseudo, app.email, app.riotId, app.region, app.genre,
    app.age, app.poids, app.hoursPerWeek, app.sportsHoursPerWeek,
    app.currentSport ?? "",
    app.motivation,
    app.discovery, app.engagement,
    STATUS_LABELS[app.status] ?? app.status,
    new Date(app.createdAt).toLocaleDateString("fr-FR"),
  ]);
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(row => row.map(escape).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `candidatures-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminBetaApplications() {
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/beta")
      .then(r => r.json())
      .then(d => { if (d.applications) setApps(d.applications); })
      .finally(() => setLoading(false));
  }, []);

  async function updateStatus(id: string, status: string) {
    setUpdating(id);
    await fetch(`/api/admin/beta/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setApps(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    setUpdating(null);
  }

  const q = search.trim().toLowerCase();
  const filtered = apps
    .filter(a => filter === "all" || a.status === filter)
    .filter(a =>
      !q ||
      a.pseudo.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q)
    );

  const counts = {
    all: apps.length,
    pending: apps.filter(a => a.status === "pending").length,
    accepted: apps.filter(a => a.status === "accepted").length,
    rejected: apps.filter(a => a.status === "rejected").length,
  };

  if (loading) return <div style={{ color: "rgba(240,230,211,0.4)", padding: 16 }}>Chargement...</div>;

  return (
    <div className="lol-panel p-4" style={{ marginTop: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", color: "#C8AA6E", letterSpacing: "0.1em" }}>
          CANDIDATURES BÊTA
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "0.8rem", color: "rgba(240,230,211,0.4)" }}>
            {counts.accepted}/100 acceptés
          </span>
          <button
            onClick={() => exportToCSV(apps)}
            title="Exporter toutes les candidatures en CSV (Excel)"
            style={{
              padding: "5px 14px", borderRadius: 6, fontSize: "0.78rem", cursor: "pointer",
              border: "1px solid rgba(200,170,110,0.3)",
              background: "rgba(200,170,110,0.07)",
              color: "#C8AA6E",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            ⬇ Export Excel
          </button>
        </div>
      </div>

      {/* Recherche */}
      <div style={{ marginBottom: 14 }}>
        <input
          type="text"
          placeholder="Rechercher par pseudo ou email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(200,170,110,0.2)",
            borderRadius: 6,
            color: "#F0E6D3",
            fontSize: "0.85rem",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Filtres statut */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {(["all", "pending", "accepted", "rejected"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "5px 14px", borderRadius: 6, fontSize: "0.78rem", cursor: "pointer",
            border: filter === f ? "1px solid #C8AA6E" : "1px solid rgba(200,170,110,0.2)",
            background: filter === f ? "rgba(200,170,110,0.1)" : "transparent",
            color: filter === f ? "#C8AA6E" : "rgba(240,230,211,0.4)",
          }}>
            {f === "all" ? "Tous" : STATUS_LABELS[f]} ({counts[f]})
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ color: "rgba(240,230,211,0.35)", fontSize: "0.875rem", padding: "20px 0" }}>
          {q ? `Aucun résultat pour "${search}".` : `Aucune candidature${filter !== "all" ? " dans cette catégorie" : ""}.`}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(app => (
          <div key={app.id} style={{
            border: "1px solid rgba(200,170,110,0.12)",
            borderRadius: 10, overflow: "hidden",
          }}>
            {/* Row */}
            <div
              onClick={() => setExpanded(expanded === app.id ? null : app.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", cursor: "pointer",
                background: expanded === app.id ? "rgba(200,170,110,0.04)" : "transparent",
              }}
            >
              <div style={{ flexShrink: 0 }}>
                <div style={{ fontSize: "0.9rem", color: "#F0E6D3", fontWeight: 600 }}>{app.pseudo}</div>
                <div style={{ fontSize: "0.75rem", color: "rgba(240,230,211,0.4)" }}>{app.riotId} · {app.region}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.78rem", color: "rgba(240,230,211,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {app.email}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                <EngagementDots value={app.engagement} />
                <span style={{
                  padding: "2px 10px", borderRadius: 999, fontSize: "0.72rem",
                  border: `1px solid ${STATUS_COLORS[app.status]}33`,
                  background: `${STATUS_COLORS[app.status]}11`,
                  color: STATUS_COLORS[app.status],
                }}>
                  {STATUS_LABELS[app.status]}
                </span>
                <span style={{ fontSize: "0.7rem", color: "rgba(240,230,211,0.25)" }}>
                  {new Date(app.createdAt).toLocaleDateString("fr-FR")}
                </span>
              </div>
            </div>

            {/* Expanded detail */}
            {expanded === app.id && (
              <div style={{
                padding: "16px 20px 20px",
                borderTop: "1px solid rgba(200,170,110,0.1)",
                background: "rgba(4,8,16,0.4)",
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
                  <Info label="Genre" value={app.genre} />
                  <Info label="Âge" value={`${app.age} ans`} />
                  <Info label="Poids" value={`${app.poids} kg`} />
                  <Info label="Jeu / semaine" value={app.hoursPerWeek} />
                  <Info label="Sport / semaine" value={`${app.sportsHoursPerWeek}h`} />
                  <Info label="Sport actuel" value={app.currentSport || "Aucun"} />
                  <Info label="Source" value={app.discovery} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,170,110,0.5)", marginBottom: 6 }}>Motivation</div>
                  <p style={{ fontSize: "0.875rem", color: "rgba(240,230,211,0.7)", lineHeight: 1.6 }}>{app.motivation}</p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  {app.status !== "accepted" && (
                    <button
                      onClick={() => updateStatus(app.id, "accepted")}
                      disabled={updating === app.id}
                      style={{
                        padding: "7px 18px", borderRadius: 6, fontSize: "0.82rem", cursor: "pointer",
                        background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.4)",
                        color: "#4caf50", fontWeight: 600,
                      }}
                    >
                      {updating === app.id ? "..." : "✓ Accepter"}
                    </button>
                  )}
                  {app.status !== "rejected" && (
                    <button
                      onClick={() => updateStatus(app.id, "rejected")}
                      disabled={updating === app.id}
                      style={{
                        padding: "7px 18px", borderRadius: 6, fontSize: "0.82rem", cursor: "pointer",
                        background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.3)",
                        color: "#ef5350", fontWeight: 600,
                      }}
                    >
                      {updating === app.id ? "..." : "✕ Refuser"}
                    </button>
                  )}
                  {app.status !== "pending" && (
                    <button
                      onClick={() => updateStatus(app.id, "pending")}
                      disabled={updating === app.id}
                      style={{
                        padding: "7px 18px", borderRadius: 6, fontSize: "0.82rem", cursor: "pointer",
                        background: "transparent", border: "1px solid rgba(200,170,110,0.2)",
                        color: "rgba(240,230,211,0.4)",
                      }}
                    >
                      Remettre en attente
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,170,110,0.45)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "0.85rem", color: "rgba(240,230,211,0.75)" }}>{value}</div>
    </div>
  );
}

function EngagementDots({ value }: { value: number }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <div key={n} style={{
          width: 6, height: 6, borderRadius: "50%",
          background: n <= value ? "#C8AA6E" : "rgba(200,170,110,0.15)",
        }} />
      ))}
    </div>
  );
}
