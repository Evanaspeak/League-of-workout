"use client";
import { useT, useMinuscule } from "@/lib/i18n/LocaleContext";
import { nomsExercices, descriptionsExercices } from "@/lib/nomsExercices";
import { exercices as exercicesDict } from "@/lib/i18n/dictionaries/exercices";
import {
  EXERCICES, EXERCICE_IDS, formaterCompact, type ExerciceId,
} from "@/lib/exercices";

/**
 * Cases à cocher de sélection des exercices. Plusieurs choix sont possibles :
 * ils tournent alors à tour de rôle d'une partie à l'autre. On empêche de tout
 * décocher, sinon il n'y aurait plus aucune façon de payer sa dette.
 */
export function ExerciceSelector({
  selection,
  onChange,
  exemplePoints = 38,
  compact = false,
}: {
  selection: ExerciceId[];
  onChange: (next: ExerciceId[]) => void;
  /** Coût d'exemple affiché sur chaque carte (en points d'effort). */
  exemplePoints?: number;
  compact?: boolean;
}) {
  const t = useT(exercicesDict);
  const minuscule = useMinuscule();
  const noms: Record<ExerciceId, string> = nomsExercices(t);
  const descs: Record<ExerciceId, string> = descriptionsExercices(t);

  const basculer = (id: ExerciceId) => {
    const coche = selection.includes(id);
    // Le dernier exercice coché ne peut pas être retiré.
    if (coche && selection.length === 1) return;
    const next = coche ? selection.filter((x) => x !== id) : [...selection, id];
    onChange(EXERCICE_IDS.filter((x) => next.includes(x)));
  };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(190px, 1fr))",
      gap: compact ? 8 : 10,
    }}>
      {EXERCICE_IDS.map((id) => {
        const actif = selection.includes(id);
        const seul = actif && selection.length === 1;
        return (
          <button
            key={id}
            type="button"
            role="checkbox"
            aria-checked={actif}
            onClick={() => basculer(id)}
            title={seul ? t.dernierExercice : undefined}
            style={{
              textAlign: "left",
              display: "flex",
              alignItems: compact ? "center" : "flex-start",
              gap: 10,
              padding: compact ? "10px 12px" : "14px 16px",
              borderRadius: 10,
              cursor: seul ? "default" : "pointer",
              background: actif ? "rgba(255,180,84,0.07)" : "rgba(236,239,244,0.02)",
              border: `1px solid ${actif ? "var(--amber)" : "var(--line)"}`,
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            {/* Case */}
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                width: 17, height: 17, borderRadius: 4, marginTop: compact ? 0 : 2,
                border: `1px solid ${actif ? "var(--amber)" : "var(--line-strong)"}`,
                background: actif ? "var(--amber)" : "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {actif && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="#0C0E11" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </span>

            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{
                display: "block",
                fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)",
                fontWeight: 600, fontSize: compact ? "0.95rem" : "1.05rem",
                textTransform: "uppercase", letterSpacing: "0.04em",
                color: actif ? "var(--amber)" : "var(--bone)",
                marginBottom: compact ? 0 : 4,
              }}>
                {noms[id]}
              </span>
              {!compact && (
                <span style={{ display: "block", fontSize: "0.76rem", color: "var(--faint)", lineHeight: 1.5 }}>
                  {descs[id]}
                </span>
              )}
              {/* Le groupe travaillé et le matériel nécessaire, dits avant le
                  choix. Découvrir qu'on n'a pas de barre une fois la dette due
                  est la pire façon de l'apprendre. */}
              {!compact && (
                <span style={{
                  display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6,
                }}>
                  <span style={{
                    fontSize: "0.68rem", padding: "2px 6px", borderRadius: 999,
                    border: "1px solid var(--line)", color: "var(--faint)",
                  }}>
                    {t.groupeNom[EXERCICES[id].groupe]}
                  </span>
                  {EXERCICES[id].materiel && (
                    <span style={{
                      fontSize: "0.68rem", padding: "2px 6px", borderRadius: 999,
                      border: "1px solid var(--amber)", color: "var(--amber)",
                    }}>
                      {t.materielRequis}
                    </span>
                  )}
                </span>
              )}
              <span className="mono-num" style={{
                display: "block", fontSize: "0.78rem", color: "var(--amber)", marginTop: compact ? 2 : 8,
              }}>
                {EXERCICES[id].unite === "reps"
                  ? `${formaterCompact(exemplePoints, id)} ${minuscule(noms[id])}`
                  : formaterCompact(exemplePoints, id)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
