"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { overlay as dictOverlay } from "@/lib/i18n/dictionaries/overlay";
import { detection as dictDetection } from "@/lib/i18n/dictionaries/detection";
import { Icone } from "@/components/Icone";
import { CompteRiot } from "@/components/CompteRiot";
import { useValeurClient } from "@/lib/valeurClient";
import { ReglageOverlay } from "@/components/ReglageOverlay";
import type { ConfigDetection, EtatOverlayJeux, OverlayJeu } from "@/types/electron";

/** Le seul jeu qui ait un compte à rattacher. */
const JEU_RIOT = "League of Legends";

const PASTILLE = (actif: boolean): React.CSSProperties => ({
  padding: "6px 13px",
  borderRadius: 999,
  cursor: "pointer",
  fontSize: "0.78rem",
  background: actif ? "rgba(255,180,84,0.1)" : "transparent",
  border: `1px solid ${actif ? "var(--amber)" : "var(--line-strong)"}`,
  color: actif ? "var(--amber)" : "var(--muted)",
  transition: "all 0.15s",
});

/**
 * Réglages regroupés par jeu, un bloc dépliable chacun.
 *
 * Les réglages étaient jusqu'ici rangés par mécanisme — le compte Riot dans le
 * profil, l'overlay d'un côté, la détection de l'autre — alors qu'on s'en
 * occupe toujours par jeu : « je veux la pastille sur League mais pas sur
 * Valorant ». Un bloc par jeu met au même endroit tout ce qui le concerne.
 *
 * Sur le web, seul League apparaît : il n'y a ni overlay ni détection sans
 * l'application desktop, et rester muet vaut mieux qu'afficher des boutons
 * morts.
 */
