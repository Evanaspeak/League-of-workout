/**
 * Drapeaux dessinés plutôt qu'emoji.
 *
 * Les emoji de drapeaux sont des paires d'indicateurs régionaux
 * (U+1F1EB U+1F1F7 pour la France). Windows ne fournit aucune police capable
 * de les combiner : Segoe UI Emoji les rend comme deux lettres, « FR » et
 * « US ». La majorité des joueurs PC ne voyait donc aucun drapeau.
 *
 * Un SVG s'affiche partout, à toutes les tailles, sans dépendre du système.
 */
export type Pays = "fr" | "us" | "es" | "de" | "cn" | "jp";

export function Drapeau({ pays, taille = 16 }: { pays: Pays; taille?: number }) {
  const hauteur = Math.round(taille * 0.7);
  const commun = {
    width: taille,
    height: hauteur,
    viewBox: "0 0 20 14",
    role: "presentation" as const,
    style: {
      borderRadius: 2,
      display: "block",
      flexShrink: 0,
      // Un liseré évite que le blanc des deux drapeaux se fonde dans un fond clair.
      boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)",
    },
  };

  if (pays === "fr") {
    return (
      <svg {...commun} aria-hidden>
        <rect width="20" height="14" fill="#F5F5F5" />
        <rect width="6.67" height="14" fill="#002654" />
        <rect x="13.33" width="6.67" height="14" fill="#CE1126" />
      </svg>
    );
  }

  if (pays === "es") {
    // Rouge, or, rouge, dans un rapport 1-2-1. Les armes du centre ne sont
    // qu'une tache à cette taille : on les laisse.
    return (
      <svg {...commun} aria-hidden>
        <rect width="20" height="14" fill="#AA151B" />
        <rect y="3.5" width="20" height="7" fill="#F1BF00" />
      </svg>
    );
  }

  if (pays === "de") {
    return (
      <svg {...commun} aria-hidden>
        <rect width="20" height="4.67" fill="#000000" />
        <rect y="4.67" width="20" height="4.66" fill="#DD0000" />
        <rect y="9.33" width="20" height="4.67" fill="#FFCE00" />
      </svg>
    );
  }

  if (pays === "cn") {
    // Une grande étoile et quatre petites, dans le canton supérieur gauche.
    return (
      <svg {...commun} aria-hidden>
        <rect width="20" height="14" fill="#DE2910" />
        <circle cx="3.4" cy="3.6" r="1.5" fill="#FFDE00" />
        {[[6.6, 1.4], [8.1, 3], [8.1, 5.2], [6.6, 6.7]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="0.62" fill="#FFDE00" />
        ))}
      </svg>
    );
  }

  if (pays === "jp") {
    return (
      <svg {...commun} aria-hidden>
        <rect width="20" height="14" fill="#F5F5F5" />
        <circle cx="10" cy="7" r="4.2" fill="#BC002D" />
      </svg>
    );
  }

  // Bannière étoilée simplifiée : à 16 px, cinquante étoiles ne sont qu'une
  // tache. Sept bandes et un canton suffisent à la reconnaître.
  return (
    <svg {...commun} aria-hidden>
      <rect width="20" height="14" fill="#F5F5F5" />
      {[0, 2, 4, 6].map((i) => (
        <rect key={i} y={i * 2} width="20" height="2" fill="#B22234" />
      ))}
      <rect width="9" height="8" fill="#3C3B6E" />
      {[1.6, 4.5, 7.4].map((x) =>
        [1.6, 4, 6.4].map((y) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="0.6" fill="#F5F5F5" />
        )),
      )}
    </svg>
  );
}
