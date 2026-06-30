"use client";
import { useEffect, useState } from "react";

type RoleWeight = {
  role: string;
  poidsMort: number;
  poidsKill: number;
  poidsAssist: number;
  maitriseActive: boolean;
};

type LevelConfig = {
  niveau: number;
  seuilGainageSec: number;
  multiplicateur: number;
  malusDefaite: number;
};

type MasteryConfig = {
  surchargeMax: number;
  partiesPourMax: number;
};

export default function AdminCoefficients() {
  const [roles, setRoles] = useState<RoleWeight[]>([]);
  const [levels, setLevels] = useState<LevelConfig[]>([]);
  const [mastery, setMastery] = useState<MasteryConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/config/scoring")
      .then(r => r.json())
      .then(d => {
        if (d.roles) setRoles(d.roles);
        if (d.levels) setLevels(d.levels);
        if (d.mastery) setMastery(d.mastery);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "rgba(240,230,211,0.4)", padding: 16 }}>Chargement...</div>;

  return (
    <div className="lol-panel p-4" style={{ marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", color: "#C8AA6E", letterSpacing: "0.1em" }}>
          COEFFICIENTS DE SCORING
        </h2>
        <span style={{ fontSize: "0.72rem", color: "rgba(240,230,211,0.3)", letterSpacing: "0.08em" }}>
          LECTURE SEULE
        </span>
      </div>

      {/* Niveaux */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,170,110,0.45)", marginBottom: 10 }}>
          Niveaux (gainage)
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ color: "rgba(200,170,110,0.5)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                <th style={thStyle}>Niveau</th>
                <th style={thStyle}>Seuil gainage (s)</th>
                <th style={thStyle}>Multiplicateur</th>
                <th style={thStyle}>Malus défaite</th>
              </tr>
            </thead>
            <tbody>
              {levels.map(l => (
                <tr key={l.niveau} style={{ borderTop: "1px solid rgba(200,170,110,0.07)" }}>
                  <td style={tdStyle}>
                    <span style={{ color: "#C8AA6E", fontWeight: 600 }}>Niv. {l.niveau}</span>
                  </td>
                  <td style={tdStyle}>{l.seuilGainageSec}s</td>
                  <td style={tdStyle}>×{l.multiplicateur}</td>
                  <td style={tdStyle}>{l.malusDefaite} pompes</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Maîtrise */}
      {mastery && (
        <div style={{ marginBottom: 20, borderTop: "1px solid rgba(200,170,110,0.08)", paddingTop: 16 }}>
          <p style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,170,110,0.45)", marginBottom: 10 }}>
            Maîtrise du champion
          </p>
          <div style={{ display: "flex", gap: 24 }}>
            <div>
              <div style={{ fontSize: "0.67rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,170,110,0.4)", marginBottom: 2 }}>
                Surcharge max
              </div>
              <div style={{ fontSize: "0.95rem", color: "rgba(240,230,211,0.85)" }}>+{Math.round(mastery.surchargeMax * 100)}%</div>
            </div>
            <div>
              <div style={{ fontSize: "0.67rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,170,110,0.4)", marginBottom: 2 }}>
                Parties pour le max
              </div>
              <div style={{ fontSize: "0.95rem", color: "rgba(240,230,211,0.85)" }}>{mastery.partiesPourMax} parties</div>
            </div>
          </div>
        </div>
      )}

      {/* Poids par rôle */}
      <div style={{ borderTop: "1px solid rgba(200,170,110,0.08)", paddingTop: 16 }}>
        <p style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(200,170,110,0.45)", marginBottom: 10 }}>
          Poids KDA par rôle
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
            <thead>
              <tr style={{ color: "rgba(200,170,110,0.5)", fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                <th style={thStyle}>Rôle</th>
                <th style={thStyle}>Mort</th>
                <th style={thStyle}>Kill</th>
                <th style={thStyle}>Assist</th>
                <th style={thStyle}>Maîtrise</th>
              </tr>
            </thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.role} style={{ borderTop: "1px solid rgba(200,170,110,0.07)" }}>
                  <td style={tdStyle}>
                    <span style={{ color: "#F0E6D3", fontWeight: 600 }}>{r.role}</span>
                  </td>
                  <td style={tdStyle}>{r.poidsMort}</td>
                  <td style={tdStyle}>{r.poidsKill}</td>
                  <td style={tdStyle}>{r.poidsAssist}</td>
                  <td style={tdStyle}>
                    <span style={{ color: r.maitriseActive ? "#4caf50" : "rgba(240,230,211,0.3)" }}>
                      {r.maitriseActive ? "oui" : "non"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "4px 8px 8px 0",
  fontWeight: 500,
};

const tdStyle: React.CSSProperties = {
  padding: "7px 8px 7px 0",
  color: "rgba(240,230,211,0.7)",
};
