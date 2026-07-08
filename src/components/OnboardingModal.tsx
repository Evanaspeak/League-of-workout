"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/LocaleContext";
import { onboardingModal as onboardingModalDict } from "@/lib/i18n/dictionaries/onboardingModal";

const PUBLIC = ["/login", "/waitlist", "/beta", "/recuperation"];

/* Icônes stroke SVG des étapes d'onboarding */
function StepIcon({ name }: { name: string }) {
  if (name === "slash") {
    return (
      <span aria-hidden style={{
        display: "inline-block", width: 12, height: 38,
        background: "var(--ember)", transform: "skewX(-18deg)", borderRadius: 2,
      }} />
    );
  }
  const paths: Record<string, React.ReactNode> = {
    dumbbell: <path d="M4 9v6M7 6v12M17 6v12M20 9v6M7 12h10" />,
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 17 9 5 9-5" />
      </>
    ),
    heart: <path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6.3a5 5 0 1 1 7.5 6.3Z" />,
    trophy: (
      <>
        <path d="M8 21h8M12 17v4" />
        <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
        <path d="M7 6H4a2 2 0 0 0 2 4h1M17 6h3a2 2 0 0 1-2 4h-1" />
      </>
    ),
  };
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="var(--steel)"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name] ?? null}
    </svg>
  );
}

export function OnboardingModal() {
  const t = useT(onboardingModalDict);
  const STEPS = t.steps;
  const path = usePathname();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    // Pages publiques (landing incluse) : l'onboarding n'a de sens qu'en app.
    if (path === "/" || PUBLIC.some((p) => path.startsWith(p))) return;
    if (localStorage.getItem("low_onboarded")) return;
    // Attend que le splash soit terminé avant d'afficher
    const timer = setTimeout(() => setVisible(true), 2800);
    return () => clearTimeout(timer);
  }, [path]);

  const close = () => {
    setClosing(true);
    setTimeout(() => {
      localStorage.setItem("low_onboarded", "1");
      setVisible(false);
      setClosing(false);
    }, 350);
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else close();
  };

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 8000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(12,14,17,0.85)",
      backdropFilter: "blur(6px)",
      padding: "1rem",
      opacity: closing ? 0 : 1,
      transition: "opacity 0.35s ease",
    }}>
      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: 420,
        background: "var(--carbon)",
        border: "1px solid var(--line-strong)",
        borderRadius: 16,
        padding: "2.5rem 2rem 2rem",
        boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        textAlign: "center",
        overflow: "hidden",
      }}>
        {/* Liseré ember */}
        <span aria-hidden style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, transparent 15%, var(--ember) 50%, transparent 85%)",
        }} />

        {/* Step dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: "1.75rem" }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === step ? "var(--ember)" : "rgba(236,239,244,0.15)",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>

        {/* Icon */}
        <div style={{
          height: 48,
          marginBottom: "1.25rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <StepIcon name={current.icon} />
        </div>

        {/* Title */}
        <h2 style={{
          fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
          fontWeight: 700,
          fontSize: "1.35rem",
          color: "var(--bone)",
          letterSpacing: "0.06em",
          lineHeight: 1.3,
          marginBottom: "1.1rem",
          whiteSpace: "pre-line",
        }}>
          {current.title.toUpperCase()}
        </h2>

        {/* Body */}
        <p style={{
          fontSize: "0.875rem",
          color: "var(--muted)",
          lineHeight: 1.75,
          marginBottom: "2rem",
          whiteSpace: "pre-line",
        }}>
          {current.body}
        </p>

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              aria-label="←"
              style={{
                flex: "0 0 auto",
                padding: "0.6rem 1rem",
                background: "transparent",
                border: "1px solid var(--line-strong)",
                borderRadius: 8,
                color: "var(--faint)",
                cursor: "pointer",
                fontSize: "0.82rem",
              }}
            >
              ←
            </button>
          )}
          <button
            onClick={next}
            className="lol-btn"
            style={{ flex: 1, fontSize: "0.88rem", letterSpacing: "0.1em" }}
          >
            {step < STEPS.length - 1 ? t.suivant : t.cestParti}
          </button>
        </div>

        {/* Skip */}
        {step < STEPS.length - 1 && (
          <button
            onClick={close}
            style={{
              marginTop: "1rem",
              background: "none",
              border: "none",
              color: "rgba(236,239,244,0.25)",
              fontSize: "0.75rem",
              cursor: "pointer",
              letterSpacing: "0.05em",
            }}
          >
            {t.passerIntroduction}
          </button>
        )}
      </div>
    </div>
  );
}
