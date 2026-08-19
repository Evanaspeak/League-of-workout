"use client";
import { Icone, type NomIcone } from "@/components/Icone";
import { useValeurClient } from "@/lib/valeurClient";

/**
 * Réglages en rubriques, comme ceux d'un téléphone : une liste courte, on
 * ouvre celle qu'on cherche, on revient.
 *
 * Tout déplier sur une seule page donnait une colonne de plusieurs écrans où
 * il fallait chercher — et où l'on tombait par accident sur des réglages qu'on
 * ne cherchait pas. Une liste d'entrées, chacune avec ce qu'elle vaut
 * actuellement à droite, se lit d'un coup d'œil.
 *
 * La rubrique ouverte vit dans l'adresse (`#jeux`) : le bouton « précédent » du
 * navigateur revient à la liste, et un lien peut pointer droit sur une
 * rubrique.
 */

/** Suit le fragment d'adresse, sans effet ni rendu en cascade. */
function abonnerAuFragment(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

/**
 * Rubrique ouverte d'après l'adresse. `null` = la liste.
 * @param connues Identifiants acceptés ; tout autre fragment est ignoré.
 */
export function useRubrique(connues: readonly string[]): string | null {
  return useValeurClient(
    () => {
      const fragment = window.location.hash.replace(/^#/, "");
      return connues.includes(fragment) ? fragment : null;
    },
    null,
    abonnerAuFragment,
  );
}

export function ouvrirRubrique(id: string) {
  window.location.hash = id;
}

/** Revient à la liste, en rendant la main au bouton « précédent ». */
export function fermerRubrique() {
  history.back();
}

/** Une entrée de la liste : icône, titre, ce qu'elle vaut, chevron. */
export function LigneRubrique({
  id, icone, titre, aide, valeur, onOuvrir, premiere, derniere,
}: {
  /** Sert d'ancre à la visite guidée, qui désigne les rubriques une par une. */
  id: string;
  icone: NomIcone;
  titre: string;
  aide: string;
  /** Résumé à droite — l'état actuel, pour éviter d'ouvrir juste pour voir. */
  valeur?: string;
  onOuvrir: () => void;
  premiere?: boolean;
  derniere?: boolean;
}) {
  return (
    <button
      onClick={onOuvrir}
      data-visite={`rubrique-${id}`}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14,
        padding: "14px 16px", cursor: "pointer", textAlign: "left",
        background: "transparent",
        border: "none",
        borderTop: premiere ? "none" : "1px solid var(--line)",
        borderRadius: `${premiere ? "6px 6px" : "0 0"} ${derniere ? "6px 6px" : "0 0"}`,
        color: "#ECEFF4",
      }}
    >
      <Icone nom={icone} taille={19} couleur="var(--amber)" />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: "block",
          fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
          fontSize: "0.9rem", letterSpacing: "0.08em", textTransform: "uppercase",
        }}>
          {titre}
        </span>
        <span style={{
          display: "block", fontSize: "0.76rem", lineHeight: 1.5,
          color: "var(--faint)", marginTop: 2,
        }}>
          {aide}
        </span>
      </span>
      {valeur && (
        <span className="mono-num" style={{
          fontSize: "0.78rem", color: "var(--muted)",
          whiteSpace: "nowrap", textAlign: "right",
        }}>
          {valeur}
        </span>
      )}
      <span style={{ display: "inline-flex", color: "var(--faint)", flexShrink: 0 }}>
        <Icone nom="chevron" taille={16} style={{ transform: "rotate(-90deg)" }} />
      </span>
    </button>
  );
}

/** Bandeau d'une rubrique ouverte : le retour, puis son titre. */
export function EnteteRubrique({ titre, retour }: { titre: string; retour: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <button
        onClick={fermerRubrique}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px 6px 8px", borderRadius: 999, cursor: "pointer",
          background: "transparent", border: "1px solid var(--line-strong)",
          color: "var(--muted)", fontSize: "0.78rem",
        }}
      >
        <Icone nom="chevron" taille={15} style={{ transform: "rotate(90deg)" }} />
        {retour}
      </button>
      <h1 className="titre-page">{titre}</h1>
    </div>
  );
}
