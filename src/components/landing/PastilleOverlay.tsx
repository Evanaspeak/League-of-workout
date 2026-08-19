"use client";

/**
 * La pastille d'overlay, telle qu'elle s'affiche par-dessus une partie.
 *
 * C'est la reproduction fidèle de `desktop/src/overlay.html` avec les jetons de
 * couleur du site : mêmes lignes, même hiérarchie, mêmes valeurs. Montrer le
 * vrai objet plutôt qu'une illustration est tout l'intérêt — c'est la seule
 * image que ce produit peut donner et qu'aucun autre ne peut copier.
 *
 * Elle est figée : sur une page d'accueil, un chiffre qui défile attire l'œil
 * au mauvais endroit, et la scène doit se lire d'un coup.
 */
export function PastilleOverlay({
  soiree, jeu, kda, kdaValeur, siGagne, siPerdu, gagne, perdu, temps,
}: {
  soiree: string; jeu: string; kda: string; kdaValeur: string;
  siGagne: string; siPerdu: string; gagne: string; perdu: string; temps: string;
}) {
  const ligne: React.CSSProperties = {
    display: "flex", alignItems: "baseline", justifyContent: "space-between",
    gap: 10, fontSize: "0.66rem", color: "var(--faint)",
  };
  const valeur: React.CSSProperties = {
    fontWeight: 700, fontSize: "0.78rem", fontVariantNumeric: "tabular-nums",
  };

  return (
    <div
      aria-hidden
      style={{
        width: 230,
        padding: "10px 13px",
        borderRadius: 12,
        background: "rgba(20,23,28,0.96)",
        border: "1px solid rgba(255,180,84,0.45)",
        color: "var(--bone)",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        fontSize: "0.58rem", letterSpacing: "0.14em", textTransform: "uppercase",
        color: "var(--steel)",
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "var(--victory)", boxShadow: "0 0 6px var(--victory)",
        }} />
        <span>Win // Workout</span>
      </div>

      <div className="mono-num" style={{
        marginTop: 5, fontSize: "1.7rem", fontWeight: 700, lineHeight: 1.05,
        color: "var(--amber)", fontVariantNumeric: "tabular-nums",
      }}>
        {temps}
      </div>
      <div style={{ marginTop: 2, fontSize: "0.62rem", color: "var(--faint)" }}>
        {soiree}
      </div>

      <div style={{ marginTop: 6, fontSize: "0.66rem", color: "var(--victory)" }}>
        {jeu}
      </div>

      <div style={{
        marginTop: 7, paddingTop: 6, display: "grid", gap: 3,
        borderTop: "1px solid rgba(152,162,176,0.16)",
      }}>
        <div style={ligne}>
          <span>{kda}</span>
          <b className="mono-num" style={{ ...valeur, color: "var(--bone)" }}>{kdaValeur}</b>
        </div>
        <div style={ligne}>
          <span>{siGagne}</span>
          <b className="mono-num" style={{ ...valeur, color: "var(--victory)" }}>{gagne}</b>
        </div>
        <div style={ligne}>
          <span>{siPerdu}</span>
          <b className="mono-num" style={{ ...valeur, color: "var(--ember)" }}>{perdu}</b>
        </div>
      </div>
    </div>
  );
}
