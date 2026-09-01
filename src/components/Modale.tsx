"use client";
import { useRef } from "react";
import { usePiegeFocus } from "@/lib/usePiegeFocus";
import { useT } from "@/lib/i18n/LocaleContext";
import { modale } from "@/lib/i18n/dictionaries/modale";

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
  sansFermeture = false,
  children,
}: {
  titre: string;
  onFermer: () => void;
  /** Largeur maximale du panneau. */
  largeur?: string;
  /**
   * Retire les trois sorties : croix, Échap, clic sur le fond.
   *
   * À n'employer que pour une fenêtre qui POSE UNE QUESTION dont la réponse
   * conditionne la suite — un consentement, par exemple, qu'on ne peut pas
   * traiter comme un « plus tard » sans continuer à faire ce qu'on demande la
   * permission de faire. La fenêtre doit alors porter elle-même ses issues,
   * toutes deux au même niveau : refuser doit être aussi simple qu'accepter.
   */
  sansFermeture?: boolean;
  children: React.ReactNode;
}) {
  const t = useT(modale);
  const panneauRef = useRef<HTMLDivElement>(null);

  /**
   * Le clavier vit dans `usePiegeFocus`, avec les quatre autres fenêtres.
   *
   * Il était écrit ici et nulle part ailleurs : les quatre fenêtres qui
   * n'emploient pas ce composant s'annonçaient donc comme modales sans rien
   * tenir de ce qu'annonce `aria-modal`.
   *
   * `sansFermeture` retire Échap en même temps que la croix et le clic sur le
   * fond : une fenêtre qui pose une question dont la réponse conditionne la
   * suite ne se referme pas d'une touche.
   */
  usePiegeFocus(panneauRef, { onEchap: sansFermeture ? null : onFermer });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titre}
      onClick={(e) => { if (!sansFermeture && e.target === e.currentTarget) onFermer(); }}
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
        ref={panneauRef}
        tabIndex={-1}
        className="lol-panel w-full"
        style={{ maxWidth: largeur, padding: "20px", position: "relative" }}
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="titre-section">{titre}</h2>
          {/* Pas de croix quand il n'y a pas de sortie : un bouton qui ne ferme
              rien est pire que pas de bouton. */}
          {!sansFermeture && <button
            type="button"
            onClick={onFermer}
            aria-label={t.fermer}
            style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 6,
              background: "rgba(152,162,176,0.08)",
              border: "1px solid var(--line)",
              color: "var(--muted)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>}
        </div>
        {children}
      </div>
    </div>
  );
}
