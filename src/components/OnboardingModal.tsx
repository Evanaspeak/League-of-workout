"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const PUBLIC = ["/login", "/waitlist"];

const STEPS = [
  {
    icon: "⚔",
    title: "Bienvenue dans\nLeague of Workouts",
    body: "L'app qui transforme tes parties de League of Legends en séances de sport. Chaque game = des pompes. Plus tu perfomes, moins tu en fais.",
  },
  {
    icon: "💪",
    title: "Comment ça marche ?",
    body: "À la fin de chaque partie, l'app calcule automatiquement ton nombre de pompes en fonction de ton KDA, de ton rôle et du résultat de la partie.\n\nVictoire avec un bon score → peu de pompes.\nDéfaite avec un mauvais KDA → beaucoup de pompes.",
  },
  {
    icon: "🧱",
    title: "Le test de gainage",
    body: "Avant chaque session, tu effectues un test de gainage chronométré. Plus tu tiens longtemps, plus ton niveau est élevé — et plus le multiplicateur de pompes est important.\n\nC'est ton niveau physique qui détermine l'intensité.",
  },
  {
    icon: "🏆",
    title: "Ton objectif",
    body: "Tu te fixes un objectif total de pompes à atteindre (par défaut : 1 000). Chaque session contribue à te rapprocher de ce chiffre.\n\nSuis ta progression sur le dashboard et dépasse tes limites !",
  },
];

export function OnboardingModal() {
  const path = usePathname();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (PUBLIC.some((p) => path.startsWith(p))) return;
    if (localStorage.getItem("low_onboarded")) return;
    // Attend que le splash soit terminé avant d'afficher
    const t = setTimeout(() => setVisible(true), 2800);
    return () => clearTimeout(t);
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
      background: "rgba(4,8,16,0.85)",
      backdropFilter: "blur(6px)",
      padding: "1rem",
      opacity: closing ? 0 : 1,
      transition: "opacity 0.35s ease",
    }}>
      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: 420,
        background: "linear-gradient(160deg, #0d1322 0%, #080d18 100%)",
        border: "1px solid rgba(200,170,110,0.25)",
        borderRadius: 8,
        padding: "2.5rem 2rem 2rem",
        boxShadow: "0 0 80px rgba(200,170,110,0.08), 0 24px 60px rgba(0,0,0,0.6)",
        textAlign: "center",
      }}>
        {/* Corner decorations */}
        {(["tl","tr","bl","br"] as const).map((pos) => (
          <span key={pos} style={{
            position: "absolute", width: 14, height: 14,
            ...(pos === "tl" && { top: 0, left: 0, borderTop: "2px solid rgba(200,170,110,0.4)", borderLeft: "2px solid rgba(200,170,110,0.4)" }),
            ...(pos === "tr" && { top: 0, right: 0, borderTop: "2px solid rgba(200,170,110,0.4)", borderRight: "2px solid rgba(200,170,110,0.4)" }),
            ...(pos === "bl" && { bottom: 0, left: 0, borderBottom: "2px solid rgba(200,170,110,0.4)", borderLeft: "2px solid rgba(200,170,110,0.4)" }),
            ...(pos === "br" && { bottom: 0, right: 0, borderBottom: "2px solid rgba(200,170,110,0.4)", borderRight: "2px solid rgba(200,170,110,0.4)" }),
          }} />
        ))}

        {/* Step dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: "1.75rem" }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 20 : 6,
              height: 6,
              borderRadius: 3,
              background: i === step ? "#C8AA6E" : "rgba(200,170,110,0.2)",
              transition: "all 0.3s ease",
            }} />
          ))}
        </div>

        {/* Icon */}
        <div style={{
          fontSize: "2.8rem",
          marginBottom: "1.25rem",
          lineHeight: 1,
          filter: "drop-shadow(0 0 16px rgba(200,170,110,0.4))",
        }}>
          {current.icon}
        </div>

        {/* Title */}
        <h2 style={{
          fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
          fontSize: "1.05rem",
          color: "#C8AA6E",
          letterSpacing: "0.12em",
          lineHeight: 1.4,
          marginBottom: "1.1rem",
          whiteSpace: "pre-line",
        }}>
          {current.title.toUpperCase()}
        </h2>

        {/* Body */}
        <p style={{
          fontSize: "0.875rem",
          color: "rgba(240,230,211,0.65)",
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
              style={{
                flex: "0 0 auto",
                padding: "0.6rem 1rem",
                background: "transparent",
                border: "1px solid rgba(200,170,110,0.2)",
                borderRadius: 4,
                color: "rgba(200,170,110,0.5)",
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
            {step < STEPS.length - 1 ? "SUIVANT →" : "C'EST PARTI !"}
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
              color: "rgba(240,230,211,0.25)",
              fontSize: "0.75rem",
              cursor: "pointer",
              letterSpacing: "0.05em",
            }}
          >
            Passer l&apos;introduction
          </button>
        )}
      </div>
    </div>
  );
}
