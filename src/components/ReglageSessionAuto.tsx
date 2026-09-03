"use client";
import { useEffect, useState } from "react";
import { useT, useMinuscule } from "@/lib/i18n/LocaleContext";
import { detection } from "@/lib/i18n/dictionaries/detection";
import { CONDUITES, toConduiteSession, type ConduiteSession } from "@/lib/sessionAuto";

/**
 * Ce que l'application fait quand elle détecte le lancement d'un jeu.
 *
 * La session se lançait toute seule sans le dire, et c'est une surprise sur un
 * compteur qui fait faire des pompes : une session ouverte sonde Riot,
 * chronomètre les jeux comptés au temps, et décide de ce qui entre dans la
 * dette.
 *
 * Le refus se dit ET l'ancienne valeur revient : sans ça, l'écran montrerait un
 * réglage que le serveur n'a pas. C'est le défaut corrigé sur les cinq réglages
 * de « Ton effort », appliqué ici dès l'écriture.
 */
export function ReglageSessionAuto() {
  const t = useT(detection);
  const minuscule = useMinuscule();
  const [conduite, setConduite] = useState<ConduiteSession | null>(null);
  const [erreur, setErreur] = useState(false);
  const [enregistre, setEnregistre] = useState<ConduiteSession | null>(null);

  useEffect(() => {
    let vivant = true;
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!vivant || !s) return;
        setConduite(toConduiteSession(s.user?.sessionAuto));
      })
      .catch(() => { /* lecture au montage : le défaut suffit */ });
    return () => { vivant = false; };
  }, []);

  const choisir = async (valeur: ConduiteSession) => {
    const avant = conduite;
    setConduite(valeur);
    setErreur(false);
    setEnregistre(null);
    try {
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPrefs: { sessionAuto: valeur } }),
      });
      if (!r.ok) throw new Error("refus");
      setEnregistre(valeur);
    } catch {
      setConduite(avant);
      setErreur(true);
    }
  };

  if (conduite === null) return null;

  return (
    <div className="space-y-2">
      <div className="titre-section">{t.conduiteTitre}</div>
      <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
        {t.conduiteAide}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {CONDUITES.map((c) => (
          <button
            key={c}
            type="button"
            className="lol-btn"
            aria-pressed={conduite === c}
            onClick={() => choisir(c)}
            style={{
              padding: "6px 14px", fontSize: "0.8rem",
              opacity: conduite === c ? 1 : 0.55,
              borderColor: conduite === c ? "var(--gold)" : undefined,
            }}
          >
            {t.conduites[c]}
          </button>
        ))}
      </div>
      {erreur && (
        <p role="alert" style={{ color: "var(--loss)", fontSize: "0.78rem" }}>
          {t.conduiteErreur}
        </p>
      )}
      {enregistre === "demander" && (
        <p style={{ color: "var(--faint)", fontSize: "0.75rem" }}>
          {minuscule(t.conduiteNoteApp)}
        </p>
      )}
    </div>
  );
}
