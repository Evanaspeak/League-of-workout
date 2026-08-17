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
export function Drapeau({ pays, taille = 16 }: { pays: "fr" | "us"; taille?: number }) {
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
