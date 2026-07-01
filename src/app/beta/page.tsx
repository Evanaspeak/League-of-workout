"use client";
import { useState } from "react";
import Link from "next/link";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { translateApiError } from "@/lib/i18n/apiErrors";
import { beta } from "@/lib/i18n/dictionaries/beta";

function sportLabel(h: number, t: ReturnType<typeof useT<typeof beta>>) {
  if (h === 0) return t.sportSedentary;
  if (h <= 2) return t.sportLowActive;
  if (h <= 5) return t.sportActive;
  if (h <= 10) return t.sportAthletic;
  if (h <= 15) return t.sportVeryAthletic;
  return t.sportAthlete;
}

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
  colorScheme: "dark" as const,
};

// Style explicite des <option> : certains navigateurs rendent la liste native
// en blanc et héritent de la couleur claire du select → texte illisible.
const OPTION_STYLE = { background: "#0a0e1a", color: "#F0E6D3" };

const LABEL_STYLE = {
  display: "block",
  fontSize: "0.78rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "rgba(200,170,110,0.7)",
  marginBottom: 6,
};

export default function BetaPage() {
  const t = useT(beta);
  const { locale } = useLocale();
  const REGIONS = t.regions;
  const HOURS = t.hours;
  const DISCOVERY = t.discovery;
  const GENRES = t.genres;
  const [form, setForm] = useState({
    pseudo: "", email: "", riotId: "", region: "EUW", genre: "", age: "",
    poids: "", hoursPerWeek: "", currentSport: "", sportsHoursPerWeek: 0, motivation: "", discovery: "", engagement: 0,
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
        body: JSON.stringify({ ...form, age: Number(form.age), poids: Number(form.poids), sportsHoursPerWeek: Number(form.sportsHoursPerWeek) }),
      });
      const data = await res.json();
      if (!res.ok) { setError(translateApiError(data.error, locale) || t.genericError); return; }
      setSuccess(true);
    } catch {
      setError(t.networkError);
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
            {t.alreadyAccount}
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
            {t.spotsAvailable}
          </div>
          <h1 style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "clamp(1.8rem, 4vw, 2.6rem)", lineHeight: 1.15, marginBottom: 16,
          }}>
            {t.heading}
          </h1>
          <p style={{ fontSize: "0.95rem", color: "rgba(240,230,211,0.55)", lineHeight: 1.7 }}>
            {t.intro}
          </p>
        </div>

        {success ? (
          <div style={{
            background: "rgba(76,175,80,0.08)", border: "1px solid rgba(76,175,80,0.3)",
            borderRadius: 14, padding: "40px 32px", textAlign: "center",
          }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>✓</div>
            <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.3rem", color: "#4caf50", marginBottom: 12 }}>
              {t.successTitle}
            </h2>
            <p style={{ color: "rgba(240,230,211,0.6)", lineHeight: 1.7 }}>
              {t.successBody}
            </p>
            <Link href="/" style={{
              display: "inline-block", marginTop: 28, padding: "10px 24px",
              borderRadius: 8, border: "1px solid rgba(200,170,110,0.3)",
              color: "#C8AA6E", textDecoration: "none", fontSize: "0.85rem",
            }}>
              {t.backHome}
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* SECTION IDENTITÉ */}
            <SectionTitle>{t.sectionIdentity}</SectionTitle>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={LABEL_STYLE}>{t.pseudoLabel}</label>
                <input style={FIELD_STYLE} placeholder={t.pseudoPlaceholder} value={form.pseudo} onChange={e => set("pseudo", e.target.value)} required />
              </div>
              <div>
                <label style={LABEL_STYLE}>{t.emailLabel}</label>
                <input style={FIELD_STYLE} type="email" placeholder="ton@email.com" value={form.email} onChange={e => set("email", e.target.value)} required />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={LABEL_STYLE}>{t.genreLabel}</label>
                <select style={FIELD_STYLE} value={form.genre} onChange={e => set("genre", e.target.value)} required>
                  <option value="" style={OPTION_STYLE}>—</option>
                  {GENRES.map(g => <option key={g} value={g} style={OPTION_STYLE}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL_STYLE}>{t.ageLabel}</label>
                <input style={FIELD_STYLE} type="number" min={13} max={99} placeholder="25" value={form.age} onChange={e => set("age", e.target.value)} required />
              </div>
              <div>
                <label style={LABEL_STYLE}>{t.weightLabel}</label>
                <input style={FIELD_STYLE} type="number" min={30} max={300} placeholder="75" value={form.poids} onChange={e => set("poids", e.target.value)} required />
              </div>
            </div>

            {/* SECTION LoL */}
            <SectionTitle>{t.sectionPlayerProfile}</SectionTitle>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={LABEL_STYLE}>{t.riotIdLabel}</label>
                <input style={FIELD_STYLE} placeholder={t.riotIdPlaceholder} value={form.riotId} onChange={e => set("riotId", e.target.value)} required />
              </div>
              <div>
                <label style={LABEL_STYLE}>{t.regionLabel}</label>
                <select style={FIELD_STYLE} value={form.region} onChange={e => set("region", e.target.value)} required>
                  {REGIONS.map(r => <option key={r} value={r} style={OPTION_STYLE}>{r}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={LABEL_STYLE}>{t.hoursPerWeekLabel}</label>
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
            <SectionTitle>{t.sectionPhysicalActivity}</SectionTitle>

            <div>
              <label style={LABEL_STYLE}>
                {t.sportHoursLabel}
                <span style={{ float: "right", color: "#C8AA6E", fontFamily: "var(--font-heading)", letterSpacing: 0, textTransform: "none", fontSize: "0.85rem" }}>
                  {t.sportHoursHint(form.sportsHoursPerWeek, sportLabel(form.sportsHoursPerWeek, t))}
                </span>
              </label>
              <input
                type="range" min={0} max={20} step={1}
                value={form.sportsHoursPerWeek}
                onChange={e => set("sportsHoursPerWeek", Number(e.target.value))}
                style={{ width: "100%", accentColor: "#C8AA6E", cursor: "pointer", height: 20 }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "rgba(240,230,211,0.3)", marginTop: 4 }}>
                <span>{t.sportRangeMin}</span>
                <span>{t.sportRangeMid}</span>
                <span>{t.sportRangeMax}</span>
              </div>
            </div>

            <div>
              <label style={LABEL_STYLE}>{t.currentSportLabel} <span style={{ opacity: 0.5 }}>{t.optional}</span></label>
              <input style={FIELD_STYLE} placeholder={t.currentSportPlaceholder} value={form.currentSport} onChange={e => set("currentSport", e.target.value)} />
            </div>

            {/* SECTION ENGAGEMENT */}
            <SectionTitle>{t.sectionEngagement}</SectionTitle>

            <div>
              <label style={LABEL_STYLE}>{t.motivationLabel}</label>
              <textarea
                style={{ ...FIELD_STYLE, minHeight: 100, resize: "vertical" }}
                placeholder={t.motivationPlaceholder}
                value={form.motivation}
                onChange={e => set("motivation", e.target.value)}
                required
              />
            </div>

            <div>
              <label style={LABEL_STYLE}>{t.engagementLabel} <span style={{ color: "rgba(240,230,211,0.4)", textTransform: "none", letterSpacing: 0 }}>{t.engagementSublabel}</span></label>
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
                  {form.engagement === 0 ? "" : form.engagement <= 2 ? t.engagement1 : form.engagement === 3 ? t.engagement3 : form.engagement === 4 ? t.engagement4 : t.engagement5}
                </span>
              </div>
            </div>

            <div>
              <label style={LABEL_STYLE}>{t.discoveryLabel}</label>
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
              {loading ? t.sendingInProgress : t.submit}
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
