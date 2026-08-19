"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { CompteurDette } from "@/components/CompteurDette";
import { estPagePublique } from "@/lib/pagesPubliques";
import { useT } from "@/lib/i18n/LocaleContext";
import { nav as navDict } from "@/lib/i18n/dictionaries/nav";

/** Identifiant de la zone où les pages déposent leurs actions. */
const ZONE_ACTIONS = "rail-actions";

/**
 * Colonne fixe de la marge droite. Elle réunit ce qui doit rester sous les yeux
 * quoi qu'on fasse : la dette en attente, puis les actions de la page courante.
 * Les regrouper dans un même conteneur garantit qu'elles s'empilent au lieu de
 * se recouvrir, quelle que soit la hauteur de la pastille de dette.
 *
 * Sous 1180 px il n'y a plus de marge à occuper : le rail se replie derrière un
 * bouton, sinon il couvrirait un tiers de l'écran. Le bouton conserve l'alerte
 * de dette — replier ne doit pas revenir à masquer ce qu'on doit.
 */
export function RailLateral() {
  const chemin = usePathname();
  const t = useT(navDict);
  const actif = !estPagePublique(chemin);
  // Le chemin voyage avec l'état d'ouverture : changer de page referme le rail,
  // qui masquerait du contenu sur petit écran. Ajustement pendant le rendu
  // plutôt qu'un effet, pour ne pas déclencher de rendu en cascade.
  const [etat, setEtat] = useState({ ouvert: false, chemin });
  if (etat.chemin !== chemin) setEtat({ ouvert: false, chemin });
  const ouvert = etat.ouvert;
  const [dette, setDette] = useState<{ enAttente: boolean; alerte: boolean }>({
    enAttente: false, alerte: false,
  });

  // La marge du rail se réserve en CSS, mais seulement là où il existe : les
  // pages publiques gardent leur mise en page pleine largeur.
  useEffect(() => {
    if (!actif) return;
    document.body.dataset.rail = "1";
    return () => { delete document.body.dataset.rail; };
  }, [actif]);

  if (!actif) return null;

  return (
    <div className={`rail-lateral${ouvert ? " est-ouvert" : ""}`} data-visite="rail">
      <button
        type="button"
        className={`rail-bascule lol-panel${dette.alerte ? " alerte" : ""}`}
        onClick={() => setEtat((e) => ({ ...e, ouvert: !e.ouvert }))}
        aria-expanded={ouvert}
        aria-label={ouvert ? t.railReplier : t.railOuvrir}
        data-visite="rail-bascule"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" aria-hidden>
          {ouvert
            ? <path d="M18 6 6 18M6 6l12 12" />
            : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
        </svg>
        {dette.enAttente && !ouvert && <span className="rail-point" aria-hidden />}
      </button>

      <div className="rail-contenu">
        <CompteurDette onEtat={setDette} />
        <div id={ZONE_ACTIONS} style={{ display: "contents" }} />
      </div>
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
