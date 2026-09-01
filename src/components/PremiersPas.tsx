"use client";
import { useMemo } from "react";
import { Lien } from "@/components/Lien";
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
export function PremiersPas({ pompesMax, onAjouter }: {
  pompesMax: number;
  /**
   * Ouvre l'ajout d'une partie, ici même.
   *
   * L'étape 3 renvoyait vers `/history`, qui ne porte aucun formulaire
   * d'ajout — le seul est dans une fenêtre du tableau de bord. Et depuis que
   * l'historique dit à son tour « c'est depuis le tableau de bord qu'on
   * enregistre une activité », les deux écrans se renvoyaient l'un à l'autre.
   * Une étape qui décrit un geste doit déclencher ce geste, pas indiquer une
   * page où il n'existe pas.
   */
  onAjouter: () => void;
}) {
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

  // Une étape mène soit à une page, soit à un geste sur celle-ci. Le bouton
  // reprend l'apparence du lien : c'est la même promesse pour qui lit, et la
  // différence ne regarde que le navigateur.
  const styleTitre = { fontWeight: 600, textDecoration: "underline" } as const;
  const etape = (
    numero: number, titre: string, aide: string,
    cible: string | (() => void), lien: string,
  ) => (
    <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}>
      <span style={{
        fontFamily: "ui-monospace, monospace", color: "var(--gold)",
        fontSize: "0.8rem", flex: "0 0 auto",
      }}>
        {numero}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {typeof cible === "string" ? (
          <Lien href={cible} style={styleTitre}>{titre}</Lien>
        ) : (
          <button
            type="button"
            onClick={cible}
            style={{
              ...styleTitre, background: "none", border: "none", padding: 0,
              textAlign: "left", color: "inherit", cursor: "pointer",
              // `font: "inherit"` écraserait la graisse posée juste au-dessus :
              // la forme courte remet tout à zéro.
              fontFamily: "inherit", fontSize: "inherit",
            }}
          >
            {titre}
          </button>
        )}
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
        {etape(3, t.etape3, t.etape3Aide, onAjouter, t.versAjout)}
      </div>
    </div>
  );
}
