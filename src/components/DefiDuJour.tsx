"use client";
import { useEffect, useState } from "react";
import { jourLocal } from "@/lib/serie";
import { chargerProgression, rafraichirProgression, type Progression } from "@/lib/chargerProgression";
import { useT } from "@/lib/i18n/LocaleContext";
import { defis as dict } from "@/lib/i18n/dictionaries/defis";
import type { AvancementDefi } from "@/lib/defiQuotidien";

/**
 * Le défi du jour, sur le tableau de bord.
 *
 * Il arrive dans la MÊME réponse que les paliers et la série : c'est la route
 * fusionnée qui le compose, et un composant qui demanderait sa propre adresse
 * referait l'aller-retour que cette route existe pour éviter.
 *
 * Il se rafraîchit à `wow-dette-changee` comme les paliers, parce que payer sa
 * dette peut le remplir : un défi qu'on vient de finir et qui reste marqué
 * « à faire » jusqu'au prochain chargement dit le contraire de ce qui vient
 * d'arriver.
 */
export function DefiDuJour() {
  const t = useT(dict);
  const [defi, setDefi] = useState<AvancementDefi | null>(null);

  useEffect(() => {
    const poser = (p: Progression | null) => {
      if (p?.defi) setDefi(p.defi as AvancementDefi);
    };
    void chargerProgression(jourLocal()).then(poser);
    const relire = () => { void rafraichirProgression(jourLocal()).then(poser); };
    window.addEventListener("wow-dette-changee", relire);
    return () => window.removeEventListener("wow-dette-changee", relire);
  }, []);

  // Rien tant qu'on ne sait pas : un défi inventé le temps du chargement
  // serait faux la moitié du temps, et il sauterait à l'arrivée de la réponse.
  if (!defi) return null;

  /**
   * Le libellé se lit par sa clé, et le type de la clé vient du module.
   *
   * Une clé absente du dictionnaire donnerait « undefined » en travers du
   * tableau de bord — c'est le défaut déjà rencontré sur la pastille en jeu,
   * où seul un test l'avait attrapé. Ici le compilateur le nomme, parce que le
   * dictionnaire déclare exactement les six clés du catalogue.
   */
  const libelle = (t as unknown as Record<string, (n: number) => string>)[defi.cle];
  if (typeof libelle !== "function") return null;

  const part = defi.cible > 0 ? Math.min(1, defi.ou / defi.cible) : 0;

  return (
    <div className="lol-panel p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="titre-section">{t.titre}</h2>
          <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.aide}</p>
        </div>
        {defi.fait && (
          <span
            style={{
              fontSize: "0.72rem", padding: "3px 8px", borderRadius: 999,
              border: "1px solid var(--win, #4caf50)", color: "var(--win, #4caf50)",
            }}
          >
            {t.fait}
          </span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="flex items-baseline justify-between gap-3">
          <span style={{ fontSize: "0.9rem" }}>{libelle(defi.cible)}</span>
          <b className="mono-num" style={{ fontSize: "0.8rem" }}>
            {`${defi.ou} / ${defi.cible}`}
          </b>
        </div>
        <div style={{ height: 6, background: "rgba(152,162,176,0.15)", borderRadius: 3 }}>
          <div
            style={{
              height: "100%", borderRadius: 3,
              background: defi.fait ? "var(--win, #4caf50)" : "var(--gold)",
              width: `${Math.round(part * 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
