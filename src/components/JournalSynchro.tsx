"use client";
import { useEffect, useState } from "react";
import { useT, useDateLocale } from "@/lib/i18n/LocaleContext";
import { journalSynchro as dict } from "@/lib/i18n/dictionaries/journalSynchro";
import { charger, enregistrer, type Entree } from "@/lib/journalSynchro";

/**
 * Le journal des synchronisations.
 *
 * Il répond à une question qu'on ne pouvait pas poser : « pourquoi mes parties
 * n'arrivent pas ? »  La boucle avalait toutes les erreurs, et rien ne
 * distinguait une panne de Riot d'une soirée sans partie.
 */
export function JournalSynchro() {
  const t = useT(dict);
  const etiquette = useDateLocale();
  const [journal, setJournal] = useState<Entree[]>([]);

  useEffect(() => {
    setJournal(charger());
    // La page des réglages reste ouverte pendant qu'on joue : le journal doit
    // suivre sans qu'on la recharge.
    const minuteur = setInterval(() => setJournal(charger()), 15_000);
    return () => clearInterval(minuteur);
  }, []);

  const relatif = (quand: number) => {
    const secondes = Math.round((quand - Date.now()) / 1000);
    const format = new Intl.RelativeTimeFormat(etiquette, { numeric: "auto" });
    if (Math.abs(secondes) < 60) return format.format(secondes, "second");
    if (Math.abs(secondes) < 3600) return format.format(Math.round(secondes / 60), "minute");
    return format.format(Math.round(secondes / 3600), "hour");
  };

  const couleur = (r: Entree["resultat"]) =>
    r === "partie" ? "#2FD98A" : r === "rien" ? "var(--steel)" : "#FF8A3D";

  const nom = (r: Entree["resultat"]) =>
    r === "partie" ? t.partie : r === "rien" ? t.rien : r === "refus" ? t.refus : t.erreur;

  return (
    <div className="lol-panel p-5 space-y-4">
      <div>
        <h2 className="titre-section">{t.titre}</h2>
        <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.aide}</p>
      </div>

      {journal.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--steel)" }}>{t.aucun}</p>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {journal.map((e) => (
              <div
                key={`${e.quand}-${e.resultat}`}
                style={{
                  display: "flex", gap: 10, alignItems: "baseline",
                  padding: "6px 0", borderBottom: "1px solid var(--line)",
                  fontSize: "0.82rem",
                }}
              >
                <span style={{ color: couleur(e.resultat), flex: "0 0 auto" }}>
                  {nom(e.resultat)}
                </span>
                <span style={{ color: "var(--muted)", flex: "1 1 auto" }}>
                  {e.detail ?? ""}
                </span>
                <span style={{ color: "var(--faint)", flex: "0 0 auto", fontSize: "0.72rem" }}>
                  {relatif(e.quand)}
                </span>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => { enregistrer([]); setJournal([]); }}
            className="text-xs"
            style={{
              color: "var(--steel)", background: "none", border: "none",
              cursor: "pointer", padding: 0, textDecoration: "underline",
            }}
          >
            {t.vider}
          </button>
        </>
      )}
    </div>
  );
}
