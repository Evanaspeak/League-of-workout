"use client";
import { useEffect } from "react";

/**
 * Fenêtre modale de l'app. Elle se ferme au clic sur le fond, à la croix et à
 * la touche Échap — trois sorties, parce qu'une modale sans échappatoire
 * évidente enferme. Le défilement de la page est gelé tant qu'elle est ouverte,
 * sinon le fond glisse sous les doigts sur mobile.
 */
export function Modale({
  titre,
  onFermer,
  largeur = "34rem",
  children,
}: {
  titre: string;
  onFermer: () => void;
  /** Largeur maximale du panneau. */
  largeur?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => { if (e.key === "Escape") onFermer(); };
    document.addEventListener("keydown", surTouche);
    const overflowInitial = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = overflowInitial;
    };
  }, [onFermer]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      onClick={(e) => { if (e.target === e.currentTarget) onFermer(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 9000,
        background: "rgba(6,8,10,0.82)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "clamp(12px, 5vh, 56px) 16px",
        overflowY: "auto",
      }}
    >
      <div
        className="lol-panel w-full"
        style={{ maxWidth: largeur, padding: "20px", position: "relative" }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">{titre}</h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 6,
              background: "rgba(152,162,176,0.08)",
              border: "1px solid var(--line)",
              color: "rgba(236,239,244,0.6)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
