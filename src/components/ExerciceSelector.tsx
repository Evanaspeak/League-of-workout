"use client";
import { useT, useMinuscule, useDateLocale } from "@/lib/i18n/LocaleContext";
import { nomsExercices, descriptionsExercices } from "@/lib/nomsExercices";
import { exercices as exercicesDict } from "@/lib/i18n/dictionaries/exercices";
import {
  EXERCICES, EXERCICE_IDS, exercicesParGroupe, formaterCompact, type ExerciceId,
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
  const etiquette = useDateLocale();
  const noms: Record<ExerciceId, string> = nomsExercices(t);
  const descs: Record<ExerciceId, string> = descriptionsExercices(t);

  const basculer = (id: ExerciceId) => {
    const coche = selection.includes(id);
    // Le dernier exercice coché ne peut pas être retiré.
    if (coche && selection.length === 1) return;
    const next = coche ? selection.filter((x) => x !== id) : [...selection, id];
    onChange(EXERCICE_IDS.filter((x) => next.includes(x)));
  };

  /**
   * Une section par sous-catégorie (réponses 061 et 067).
   *
   * À seize exercices, la liste plate ne se lit plus — et la rotation censée
   * éviter trois jours de pectoraux d'affilée n'a aucun moyen de se voir.
   *
   * Chaque section porte `role="group"` et se NOMME par son titre : un
   * intitulé posé devant une rangée de cases n'étiquette rien tout seul, un
   * lecteur d'écran le lit comme un texte quelconque. C'est le défaut déjà
   * corrigé sur le panneau du corps, et il se reprend ici.
   */
  return (
    <div style={{ display: "grid", gap: compact ? 14 : 20 }}>
      {exercicesParGroupe().map(({ groupe, ids }) => (
        <section key={groupe} role="group" aria-labelledby={`exo-groupe-${groupe}`}>
          <h4
            id={`exo-groupe-${groupe}`}
            style={{
              margin: compact ? "0 0 6px" : "0 0 10px",
              fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)",
              fontSize: compact ? "0.72rem" : "0.78rem",
              textTransform: "uppercase", letterSpacing: "0.08em",
              color: "var(--faint)", fontWeight: 600,
            }}
          >
            {t.groupeNom[groupe]}
          </h4>
          <div style={{
            display: "grid",
            gridTemplateColumns: compact ? "1fr" : "repeat(auto-fit, minmax(190px, 1fr))",
            gap: compact ? 8 : 10,
          }}>
      {ids.map((id) => {
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
              background: actif ? "color-mix(in srgb, var(--amber) 7%, transparent)" : "color-mix(in srgb, var(--bone) 2%, transparent)",
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
                  stroke="var(--ink)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
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
                <span style={{ display: "block", fontSize: "0.76rem", color: "var(--muted)", lineHeight: 1.5 }}>
                  {descs[id]}
                </span>
              )}
              {/* Le matériel nécessaire, dit avant le choix : découvrir qu'on
                  n'a pas de barre une fois la dette due est la pire façon de
                  l'apprendre. Le groupe travaillé, lui, a quitté la carte pour
                  le titre de sa section — le répéter seize fois n'apprenait
                  plus rien. */}
              {!compact && (
                <span style={{
                  display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6,
                }}>
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
                  ? `${formaterCompact(exemplePoints, id, null, etiquette)} ${minuscule(noms[id])}`
                  : formaterCompact(exemplePoints, id, null, etiquette)}
              </span>
            </span>
          </button>
        );
      })}
          </div>
        </section>
      ))}
    </div>
  );
}
