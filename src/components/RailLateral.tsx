"use client";
import { useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { CompteurDette } from "@/components/CompteurDette";
import { estPagePublique } from "@/lib/pagesPubliques";

/** Identifiant de la zone où les pages déposent leurs actions. */
const ZONE_ACTIONS = "rail-actions";

/**
 * Colonne fixe de la marge droite. Elle réunit ce qui doit rester sous les yeux
 * quoi qu'on fasse : la dette en attente, puis les actions de la page courante.
 * Les regrouper dans un même conteneur garantit qu'elles s'empilent au lieu de
 * se recouvrir, quelle que soit la hauteur de la pastille de dette.
 */
export function RailLateral() {
  const chemin = usePathname();
  const actif = !estPagePublique(chemin);

  // La marge du rail se réserve en CSS, mais seulement là où il existe : les
  // pages publiques gardent leur mise en page pleine largeur.
  useEffect(() => {
    if (!actif) return;
    document.body.dataset.rail = "1";
    return () => { delete document.body.dataset.rail; };
  }, [actif]);

  if (!actif) return null;

  return (
    <div className="rail-lateral">
      <CompteurDette />
      <div id={ZONE_ACTIONS} style={{ display: "contents" }} />
    </div>
  );
}

/** Rien à s'abonner : la zone est rendue une fois pour toutes par le layout. */
const sAbonner = () => () => {};
const zoneCliente = () => document.getElementById(ZONE_ACTIONS);
const zoneServeur = () => null;

/**
 * Dépose des actions dans le rail depuis n'importe quelle page. Le portail
 * évite d'avoir à faire remonter l'état de la page jusqu'au layout.
 */
export function RailActions({ children }: { children: React.ReactNode }) {
  const zone = useSyncExternalStore(sAbonner, zoneCliente, zoneServeur);
  if (!zone) return null;
  return createPortal(children, zone);
}
