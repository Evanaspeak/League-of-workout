"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { detection as dict } from "@/lib/i18n/dictionaries/detection";
import type { ConfigDetection } from "@/types/electron";
import { Icone } from "@/components/Icone";

const PASTILLE = (actif: boolean): React.CSSProperties => ({
  padding: "6px 13px",
  borderRadius: 999,
  cursor: "pointer",
  fontSize: "0.78rem",
  background: actif ? "rgba(255,180,84,0.1)" : "transparent",
  border: `1px solid ${actif ? "var(--amber)" : "var(--line-strong)"}`,
  color: actif ? "var(--amber)" : "rgba(236,239,244,0.6)",
  transition: "all 0.15s",
});

/**
 * Choix des jeux surveillés et de ce que leur lancement déclenche.
 *
 * N'apparaît que dans l'application desktop : sur le web, aucune page ne peut
 * savoir ce qui tourne sur la machine, et c'est très bien ainsi.
 */
export function ReglageDetection() {
  const t = useT(dict);
  const [config, setConfig] = useState<ConfigDetection | null>(null);
  const [demarrage, setDemarrage] = useState<{ actif: boolean; disponible: boolean } | null>(null);

  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.detectionLire) return;
    pont.detectionLire().then(setConfig).catch(() => {});
    pont.demarrageLire?.().then(setDemarrage).catch(() => {});
  }, []);

  if (!config) return null;

  const enregistrer = async (suivant: Partial<Omit<ConfigDetection, "disponible">>) => {
    // On affiche tout de suite, puis on retient ce que l'application a
    // réellement enregistré : elle écarte les jeux qu'elle ne sait pas détecter.
    setConfig((prec) => (prec ? { ...prec, ...suivant } as ConfigDetection : prec));
    try {
      setConfig(await window.electronLOL!.detectionEcrire!(suivant));
    } catch {
      /* l'état précédent reste affiché */
    }
  };

  const basculerAction = (cle: keyof ConfigDetection["actions"]) => {
    enregistrer({
      surveilles: config.surveilles,
      actions: { ...config.actions, [cle]: !config.actions[cle] },
    });
  };

  const actions: { cle: keyof ConfigDetection["actions"]; nom: string; aide: string }[] = [
    { cle: "session", nom: t.actionSession, aide: t.actionSessionAide },
    { cle: "overlay", nom: t.actionOverlay, aide: t.actionOverlayAide },
    { cle: "fenetre", nom: t.actionFenetre, aide: t.actionFenetreAide },
  ];

  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }} className="space-y-4">
      <div className="space-y-2">
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
      </div>

      {config.disponible.length === 0 ? (
        <p className="text-xs" style={{ color: "rgba(236,239,244,0.4)" }}>{t.indisponible}</p>
      ) : (
        <>
          {/* Le choix des jeux surveillés a rejoint le bloc de chaque jeu :
              c'est là qu'on s'en occupe, avec l'overlay et le compte. Ne reste
              ici que ce qui vaut pour tous. */}
          <div className="space-y-2">
            <p className="text-xs" style={{ color: "rgba(152,162,176,0.7)" }}>{t.actionsTitre}</p>
            <div className="space-y-2">
              {actions.map(({ cle, nom, aide }) => (
                <div key={cle} style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={() => basculerAction(cle)}
                    aria-pressed={config.actions[cle]}
                    style={{ ...PASTILLE(config.actions[cle]), minWidth: 190, textAlign: "left" }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      {config.actions[cle] && <Icone nom="coche" taille={14} />}
                      {nom}
                    </span>
                  </button>
                  <span className="text-xs" style={{ color: "rgba(236,239,244,0.35)", flex: 1, minWidth: 200 }}>
                    {aide}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {demarrage?.disponible && (
        <div className="space-y-2">
          <p className="text-xs" style={{ color: "rgba(152,162,176,0.7)" }}>{t.demarrageTitre}</p>
          <p className="text-xs" style={{ color: "rgba(236,239,244,0.45)", lineHeight: 1.6 }}>
            {t.demarrageAide}
          </p>
          <button
            onClick={async () => {
              const suivant = !demarrage.actif;
              setDemarrage({ ...demarrage, actif: suivant });
              try {
                setDemarrage(await window.electronLOL!.demarrageEcrire!(suivant));
              } catch {
                setDemarrage(demarrage);
              }
            }}
            aria-pressed={demarrage.actif}
            style={PASTILLE(demarrage.actif)}
          >
            {demarrage.actif ? t.demarrageActif : t.demarrageInactif}
          </button>
        </div>
      )}
    </div>
  );
}