export function ReglageJeux() {
  const t = useT(dictOverlay);
  const tDet = useT(dictDetection);

  const [jeux, setJeux] = useState<EtatOverlayJeux | null>(null);
  const [detection, setDetection] = useState<ConfigDetection | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(JEU_RIOT);
  /**
   * L'application n'a pas retenu le dernier réglage.
   *
   * L'écran posait la nouvelle valeur AVANT de la faire enregistrer, et ne
   * faisait rien de l'échec : le commentaire promettait que « l'état précédent
   * reste affiché », ce qui était faux — c'est justement le nouvel état qui
   * restait. On voyait donc un réglage que l'application n'avait pas, et on
   * s'en apercevait au rechargement suivant, sans savoir pourquoi. Même défaut
   * que celui corrigé sur « Ton effort », au même moment.
   */
  const [erreur, setErreur] = useState(false);
  /**
   * Vrai quand l'application tourne mais ne connaît pas encore le réglage par
   * jeu : la page est servie depuis le site, elle peut donc être en avance sur
   * la version installée. Lu sans effet — c'est une valeur du navigateur, pas
   * un état à synchroniser.
   */
  const tropAncienne = useValeurClient(
    () => Boolean(window.electronLOL) && !window.electronLOL?.overlayJeuxLire,
    false,
  );

  /**
   * La page est-elle ouverte dans un navigateur ordinaire ?
   *
   * Alors il n'y a qu'un jeu dans la liste, et c'est normal : sans
   * l'application, ni pastille ni détection. Ce qui ne l'était pas, c'est de
   * ne rien en dire. La section annonce « chaque jeu a ses réglages », montre
   * un seul jeu, et laisse chercher où sont passés les autres.
   */
  const surLeWeb = useValeurClient(() => !window.electronLOL, false);

  useEffect(() => {
    const pont = typeof window !== "undefined" ? window.electronLOL : undefined;
    if (!pont?.overlayJeuxLire) return;
    pont.overlayJeuxLire().then(setJeux).catch(() => {});
    pont.detectionLire?.().then(setDetection).catch(() => {});
  }, []);

  const ecrire = async (jeu: string, patch: Partial<OverlayJeu>) => {
    // On affiche tout de suite, puis on retient ce que l'application a
    // réellement enregistré. Le retour en arrière n'est pas un ornement :
    // sans lui, le message d'échec et ce qu'on voit se contredisent.
    const avant = jeux;
    setJeux((prec) => (prec
      ? { ...prec, config: { ...prec.config, [jeu]: { ...prec.config[jeu], ...patch } as OverlayJeu } }
      : prec));
    try {
      setJeux(await window.electronLOL!.overlayJeuEcrire!(jeu, patch));
      setErreur(false);
    } catch {
      setJeux(avant);
      setErreur(true);
    }
  };

  const basculerSurveillance = async (jeu: string) => {
    if (!detection) return;
    const avant = detection;
    const surveilles = detection.surveilles.includes(jeu)
      ? detection.surveilles.filter((j) => j !== jeu)
      : [...detection.surveilles, jeu];
    setDetection({ ...detection, surveilles });
    try {
      setDetection(await window.electronLOL!.detectionEcrire!({ surveilles }));
      setErreur(false);
    } catch {
      setDetection(avant);
      setErreur(true);
    }
  };

  const placer = async (jeu: string, actif: boolean) => {
    try {
      await window.electronLOL!.overlayPlacement!(actif, jeu);
      setJeux(await window.electronLOL!.overlayJeuxLire!());
      setErreur(false);
    } catch {
      setErreur(true);
    }
  };

  // Quitter la page en plein placement laisserait la pastille attrapable, sans
  // plus rien pour en sortir.
  useEffect(() => () => {
    window.electronLOL?.overlayPlacement?.(false).catch(() => {});
  }, []);

  // Hors application desktop, il ne reste que le compte Riot de League.
  const liste = jeux ? jeux.jeux : [JEU_RIOT];
  // League passe en tête : c'est le jeu qui porte le plus de réglages.
  const ordonnes = [...liste].sort((a, b) =>
    a === JEU_RIOT ? -1 : b === JEU_RIOT ? 1 : a.localeCompare(b));

  return (
    <div className="space-y-2">
      {tropAncienne && (
        <p className="text-xs" style={{ color: "var(--amber)", lineHeight: 1.6 }}>
          {t.versionAncienne}
        </p>
      )}

      {erreur && (
        <p className="text-xs" role="status" style={{ color: "var(--loss)", lineHeight: 1.6 }}>
          {t.erreurReglage}
        </p>
      )}

      {jeux && jeux.jeux.length === 0 && (
        <p className="text-xs" style={{ color: "var(--faint)" }}>{t.jeuxAucun}</p>
      )}

      {surLeWeb && (
        <div style={{
          border: "1px solid var(--line)", borderRadius: 6,
          padding: "11px 14px", display: "flex", flexDirection: "column", gap: 5,
        }}>
          <span style={{ color: "var(--bone)", fontWeight: 600, fontSize: "0.85rem" }}>
            {t.surLeWebTitre}
          </span>
          <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6, margin: 0 }}>
            {t.surLeWebAide}
          </p>
          <Link href="/telechargement" style={{ color: "var(--amber)", fontSize: "0.8rem" }}>
            {t.surLeWebLien}
          </Link>
        </div>
      )}

      {ordonnes.map((jeu) => {
        const deplie = ouvert === jeu;
        const config = jeux?.config[jeu];
        const surveille = detection?.surveilles.includes(jeu) ?? false;
        return (
          <div key={jeu} style={{ border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden" }}>
            <button
              onClick={() => setOuvert(deplie ? null : jeu)}
              aria-expanded={deplie}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 10, padding: "11px 14px", cursor: "pointer",
                background: deplie ? "rgba(152,162,176,0.06)" : "transparent",
                border: "none", color: "#ECEFF4", textAlign: "left",
                fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)",
                fontSize: "0.85rem", letterSpacing: "0.08em",
              }}
            >
              <span>{jeu}</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                {config && (
                  <span className="text-xs" style={{
                    color: config.actif ? "var(--amber)" : "rgba(152,162,176,0.45)",
                    letterSpacing: 0, fontFamily: "var(--font-body, sans-serif)",
                  }}>
                    {config.actif ? t.jeuAffiche : t.jeuMasque}
                  </span>
                )}
                <span style={{
                  display: "inline-flex", transition: "transform 0.2s",
                  transform: deplie ? "rotate(180deg)" : "rotate(0deg)",
                  color: "var(--steel)",
                }}>
                  <Icone nom="chevron" taille={16} />
                </span>
              </span>
            </button>

            {deplie && (
              <div style={{ padding: "4px 14px 16px" }} className="space-y-4">
                {jeu === JEU_RIOT && <CompteRiot />}

                {config && (
                  <div className="space-y-3" style={
                    jeu === JEU_RIOT ? { borderTop: "1px solid var(--line)", paddingTop: 14 } : undefined
                  }>
                    <h3 className="titre-bloc">
                      {t.titre}
                    </h3>

                    <button
                      onClick={() => ecrire(jeu, { actif: !config.actif })}
                      aria-pressed={config.actif}
                      style={PASTILLE(config.actif)}
                    >
                      {config.actif ? t.jeuAffiche : t.jeuMasque}
                    </button>

                    {config.actif && (
                      <>
                        <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
                          {t.positionAide}
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {jeux!.coins.map((coin) => {
                            const choisi = config.position === null && coin === config.coin;
                            return (
                              <button
                                key={coin}
                                aria-pressed={choisi}
                                onClick={() => ecrire(jeu, { coin, position: null })}
                                style={PASTILLE(choisi)}
                              >
                                {t.coins[coin] ?? coin}
                              </button>
                            );
                          })}
                        </div>

                        <button
                          onClick={() => placer(jeu, !jeux!.placement)}
                          aria-pressed={jeux!.placement}
                          className="text-sm"
                          style={{
                            padding: "6px 14px", borderRadius: 999, cursor: "pointer",
                            background: jeux!.placement ? "rgba(47,217,138,0.12)" : "transparent",
                            border: `1px solid ${jeux!.placement ? "var(--victory)" : "var(--line-strong)"}`,
                            color: jeux!.placement ? "var(--victory)" : "var(--muted)",
                          }}
                        >
                          {jeux!.placement ? t.placerTerminer : t.placerBtn}
                        </button>
                        {jeux!.placement && (
                          <p className="text-xs" style={{ color: "var(--victory)", lineHeight: 1.6 }}>
                            {t.placerEnCours}
                          </p>
                        )}
                        {!jeux!.placement && config.position && (
                          <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
                            {t.placerLibre}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}

                {detection && (
                  <div className="space-y-2" style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
                    <h3 className="titre-bloc">
                      {tDet.titre}
                    </h3>
                    <button
                      onClick={() => basculerSurveillance(jeu)}
                      aria-pressed={surveille}
                      style={PASTILLE(surveille)}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                        {surveille && <Icone nom="coche" taille={14} />}
                        {surveille ? tDet.jeuSurveille : tDet.jeuIgnore}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Application trop ancienne pour le réglage par jeu : on retombe sur
          l'ancien panneau, qui vaut alors pour tous les jeux. */}
      {tropAncienne && <ReglageOverlay />}

      {jeux && (
        <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6, paddingTop: 4 }}>
          {tDet.ambigus}
        </p>
      )}
    </div>
  );
}
