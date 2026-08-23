"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { premiersPas as dict } from "@/lib/i18n/dictionaries/premiersPas";
import { calculerPublic } from "@/lib/calculateurPublic";

/**
 * Ce qu'un compte neuf voit à la place des graphiques vides.
 *
 * Un tableau de bord sans données ne dit rien de ce que le produit fait. Il
 * annonçait « aucune partie enregistrée » et renvoyait vers l'historique : ni
 * l'un ni l'autre ne répond à la seule question qu'on se pose à ce
 * moment-là — qu'est-ce que ça va me faire faire, concrètement ?
 *
 * La démonstration y répond avec un chiffre, calculé pour de vrai, et annoncé
 * comme un exemple. Elle n'écrit rien : montrer de fausses données comme si
 * elles étaient les siennes vaut moins que de ne rien montrer.
 */
export function PremiersPas({ pompesMax }: { pompesMax: number }) {
  const t = useT(dict);

  const exemple = useMemo(() => calculerPublic({
    jeu: "League of Legends",
    // Le niveau de départ tant que le test de force n'est pas passé. C'est le
    // même repli que côté serveur, pas une valeur inventée pour la vitrine.
    pompesMax: pompesMax > 0 ? pompesMax : 15,
    role: "Mid",
    result: "D",
    kills: 2, deaths: 9, assists: 4,
  }), [pompesMax]);

  const etape = (numero: number, titre: string, aide: string, vers: string, lien: string) => (
    <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
      <span style={{
        fontFamily: "ui-monospace, monospace", color: "var(--gold)",
        fontSize: "0.8rem", flex: "0 0 auto",
      }}>
        {numero}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <Link href={vers} style={{ fontWeight: 600, textDecoration: "underline" }}>
          {titre}
        </Link>
        <span className="text-xs" style={{ color: "var(--steel)" }}>{aide}</span>
        <span className="text-xs" style={{ color: "var(--faint)" }}>{lien}</span>
      </div>
    </div>
  );

  return (
    <div className="lol-panel p-5 space-y-5">
      <div>
        <h2 className="titre-section">{t.titre}</h2>
        <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.intro}</p>
      </div>

      <div style={{
        border: "1px solid var(--line)", borderRadius: 6, padding: "14px 16px",
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        <span style={{
          fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase",
          color: "var(--gold)",
        }}>
          {t.exempleTitre}
        </span>
        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{t.exempleLigne}</span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
          <span style={{ color: "var(--steel)", fontSize: "0.8rem" }}>{t.exempleVerdict}</span>
          <b style={{
            fontFamily: "var(--font-heading)", fontSize: "2rem", color: "var(--gold)",
            lineHeight: 1, fontVariantNumeric: "tabular-nums",
          }}>
            {exemple.points}
          </b>
          <span style={{ color: "var(--muted)" }}>{t.exempleUnite}</span>
        </div>
        <span className="text-xs" style={{ color: "var(--faint)" }}>{t.exempleAide}</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{
          fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase",
          color: "var(--steel)",
        }}>
          {t.etapesTitre}
        </span>
        {etape(1, t.etape1, t.etape1Aide, "/settings?rubrique=effort", t.versReglages)}
        {etape(2, t.etape2, t.etape2Aide, "/settings?rubrique=jeux", t.versReglages)}
        {etape(3, t.etape3, t.etape3Aide, "/history", t.versHistorique)}
      </div>
    </div>
  );
}
