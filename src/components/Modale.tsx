"use client";
import { useEffect, useRef } from "react";

/** Ce qui peut recevoir le focus au clavier à l'intérieur de la fenêtre. */
const FOCUSABLES = [
  "a[href]", "button:not([disabled])", "input:not([disabled])",
  "select:not([disabled])", "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

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
  const panneauRef = useRef<HTMLDivElement>(null);

  // `onFermer` est presque toujours écrit en ligne par l'appelant, donc recréé
  // à chaque rendu. En faire une dépendance de l'effet le rejouait à chaque
  // frappe et à chaque seconde de compte à rebours — et chaque relance rendait
  // le focus à la croix, en plein milieu de la saisie. On le lit par référence.
  const fermerRef = useRef(onFermer);
  useEffect(() => { fermerRef.current = onFermer; }, [onFermer]);

  useEffect(() => {
    // Le focus entre dans la fenêtre et n'en sort plus tant qu'elle est
    // ouverte : sans ça, la tabulation continue dans la page derrière et la
    // fenêtre n'existe pas pour qui navigue au clavier ou au lecteur d'écran.
    const rendreA = document.activeElement as HTMLElement | null;
    const premier = panneauRef.current?.querySelector<HTMLElement>(FOCUSABLES);
    (premier ?? panneauRef.current)?.focus();

    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") { fermerRef.current(); return; }
      if (e.key !== "Tab") return;
      const cibles = Array.from(
        panneauRef.current?.querySelectorAll<HTMLElement>(FOCUSABLES) ?? [],
      ).filter((el) => el.offsetParent !== null);
      if (cibles.length === 0) return;
      const debut = cibles[0];
      const fin = cibles[cibles.length - 1];
      if (e.shiftKey && document.activeElement === debut) {
        e.preventDefault(); fin.focus();
      } else if (!e.shiftKey && document.activeElement === fin) {
        e.preventDefault(); debut.focus();
      }
    };

    document.addEventListener("keydown", surTouche);
    const overflowInitial = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = overflowInitial;
      // Le focus revient d'où il venait : on ne perd pas sa place dans la page.
      rendreA?.focus?.();
    };
    // Monté une seule fois : le piège se pose à l'ouverture et se lève à la
    // fermeture, jamais entre les deux.
  }, []);

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
        ref={panneauRef}
        tabIndex={-1}
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
