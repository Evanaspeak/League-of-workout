"use client";
import { useState } from "react";
import Link from "next/link";

const REGIONS = ["EUW", "EUNE", "NA", "LAN", "LAS", "BR", "OCE", "KR", "JP", "TR", "RU"];
const HOURS = ["Moins de 5h", "5 à 10h", "10 à 20h", "Plus de 20h"];
const DISCOVERY = ["Discord", "Reddit", "Twitter / X", "TikTok", "Un ami", "Autre"];
const GENRES = ["Homme", "Femme", "Non-binaire", "Préfère ne pas préciser"];

const FIELD_STYLE = {
  width: "100%",
  background: "rgba(240,230,211,0.04)",
  border: "1px solid rgba(200,170,110,0.2)",
  borderRadius: 8,
  padding: "10px 14px",
  color: "#F0E6D3",
  fontSize: "0.9rem",
  outline: "none",
  boxSizing: "border-box" as const,
};

const LABEL_STYLE = {
  display: "block",
  fontSize: "0.78rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "rgba(200,170,110,0.7)",
  marginBottom: 6,
};

export default function BetaPage() {
  const [form, setForm] = useState({
    pseudo: "", email: "", riotId: "", region: "EUW", genre: "", age: "",
    poids: "", hoursPerWeek: "", currentSport: "", motivation: "", discovery: "", engagement: 0,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const isReady = form.pseudo && form.email && form.riotId && form.region && form.genre
    && form.age && form.poids && form.hoursPerWeek && form.motivation && form.discovery && form.engagement > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/beta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, age: Number(form.age), poids: Number(form.poids) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erreur"); return; }
      setSuccess(true);
    } catch {
      setError("Erreur réseau, réessaie.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: "#040810", minHeight: "100dvh", color: "#F0E6D3" }}>
      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(4,8,16,0.88)", backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(200,170,110,0.16)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ fontFamily: "var(--font-heading)", fontSize: "1rem", letterSpacing: "0.14em", color: "#C8AA6E", textDecoration: "none" }}>
            ⚔ L·O·W
          </Link>
          <Link href="/login" style={{ fontSize: "0.8rem", color: "rgba(240,230,211,0.4)", textDecoration: "none" }}>
            Déjà un compte ? Se connecter →
          </Link>
        </div>
      </nav>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "60px 24px 100px" }}>
        {/* HEADER */}
        <div style={{ marginBottom: 48, textAlign: "center" }}>
          <div style={{
            display: "inline-block", marginBottom: 20,
            padding: "4px 16px", borderRadius: 999,
            border: "1px solid rgba(11,196,227,0.3)",
            background: "rgba(11,196,227,0.06)",
            fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "#0bc4e3",
          }}>
            100 places disponibles
          </div>
          <h1 style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "clamp(1.8rem, 4vw, 2.6rem)", lineHeight: 1.15, marginBottom: 16,
          }}>
            Candidature bêta
          </h1>
          <p style={{ fontSize: "0.95rem", color: "rgba(240,230,211,0.55)", lineHeight: 1.7 }}>
            On sélectionne 100 joueurs pour tester League of Workout avant le lancement officiel.
            Remplis ce formulaire et on te contacte par email si tu es retenu.
          </p>
        </div>

        {success ? (
          <div style={{
            background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.3)",
            borderRadius: 14, padding: "40px 32px", textAlign: "center",
          }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>✓</div>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.3rem", color: "#4caf50", marginBottom: 12 }}>
              Candidature envoyée !
            </h2>
            <p style={{ color: "rgba(240,230,211,0.6)", lineHeight: 1.7 }}>
              Un email de confirmation t&apos;a été envoyé. On passe en revue toutes les candidatures
              et on te contacte si tu fais partie des 100 sélectionnés.
            </p>
            <Link href="/" style={{
              display: "inline-block", marginTop: 28, padding: "10px 24px",
              borderRadius: 8, border: "1px solid rgba(200,170,110,0.3)",
              color: "#C8AA6E", textDecoration: "none", fontSize: "0.85rem",
            }}>
              ← Retour à l&apos;accueil
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* SECTION IDENTITÉ */}
            <SectionTitle>Qui es-tu ?</SectionTitle>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={LABEL_STYLE}>Pseudo *</label>
                <input style={FIELD_STYLE} placeholder="Ton pseudo" value={form.pseudo} onChange={e => set("pseudo", e.target.value)} required />
              </div>
              <div>
                <label style={LABEL_STYLE}>Email *</label>
                <input style={FIELD_STYLE} type="email" placeholder="ton@email.com" value={form.email} onChange={e => set("email", e.target.value)} required />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={LABEL_STYLE}>Genre *</label>
                <select style={FIELD_STYLE} value={form.genre} onChange={e => set("genre", e.target.value)} required>
                  <option value="">—</option>
                  {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>Âge *</label>
                <input style={FIELD_STYLE} type="number" min={13} max={99} placeholder="25" value={form.age} onChange={e => set("age", e.target.value)} required />
              </div>
              <div>
                <label style={LABEL_STYLE}>Poids (kg) *</label>
                <input style={FIELD_STYLE} type="number" min={30} max={300} placeholder="75" value={form.poids} onChange={e => set("poids", e.target.value)} required />
              </div>
            </div>

            {/* SECTION LoL */}
            <SectionTitle>Ton profil de joueur</SectionTitle>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={LABEL_STYLE}>Riot ID *</label>
                <input style={FIELD_STYLE} placeholder="Pseudo#TAG" value={form.riotId} onChange={e => set("riotId", e.target.value)} required />
              </div>
              <div>
                <label style={LABEL_STYLE}>Région *</label>
                <select style={FIELD_STYLE} value={form.region} onChange={e => set("region", e.target.value)} required>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={LABEL_STYLE}>Heures de jeu par semaine *</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {HOURS.map(h => (
                  <button key={h} type="button" onClick={() => set("hoursPerWeek", h)} style={{
                    padding: "8px 16px", borderRadius: 6, fontSize: "0.85rem", cursor: "pointer",
                    border: form.hoursPerWeek === h ? "1px solid #C8AA6E" : "1px solid rgba(200,170,110,0.2)",
                    background: form.hoursPerWeek === h ? "rgba(200,170,110,0.12)" : "transparent",
                    color: form.hoursPerWeek === h ? "#C8AA6E" : "rgba(240,230,211,0.5)",
                  }}>
                    {h}
                  </button>
                ))}
              </div>
            </div>

            {/* SECTION SPORT */}
            <SectionTitle>Activité physique</SectionTitle>

            <div>
              <label style={LABEL_STYLE}>Sport(s) pratiqué(s) actuellement <span style={{ opacity: 0.5 }}>(optionnel)</span></label>
              <input style={FIELD_STYLE} placeholder="Ex: Course à pied, musculation, aucun..." value={form.currentSport} onChange={e => set("currentSport", e.target.value)} />
            </div>

            {/* SECTION ENGAGEMENT */}
            <SectionTitle>Ton engagement</SectionTitle>

            <div>
              <label style={LABEL_STYLE}>Motivation *</label>
              <textarea
                style={{ ...FIELD_STYLE, minHeight: 100, resize: "vertical" }}
                placeholder="Pourquoi veux-tu tester League of Workout ? Qu'est-ce qui t'a convaincu ?"
                value={form.motivation}
                onChange={e => set("motivation", e.target.value)}
                required
              />
            </div>

            <div>
              <label style={LABEL_STYLE}>Assurance d&apos;engagement * <span style={{ color: "rgba(240,230,211,0.4)", textTransform: "none", letterSpacing: 0 }}>— À quel point vas-tu vraiment le faire ?</span></label>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => set("engagement", n)} style={{
                    width: 48, height: 48, borderRadius: 8, fontSize: "1.1rem", cursor: "pointer",
                    border: form.engagement >= n ? "1px solid #C8AA6E" : "1px solid rgba(200,170,110,0.2)",
                    background: form.engagement >= n ? "rgba(200,170,110,0.15)" : "transparent",
                    color: form.engagement >= n ? "#C8AA6E" : "rgba(240,230,211,0.3)",
                    fontFamily: "var(--font-heading)",
                    fontWeight: 700,
                  }}>
                    {n}
                  </button>
                ))}
                <span style={{ alignSelf: "center", fontSize: "0.8rem", color: "rgba(240,230,211,0.4)", marginLeft: 8 }}>
                  {form.engagement === 0 ? "" : form.engagement <= 2 ? "On verra..." : form.engagement === 3 ? "Motivé" : form.engagement === 4 ? "Très motivé" : "100% engagé 🔥"}
                </span>
              </div>
            </div>

            <div>
              <label style={LABEL_STYLE}>Comment as-tu entendu parler du projet ? *</label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {DISCOVERY.map(d => (
                  <button key={d} type="button" onClick={() => set("discovery", d)} style={{
                    padding: "8px 16px", borderRadius: 6, fontSize: "0.85rem", cursor: "pointer",
                    border: form.discovery === d ? "1px solid #C8AA6E" : "1px solid rgba(200,170,110,0.2)",
                    background: form.discovery === d ? "rgba(200,170,110,0.12)" : "transparent",
                    color: form.discovery === d ? "#C8AA6E" : "rgba(240,230,211,0.5)",
                  }}>
                    {d}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div style={{
                background: "rgba(239,83,80,0.08)", border: "1px solid rgba(239,83,80,0.3)",
                borderRadius: 8, padding: "10px 16px", fontSize: "0.875rem", color: "#ef5350",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!isReady || loading}
              style={{
                padding: "14px 32px", borderRadius: 8, fontSize: "1rem",
                background: isReady ? "linear-gradient(135deg, #C8AA6E, #a8893e)" : "rgba(200,170,110,0.15)",
                color: isReady ? "#040810" : "rgba(200,170,110,0.4)",
                fontWeight: 700, cursor: isReady ? "pointer" : "not-allowed",
                border: "none", letterSpacing: "0.05em",
                boxShadow: isReady ? "0 4px 24px rgba(200,170,110,0.25)" : "none",
                transition: "all 0.2s",
                marginTop: 8,
              }}
            >
              {loading ? "Envoi en cours..." : "Envoyer ma candidature"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: "0.72rem", letterSpacing: "0.14em", textTransform: "uppercase",
      color: "#0bc4e3", paddingBottom: 8,
      borderBottom: "1px solid rgba(11,196,227,0.15)",
      marginTop: 8,
    }}>
      {children}
    </div>
  );
}
