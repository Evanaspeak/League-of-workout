"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { adminMesures } from "@/lib/i18n/dictionaries/adminMesures";
import { formaterDelai, type Mesures } from "@/lib/mesures";

/**
 * Les chiffres d'usage, à l'endroit où ils changent une décision.
 *
 * Ils ne servent pas à se rassurer : le délai jusqu'à la première partie dit
 * si l'entrée dans le produit est trop longue, et le nombre de revenus dit si
 * le produit sert à quelque chose. Les deux étaient inconnus.
 */
export default function AdminMesures() {
  const t = useT(adminMesures);
  const [m, setM] = useState<Mesures | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    fetch("/api/admin/mesures")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("refus"))))
      .then(setM)
      .catch(() => setErreur(true));
  }, []);

  const ligne = (libelle: string, valeur: string) => (
    <div
      className="flex items-baseline justify-between gap-3"
      style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}
    >
      <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{libelle}</span>
      <b style={{ fontVariantNumeric: "tabular-nums" }}>{valeur}</b>
    </div>
  );

  return (
    <div className="lol-panel p-5 space-y-4">
      <div>
        <h2 className="titre-section">{t.titre}</h2>
        <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.aide}</p>
      </div>

      {erreur && <p className="text-sm loss-text">{t.echec}</p>}
      {!erreur && m === null && (
        <p className="text-sm" style={{ color: "var(--steel)" }}>{t.chargement}</p>
      )}

      {m && m.comptes === 0 && (
        <p className="text-sm" style={{ color: "var(--steel)" }}>{t.vide}</p>
      )}

      {m && m.comptes > 0 && (
        <div className="flex flex-col">
          {ligne(t.comptes, String(m.comptes))}
          {ligne(t.avecPartie, `${m.avecPartie} (${m.partActifs} %)`)}
          {ligne(t.delaiMedian, formaterDelai(m.delai.median))}
          {ligne(t.delaiQuartiles, `${formaterDelai(m.delai.p25)} · ${formaterDelai(m.delai.p75)}`)}
          {ligne(t.dansLaJournee, String(m.dansLaJournee))}
          {ligne(t.dansLaSemaine, String(m.dansLaSemaine))}
          {ligne(t.revenus, String(m.revenus))}
        </div>
      )}
    </div>
  );
}
