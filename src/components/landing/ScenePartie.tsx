"use client";
import type { ReactNode } from "react";

/**
 * L'overlay, posé par-dessus une partie.
 *
 * Montrer la pastille seule sur fond de page ne dit pas ce qu'elle est : on la
 * prend pour une carte du site. Or c'est une surcouche, qui vit au-dessus d'un
 * jeu en plein écran, dans un coin de l'écran.
 *
 * Le fond n'imite aucun jeu — ce serait emprunter une image qui ne nous
 * appartient pas. C'est une scène abstraite : la barre d'un jeu en cours, un
 * dégradé sombre, et le cadre d'un écran. Assez pour que la pastille se lise
 * comme ce qu'elle est.
 */
export function ScenePartie({ pastille, etiquette }: { pastille: ReactNode; etiquette: string }) {
  return (
    <div className="scene-partie">
      <div className="scene-partie-ecran" aria-hidden>
        {/* Le décor : des lignes de HUD suggérées, jamais copiées. */}
        <span className="sp-barre sp-barre-1" />
        <span className="sp-barre sp-barre-2" />
        <span className="sp-barre sp-barre-3" />
        <span className="sp-vignette" />
      </div>
      <span className="scene-partie-etiquette">{etiquette}</span>
      <div className="scene-partie-pastille">{pastille}</div>
    </div>
  );
}
