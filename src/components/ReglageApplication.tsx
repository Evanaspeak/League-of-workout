"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { maj as dict } from "@/lib/i18n/dictionaries/maj";
import type { EtatMaj } from "@/types/electron";

/**
 * Version installée et état des mises à jour, dans l'application desktop.
 *
 * Le numéro de version n'apparaissait nulle part : impossible de dire si une
 * mise à jour s'était appliquée, ni de distinguer « rien à installer » de
 * « le mécanisme est cassé ». Le bouton de vérification donne en plus une
 * réponse immédiate, sans attendre le prochain contrôle automatique.
 */
export function ReglageApplication() {
  const t = useT(dict);
  const [infos, setInfos] = useState<{ version: string; etat: EtatMaj } | null>(null);
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.version || !pont.majEtat) return;
    Promise.all([pont.version(), pont.majEtat()])
      .then(([version, etat]) => setInfos({ version, etat }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.onMajEtat) return;
    return pont.onMajEtat((etat) => setInfos((prec) => (prec ? { ...prec, etat } : prec)));
  }, []);

  if (!infos) return null;

  const verifier = async () => {
    setEnCours(true);
    try {
      const etat = await window.electronLOL!.majVerifier!();
      setInfos((prec) => (prec ? { ...prec, etat } : prec));
    } catch {
      /* l'état reste celui d'avant */
    }
    setEnCours(false);
  };

  const { statut, version: versionDispo, erreur } = infos.etat;
  const message =
    statut === "prete"
      ? `${versionDispo ? t.preteVersion(versionDispo) : t.prete} ${t.installeAuRedemarrage}`
      : statut === "telechargement" && versionDispo
        ? t.telechargement(versionDispo)
        : statut === "a-jour"
          ? t.aJour
          : statut === "erreur"
            ? t.erreur
            : statut === "sources"
              ? t.depuisSources
              : null;

  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }} className="space-y-3">
      <h2 className="titre-section">
        {t.titre}
      </h2>

      <p className="mono-num text-sm" style={{ color: "var(--amber)" }}>
        {t.versionInstallee(infos.version)}
      </p>

      {message && (
        <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
          {message}
        </p>
      )}

      {/* Le détail technique, plutôt qu'un message générique : c'est lui qui
          permet de dire ce qui a réellement échoué. Sans lui, une erreur de
          téléchargement se confond avec une erreur de vérification. */}
      {statut === "erreur" && erreur && (
        <p className="mono-num" style={{
          fontSize: "0.68rem", color: "var(--faint)",
          lineHeight: 1.5, wordBreak: "break-word",
        }}>
          {erreur.slice(0, 300)}
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        <button className="lol-btn text-sm" onClick={verifier} disabled={enCours || statut === "sources"}>
          {enCours || statut === "verification" ? t.verification : t.verifier}
        </button>
        {statut === "prete" && (
          <button
            className="lol-btn text-sm"
            onClick={() => window.electronLOL?.majInstaller?.()}
          >
            {t.redemarrer}
          </button>
        )}
      </div>
    </div>
  );
}
