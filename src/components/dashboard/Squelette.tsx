"use client";

/**
 * La forme du tableau de bord, avant que ses données n'arrivent.
 *
 * Sans lui, la page affichait un « Chargement… » de deux lignes : le pied de
 * page se posait juste dessous, puis sautait de sept cents pixels quand le
 * contenu arrivait. Mesuré à 0,148 de déplacement cumulé, pour un seuil de
 * 0,1 — c'est le genre de saut qui fait cliquer à côté.
 *
 * Le squelette reprend les mêmes classes que la page réelle : il occupe donc
 * la même place sans qu'on ait à recopier des hauteurs à la main, qui
 * dériveraient au premier changement de style.
 */
export function Squelette() {
  return (
    <div className="space-y-6" aria-hidden>
      <div style={{ height: 44, width: 260, borderRadius: 6, background: "var(--bg-raised)" }} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="stat-card p-4" style={{ height: 104 }} />
        ))}
      </div>
      <div className="lol-panel p-4" style={{ height: 92 }} />
      <div style={{ height: 34 }} />
      <div className="grid gap-4 grid-cols-1">
        {[0, 1].map((i) => (
          <div key={i} className="bloc-graphique" style={{ height: 250 }} />
        ))}
      </div>
    </div>
  );
}

/**
 * La place d'un bloc de graphique pendant qu'il se charge.
 *
 * Sa hauteur reprend celle du bloc réel : un titre, puis deux cents pixels de
 * tracé. Sans cette réserve, la page se replierait au moment où les
 * graphiques se posent, et le déplacement cumulé remonterait.
 */
export function PlaceGraphique({ double = false }: { double?: boolean }) {
  return (
    <div className="grid gap-4 grid-cols-1" aria-hidden>
      {(double ? [0, 1] : [0]).map((i) => (
        <div key={i} className="bloc-graphique" style={{ height: 250 }} />
      ))}
    </div>
  );
}
