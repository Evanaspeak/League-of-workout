"use client";
import { useCallback, useEffect, useState } from "react";
import { useT, useDateLocale } from "@/lib/i18n/LocaleContext";
import { exercices as dict } from "@/lib/i18n/dictionaries/exercices";
import { nomsExercices } from "@/lib/nomsExercices";
import type { ExerciceId } from "@/lib/exercices";

type Etat = { actifs: ExerciceId[]; suspendus: ExerciceId[]; depuis: string | null };

/**
 * Mettre un exercice de côté, et le reprendre.
 *
 * Une gêne au poignet interdit les pompes pendant deux semaines. Sans ce
 * geste, il ne restait que deux issues : décocher l'exercice — ce qui perd la
 * trace de ce qu'on faisait — ou continuer et aggraver.
 *
 * Aucune raison n'est demandée. Une case « pourquoi ? » ferait de cet écran un
 * dossier médical, ce qu'il n'est pas et n'a pas à devenir.
 */
export function SuspensionExercice({ surChangement }: { surChangement?: () => void }) {
  const t = useT(dict);
  const etiquette = useDateLocale();
  const noms = nomsExercices(t);
  const [etat, setEtat] = useState<Etat | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const relire = useCallback(async () => {
    try {
      const r = await fetch("/api/suspension");
      if (r.ok) setEtat(await r.json());
    } catch { /* la page reste utilisable sans ce bloc */ }
  }, []);

  useEffect(() => { void relire(); }, [relire]);

  const agir = async (methode: "POST" | "DELETE", exercice: ExerciceId) => {
    setErreur(null);
    const r = await fetch("/api/suspension", {
      method: methode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exercice }),
    });
    if (!r.ok) {
      // Le seul refus qu'on sache nommer est celui du dernier exercice : le
      // reste ne se produit qu'en cas de panne, et un message inventé pour
      // l'occasion en dirait moins que rien.
      const { error } = await r.json().catch(() => ({ error: "" }));
      setErreur(String(error) || t.dernierSuspendu);
      return;
    }
    setEtat(await r.json());
    surChangement?.();
  };

  if (!etat) return null;

  const depuis = etat.depuis
    ? new Intl.DateTimeFormat(etiquette, { dateStyle: "long" }).format(new Date(etat.depuis))
    : null;

  return (
    <div className="lol-panel p-5 space-y-4">
      <div>
        <h2 className="titre-section">{t.suspendreTitre}</h2>
        <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.suspendreAide}</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {etat.actifs.map((id) => (
          <div key={id} className="flex items-baseline justify-between gap-3"
            style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontSize: "0.9rem" }}>{noms[id]}</span>
            <button
              type="button"
              onClick={() => agir("POST", id)}
              className="text-xs"
              style={{
                color: "var(--steel)", background: "none", border: "none",
                cursor: "pointer", padding: 0, textDecoration: "underline",
              }}
            >
              {t.suspendre}
            </button>
          </div>
        ))}
      </div>

      {etat.suspendus.length > 0 && (
        <div>
          <div style={{
            fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--gold)", marginBottom: 4,
          }}>
            {t.suspendusTitre}{depuis ? ` · ${t.suspenduDepuis(depuis)}` : ""}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {etat.suspendus.map((id) => (
              <div key={id} className="flex items-baseline justify-between gap-3"
                style={{ padding: "4px 0", borderBottom: "1px solid var(--line)", opacity: 0.6 }}>
                <span style={{ fontSize: "0.9rem" }}>{noms[id]}</span>
                <button
                  type="button"
                  onClick={() => agir("DELETE", id)}
                  className="text-xs"
                  style={{
                    color: "var(--gold)", background: "none", border: "none",
                    cursor: "pointer", padding: 0, textDecoration: "underline",
                  }}
                >
                  {t.reprendre}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {erreur && <p className="text-sm loss-text">{erreur}</p>}
    </div>
  );
}
