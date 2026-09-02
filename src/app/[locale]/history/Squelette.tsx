"use client";

/**
 * La forme de l'historique, avant que ses parties n'arrivent.
 *
 * Sans lui, la page affichait un « Chargement… » d'une ligne, et le pied de
 * page se posait juste dessous. Quand la liste arrivait, tout ce qui était
 * visible sautait de plusieurs centaines de pixels : **0,252 de déplacement
 * cumulé** pour un seuil de 0,1, mesuré sur soixante parties.
 *
 * C'est exactement le défaut déjà corrigé sur le tableau de bord, à 0,148. Il
 * a vécu ici parce que toutes les campagnes précédentes tournaient sur un
 * compte VIDE : une liste sans ligne ne pousse rien, et la mesure rendait
 * 0,000 en toute honnêteté sans rien dire. C'est le piège déjà écrit pour
 * `routes.mjs`, sur une autre métrique.
 *
 * Le squelette reprend les classes de la page réelle plutôt que des hauteurs
 * recopiées à la main, qui dériveraient au premier changement de style. Les
 * douze lignes sont un ordre de grandeur, pas une prédiction : il s'agit de
 * remplir l'écran pour que le pied de page ne soit pas visible avant, et donc
 * ne saute pas.
 */
export function Squelette() {
  return (
    <div className="space-y-4" aria-hidden data-attente="historique">
      {/* La barre de filtres */}
      <div className="lol-panel p-3" style={{ height: 76 }} />
      {/* La liste elle-même */}
      <div className="lol-panel p-3 space-y-2">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} style={{ height: 44, borderRadius: 6, background: "var(--bg-raised)" }} />
        ))}
      </div>
    </div>
  );
}
