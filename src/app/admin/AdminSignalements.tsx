"use client";
import { useCallback, useEffect, useState } from "react";
import { useT, useDateLocale } from "@/lib/i18n/LocaleContext";
import { adminSignalements } from "@/lib/i18n/dictionaries/adminSignalements";

type Signalement = {
  id: string;
  createdAt: string;
  message: string;
  page: string;
  contexte: Record<string, unknown>;
  statut: "ouvert" | "traite";
  pseudo: string | null;
};

/**
 * Les problèmes signalés, à l'endroit où quelqu'un peut agir.
 *
 * Un formulaire qui recueille sans que rien n'en sorte est pire qu'aucun
 * formulaire : il laisse croire qu'on a été entendu.
 */
export default function AdminSignalements() {
  const t = useT(adminSignalements);
  const etiquette = useDateLocale();
  const [lignes, setLignes] = useState<Signalement[] | null>(null);
  const [erreur, setErreur] = useState(false);

  const relire = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/signalements");
      if (!r.ok) { setErreur(true); return; }
      setLignes(await r.json());
      setErreur(false);
    } catch {
      setErreur(true);
    }
  }, []);

  useEffect(() => { void relire(); }, [relire]);

  const basculer = async (l: Signalement) => {
    const statut = l.statut === "ouvert" ? "traite" : "ouvert";
    // `relire()` seul suffit à masquer l'échec : la liste revient telle
    // qu'elle était, et on croit avoir mal cliqué.
    try {
      await fetch("/api/admin/signalements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: l.id, statut }),
      });
    } catch { /* la relecture ci-dessous montrera l'état réel */ }
    await relire();
  };

  const quand = (iso: string) =>
    new Intl.DateTimeFormat(etiquette, { dateStyle: "short", timeStyle: "short" })
      .format(new Date(iso));

  return (
    <div className="lol-panel p-5 space-y-4">
      <div>
        <h2 className="titre-section">{t.titre}</h2>
        <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.aide}</p>
      </div>

      {erreur && <p className="text-sm loss-text">{t.echec}</p>}
      {!erreur && lignes === null && (
        <p className="text-sm" style={{ color: "var(--steel)" }}>{t.chargement}</p>
      )}
      {lignes?.length === 0 && (
        <p className="text-sm" style={{ color: "var(--steel)" }}>{t.aucun}</p>
      )}

      <div className="flex flex-col gap-3">
        {lignes?.map((l) => (
          <div
            key={l.id}
            style={{
              border: "1px solid var(--line)", borderRadius: 6, padding: "12px 14px",
              // Un signalement traité s'efface sans disparaître : on doit
              // pouvoir le relire, et il ne doit pas retenir le regard.
              opacity: l.statut === "traite" ? 0.55 : 1,
              display: "flex", flexDirection: "column", gap: 6,
            }}
          >
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span style={{ fontSize: "0.72rem", color: "var(--gold)" }}>
                {l.pseudo ?? t.anonyme}
              </span>
              <span style={{ fontSize: "0.72rem", color: "var(--steel)" }}>
                {quand(l.createdAt)}
              </span>
            </div>

            <p style={{ fontSize: "0.9rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {l.message}
            </p>

            <div style={{ fontSize: "0.72rem", color: "var(--steel)" }}>
              {l.page}
              {Object.entries(l.contexte).map(([cle, valeur]) => (
                <span key={cle}> · {cle} {String(valeur)}</span>
              ))}
            </div>

            <button
              type="button"
              onClick={() => basculer(l)}
              className="text-xs"
              style={{
                alignSelf: "flex-start", color: "var(--steel)", background: "none",
                border: "none", cursor: "pointer", padding: 0, textDecoration: "underline",
              }}
            >
              {l.statut === "ouvert" ? t.marquerTraite : t.rouvrir}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
