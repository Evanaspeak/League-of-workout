"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { landing } from "@/lib/i18n/dictionaries/landing";
import { Wordmark } from "@/components/Wordmark";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const DOWNLOAD_URL = process.env.NEXT_PUBLIC_DOWNLOAD_URL;

/* ── Icônes SVG (stroke, style unique — pas d'emoji) ─────────────────────── */
function Icon({ name, size = 20, color = "var(--steel)" }: { name: string; size?: number; color?: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </>
    ),
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 17 9 5 9-5" />
      </>
    ),
    zap: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    brain: (
      <>
        <path d="M9.5 3A2.5 2.5 0 0 0 7 5.5a3 3 0 0 0-2.2 5A3.5 3.5 0 0 0 6.5 21H11V3H9.5Z" />
        <path d="M14.5 3A2.5 2.5 0 0 1 17 5.5a3 3 0 0 1 2.2 5A3.5 3.5 0 0 1 17.5 21H13V3h1.5Z" />
      </>
    ),
    heart: <path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6.3a5 5 0 1 1 7.5 6.3Z" />,
  };
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      {paths[name] ?? null}
    </svg>
  );
}

/* Petit slash ember — le "or" de la marque, utilisé comme puce */
function Slash({ height = 12 }: { height?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: Math.max(2, Math.round(height / 5)),
        height,
        background: "var(--ember)",
        transform: "skewX(-18deg)",
        borderRadius: 1,
        flexShrink: 0,
      }}
    />
  );
}

/* ── Le feed de dette : la soirée facturée, game par game ────────────────── */
type FeedEntry = { r: string; mode: string; kda: string; reps: number };

function DebtFeed({
  title, count, totalLabel, unit, entries,
}: {
  title: string; count: string; totalLabel: string; unit: string; entries: FeedEntry[];
}) {
  const HOLD_STEPS = 3; // temps de pause une fois la soirée complète
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(entries.length);
      return;
    }
    const id = setInterval(() => {
      // Après la pause, on repart directement sur la première game (pas de trou vide)
      setStep((prev) => (prev >= entries.length + HOLD_STEPS ? 1 : prev + 1));
    }, 950);
    return () => clearInterval(id);
  }, [entries.length]);

  const visible = Math.min(step, entries.length);
  const total = entries.slice(0, visible).reduce((s, e) => s + e.reps, 0);

  return (
    <div style={{
      background: "var(--carbon)",
      border: "1px solid var(--line)",
      borderRadius: 16,
      overflow: "hidden",
      width: "100%",
      maxWidth: 440,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 20px", borderBottom: "1px solid var(--line)",
      }}>
        <span className="eyebrow">{title}</span>
        <span className="mono-num" style={{ fontSize: "0.7rem", color: "var(--faint)" }}>{count}</span>
      </div>

      {/* Rows */}
      <div>
        {entries.map((e, i) => {
          const isWin = e.r === "V" || e.r === "W";
          const shown = i < visible;
          return (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 20px",
                borderBottom: "1px solid var(--line)",
                opacity: shown ? 1 : 0,
                transform: shown ? "translateY(0)" : "translateY(8px)",
                transition: "opacity 0.35s ease, transform 0.35s ease",
              }}
            >
              <span
                className="mono-num"
                style={{
                  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.75rem", fontWeight: 600,
                  color: isWin ? "var(--victory)" : "var(--loss)",
                  background: isWin ? "var(--victory-soft)" : "rgba(255,90,71,0.1)",
                  border: `1px solid ${isWin ? "rgba(47,217,138,0.3)" : "rgba(255,90,71,0.3)"}`,
                }}
              >
                {e.r}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "0.85rem", color: "var(--bone)", fontWeight: 500 }}>{e.mode}</span>
                <span className="mono-num" style={{ display: "block", fontSize: "0.68rem", color: "var(--faint)" }}>{e.kda}</span>
              </span>
              <span className="mono-num" style={{
                fontSize: "0.95rem", fontWeight: 600,
                color: isWin ? "var(--victory)" : "var(--ember)",
              }}>
                +{e.reps}
              </span>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "baseline",
        padding: "16px 20px",
        background: "rgba(255,77,46,0.05)",
      }}>
        <span className="eyebrow">{totalLabel}</span>
        <span className="mono-num" style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--ember)", lineHeight: 1 }}>
          {total} <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,77,46,0.7)" }}>{unit}</span>
        </span>
      </div>
    </div>
  );
}

