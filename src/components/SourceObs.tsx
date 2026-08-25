"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { sourceObs as dict } from "@/lib/i18n/dictionaries/sourceObs";

/**
 * Le lien de la source de diffusion.
 *
 * Il n'existe pas tant qu'on ne l'a pas demandé, et se refait d'un clic : c'est
 * la seule façon de révoquer une adresse déjà collée dans un logiciel, ou
 * partagée par mégarde pendant un partage d'écran.
 */
export function SourceObs() {
  const t = useT(dict);
  const [echec, setEchec] = useState(false);
  const [jeton, setJeton] = useState<string | null | undefined>(undefined);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    fetch("/api/obs")
      .then((r) => (r.ok ? r.json() : { jeton: null }))
      .then((d) => setJeton(d.jeton))
      .catch(() => setJeton(null));
  }, []);

  const adresse = jeton
    ? `${typeof window === "undefined" ? "" : window.location.origin}/obs/${jeton}`
    : "";

  const agir = async (methode: "POST" | "DELETE") => {
    setEchec(false);
    // Sans message, un refus ne produit rien : le bouton a l'air de ne pas
    // marcher, et on reclique.
    try {
      const r = await fetch("/api/obs", { method: methode });
      if (!r.ok) { setEchec(true); return; }
      setJeton((await r.json()).jeton);
    } catch {
      setEchec(true);
    }
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(adresse);
      setCopie(true);
      setTimeout(() => setCopie(false), 2000);
    } catch { /* le champ reste sélectionnable à la main */ }
  };

  if (jeton === undefined) return null;

  return (
    <div className="lol-panel p-5 space-y-4">
      <div>
        <h2 className="titre-section">{t.titre}</h2>
        <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.aide}</p>
        {echec && <p role="alert" className="text-xs mt-1" style={{ color: "var(--loss)" }}>{t.echec}</p>}
      </div>

      {jeton ? (
        <>
          <input
            className="lol-input"
            readOnly
            value={adresse}
            onFocus={(e) => e.currentTarget.select()}
            aria-label={t.titre}
            style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.75rem" }}
          />
          <div className="flex flex-wrap gap-3">
            <button className="lol-btn" onClick={copier} style={{ flex: "1 1 8rem" }}>
              {copie ? t.copie : t.copier}
            </button>
            <button
              className="lol-btn"
              onClick={() => agir("POST")}
              style={{ flex: "1 1 8rem", background: "transparent" }}
            >
              {t.refaire}
            </button>
          </div>
          <p className="text-xs" style={{ color: "var(--steel)" }}>{t.largeur}</p>
          <p className="text-xs" style={{ color: "var(--steel)" }}>{t.avertissement}</p>
          <button
            type="button"
            onClick={() => agir("DELETE")}
            className="text-xs"
            style={{
              color: "var(--steel)", background: "none", border: "none",
              cursor: "pointer", padding: 0, textDecoration: "underline",
            }}
          >
            {t.retirer}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm" style={{ color: "var(--muted)" }}>{t.aucun}</p>
          <button className="lol-btn w-full" onClick={() => agir("POST")}>{t.creer}</button>
        </>
      )}
    </div>
  );
}
