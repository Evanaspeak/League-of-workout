"use client";
import { useEffect, useState } from "react";
import { useT, useDateLocale } from "@/lib/i18n/LocaleContext";
import { adminBetaApplications } from "@/lib/i18n/dictionaries/adminBetaApplications";

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
  pending: "#ECEFF4",
  accepted: "#2FD98A",
  rejected: "#FF5A47",
};

function exportToCSV(apps: Application[], t: ReturnType<typeof useT<typeof adminBetaApplications>>, statusLabels: Record<string, string>, dateLocale: string) {
  const headers = t.csvHeaders;
  const rows = apps.map(app => [
    app.pseudo, app.email, app.riotId, app.region, app.genre,
    app.age, app.poids, app.hoursPerWeek, app.sportsHoursPerWeek,
    app.currentSport ?? "",
    app.motivation,
    app.discovery, app.engagement,
    statusLabels[app.status] ?? app.status,
    new Date(app.createdAt).toLocaleDateString(dateLocale),
  ]);
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const csv = [headers, ...rows].map(row => row.map(escape).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${t.csvFilenamePrefix}-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function AdminBetaApplications() {
  const t = useT(adminBetaApplications);
  const dateLocale = useDateLocale();
  const STATUS_LABELS: Record<string, string> = {
    pending: t.statusPending,
    accepted: t.statusAccepted,
    rejected: t.statusRejected,
  };
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "accepted" | "rejected">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/beta")
      .then(r => r.json())
      .then(d => { if (d.applications) setApps(d.applications); })
      .finally(() => setLoading(false));
  }, []);

  async function deleteApplication(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/admin/beta/${id}`, { method: "DELETE" });
    if (res.ok) { setApps(prev => prev.filter(a => a.id !== id)); setExpanded(null); }
    setDeleting(null);
    setConfirmDelete(null);
  }

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

  if (loading) return <div style={{ color: "rgba(236,239,244,0.4)", padding: 16 }}>{t.loading}</div>;

  return (
    <div className="lol-panel p-4" style={{ marginTop: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", color: "#ECEFF4", letterSpacing: "0.1em" }}>
          {t.title}
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "0.8rem", color: "rgba(236,239,244,0.4)" }}>
            {t.acceptedOutOf(counts.accepted)}
          </span>
          <button
            onClick={() => exportToCSV(apps, t, STATUS_LABELS, dateLocale)}
            title={t.exportTitle}
            style={{
              padding: "5px 14px", borderRadius: 6, fontSize: "0.78rem", cursor: "pointer",
              border: "1px solid rgba(152,162,176,0.3)",
              background: "rgba(152,162,176,0.07)",
              color: "#ECEFF4",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            {t.exportButton}
          </button>
        </div>
      </div>

      {/* Recherche */}
      <div style={{ marginBottom: 14 }}>
        <input
          type="text"
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(152,162,176,0.2)",
            borderRadius: 6,
            color: "#ECEFF4",
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
            border: filter === f ? "1px solid #ECEFF4" : "1px solid rgba(152,162,176,0.2)",
            background: filter === f ? "rgba(152,162,176,0.1)" : "transparent",
            color: filter === f ? "#ECEFF4" : "rgba(236,239,244,0.4)",
          }}>
            {f === "all" ? t.filterAll : STATUS_LABELS[f]} ({counts[f]})
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ color: "rgba(236,239,244,0.35)", fontSize: "0.875rem", padding: "20px 0" }}>
          {q ? t.noResultsFor(search) : t.noApplications(filter !== "all")}
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(app => (
          <div key={app.id} style={{
            border: "1px solid rgba(152,162,176,0.12)",
            borderRadius: 10, overflow: "hidden",
          }}>
            {/* Row */}
            <div
              onClick={() => setExpanded(expanded === app.id ? null : app.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px", cursor: "pointer",
                background: expanded === app.id ? "rgba(152,162,176,0.04)" : "transparent",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.9rem", color: "#ECEFF4", fontWeight: 600 }}>{app.pseudo}</div>
                <div style={{ fontSize: "0.78rem", color: "rgba(236,239,244,0.5)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {app.email}
                </div>
                <div style={{ fontSize: "0.75rem", color: "rgba(236,239,244,0.4)" }}>{app.riotId} · {app.region}</div>
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
                <span style={{ fontSize: "0.7rem", color: "rgba(236,239,244,0.25)" }}>
                  {new Date(app.createdAt).toLocaleDateString(dateLocale)}
                </span>
              </div>
            </div>

            {/* Expanded detail */}
            {expanded === app.id && (
              <div style={{
                padding: "16px 20px 20px",
                borderTop: "1px solid rgba(152,162,176,0.1)",
                background: "rgba(12,14,17,0.4)",
              }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 16 }}>
                  <Info label={t.genre} value={app.genre} />
                  <Info label={t.age} value={t.ageSuffix(app.age)} />
                  <Info label={t.weight} value={`${app.poids} kg`} />
                  <Info label={t.gamePerWeek} value={app.hoursPerWeek} />
                  <Info label={t.sportPerWeek} value={`${app.sportsHoursPerWeek}h`} />
                  <Info label={t.currentSport} value={app.currentSport || t.none} />
                  <Info label={t.source} value={app.discovery} />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(152,162,176,0.5)", marginBottom: 6 }}>{t.motivation}</div>
                  <p style={{ fontSize: "0.875rem", color: "rgba(236,239,244,0.7)", lineHeight: 1.6 }}>{app.motivation}</p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  {app.status !== "accepted" && (
                    <button
                      onClick={() => updateStatus(app.id, "accepted")}
                      disabled={updating === app.id}
                      style={{
                        padding: "7px 18px", borderRadius: 6, fontSize: "0.82rem", cursor: "pointer",
                        background: "rgba(47,217,138,0.1)", border: "1px solid rgba(47,217,138,0.4)",
                        color: "#2FD98A", fontWeight: 600,
                      }}
                    >
                      {updating === app.id ? "..." : t.accept}
                    </button>
                  )}
                  {app.status !== "rejected" && (
                    <button
                      onClick={() => updateStatus(app.id, "rejected")}
                      disabled={updating === app.id}
                      style={{
                        padding: "7px 18px", borderRadius: 6, fontSize: "0.82rem", cursor: "pointer",
                        background: "rgba(255,90,71,0.08)", border: "1px solid rgba(255,90,71,0.3)",
                        color: "#FF5A47", fontWeight: 600,
                      }}
                    >
                      {updating === app.id ? "..." : t.reject}
                    </button>
                  )}
                  {app.status !== "pending" && (
                    <button
                      onClick={() => updateStatus(app.id, "pending")}
                      disabled={updating === app.id}
                      style={{
                        padding: "7px 18px", borderRadius: 6, fontSize: "0.82rem", cursor: "pointer",
                        background: "transparent", border: "1px solid rgba(152,162,176,0.2)",
                        color: "rgba(236,239,244,0.4)",
                      }}
                    >
                      {t.backToPending}
                    </button>
                  )}
                  <div style={{ marginLeft: "auto" }}>
                    {confirmDelete === app.id ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: "0.75rem", color: "#FF5A47" }}>{t.deleteConfirm}</span>
                        <button
                          onClick={() => deleteApplication(app.id)}
                          disabled={deleting === app.id}
                          style={{ padding: "4px 10px", borderRadius: 5, fontSize: "0.75rem", cursor: "pointer", background: "rgba(255,90,71,0.15)", border: "1px solid rgba(255,90,71,0.5)", color: "#FF5A47", fontWeight: 600 }}
                        >
                          {deleting === app.id ? "..." : t.confirm}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          style={{ padding: "4px 8px", borderRadius: 5, fontSize: "0.75rem", cursor: "pointer", background: "transparent", border: "1px solid rgba(236,239,244,0.15)", color: "rgba(236,239,244,0.4)" }}
                        >
                          {t.cancel}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(app.id)}
                        style={{ padding: "4px 10px", borderRadius: 5, fontSize: "0.75rem", cursor: "pointer", background: "transparent", border: "1px dashed rgba(255,90,71,0.3)", color: "rgba(255,90,71,0.5)" }}
                      >
                        {t.delete}
                      </button>
                    )}
                  </div>
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
      <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(152,162,176,0.45)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: "0.85rem", color: "rgba(236,239,244,0.75)" }}>{value}</div>
    </div>
  );
}

function EngagementDots({ value }: { value: number }) {
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <div key={n} style={{
          width: 6, height: 6, borderRadius: "50%",
          background: n <= value ? "#ECEFF4" : "rgba(152,162,176,0.15)",
        }} />
      ))}
    </div>
  );
}
