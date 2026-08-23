"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { dashboard as dict } from "@/lib/i18n/dictionaries/dashboard";
import { jourLocal } from "@/lib/serie";

type Etat = {
  serie: number;
  meilleure: number;
  payeAujourdhui: boolean;
  enRetard: boolean;
  joursDeRetard: number;
};

/**
 * La série de jours payés, et le retard quand il y en a un.
 *
 * La série compte les jours où l'on a PAYÉ, jamais ceux où l'on a joué. C'est
 * la différence entre une application qui récompense l'effort et une qui
 * récompense le temps passé sur un jeu.
 *
 * Le jour part d'ici : celui du navigateur, pas celui du serveur. Quelqu'un
 * qui paie à une heure du matin verrait sinon sa série comptée sur la veille
 * ou le lendemain selon son fuseau.
 */
export function SerieEtRetard() {
  const t = useT(dict);
  const [etat, setEtat] = useState<Etat | null>(null);

  useEffect(() => {
    const relire = () => {
      fetch(`/api/serie?jour=${jourLocal()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d) setEtat(d); })
        .catch(() => {});
    };
    relire();
    // La dette qui bouge change la série et le retard : l'écran doit suivre
    // sans qu'on recharge la page.
    window.addEventListener("wow-dette-changee", relire);
    return () => window.removeEventListener("wow-dette-changee", relire);
  }, []);

  if (!etat) return null;
  if (etat.serie === 0 && !etat.enRetard) return null;

  return (
    <div className="flex flex-col gap-3">
      {etat.serie > 0 && (
        <div className="lol-panel p-4" style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap",
        }}>
          <span style={{
            fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase",
            color: "var(--steel)",
          }}>
            {t.serieLabel}
          </span>
          <div style={{ textAlign: "right" }}>
            <b style={{
              fontFamily: "var(--font-heading)", fontSize: "1.4rem", color: "var(--gold)",
            }}>
              {t.serieJours(etat.serie)}
            </b>
            {etat.meilleure > etat.serie && (
              <div style={{ fontSize: "0.75rem", color: "var(--steel)" }}>
                {t.serieMeilleure(etat.meilleure)}
              </div>
            )}
          </div>
        </div>
      )}

      {etat.enRetard && (
        <div className="lol-panel p-4" style={{ borderColor: "#FF8A3D" }}>
          <div style={{ color: "#FF8A3D", fontWeight: 600, marginBottom: 4 }}>
            {t.retardTitre(etat.joursDeRetard)}
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.5 }}>
            {t.retardTexte}
          </p>
        </div>
      )}
    </div>
  );
}
