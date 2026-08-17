"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { overlay as dict } from "@/lib/i18n/dictionaries/overlay";

/**
 * Overlay en jeu, réglable depuis l'application desktop uniquement.
 *
 * Il s'affiche par-dessus un jeu en fenêtré ou en sans bordure, mais pas en
 * plein écran exclusif : le jeu y détient l'écran seul, et rien d'autre n'y est
 * dessiné. Aucune façon de contourner ça sans s'accrocher au rendu du jeu, ce
 * qu'un anti-cheat prendrait — à raison — pour une intrusion. On l'explique
 * donc, plutôt que de laisser croire à une panne.
 */
export function ReglageOverlay() {
  const t = useT(dict);
  // Un seul état, renseigné depuis la réponse du pont : hors application
  // desktop il reste nul, et la section ne s'affiche pas du tout.
  const [etat, setEtat] = useState<{ actif: boolean } | null>(null);

  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.overlayActif) return;
    pont.overlayActif().then((actif) => setEtat({ actif })).catch(() => {});
  }, []);

  if (!etat) return null;
  const actif = etat.actif;

  const basculer = async () => {
    const suivant = !actif;
    setEtat({ actif: suivant });
    try {
      setEtat({ actif: await window.electronLOL!.setOverlayActif!(suivant) });
    } catch {
      setEtat({ actif: !suivant });
    }
  };

  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }} className="space-y-3">
      <h2 style={{
        fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
        fontSize: "0.72rem", color: "#ECEFF4",
        letterSpacing: "0.16em", textTransform: "uppercase",
      }}>
        {t.titre}
      </h2>
      <p className="text-xs" style={{ color: "rgba(236,239,244,0.45)", lineHeight: 1.6 }}>
        {t.aide}
      </p>

      <button
        onClick={basculer}
        aria-pressed={actif}
        className="text-sm"
        style={{
          padding: "8px 16px",
          borderRadius: 999,
          cursor: "pointer",
          background: actif ? "rgba(255,180,84,0.1)" : "transparent",
          border: `1px solid ${actif ? "var(--amber)" : "var(--line-strong)"}`,
          color: actif ? "var(--amber)" : "rgba(236,239,244,0.6)",
          transition: "all 0.15s",
        }}
      >
        {actif ? t.active : t.desactive}
      </button>

      {actif && (
        <p className="text-xs" style={{ color: "rgba(236,239,244,0.35)", lineHeight: 1.6 }}>
          {t.limitePleinEcran}<br />{t.raccourci}
        </p>
      )}
    </div>
  );
}
