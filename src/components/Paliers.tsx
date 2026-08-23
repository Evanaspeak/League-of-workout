"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { badges as dict } from "@/lib/i18n/dictionaries/badges";
import type { Badge } from "@/lib/badges";

type Reponse = { badges: Badge[]; prochain: Badge | null };

/**
 * Les paliers, sur le tableau de bord.
 *
 * Le libellé se compose à partir de la clé : « volume500 » devient « 500 points
 * d'effort ». Écrire les dix-huit noms à la main dans six langues aurait fait
 * cent huit chaînes, dont la moitié auraient fini par diverger d'un seuil
 * changé dans le code.
 */
export function Paliers() {
  const t = useT(dict);
  const [etat, setEtat] = useState<Reponse | null>(null);

  useEffect(() => {
    const relire = () => {
      fetch("/api/badges")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setEtat(d); })
        .catch(() => {});
    };
    relire();
    window.addEventListener("wow-dette-changee", relire);
    return () => window.removeEventListener("wow-dette-changee", relire);
  }, []);

  if (!etat) return null;

  const nommer = (badge: Badge): string => {
    const famille = badge.cle.replace(/\d+$/, "");
    if (famille === "volume") return t.volume(badge.seuil);
    if (famille === "parties") return t.parties(badge.seuil);
    return t.serie(badge.seuil);
  };

  const obtenus = etat.badges.filter((b) => b.obtenu);

  return (
    <div className="lol-panel p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="titre-section">{t.titre}</h2>
          <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.aide}</p>
        </div>
        <span className="text-xs" style={{ color: "var(--steel)", fontVariantNumeric: "tabular-nums" }}>
          {t.obtenus(obtenus.length, etat.badges.length)}
        </span>
      </div>

      {etat.prochain ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="flex items-baseline justify-between gap-3">
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              {t.prochain} · {nommer(etat.prochain)}
            </span>
            <b style={{ fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}>
              {etat.prochain.avancement} / {etat.prochain.seuil}
            </b>
          </div>
          <div style={{ height: 6, background: "rgba(152,162,176,0.15)", borderRadius: 3 }}>
            <div
              style={{
                height: "100%", borderRadius: 3, background: "var(--gold)",
                width: `${Math.round((etat.prochain.avancement / etat.prochain.seuil) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{t.tout}</p>
      )}

      {obtenus.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {obtenus.map((b) => (
            <span
              key={b.cle}
              style={{
                fontSize: "0.72rem", padding: "3px 8px", borderRadius: 999,
                border: "1px solid var(--gold)", color: "var(--gold)",
              }}
            >
              {nommer(b)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
