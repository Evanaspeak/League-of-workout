export const visite = {
  fr: {
    // Le compteur d'étapes et les commandes.
    etape: (n: number, total: number) => `${n} / ${total}`,
    suivant: "Suivant",
    precedent: "Précédent",
    terminer: "C'est parti",
    passer: "Passer la visite",

    // Chaque étape pointe un élément réel de l'écran. Les textes disent ce que
    // la chose FAIT, pas ce qu'elle est : « ouvre le suivi » plutôt que
    // « bouton de session ».
    railTitre: "Tout part d'ici",
    railTexte: "Ce rail te suit sur toutes les pages. C'est là que tu lances une soirée, que tu ajoutes une partie à la main, et que tu vois ce que tu dois.",

    sessionTitre: "Lance une soirée",
    sessionTexte: "Tu dis à quel jeu tu joues, et l'application enregistre tes parties toute seule jusqu'à ce que tu l'arrêtes. Sur League, elle lit directement le score en fin de partie.",

    ajoutTitre: "Ou saisis à la main",
    ajoutTexte: "Une partie oubliée, un jeu non détecté, une séance de sport hors application : tu l'ajoutes ici et le coût se calcule pareil.",

    detteTitre: "Ce que tu dois",
    detteTexte: "Ta dette s'accumule ici, partie après partie. Clique dessus quand tu es prêt : un décompte t'accompagne pendant l'effort, et ce que tu fais est déduit.",

    statsTitre: "Ce que ça donne",
    statsTexte: "Tes totaux, ton taux de victoire et ta progression. Le chiffre qui compte n'est pas le plus gros, c'est le coût moyen d'une partie : c'est lui qui baisse quand tu joues mieux.",

    historiqueTitre: "Chaque partie, son coût",
    historiqueTexte: "L'historique liste tout ce que tu as joué, avec l'exercice et le détail du calcul. Tu peux y corriger une date ou supprimer une ligne.",

    reglagesTitre: "Règle-la à ta mesure",
    reglagesTexte: "Ton test de force fixe la difficulté, tes exercices décident de la monnaie, et chaque jeu a ses propres réglages. Commence par le test de force : tout en découle.",
  },
  en: {
    etape: (n: number, total: number) => `${n} / ${total}`,
    suivant: "Next",
    precedent: "Back",
    terminer: "Let's go",
    passer: "Skip the tour",

    railTitre: "It all starts here",
    railTexte: "This rail follows you on every page. It's where you start a night, add a game by hand, and see what you owe.",

    sessionTitre: "Start a night",
    sessionTexte: "You tell it which game you're playing, and the app logs your matches on its own until you stop it. On League it reads the score straight from the game.",

    ajoutTitre: "Or enter it by hand",
    ajoutTexte: "A forgotten match, a game it can't detect, a workout outside the app: add it here and the cost is worked out the same way.",

    detteTitre: "What you owe",
    detteTexte: "Your debt piles up here, match after match. Tap it when you're ready: a countdown walks you through the effort, and what you do is taken off.",

    statsTitre: "What it adds up to",
    statsTexte: "Your totals, your win rate and your progress. The number that matters isn't the biggest one — it's the average cost per match, and that's what drops when you play better.",

    historiqueTitre: "Every match, its cost",
    historiqueTexte: "History lists everything you've played, with the exercise and the breakdown of the maths. You can fix a date or delete a row there.",

    reglagesTitre: "Set it to your size",
    reglagesTexte: "Your strength test sets the difficulty, your exercises decide the currency, and each game has its own settings. Start with the strength test: everything follows from it.",
  },
};
