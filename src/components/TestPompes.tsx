"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { testPompes as dict } from "@/lib/i18n/dictionaries/testPompes";
import { getLevelParPompes, testAFaire, type LevelCfg } from "@/lib/scoring";

/**
 * Test de pompes maximales : le nombre que quelqu'un enchaîne d'affilée fixe
 * son niveau, donc le multiplicateur appliqué à toute sa dette.
 *
 * Il remplace le test de gainage, qui mesurait autre chose que la monnaie de
 * l'application, et qu'on redemandait à chaque session — au point que plus
 * personne ne le refaisait vraiment. Une fois par mois suffit : la force ne
 * change pas d'un soir à l'autre.
 */
export function TestPompes({
  pompesMax,
  faitLe,
  niveaux,
  onEnregistre,
  autonome = false,
}: {
  pompesMax: number;
  faitLe: string | null;
  niveaux: LevelCfg[];
  onEnregistre: (valeur: number) => Promise<void>;
  /**
   * Le test est présenté seul, dans son propre encadré — sur le tableau de
   * bord. Il n'a alors pas de section au-dessus dont il faudrait se séparer
   * par un trait.
   */
  autonome?: boolean;
}) {
  const t = useT(dict);
  const [saisie, setSaisie] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [occupe, setOccupe] = useState(false);

  const aFaire = testAFaire(pompesMax, faitLe);
  const niveau = niveaux.length > 0 ? getLevelParPompes(pompesMax, niveaux) : null;
  const valeur = Number(saisie);
  const valide = Number.isFinite(valeur) && valeur >= 0 && valeur <= 500 && saisie !== "";

  const enregistrer = async () => {
    if (!valide) return;
    setOccupe(true);
    await onEnregistre(Math.round(valeur));
    setOccupe(false);
    setOuvert(false);
    setSaisie("");
  };

  const apercu = valide && niveaux.length > 0 ? getLevelParPompes(valeur, niveaux) : null;

  return (
    <div
      style={autonome ? undefined : { borderTop: "1px solid var(--line)", paddingTop: 16 }}
      className="space-y-3"
    >
      <h2 className="titre-section">
        {t.titre}
      </h2>
      <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
        {t.aide}
      </p>

      {pompesMax > 0 && niveau && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <span className="mono-num" style={{ fontSize: "1.6rem", fontWeight: 600, color: "var(--amber)", lineHeight: 1.1 }}>
            {pompesMax}
          </span>
          <span className="text-xs" style={{ color: "var(--faint)" }}>
            {t.resume(niveau.niveau, niveau.multiplicateur)}
          </span>
        </div>
      )}

      {aFaire && (
        <p className="text-xs" style={{ color: "var(--amber)" }}>
          {pompesMax > 0 ? t.perime : t.jamaisFait}
        </p>
      )}

      {!ouvert && (
        <button className="lol-btn text-sm" onClick={() => setOuvert(true)}>
          {pompesMax > 0 ? t.refaire : t.faire}
        </button>
      )}

      {ouvert && (
        <div className="space-y-3" style={{
          padding: "14px 16px",
          borderRadius: 8,
          background: "rgba(152,162,176,0.05)",
          border: "1px solid var(--line)",
        }}>
          <p className="text-xs" style={{ color: "var(--muted)", lineHeight: 1.6 }}>
            {t.consigne}
          </p>
          <div>
            <label htmlFor="test-pompes" className="block text-xs mb-1" style={{ color: "var(--steel)" }}>
              {t.champ}
            </label>
            <input
              id="test-pompes"
              type="number"
              min="0"
              max="500"
              className="lol-input text-center text-2xl font-bold"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enregistrer()}
              autoFocus
            />
          </div>

          {apercu && (
            <p className="text-xs" style={{ color: "var(--amber)" }}>
              {t.apercu(apercu.niveau, apercu.multiplicateur)}
            </p>
          )}

          <div className="flex gap-2">
            <button
              className="text-xs px-3 py-2 rounded flex-1"
              style={{ background: "rgba(152,162,176,0.1)", border: "1px solid var(--line-strong)", color: "rgba(236,239,244,0.7)", cursor: "pointer" }}
              onClick={() => { setOuvert(false); setSaisie(""); }}
            >
              {t.annuler}
            </button>
            <button className="lol-btn text-sm flex-1" onClick={enregistrer} disabled={!valide || occupe}>
              {occupe ? "…" : t.enregistrer}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
