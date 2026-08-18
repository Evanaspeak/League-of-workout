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
    raccourciActif: (combinaison: string) => `${combinaison} l'affiche ou le masque depuis le bureau.`,
    raccourciAucun:
      "Aucun raccourci n'a pu être pris : toutes les combinaisons sont déjà utilisées par une autre application.",
    raccourciCoin: (combinaison: string) => `${combinaison} la déplace d'un coin à l'autre.`,
    // Promettre « même en jeu » était faux : League tourne avec des privilèges
    // que l'application n'a pas, et Windows ne lui livre alors pas la
    // combinaison. Mieux vaut dire ce qui marche que répéter ce qui échoue.
    raccourciEnJeu:
      "En jeu, League tourne avec des privilèges plus élevés que l'application (Vanguard) et Windows ne nous livre plus la combinaison — le raccourci reste sans effet tant que le jeu a le focus. Pour la masquer pendant une partie, passe par l'icône près de l'horloge : clic droit, « Afficher / masquer l'overlay ». Elle répond toujours.",
    placerBtn: "Placer à la main",
    placerTerminer: "Terminer le placement",
    placerEnCours: "La pastille est attrapable : traîne-la où tu veux, y compris par-dessus le jeu en « Sans bordure ». Clique sur « Terminer » quand elle est bien.",
    placerLibre: "Posée à la main. Choisir un coin annule ce placement.",
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
    raccourciActif: (combinaison: string) => `${combinaison} shows or hides it from the desktop.`,
    raccourciAucun:
      "No shortcut could be registered: every combination is already taken by another app.",
    raccourciCoin: (combinaison: string) => `${combinaison} moves it from corner to corner.`,
    raccourciEnJeu:
      "In game, League runs with higher privileges than the app (Vanguard) and Windows stops delivering the combination — the shortcut does nothing while the game has focus. To hide the panel mid-match, use the icon near the clock: right-click, « Show / hide overlay ». That always responds.",
    placerBtn: "Place it by hand",
    placerTerminer: "Done placing",
    placerEnCours: "The panel can be grabbed: drag it wherever you like, including over the game in « Borderless ». Click « Done » once it sits right.",
    placerLibre: "Placed by hand. Picking a corner clears it.",
  },
};
