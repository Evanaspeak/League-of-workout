"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { maj as dict } from "@/lib/i18n/dictionaries/maj";
import type { EtatMaj } from "@/types/electron";

/**
 * Bandeau de mise à jour, en bas de l'application.
 *
 * Il suit le téléchargement puis propose de redémarrer. L'installeur pèse plus
 * de 70 Mo : sans jauge, la seule chose visible serait une longue absence de
 * réaction, indistinguable d'une panne.
 */
export function MajDesktop() {
  const t = useT(dict);
  const [etat, setEtat] = useState<EtatMaj | null>(null);
  const [masque, setMasque] = useState(false);

  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.majEtat || !pont.onMajEtat) return;
    // L'état courant d'abord : le téléchargement a pu se terminer avant que
    // cette page existe. L'abonnement seul manquerait ce cas.
    pont.majEtat().then(setEtat).catch(() => {});
    return pont.onMajEtat(setEtat);
  }, []);

  const statut = etat?.statut;
  const enCours = statut === "telechargement";
  const prete = statut === "prete";
  if (masque || (!enCours && !prete)) return null;

  const pct = Math.min(100, Math.max(0, etat?.progression ?? 0));

  return (
    <div
      role="status"
      style={{
        // La marge à droite laisse passer le bouton du rail latéral, replié
        // dans ce coin dès que la fenêtre est étroite — celle de l'application
        // l'est toujours.
        position: "fixed", left: 16, right: 76, bottom: 16, zIndex: 900,
        margin: "0 auto", maxWidth: 520,
        padding: "12px 16px", borderRadius: 10,
        background: "var(--carbon, #14171C)",
        border: `1px solid ${prete ? "var(--amber, #FFB454)" : "var(--line-strong, rgba(152,162,176,0.28))"}`,
        boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <span style={{ flex: 1, minWidth: 190, fontSize: "0.85rem", color: "var(--bone, #ECEFF4)", lineHeight: 1.5 }}>
          {prete
            ? (etat?.version ? t.preteVersion(etat.version) : t.prete)
            : (etat?.version ? t.telechargement(etat.version) : t.telechargementSansVersion)}
        </span>

        {prete ? (
          <>
            <button className="lol-btn text-sm" onClick={() => window.electronLOL?.majInstaller?.()}>
              {t.redemarrer}
            </button>
            <button
              onClick={() => setMasque(true)}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                fontSize: "0.78rem", color: "rgba(236,239,244,0.45)",
              }}
            >
              {t.plusTard}
            </button>
          </>
        ) : (
          <span className="mono-num" style={{ fontSize: "0.85rem", color: "var(--amber, #FFB454)", fontWeight: 600 }}>
            {pct}%
          </span>
        )}
      </div>

      {enCours && (
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          style={{
            marginTop: 10, height: 4, borderRadius: 999, overflow: "hidden",
            background: "rgba(152,162,176,0.16)",
          }}
        >
          <div style={{
            width: `${pct}%`, height: "100%", borderRadius: 999,
            // Le dégradé de la marque : l'ember vers l'ambre, comme le sigle.
            background: "linear-gradient(90deg, var(--ember, #FF4D2E), var(--amber, #FFB454))",
            transition: "width 0.3s ease",
          }} />
        </div>
      )}
    </div>
  );
}