/* ── Landing ─────────────────────────────────────────────────────────────── */
export default function LandingClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const t = useT(landing);

  const h2: React.CSSProperties = {
    fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.015em",
    fontSize: "clamp(1.9rem, 3.4vw, 2.7rem)",
    lineHeight: 1.05,
    color: "var(--bone)",
  };

  return (
    <div className="full-bleed" style={{
      background: "var(--ink)",
      color: "var(--bone)",
      marginTop: "-1.5rem",
      marginBottom: "-1.5rem",
    }}>

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(12,14,17,0.85)", backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--line)",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex" }}>
            <Wordmark fontSize="1.1rem" />
          </Link>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <LanguageSwitcher />
            <Link
              href={isLoggedIn ? "/dashboard" : "/login"}
              className="wow-ghost"
              style={{ padding: "7px 18px", fontSize: "0.82rem" }}
            >
              {isLoggedIn ? t.navLoggedIn : t.navLoggedOut}
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ padding: "0 24px" }}>
        <div className="wow-hero" style={{
          maxWidth: 1200, margin: "0 auto",
          display: "grid", gridTemplateColumns: "1.05fr 0.95fr",
          gap: 56, alignItems: "center",
          minHeight: "calc(100dvh - 60px)",
          paddingTop: 48, paddingBottom: 64,
        }}>
          {/* Colonne texte */}
          <div>
            <Link href="/beta" style={{ textDecoration: "none" }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                marginBottom: 28,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: "var(--victory)",
                  animation: "pulse 2s ease-in-out infinite",
                }} />
                <span className="eyebrow" style={{ color: "var(--muted)" }}>{t.heroBadge}</span>
              </span>
            </Link>

            <h1 style={{
              fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
              fontWeight: 700,
              textTransform: "uppercase",
              fontSize: "clamp(3rem, 7.2vw, 5.4rem)",
              lineHeight: 0.98,
              letterSpacing: "0.01em",
              margin: "0 0 26px",
            }}>
              <span style={{ display: "block", color: "var(--bone)" }}>{t.heroTitleLine1}</span>
              <span style={{ display: "block", color: "var(--ember)" }}>{t.heroTitleLine2}</span>
            </h1>

            <p style={{
              fontSize: "clamp(1rem, 1.6vw, 1.1rem)", lineHeight: 1.65,
              color: "var(--muted)", maxWidth: 500, marginBottom: 30,
            }}>
              {t.heroSubtitle}
            </p>

            {/* Jeux supportés */}
            <div className="mono-num" style={{
              display: "flex", flexWrap: "wrap", alignItems: "center",
              gap: "8px 14px", marginBottom: 38,
              fontSize: "0.7rem", letterSpacing: "0.1em", textTransform: "uppercase",
            }}>
              <span style={{ color: "var(--victory)" }}>{t.heroGamesLive}</span>
              <Slash height={11} />
              <span style={{ color: "var(--faint)" }}>{t.heroGamesNext}</span>
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
              <Link href="/beta" className="wow-cta">
                {t.heroBeta}
              </Link>
              <Link href={isLoggedIn ? "/dashboard" : "/login"} className="wow-ghost">
                {isLoggedIn ? t.navLoggedIn : t.heroLogin}
              </Link>
            </div>

            {DOWNLOAD_URL && (
              <a href={DOWNLOAD_URL} className="mono-num" style={{
                display: "inline-block", marginTop: 22,
                fontSize: "0.72rem", letterSpacing: "0.08em",
                color: "var(--faint)", textDecoration: "none",
                borderBottom: "1px solid var(--line-strong)",
                paddingBottom: 2,
              }}>
                {t.heroDownload} ↓
              </a>
            )}
          </div>

          {/* Colonne feed */}
          <div className="wow-hero-feed" style={{ display: "flex", justifyContent: "flex-end" }}>
            <DebtFeed
              title={t.feedTitle}
              count={t.feedCount}
              totalLabel={t.feedTotalLabel}
              unit={t.feedUnit}
              entries={t.feedEntries}
            />
          </div>
        </div>
      </section>

      {/* STAT STRIP */}
      <section style={{
        borderTop: "1px solid var(--line)",
        borderBottom: "1px solid var(--line)",
        background: "var(--carbon)",
        padding: "44px 24px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p className="eyebrow" style={{ marginBottom: 36 }}>{t.statsLabel}</p>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 32,
          }}>
            {t.stats.map((s) => (
              <div key={s.value}>
                <div className="mono-num" style={{
                  fontSize: "clamp(1.7rem, 3vw, 2.3rem)", fontWeight: 600,
                  color: "var(--bone)", lineHeight: 1, marginBottom: 10,
                }}>
                  {s.value}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--faint)", lineHeight: 1.55 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* LE PROBLÈME */}
      <section style={{ padding: "96px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div className="wow-grid-2" style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center",
        }}>
          <div>
            <p className="eyebrow" style={{ marginBottom: 18 }}>{t.problemEyebrow}</p>
            <h2 style={{ ...h2, marginBottom: 24 }}>
              {t.problemTitleLine1}<br />{t.problemTitleLine2}{" "}
              <span style={{ color: "var(--ember)" }}>{t.problemTitleHighlight}</span>
            </h2>
            <p style={{ fontSize: "0.97rem", lineHeight: 1.75, color: "var(--muted)", marginBottom: 16 }}>
              {t.problemPara1}
            </p>
            <p style={{ fontSize: "0.97rem", lineHeight: 1.75, color: "var(--muted)" }}>
              {t.problemPara2}
            </p>
          </div>
          <div style={{
            background: "var(--carbon)",
            border: "1px solid var(--line)",
            borderRadius: 16, padding: "12px 28px",
          }}>
            {t.problemStats.map((item, i) => (
              <div key={item.label} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
                padding: "18px 0",
                borderBottom: i < t.problemStats.length - 1 ? "1px solid var(--line)" : "none",
              }}>
                <span style={{ fontSize: "0.87rem", color: "var(--muted)" }}>{item.label}</span>
                <span className="mono-num" style={{ fontSize: "1.15rem", fontWeight: 600, color: "var(--ember)", whiteSpace: "nowrap" }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* POURQUOI LES POMPES */}
      <section style={{
        borderTop: "1px solid var(--line)",
        padding: "96px 24px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p className="eyebrow" style={{ marginBottom: 18 }}>{t.whyPushupsEyebrow}</p>
          <h2 style={{ ...h2, marginBottom: 14 }}>{t.whyPushupsTitle}</h2>
          <p style={{ fontSize: "0.97rem", color: "var(--muted)", maxWidth: 620, lineHeight: 1.7, marginBottom: 48 }}>
            {t.whyPushupsSubtitle}
          </p>

          <div className="wow-grid-2" style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 72,
          }}>
            {t.pushupReasons.map((r) => (
              <div key={r.title} style={{
                background: "var(--carbon)",
                border: "1px solid var(--line)",
                borderRadius: 16, padding: "30px 28px",
              }}>
                <div style={{ marginBottom: 18 }}>
                  <Icon name={r.icon} size={24} color="var(--steel)" />
                </div>
                <h3 style={{
                  fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
                  fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em",
                  fontSize: "1.25rem", color: "var(--bone)", marginBottom: 10,
                }}>
                  {r.title}
                </h3>
                <p style={{ fontSize: "0.9rem", lineHeight: 1.7, color: "var(--muted)" }}>
                  {r.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Muscles travaillés */}
          <h3 style={{
            fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
            fontWeight: 600, textTransform: "uppercase",
            fontSize: "clamp(1.3rem, 2.2vw, 1.6rem)", color: "var(--bone)", marginBottom: 8,
          }}>
            {t.musclesTitle}
          </h3>
          <p style={{ fontSize: "0.9rem", color: "var(--faint)", maxWidth: 540, lineHeight: 1.65, marginBottom: 22 }}>
            {t.musclesSubtitle}
          </p>

          {/* Légende des rôles */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginBottom: 28 }}>
            {Object.entries(t.muscleRoles).map(([role, { color, label }]) => (
              <div key={role} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: color }} />
                <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  <strong style={{ color, fontWeight: 600 }}>{role}</strong> · {label}
                </span>
              </div>
            ))}
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14,
          }}>
            {t.pushupMuscles.map((m) => {
              const c = t.muscleRoles[m.role as keyof typeof t.muscleRoles].color;
              return (
                <div key={m.name} style={{
                  background: "var(--carbon)",
                  border: "1px solid var(--line)",
                  borderLeft: `3px solid ${c}`,
                  borderRadius: 12, padding: "18px 20px",
                }}>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
                      fontWeight: 600, fontSize: "1.02rem", color: "var(--bone)",
                      textTransform: "uppercase", letterSpacing: "0.03em",
                    }}>
                      {m.name}
                    </span>
                  </div>
                  <div className="mono-num" style={{ fontSize: "0.65rem", color: "var(--faint)", marginBottom: 8, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                    {m.region}
                  </div>
                  <p style={{ fontSize: "0.82rem", lineHeight: 1.6, color: "var(--muted)" }}>
                    {m.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Sources */}
          <div style={{ marginTop: 44 }}>
            <p className="eyebrow" style={{ marginBottom: 12 }}>{t.sourcesTitle}</p>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8, maxWidth: 760 }}>
              {t.pushupSources.map((s) => (
                <li key={s.href} style={{ fontSize: "0.76rem", lineHeight: 1.6, color: "var(--faint)" }}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer"
                    style={{ color: "var(--signal)", textDecoration: "none" }}>
                    {s.label} ↗
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section style={{
        borderTop: "1px solid var(--line)",
        background: "var(--carbon)",
        padding: "96px 24px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p className="eyebrow" style={{ marginBottom: 18 }}>{t.howEyebrow}</p>
          <h2 style={{ ...h2, marginBottom: 48 }}>{t.howTitle}</h2>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20,
          }}>
            {t.steps.map((step) => (
              <div key={step.num} style={{
                background: "var(--ink)",
                border: "1px solid var(--line)",
                borderRadius: 16, padding: "30px 28px",
              }}>
                <div className="mono-num" style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  fontSize: "0.75rem", fontWeight: 600, color: "var(--ember)",
                  marginBottom: 20, letterSpacing: "0.1em",
                }}>
                  {step.num}
                  <span style={{ width: 28, height: 1, background: "rgba(255,77,46,0.35)" }} />
                </div>
                <h3 style={{
                  fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
                  fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em",
                  fontSize: "1.3rem", color: "var(--bone)", marginBottom: 10,
                }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: "0.88rem", lineHeight: 1.7, color: "var(--muted)" }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BIENFAITS */}
      <section style={{ padding: "96px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <p className="eyebrow" style={{ marginBottom: 18 }}>{t.benefitsEyebrow}</p>
        <h2 style={{ ...h2, marginBottom: 14 }}>{t.benefitsTitle}</h2>
        <p style={{ fontSize: "0.97rem", color: "var(--muted)", maxWidth: 520, lineHeight: 1.7, marginBottom: 48 }}>
          {t.benefitsSubtitle}
        </p>
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16,
        }}>
          {t.benefits.map((b) => (
            <div key={b.title} style={{
              background: "var(--carbon)",
              border: "1px solid var(--line)",
              borderRadius: 14, padding: "26px 24px",
            }}>
              <div style={{ marginBottom: 16 }}>
                <Icon name={b.icon} size={22} color="var(--steel)" />
              </div>
              <h3 style={{
                fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
                fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em",
                fontSize: "1.15rem", color: "var(--bone)", marginBottom: 8,
              }}>
                {b.title}
              </h3>
              <p style={{ fontSize: "0.85rem", lineHeight: 1.65, color: "var(--muted)" }}>
                {b.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{
        borderTop: "1px solid var(--line)",
        padding: "96px 24px",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p className="eyebrow" style={{ marginBottom: 18 }}>{t.featuresEyebrow}</p>
          <h2 style={{ ...h2, marginBottom: 48 }}>{t.featuresTitle}</h2>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14,
          }}>
            {t.features.map((f) => (
              <div key={f.title} style={{
                display: "flex", gap: 16, padding: "20px",
                background: "var(--carbon)",
                border: "1px solid var(--line)",
                borderRadius: 12,
              }}>
                <div style={{ paddingTop: 5 }}>
                  <Slash height={13} />
                </div>
                <div>
                  <div style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--bone)", marginBottom: 4 }}>
                    {f.title}
                  </div>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)", lineHeight: 1.6 }}>
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
        borderTop: "1px solid var(--line)",
        padding: "110px 24px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 style={{
            fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
            fontWeight: 700, textTransform: "uppercase",
            fontSize: "clamp(2.2rem, 4.6vw, 3.4rem)",
            lineHeight: 1.02, marginBottom: 18, color: "var(--bone)",
          }}>
            {t.ctaTitle}
          </h2>
          <p style={{ fontSize: "0.97rem", color: "var(--muted)", lineHeight: 1.7, marginBottom: 38 }}>
            {t.ctaSubtitle}
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/beta" className="wow-cta" style={{ fontSize: "1rem", padding: "14px 34px" }}>
              {t.ctaBeta}
            </Link>
            {DOWNLOAD_URL && (
              <a href={DOWNLOAD_URL} className="wow-ghost" style={{ fontSize: "1rem", padding: "14px 34px" }}>
                {t.ctaDownload}
              </a>
            )}
          </div>
        </div>
      </section>

      <style>{`
        .wow-cta {
          display: inline-block;
          padding: 13px 30px;
          border-radius: 8px;
          background: var(--ember);
          color: #fff;
          font-family: var(--font-heading, 'Barlow Condensed', sans-serif);
          font-weight: 600;
          font-size: 0.95rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          text-decoration: none;
          transition: background 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
        }
        .wow-cta:hover {
          background: #FF6448;
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(255, 77, 46, 0.3);
        }
        .wow-ghost {
          display: inline-block;
          padding: 13px 30px;
          border-radius: 8px;
          border: 1px solid var(--line-strong);
          color: var(--bone);
          font-family: var(--font-heading, 'Barlow Condensed', sans-serif);
          font-weight: 600;
          font-size: 0.95rem;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          text-decoration: none;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .wow-ghost:hover {
          border-color: rgba(236, 239, 244, 0.35);
          background: rgba(236, 239, 244, 0.05);
        }
        @media (max-width: 960px) {
          .wow-hero {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
            min-height: 0 !important;
            padding-top: 56px !important;
          }
          .wow-hero-feed {
            justify-content: flex-start !important;
          }
        }
        @media (max-width: 768px) {
          .wow-grid-2 {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
