"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { landing } from "@/lib/i18n/dictionaries/landing";

const DOWNLOAD_URL = process.env.NEXT_PUBLIC_DOWNLOAD_URL;

export default function LandingClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const t = useT(landing);

  const PROBLEM_STATS_COLORS = ["#ef5350", "#ef5350", "#ef5350", "#ef5350"];

  return (
    <div style={{ background: "#040810", minHeight: "100dvh", color: "#F0E6D3" }}>

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(4,8,16,0.88)",
        backdropFilter: "blur(14px)",
        borderBottom: "1px solid rgba(200,170,110,0.16)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "1rem", letterSpacing: "0.14em", color: "#C8AA6E",
            textShadow: "0 0 22px rgba(200,170,110,0.5)",
          }}>
            ⚔ L·O·W
          </span>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {DOWNLOAD_URL && (
              <a
                href={DOWNLOAD_URL}
                style={{
                  padding: "6px 16px", borderRadius: 6, fontSize: "0.8rem",
                  border: "1px solid rgba(200,170,110,0.35)", color: "#C8AA6E",
                  textDecoration: "none", letterSpacing: "0.05em",
                }}
              >
                {t.navDownload}
              </a>
            )}
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              style={{
                padding: "6px 18px", borderRadius: 6, fontSize: "0.8rem",
                background: "linear-gradient(135deg, #C8AA6E, #a8893e)",
                color: "#040810", fontWeight: 700, textDecoration: "none",
                letterSpacing: "0.05em",
              }}
            >
              {isLoggedIn ? t.navLoggedIn : t.navLoggedOut}
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        minHeight: "92dvh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "80px 24px 60px",
        position: "relative", overflow: "hidden",
        textAlign: "center",
      }}>
        {/* Background glow */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 80% 60% at 50% 30%, rgba(200,170,110,0.07) 0%, transparent 70%)",
        }} />
        <div style={{
          position: "absolute", top: "20%", left: "10%", width: 300, height: 300,
          borderRadius: "50%", background: "rgba(11,196,227,0.04)",
          filter: "blur(80px)", pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: "30%", right: "8%", width: 250, height: 250,
          borderRadius: "50%", background: "rgba(200,170,110,0.05)",
          filter: "blur(60px)", pointerEvents: "none",
        }} />

        <div style={{ position: "relative", maxWidth: 760 }}>
          <Link href="/beta" style={{ textDecoration: "none" }}>
            <div style={{
              display: "inline-block", marginBottom: 24,
              padding: "4px 16px", borderRadius: 999,
              border: "1px solid rgba(11,196,227,0.3)",
              background: "rgba(11,196,227,0.06)",
              fontSize: "0.75rem", letterSpacing: "0.12em", textTransform: "uppercase",
              color: "#0bc4e3", cursor: "pointer",
            }}>
              {t.heroBadge}
            </div>
          </Link>

          <h1 style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "clamp(2.4rem, 6vw, 4.5rem)",
            lineHeight: 1.08, marginBottom: 24,
            background: "linear-gradient(135deg, #F0E6D3 0%, #C8AA6E 50%, #0bc4e3 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            {t.heroTitleLine1}<br />{t.heroTitleLine2}
          </h1>

          <p style={{
            fontSize: "clamp(1rem, 2vw, 1.2rem)", lineHeight: 1.65,
            color: "rgba(240,230,211,0.65)", marginBottom: 40, maxWidth: 580, margin: "0 auto 40px",
          }}>
            {t.heroSubtitle}
          </p>

          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            {DOWNLOAD_URL && (
              <a
                href={DOWNLOAD_URL}
                style={{
                  padding: "14px 32px", borderRadius: 8, fontSize: "0.95rem",
                  background: "linear-gradient(135deg, #C8AA6E, #a8893e)",
                  color: "#040810", fontWeight: 700, textDecoration: "none",
                  letterSpacing: "0.05em", boxShadow: "0 4px 24px rgba(200,170,110,0.3)",
                }}
              >
                {t.heroDownload}
              </a>
            )}
            <Link
              href="/beta"
              style={{
                padding: "14px 32px", borderRadius: 8, fontSize: "0.95rem",
                border: "1px solid rgba(200,170,110,0.4)",
                background: "rgba(200,170,110,0.06)",
                color: "#C8AA6E", textDecoration: "none",
                letterSpacing: "0.05em",
              }}
            >
              {t.heroBeta}
            </Link>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <section style={{
        borderTop: "1px solid rgba(200,170,110,0.12)",
        borderBottom: "1px solid rgba(200,170,110,0.12)",
        background: "rgba(200,170,110,0.03)",
        padding: "48px 24px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{
            textAlign: "center", fontSize: "0.75rem", letterSpacing: "0.14em",
            textTransform: "uppercase", color: "rgba(200,170,110,0.5)", marginBottom: 40,
          }}>
            {t.statsLabel}
          </p>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 32,
          }}>
            {t.stats.map((s) => (
              <div key={s.value} style={{ textAlign: "center" }}>
                <div style={{
                  fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                  fontSize: "clamp(2rem, 4vw, 3rem)", color: "#C8AA6E",
                  textShadow: "0 0 30px rgba(200,170,110,0.4)", lineHeight: 1,
                  marginBottom: 10,
                }}>
                  {s.value}
                </div>
                <div style={{ fontSize: "0.85rem", color: "rgba(240,230,211,0.5)", lineHeight: 1.5 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LE PROBLÈME */}
      <section style={{ padding: "100px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60, alignItems: "center",
        }}
          className="landing-two-col"
        >
          <div>
            <p style={{
              fontSize: "0.75rem", letterSpacing: "0.14em", textTransform: "uppercase",
              color: "#0bc4e3", marginBottom: 16,
            }}>
              {t.problemEyebrow}
            </p>
            <h2 style={{
              fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
              fontSize: "clamp(1.8rem, 3.5vw, 2.8rem)", lineHeight: 1.2, marginBottom: 24,
            }}>
              {t.problemTitleLine1}<br />{t.problemTitleLine2}<br />
              <span style={{ color: "#C8AA6E" }}>{t.problemTitleHighlight}</span>
            </h2>
            <p style={{ fontSize: "1rem", lineHeight: 1.75, color: "rgba(240,230,211,0.6)", marginBottom: 16 }}>
              {t.problemPara1}
            </p>
            <p style={{ fontSize: "1rem", lineHeight: 1.75, color: "rgba(240,230,211,0.6)" }}>
              {t.problemPara2}
            </p>
          </div>
          <div style={{
            background: "rgba(200,170,110,0.04)",
            border: "1px solid rgba(200,170,110,0.14)",
            borderRadius: 16, padding: "40px 32px",
          }}>
            {t.problemStats.map((item, i) => (
              <div key={item.label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "16px 0",
                borderBottom: "1px solid rgba(200,170,110,0.08)",
              }}>
                <span style={{ fontSize: "0.9rem", color: "rgba(240,230,211,0.55)" }}>{item.label}</span>
                <span style={{
                  fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                  fontSize: "1.4rem", color: PROBLEM_STATS_COLORS[i],
                }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* POURQUOI LES POMPES */}
      <section style={{ padding: "100px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <p style={{
          textAlign: "center", fontSize: "0.75rem", letterSpacing: "0.14em",
          textTransform: "uppercase", color: "#C8AA6E", marginBottom: 12,
        }}>
          {t.whyPushupsEyebrow}
        </p>
        <h2 style={{
          fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", textAlign: "center", marginBottom: 16,
        }}>
          {t.whyPushupsTitle}
        </h2>
        <p style={{
          textAlign: "center", fontSize: "1rem", color: "rgba(240,230,211,0.55)",
          maxWidth: 620, margin: "0 auto 56px", lineHeight: 1.7,
        }}>
          {t.whyPushupsSubtitle}
        </p>

        {/* Deux arguments */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20, marginBottom: 64,
        }}>
          {t.pushupReasons.map((r) => (
            <div key={r.title} style={{
              background: "rgba(200,170,110,0.04)",
              border: "1px solid rgba(200,170,110,0.14)",
              borderRadius: 16, padding: "32px 28px",
            }}>
              <div style={{ fontSize: "1.7rem", marginBottom: 16 }}>{r.icon}</div>
              <h3 style={{
                fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                fontSize: "1.05rem", color: "#C8AA6E", marginBottom: 12,
              }}>
                {r.title}
              </h3>
              <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "rgba(240,230,211,0.6)" }}>
                {r.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Muscles travaillés */}
        <div style={{ textAlign: "center", marginBottom: 12 }}>
          <h3 style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "clamp(1.3rem, 2.4vw, 1.7rem)", color: "#F0E6D3", marginBottom: 10,
          }}>
            {t.musclesTitle}
          </h3>
          <p style={{ fontSize: "0.92rem", color: "rgba(240,230,211,0.5)", maxWidth: 540, margin: "0 auto", lineHeight: 1.65 }}>
            {t.musclesSubtitle}
          </p>
        </div>

        {/* Légende des rôles */}
        <div style={{
          display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 18,
          margin: "20px 0 32px",
        }}>
          {Object.entries(t.muscleRoles).map(([role, { color, label }]) => (
            <div key={role} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                width: 10, height: 10, borderRadius: "50%", background: color,
                boxShadow: `0 0 8px ${color}66`,
              }} />
              <span style={{ fontSize: "0.8rem", color: "rgba(240,230,211,0.55)" }}>
                <strong style={{ color, fontWeight: 600 }}>{role}</strong> · {label}
              </span>
            </div>
          ))}
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16,
        }}>
          {t.pushupMuscles.map((m) => {
            const c = t.muscleRoles[m.role as keyof typeof t.muscleRoles].color;
            return (
              <div key={m.name} style={{
                background: "rgba(4,8,16,0.5)",
                border: "1px solid rgba(200,170,110,0.1)",
                borderLeft: `3px solid ${c}`,
                borderRadius: 12, padding: "18px 20px",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                  <span style={{
                    fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                    fontSize: "0.92rem", color: "#F0E6D3",
                  }}>
                    {m.name}
                  </span>
                  <span style={{
                    flexShrink: 0, padding: "2px 9px", borderRadius: 999, fontSize: "0.66rem",
                    letterSpacing: "0.04em", textTransform: "uppercase",
                    color: c, border: `1px solid ${c}40`, background: `${c}12`,
                  }}>
                    {m.role}
                  </span>
                </div>
                <div style={{ fontSize: "0.72rem", color: "rgba(200,170,110,0.45)", marginBottom: 8, letterSpacing: "0.03em" }}>
                  {m.region}
                </div>
                <p style={{ fontSize: "0.82rem", lineHeight: 1.6, color: "rgba(240,230,211,0.55)" }}>
                  {m.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Sources */}
        <div style={{ marginTop: 40 }}>
          <p style={{
            fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase",
            color: "rgba(200,170,110,0.45)", marginBottom: 12, textAlign: "center",
          }}>
            {t.sourcesTitle}
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 auto", maxWidth: 760, display: "flex", flexDirection: "column", gap: 8 }}>
            {t.pushupSources.map((s) => (
              <li key={s.href} style={{ fontSize: "0.78rem", lineHeight: 1.6, color: "rgba(240,230,211,0.45)", textAlign: "center" }}>
                <a href={s.href} target="_blank" rel="noopener noreferrer"
                  style={{ color: "rgba(11,196,227,0.7)", textDecoration: "none" }}>
                  {s.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section style={{
        padding: "80px 24px",
        background: "rgba(11,196,227,0.02)",
        borderTop: "1px solid rgba(11,196,227,0.08)",
        borderBottom: "1px solid rgba(11,196,227,0.08)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{
            textAlign: "center", fontSize: "0.75rem", letterSpacing: "0.14em",
            textTransform: "uppercase", color: "#0bc4e3", marginBottom: 12,
          }}>
            {t.howEyebrow}
          </p>
          <h2 style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", textAlign: "center", marginBottom: 60,
          }}>
            {t.howTitle}
          </h2>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24,
          }}>
            {t.steps.map((step) => (
              <div key={step.num} style={{
                background: "rgba(4,8,16,0.6)",
                border: "1px solid rgba(200,170,110,0.14)",
                borderRadius: 16, padding: "36px 28px",
                position: "relative",
              }}>
                <div style={{
                  fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                  fontSize: "3rem", color: "rgba(200,170,110,0.12)",
                  position: "absolute", top: 20, right: 24, lineHeight: 1,
                }}>
                  {step.num}
                </div>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%",
                  background: "rgba(200,170,110,0.1)",
                  border: "1px solid rgba(200,170,110,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 20,
                  fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                  fontSize: "0.85rem", color: "#C8AA6E",
                }}>
                  {step.num}
                </div>
                <h3 style={{
                  fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                  fontSize: "1.1rem", color: "#F0E6D3", marginBottom: 12,
                }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "rgba(240,230,211,0.55)" }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BIENFAITS */}
      <section style={{ padding: "100px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <p style={{
          textAlign: "center", fontSize: "0.75rem", letterSpacing: "0.14em",
          textTransform: "uppercase", color: "#C8AA6E", marginBottom: 12,
        }}>
          {t.benefitsEyebrow}
        </p>
        <h2 style={{
          fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
          fontSize: "clamp(1.8rem, 3vw, 2.4rem)", textAlign: "center", marginBottom: 16,
        }}>
          {t.benefitsTitle}
        </h2>
        <p style={{
          textAlign: "center", fontSize: "1rem", color: "rgba(240,230,211,0.5)",
          maxWidth: 520, margin: "0 auto 60px", lineHeight: 1.7,
        }}>
          {t.benefitsSubtitle}
        </p>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20,
        }}>
          {t.benefits.map((b) => (
            <div key={b.title} style={{
              background: "rgba(200,170,110,0.04)",
              border: "1px solid rgba(200,170,110,0.12)",
              borderRadius: 14, padding: "28px 24px",
              transition: "border-color 0.2s",
            }}>
              <div style={{ fontSize: "1.6rem", marginBottom: 14 }}>{b.icon}</div>
              <h3 style={{
                fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                fontSize: "1rem", color: "#C8AA6E", marginBottom: 10,
              }}>
                {b.title}
              </h3>
              <p style={{ fontSize: "0.875rem", lineHeight: 1.7, color: "rgba(240,230,211,0.55)" }}>
                {b.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{
        padding: "80px 24px",
        background: "rgba(200,170,110,0.025)",
        borderTop: "1px solid rgba(200,170,110,0.1)",
        borderBottom: "1px solid rgba(200,170,110,0.1)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{
            textAlign: "center", fontSize: "0.75rem", letterSpacing: "0.14em",
            textTransform: "uppercase", color: "#C8AA6E", marginBottom: 12,
          }}>
            {t.featuresEyebrow}
          </p>
          <h2 style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "clamp(1.8rem, 3vw, 2.4rem)", textAlign: "center", marginBottom: 56,
          }}>
            {t.featuresTitle}
          </h2>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16,
          }}>
            {t.features.map((f) => (
              <div key={f.title} style={{
                display: "flex", gap: 16, padding: "20px 20px",
                background: "rgba(4,8,16,0.5)",
                border: "1px solid rgba(200,170,110,0.1)",
                borderRadius: 12,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#0bc4e3", marginTop: 6, flexShrink: 0,
                  boxShadow: "0 0 8px rgba(11,196,227,0.6)",
                }} />
                <div>
                  <div style={{
                    fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
                    fontSize: "0.9rem", color: "#F0E6D3", marginBottom: 6,
                  }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: "0.825rem", color: "rgba(240,230,211,0.5)", lineHeight: 1.6 }}>
                    {f.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section style={{
        padding: "120px 24px", textAlign: "center",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(200,170,110,0.07) 0%, transparent 70%)",
        }} />
        <div style={{ position: "relative", maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "clamp(2rem, 4vw, 3rem)", lineHeight: 1.15, marginBottom: 20,
          }}>
            {t.ctaTitle}
          </h2>
          <p style={{
            fontSize: "1rem", color: "rgba(240,230,211,0.55)", lineHeight: 1.7, marginBottom: 40,
          }}>
            {t.ctaSubtitle}
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            {DOWNLOAD_URL && (
              <a
                href={DOWNLOAD_URL}
                style={{
                  padding: "14px 36px", borderRadius: 8, fontSize: "1rem",
                  background: "linear-gradient(135deg, #C8AA6E, #a8893e)",
                  color: "#040810", fontWeight: 700, textDecoration: "none",
                  letterSpacing: "0.05em", boxShadow: "0 4px 24px rgba(200,170,110,0.3)",
                }}
              >
                {t.ctaDownload}
              </a>
            )}
            <Link
              href="/beta"
              style={{
                padding: "14px 36px", borderRadius: 8, fontSize: "1rem",
                border: "1px solid rgba(200,170,110,0.4)",
                background: "rgba(200,170,110,0.06)",
                color: "#C8AA6E", textDecoration: "none",
                letterSpacing: "0.05em",
              }}
            >
              {t.ctaBeta}
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop: "1px solid rgba(200,170,110,0.1)",
        padding: "32px 24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 16,
        maxWidth: 1100, margin: "0 auto",
        fontSize: "0.8rem", color: "rgba(240,230,211,0.3)",
      }}>
        <span style={{ fontFamily: "var(--font-heading)", color: "rgba(200,170,110,0.4)", letterSpacing: "0.1em" }}>
          ⚔ L·O·W
        </span>
        <div style={{ display: "flex", gap: 24 }}>
          <Link href="/cgu" style={{ color: "rgba(240,230,211,0.3)", textDecoration: "none" }}>{t.footerCgu}</Link>
          <Link href="/confidentialite" style={{ color: "rgba(240,230,211,0.3)", textDecoration: "none" }}>{t.footerConfidentialite}</Link>
          <Link href="/login" style={{ color: "rgba(240,230,211,0.3)", textDecoration: "none" }}>{t.footerLogin}</Link>
        </div>
        <span>{t.footerDisclaimer}</span>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .landing-two-col {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
