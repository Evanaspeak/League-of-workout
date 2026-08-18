export const overlay = {
  fr: {
    titre: "Overlay en jeu",
    aide: "Une pastille affichée par-dessus le jeu pendant la partie : ta dette qui monte, sans quitter l'écran. Elle laisse passer les clics et ne peut pas gêner une partie.",
    active: "Overlay activé",
    desactive: "Overlay désactivé",
    limitePleinEcran:
      "En plein écran, League garde l'écran pour lui seul et l'overlay disparaît. Passe le jeu en « Sans bordure » pour le voir — l'image est identique, et il revient tout seul.",
    positionTitre: "Position à l'écran",
    positionAide: "En haut à droite, la pastille recouvre le score et le CS. Choisis un coin libre.",
    coins: { "haut-gauche": "Haut gauche", "haut-droite": "Haut droite", "bas-gauche": "Bas gauche", "bas-droite": "Bas droite" } as Record<string, string>,
    raccourciActif: (combinaison: string) => `${combinaison} l'affiche ou le masque, même en jeu.`,
    raccourciAucun:
      "Aucun raccourci n'a pu être pris : toutes les combinaisons sont déjà utilisées par une autre application. Passe par l'icône près de l'horloge, elle répond toujours.",
    raccourciCoin: (combinaison: string) => `${combinaison} la déplace d'un coin à l'autre.`,
  },
  en: {
    titre: "In-game overlay",
    aide: "A small panel drawn over the game while you play: your debt as it climbs, without leaving the screen. It lets clicks through and cannot interfere with a match.",
    active: "Overlay on",
    desactive: "Overlay off",
    limitePleinEcran:
      "In fullscreen, League keeps the display to itself and the overlay disappears. Switch the game to « Borderless » to see it — the picture is identical, and it comes back on its own.",
    positionTitre: "On-screen position",
    positionAide: "Top right covers the score and CS. Pick a free corner.",
    coins: { "haut-gauche": "Top left", "haut-droite": "Top right", "bas-gauche": "Bottom left", "bas-droite": "Bottom right" } as Record<string, string>,
    raccourciActif: (combinaison: string) => `${combinaison} shows or hides it, even mid-game.`,
    raccourciAucun:
      "No shortcut could be registered: every combination is already taken by another app. Use the icon near the clock — it always responds.",
    raccourciCoin: (combinaison: string) => `${combinaison} moves it from corner to corner.`,
  },
};
