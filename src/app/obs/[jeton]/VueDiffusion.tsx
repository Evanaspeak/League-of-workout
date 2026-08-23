"use client";
import { useEffect, useState } from "react";

type Etat = { lignes: string[]; points: number; serie: number; enRetard: boolean };

/** Toutes les dix secondes : assez pour suivre, assez peu pour ne rien coûter. */
const PERIODE_MS = 10_000;

/**
 * Le compteur, tel qu'un public le voit.
 *
 * Le fond est transparent : c'est ce qu'attend une source navigateur dans un
 * logiciel de diffusion, et c'est aussi ce qui rend la page inutilisable
 * ailleurs — tant mieux, elle n'a rien à faire ailleurs.
 *
 * Le texte porte un contour sombre plutôt qu'un fond : superposé à un jeu, un
 * fond ferait un rectangle au milieu de l'écran, et un texte sans contour
 * disparaîtrait sur les zones claires.
 */
export function VueDiffusion({ jeton }: { jeton: string }) {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [perdu, setPerdu] = useState(false);

  useEffect(() => {
    let vivant = true;
    const relire = async () => {
      try {
        const r = await fetch(`/api/obs/${encodeURIComponent(jeton)}`, { cache: "no-store" });
        if (!vivant) return;
        if (r.status === 404) { setPerdu(true); return; }
        if (!r.ok) return;
        setEtat(await r.json());
        setPerdu(false);
      } catch { /* le tour suivant réessaiera */ }
    };
    void relire();
    const minuteur = setInterval(relire, PERIODE_MS);
    return () => { vivant = false; clearInterval(minuteur); };
  }, [jeton]);

  const contour = {
    // Quatre ombres plutôt qu'un `-webkit-text-stroke` : le contour reste
    // dehors, et le chiffre ne s'amincit pas.
    textShadow: "0 2px 0 #000, 0 -2px 0 #000, 2px 0 0 #000, -2px 0 0 #000, 0 0 12px rgba(0,0,0,0.8)",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "transparent",
        display: "flex", flexDirection: "column",
        alignItems: "flex-start", justifyContent: "flex-start",
        padding: 24, gap: 2, fontFamily: "var(--font-heading, sans-serif)",
      }}
    >
      {perdu ? (
        <span style={{ ...contour, color: "#FF8A3D", fontSize: 22 }}>
          Lien invalide
        </span>
      ) : etat && etat.points > 0 ? (
        <>
          <span style={{
            ...contour, color: etat.enRetard ? "#FF8A3D" : "#C8AA6E",
            fontSize: 16, letterSpacing: "0.12em", textTransform: "uppercase",
          }}>
            À faire
          </span>
          <span style={{
            ...contour, color: "#FFFFFF", fontSize: 56, lineHeight: 1,
            fontVariantNumeric: "tabular-nums",
          }}>
            {etat.lignes.join(" · ")}
          </span>
          {etat.serie > 0 && (
            <span style={{ ...contour, color: "#2FD98A", fontSize: 18 }}>
              {etat.serie} j
            </span>
          )}
        </>
      ) : null}
    </div>
  );
}
