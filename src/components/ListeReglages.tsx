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

/**
 * Rubriques des réglages, dans l'ordre de la liste.
 *
 * **L'identifiant EST le fragment d'adresse** : `/settings#jeux` ouvre les
 * jeux. La règle était écrite au-dessus de cette liste et le voisin ne la
 * suivait pas — les deux premières étapes des « Premiers pas » visaient
 * `?rubrique=effort`, un paramètre que personne ne lit, donc elles arrivaient
 * sur la LISTE des rubriques.
 *
 * Elle vit ici plutôt que dans l'écran des réglages pour que le compilateur
 * tienne le lien : c'est le même choix que `PARAM_AJOUT`, écrit une fois et lu
 * du manifeste comme du tableau de bord.
 */
export const RUBRIQUES = ["profil", "corps", "effort", "jeux", "application", "donnees", "avance"] as const;
export type Rubrique = (typeof RUBRIQUES)[number];

/**
 * L'adresse qui OUVRE une rubrique.
 *
 * Un FRAGMENT, jamais un paramètre de requête : c'est `useRubrique` qui décide,
 * et elle lit `window.location.hash`. Le type refuse un identifiant inventé, et
 * un identifiant renommé fait tomber la construction chez les appelants —
 * mais aucun des deux n'attrape le retour à `?rubrique=`, qui compile
 * parfaitement et n'ouvre rien. C'est la forme, et elle seule, que le test
 * épingle.
 */
export const versRubrique = (id: Rubrique) => `/settings#${id}`;

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
        color: "var(--bone)",
      }}
    >
      <Icone nom={icone} taille={19} couleur="var(--amber)" />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: "block",
          fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)",
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
        /* La chasse fixe aligne des chiffres entre eux ; ces résumés n'en sont
           pas tous. « test à faire » et « 3 jeux » y prenaient l'allure d'une
           machine à écrire, sans rien y gagner. Elle ne sert plus qu'aux
           résumés qui sont vraiment des nombres. */
        <span className={/^[\d.,\s]+$/.test(valeur) ? "mono-num" : undefined} style={{
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
