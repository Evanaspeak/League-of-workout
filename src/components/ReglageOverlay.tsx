"use client";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { overlay as dict } from "@/lib/i18n/dictionaries/overlay";
import type { EtatOverlay } from "@/types/electron";

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
  // Position et raccourcis réellement obtenus : un raccourci global peut être
  // refusé sans que rien ne le dise, et c'est alors introuvable.
  const [place, setPlace] = useState<EtatOverlay | null>(null);

  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.overlayActif) return;
    pont.overlayActif().then((actif) => setEtat({ actif })).catch(() => {});
    pont.overlayCoinLire?.().then(setPlace).catch(() => {});
  }, []);

  // Quitter la page en plein placement laisserait la pastille attrapable, sans
  // plus rien pour en sortir : on referme le mode avec la page.
  const placementRef = useRef(false);
  useEffect(() => { placementRef.current = Boolean(place?.placement); }, [place]);
  useEffect(() => () => {
    if (placementRef.current) window.electronLOL?.overlayPlacement?.(false).catch(() => {});
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
          {t.limitePleinEcran}
        </p>
      )}

      {actif && place && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: "rgba(152,162,176,0.7)" }}>{t.positionTitre}</p>
          <p className="text-xs" style={{ color: "rgba(236,239,244,0.45)", lineHeight: 1.6 }}>
            {t.positionAide}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {place.coins.map((coin) => {
              // Un coin cesse d'être « le » choix dès qu'on a posé la pastille
              // à la main : afficher les deux comme actifs mentirait sur ce qui
              // décide réellement de sa position.
              const choisi = !place.libre && coin === place.coin;
              return (
                <button
                  key={coin}
                  aria-pressed={choisi}
                  onClick={async () => {
                    try { setPlace(await window.electronLOL!.overlayCoinEcrire!(coin)); } catch { /* inchangé */ }
                  }}
                  style={{
                    padding: "6px 13px", borderRadius: 999, cursor: "pointer", fontSize: "0.78rem",
                    background: choisi ? "rgba(255,180,84,0.1)" : "transparent",
                    border: `1px solid ${choisi ? "var(--amber)" : "var(--line-strong)"}`,
                    color: choisi ? "var(--amber)" : "rgba(236,239,244,0.6)",
                  }}
                >
                  {t.coins[coin] ?? coin}
                </button>
              );
            })}
          </div>
          {/* Les quatre coins ne suffisent pas : selon la résolution et
              l'interface du jeu, la zone libre n'est jamais au même endroit.
              Le placement à la main est plus direct qu'un aller-retour par
              capture d'écran, et donne le résultat au pixel près. */}
          {window.electronLOL?.overlayPlacement && (
            <div className="space-y-2">
              <button
                onClick={async () => {
                  try {
                    setPlace(await window.electronLOL!.overlayPlacement!(!place.placement));
                  } catch { /* inchangé */ }
                }}
                aria-pressed={place.placement}
                className="text-sm"
                style={{
                  padding: "6px 14px", borderRadius: 999, cursor: "pointer",
                  background: place.placement ? "rgba(47,217,138,0.12)" : "transparent",
                  border: `1px solid ${place.placement ? "var(--victory)" : "var(--line-strong)"}`,
                  color: place.placement ? "var(--victory)" : "rgba(236,239,244,0.6)",
                }}
              >
                {place.placement ? t.placerTerminer : t.placerBtn}
              </button>
              {place.placement && (
                <p className="text-xs" style={{ color: "var(--victory)", lineHeight: 1.6 }}>
                  {t.placerEnCours}
                </p>
              )}
              {!place.placement && place.libre && (
                <p className="text-xs" style={{ color: "rgba(236,239,244,0.45)", lineHeight: 1.6 }}>
                  {t.placerLibre}
                </p>
              )}
            </div>
          )}

          <p className="text-xs" style={{ color: "rgba(236,239,244,0.35)", lineHeight: 1.6 }}>
            {place.raccourcis.bascule ? t.raccourciActif(place.raccourcis.bascule) : t.raccourciAucun}
            {place.raccourcis.coin && <><br />{t.raccourciCoin(place.raccourcis.coin)}</>}
          </p>
        </div>
      )}
    </div>
  );
}
