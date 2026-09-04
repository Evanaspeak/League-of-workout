"use client";
import { useEffect, useState } from "react";
import { jourLocal } from "@/lib/serie";
import { chargerProgression, rafraichirProgression, type Progression } from "@/lib/chargerProgression";
import { useT } from "@/lib/i18n/LocaleContext";
import { defis as dict } from "@/lib/i18n/dictionaries/defis";
import type { AvancementDefi } from "@/lib/defiQuotidien";
import type { AvancementMensuel } from "@/lib/defiMensuel";
import type { Collectif } from "@/lib/objectifCollectif";
// Les deux valeurs viennent du module qui les ACCORDE, jamais d'un chiffre
// écrit à l'écran : une récompense annoncée qui diffère de celle qu'on reçoit
// est pire que pas de récompense annoncée du tout.
import { XP_DEFI_JOUR, XP_DEFI_MOIS } from "@/lib/xpDefis";

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
  const [mois, setMois] = useState<AvancementMensuel[] | null>(null);
  const [collectif, setCollectif] = useState<Collectif | null>(null);

  useEffect(() => {
    const poser = (p: Progression | null) => {
      if (p?.defi) setDefi(p.defi as AvancementDefi);
      if (Array.isArray(p?.defisMois)) setMois(p.defisMois as AvancementMensuel[]);
      if (p?.collectif) setCollectif(p.collectif as Collectif);
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
  /**
   * La même barre pour le jour et pour le mois.
   *
   * Écrite deux fois, elle aurait fini par diverger — c'est le motif trouvé
   * six fois sur ce projet, et il ne prend jamais la forme d'une copie qu'on
   * remarque : il prend celle d'une correction qui n'en répare qu'une moitié.
   */
  const barre = (cle: string, cible: number, ou: number, fait: boolean, xp: number) => {
    const phrase = (t as unknown as Record<string, (n: number) => string>)[cle];
    if (typeof phrase !== "function") return null;
    const part = cible > 0 ? Math.min(1, ou / cible) : 0;
    return (
      <div key={cle} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div className="flex items-baseline justify-between gap-3">
          <span style={{ fontSize: "0.9rem", opacity: fait ? 0.6 : 1 }}>{phrase(cible)}</span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            {/*
              Ce que le défi RAPPORTE, à côté de ce qu'il demande.
              Sans ce chiffre, la récompense existe et ne se voit pas : l'XP
              monte de cinquante sans que rien ne relie ce mouvement au défi
              qu'on vient de finir, et une récompense que personne ne relie à
              son geste n'en est pas une. Il vaut aussi comme raison de
              commencer, ce qui est la moitié du travail d'un défi.
            */}
            <span
              className="mono-num"
              style={{ fontSize: "0.72rem", color: fait ? "var(--win, #4caf50)" : "var(--gold)" }}
            >
              {t.gain(xp)}
            </span>
            <b className="mono-num" style={{ fontSize: "0.8rem" }}>{`${ou} / ${cible}`}</b>
          </span>
        </div>
        <div style={{ height: 6, background: "rgba(152,162,176,0.15)", borderRadius: 3 }}>
          <div
            style={{
              height: "100%", borderRadius: 3,
              background: fait ? "var(--win, #4caf50)" : "var(--gold)",
              width: `${Math.round(part * 100)}%`,
            }}
          />
        </div>
      </div>
    );
  };

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

      {barre(defi.cle, defi.cible, defi.ou, defi.fait, XP_DEFI_JOUR)}

      {mois && mois.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 6 }}>
          <div>
            <h3 className="titre-section" style={{ fontSize: "0.95rem" }}>{t.moisTitre}</h3>
            <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.moisAide}</p>
          </div>
          {mois.map((m) => barre(m.cle, m.cible, m.ou, m.fait, XP_DEFI_MOIS))}
        </div>
      )}

      {collectif && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 6 }}>
          <div>
            <h3 className="titre-section" style={{ fontSize: "0.95rem" }}>{t.collectifTitre}</h3>
            {/*
              Le nombre de contributeurs n'est pas une décoration. « 8 420 sur
              100 000 » est décourageant à quatre ; « 8 420 sur 100 000, à 4 »
              est vrai à toutes les tailles, et c'est ce qui rend la barre
              honnête avant que l'objectif ne soit atteignable.
            */}
            <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>
              {t.collectifAide(collectif.contributeurs)}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="flex items-baseline justify-between gap-3">
              <span style={{ fontSize: "0.9rem" }}>
                {collectif.atteint ? t.collectifAtteint : "\u00a0"}
              </span>
              <b className="mono-num" style={{ fontSize: "0.8rem" }}>
                {`${collectif.points} / ${collectif.cible}`}
              </b>
            </div>
            <div style={{ height: 6, background: "rgba(152,162,176,0.15)", borderRadius: 3 }}>
              <div
                style={{
                  height: "100%", borderRadius: 3,
                  background: collectif.atteint ? "var(--win, #4caf50)" : "var(--gold)",
                  width: `${Math.round(collectif.part * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
