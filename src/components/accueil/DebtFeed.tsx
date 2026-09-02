"use client";
import { useEffect, useState } from "react";
import { useMouvementReduit } from "@/lib/valeurClient";

/** Une ligne du fil : ce qu'on a joué, comment ça a fini, ce que ça coûte. */
type FeedEntry = {
  r: string;
  issue: "gagne" | "perdu" | "neutre";
  jeu: string;
  detail: string;
  pts: number;
};

/**
 * Le compteur d'une soirée qui se remplit sous les yeux.
 *
 * C'est la seule partie de la page d'accueil qui a vraiment besoin du
 * navigateur : un état, un intervalle, et le respect du réglage système qui
 * limite les animations. Elle recevait déjà ses textes en propriétés, donc la
 * sortir de la page n'a rien coûté.
 */
export function DebtFeed({
  title, count, totalLabel, unit, conversion, entries,
}: {
  title: string; count: string; totalLabel: string; unit: string;
  /** Ce que le total donne dans chaque exercice : le modèle en une ligne. */
  conversion: string;
  entries: FeedEntry[];
}) {
  const HOLD_STEPS = 3; // temps de pause une fois la soirée complète
  const [step, setStep] = useState(0);
  const mouvementReduit = useMouvementReduit();

  useEffect(() => {
    // Animation refusée par le système : le compteur ne sert plus à rien, la
    // soirée s'affiche entière et l'intervalle n'est jamais lancé.
    if (mouvementReduit) return;
    const id = setInterval(() => {
      // Après la pause, on repart directement sur la première game (pas de trou vide)
      setStep((prev) => (prev >= entries.length + HOLD_STEPS ? 1 : prev + 1));
    }, 950);
    return () => clearInterval(id);
  }, [entries.length, mouvementReduit]);

  const visible = mouvementReduit ? entries.length : Math.min(step, entries.length);
  const total = entries.slice(0, visible).reduce((s, e) => s + e.pts, 0);
  const complet = visible === entries.length;

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
          const isWin = e.issue === "gagne";
          // Une session au temps n'a ni victoire ni défaite : elle reste neutre.
          const isNeutre = e.issue === "neutre";
          const teinte = isNeutre ? "var(--steel)" : isWin ? "var(--victory)" : "var(--loss)";
          const fond = isNeutre
            ? "rgba(152,162,176,0.1)"
            : isWin ? "var(--victory-soft)" : "rgba(255,90,71,0.1)";
          const bord = isNeutre
            ? "rgba(152,162,176,0.3)"
            : isWin ? "rgba(47,217,138,0.3)" : "rgba(255,90,71,0.3)";
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
                  color: teinte,
                  background: fond,
                  border: `1px solid ${bord}`,
                }}
              >
                {isNeutre ? "·" : e.r}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "0.85rem", color: "var(--bone)", fontWeight: 500 }}>{e.jeu}</span>
                <span className="mono-num" style={{ display: "block", fontSize: "0.68rem", color: "var(--faint)" }}>{e.detail}</span>
              </span>
              <span className="mono-num" style={{
                fontSize: "0.95rem", fontWeight: 600,
                color: isWin ? "var(--victory)" : "var(--ember)",
              }}>
                +{e.pts}
              </span>
            </div>
          );
        })}
      </div>

      {/* Total, puis ce qu'il donne dans chaque exercice : la conversion est le
          produit, autant la montrer dès l'accueil. */}
      <div style={{ padding: "16px 20px", background: "rgba(255,77,46,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="eyebrow">{totalLabel}</span>
          <span className="mono-num" style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--ember)", lineHeight: 1 }}>
            {total} <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,77,46,0.7)" }}>{unit}</span>
          </span>
        </div>
        <div
          className="mono-num"
          style={{
            fontSize: "0.7rem", color: "var(--faint)", textAlign: "right", marginTop: 6,
            opacity: complet ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
        >
          {conversion}
        </div>
      </div>
    </div>
  );
}

/* ── Landing ─────────────────────────────────────────────────────────────── */
