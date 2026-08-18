"use client";
import { useEffect } from "react";

/**
 * Marque la page comme affichée dans l'application desktop.
 *
 * Celle-ci ne dessine plus la barre de titre de Windows — une bande claire avec
 * le nom du programme et un menu « File / Edit / View » sans usage ici. Ne
 * restent que les vrais boutons système, posés en haut à droite par-dessus la
 * page. En échange, c'est à la page de dire où l'on peut attraper la fenêtre
 * pour la déplacer : sans zone désignée, elle ne bouge plus à la souris.
 *
 * Le repère vit sur la balise racine plutôt que dans un composant, pour que les
 * règles tiennent en CSS et s'appliquent à toutes les barres de navigation du
 * site — y compris celles des pages qui ont la leur.
 */
export function CadreDesktop() {
  useEffect(() => {
    if (!window.electronLOL?.isDesktop) return;
    const racine = document.documentElement;
    racine.classList.add("cadre-desktop");
    return () => racine.classList.remove("cadre-desktop");
  }, []);

  return null;
}
