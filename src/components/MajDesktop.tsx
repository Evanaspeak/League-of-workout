"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { maj as dict } from "@/lib/i18n/dictionaries/maj";
import type { EtatMaj } from "@/types/electron";

/**
 * Bandeau annonçant une mise à jour prête à s'installer.
 *
 * L'application téléchargeait déjà les nouvelles versions et les posait à la
 * fermeture, mais sans jamais le dire : l'événement était bien émis côté
 * application, et personne ne l'écoutait. On ne pouvait donc ni le savoir, ni
 * choisir d'installer tout de suite.
 */
export function MajDesktop() {
  const t = useT(dict);
  const [etat, setEtat] = useState<EtatMaj | null>(null);
  const [masque, setMasque] = useState(false);

  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.majEtat || !pont.onMajEtat) return;
    // L'état courant d'abord : le téléchargement a pu se terminer avant que
    // cette page existe. L'abonnement seul manquerait ce cas.
    pont.majEtat().then(setEtat).catch(() => {});
    return pont.onMajEtat(setEtat);
  }, []);

  if (masque || etat?.statut !== "prete") return null;

  return (
    <div
      role="status"
      style={{
        // La marge à droite laisse passer le bouton du rail latéral, replié
        // dans ce coin dès que la fenêtre est étroite — celle de l'application
        // l'est toujours.
        position: "fixed", left: 16, right: 76, bottom: 16, zIndex: 900,
        margin: "0 auto", maxWidth: 520,
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
        padding: "12px 16px", borderRadius: 10,
        background: "var(--carbon, #14171C)",
        border: "1px solid var(--amber, #FFB454)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
      }}
    >
      <span style={{ flex: 1, minWidth: 200, fontSize: "0.85rem", color: "var(--bone, #ECEFF4)", lineHeight: 1.5 }}>
        {etat.version ? t.preteVersion(etat.version) : t.prete}
      </span>
      <button
        className="lol-btn text-sm"
        onClick={() => window.electronLOL?.majInstaller?.()}
      >
        {t.redemarrer}
      </button>
      <button
        onClick={() => setMasque(true)}
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: "0.78rem", color: "rgba(236,239,244,0.45)",
        }}
      >
        {t.plusTard}
      </button>
    </div>
  );
}
