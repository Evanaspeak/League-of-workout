"use client";
import { useSession } from "@/lib/SessionContext";
import { useT } from "@/lib/i18n/LocaleContext";
import { exercices as exercicesDict } from "@/lib/i18n/dictionaries/exercices";
import { formaterCompact, EXERCICES } from "@/lib/exercices";

/**
 * Bandeau affiché quand la dette accumulée pendant une session dépasse le
 * seuil : l'idée est de fractionner l'effort au fil de la soirée plutôt que
 * de tout reporter à la fin.
 */
export function RappelSession() {
  const { rappelActif, dettePoints, exercice, acquitterRappel, reporterRappel } = useSession();
  const t = useT(exercicesDict);

  if (!rappelActif) return null;

  const nom = { pompes: t.pompesNom, squats: t.squatsNom, boxe: t.boxeNom }[exercice];
  const valeur = formaterCompact(dettePoints, exercice);
  const quantite = EXERCICES[exercice].unite === "reps" ? `${valeur} ${nom.toLowerCase()}` : valeur;

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 24,
        transform: "translateX(-50%)",
        zIndex: 9000,
        width: "min(560px, calc(100vw - 32px))",
        background: "var(--carbon)",
        border: "1px solid rgba(255,77,46,0.45)",
        borderRadius: 14,
        boxShadow: "0 18px 50px rgba(0,0,0,0.55), 0 0 30px rgba(255,77,46,0.12)",
        overflow: "hidden",
        animation: "riseIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "var(--brand-gradient)",
        }}
      />
      <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div
            style={{
              fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
              fontWeight: 700,
              fontSize: "1.15rem",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              color: "var(--bone)",
              marginBottom: 2,
            }}
          >
            {t.rappelNotifTitre}
          </div>
          <div style={{ fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.5 }}>
            {t.rappelBandeau(quantite)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
          <button
            onClick={reporterRappel}
            style={{
              padding: "9px 16px",
              borderRadius: 8,
              background: "transparent",
              border: "1px solid var(--line-strong)",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            {t.rappelPlusTard}
          </button>
          <button onClick={acquitterRappel} className="lol-btn" style={{ padding: "9px 20px" }}>
            {t.rappelFait}
          </button>
        </div>
      </div>
    </div>
  );
}
