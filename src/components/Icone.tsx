/**
 * Jeu d'icônes du produit — source unique.
 *
 * Un émoji n'a ni grille, ni graisse, ni alignement optique : il est dessiné par
 * la police du système, change d'un poste à l'autre, et ne s'accorde à aucune
 * direction artistique. Même reproche aux glyphes typographiques employés comme
 * pictogrammes (→ ✓ ✕ ▾) : ce sont des caractères de texte, ils héritent de la
 * police et ne s'alignent pas sur la ligne de base des libellés.
 *
 * Tout est donc tracé ici, sur la même grille de 24, avec la même graisse de
 * trait et les mêmes terminaisons. Une icône qui manque s'ajoute à cette liste,
 * jamais ailleurs.
 */

export type NomIcone =
  // Navigation et actions
  | "fleche" | "fleche-bas" | "fleche-haut" | "chevron" | "croix" | "plus"
  | "coche" | "crayon" | "recharger" | "telecharger" | "reglages" | "globe"
  | "lien-externe"
  // Sens et état
  | "flamme" | "crane" | "muscle" | "cadenas" | "alerte"
  // Ambiance (page d'accueil)
  | "maison" | "couches" | "eclair" | "cible" | "cerveau" | "coeur"
  // Rubriques des réglages
  | "personne" | "manette" | "moniteur";

const TRACES: Record<NomIcone, React.ReactNode> = {
  // ── Navigation et actions ────────────────────────────────────────────────
  fleche: (
    <>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  "fleche-bas": (
    <>
      <path d="M12 4v15" />
      <path d="m6 13 6 6 6-6" />
    </>
  ),
  "fleche-haut": (
    <>
      <path d="M12 20V5" />
      <path d="m6 11 6-6 6 6" />
    </>
  ),
  chevron: <path d="m6 9 6 6 6-6" />,
  "lien-externe": (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7.5A1.5 1.5 0 0 1 5 6h4.5" />
    </>
  ),
  croix: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  coche: <path d="m4 12.5 5.5 5.5L20 7" />,
  crayon: (
    <>
      <path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m14.5 5.5 4 4" />
    </>
  ),
  recharger: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v5h-5" />
    </>
  ),
  telecharger: (
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M4 20h16" />
    </>
  ),
  reglages: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z" />
    </>
  ),

  // ── Sens et état ─────────────────────────────────────────────────────────
  flamme: (
    <>
      <path d="M12 2.5c3.5 4 5.5 6.5 5.5 9.5a5.5 5.5 0 0 1-11 0c0-1.6.6-3 1.8-4.4.4 1.3 1.1 2 2 2.2-.3-2.4.3-4.6 1.7-7.3Z" />
    </>
  ),
  crane: (
    <>
      <path d="M5 11a7 7 0 1 1 14 0v3.5l-1.5 1V19h-11v-3.5L5 14.5V11Z" />
      <circle cx="9.3" cy="11" r="1.4" />
      <circle cx="14.7" cy="11" r="1.4" />
    </>
  ),
  muscle: (
    <>
      <path d="M4 17.5c0-3 1.5-5 4-5.5V6.5A2.5 2.5 0 0 1 10.5 4c1.4 0 2.5 1.1 2.5 2.5v3c3.6 0 6 2.1 6 5.2 0 2.6-1.8 4.3-4.5 4.3H6.5A2.5 2.5 0 0 1 4 17.5Z" />
    </>
  ),
  cadenas: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </>
  ),
  alerte: (
    <>
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.4h.01" />
    </>
  ),

  // ── Ambiance ─────────────────────────────────────────────────────────────
  maison: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </>
  ),
  couches: (
    <>
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </>
  ),
  eclair: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
  cible: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  cerveau: (
    <>
      <path d="M9.5 3A2.5 2.5 0 0 0 7 5.5a3 3 0 0 0-2.2 5A3.5 3.5 0 0 0 6.5 21H11V3H9.5Z" />
      <path d="M14.5 3A2.5 2.5 0 0 1 17 5.5a3 3 0 0 1 2.2 5A3.5 3.5 0 0 1 17.5 21H13V3h1.5Z" />
    </>
  ),
  coeur: <path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6.3a5 5 0 1 1 7.5 6.3Z" />,

  // ── Rubriques des réglages ───────────────────────────────────────────────
  personne: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  manette: (
    <>
      <path d="M8.5 7.5h7a5.5 5.5 0 0 1 5.4 6.5l-.5 2.7a2.6 2.6 0 0 1-4.7 1l-1.2-1.8H9.5l-1.2 1.8a2.6 2.6 0 0 1-4.7-1l-.5-2.7a5.5 5.5 0 0 1 5.4-6.5Z" />
      <path d="M7 11v3" />
      <path d="M5.5 12.5h3" />
      <path d="M16 11.5h.01" />
      <path d="M18 13.5h.01" />
    </>
  ),
  moniteur: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M9 20h6" />
      <path d="M12 16v4" />
    </>
  ),
};

export function Icone({
  nom,
  taille = 20,
  couleur = "currentColor",
  titre,
  style,
}: {
  nom: NomIcone;
  taille?: number;
  couleur?: string;
  /**
   * À renseigner uniquement quand l'icône porte seule le sens. Accompagnée d'un
   * libellé, elle reste décorative et doit être tue aux lecteurs d'écran.
   */
  titre?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke={couleur}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      role={titre ? "img" : undefined}
      aria-label={titre}
      aria-hidden={titre ? undefined : true}
      // Une icône posée à côté d'un mot doit s'asseoir sur sa ligne, pas flotter.
      style={{ flexShrink: 0, verticalAlign: "middle", ...style }}
    >
      {titre ? <title>{titre}</title> : null}
      {TRACES[nom]}
    </svg>
  );
}
