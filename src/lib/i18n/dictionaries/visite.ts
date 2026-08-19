export const visite = {
  fr: {
    etape: (n: number, total: number) => `${n} / ${total}`,
    suivant: "Suivant",
    precedent: "Précédent",
    terminer: "C'est parti",
    passer: "Passer la visite",

    // Chaque étape pointe un élément réel de l'écran. Les textes disent ce que
    // la chose FAIT et pourquoi elle existe — pas ce qu'elle est. « Ouvre le
    // suivi » plutôt que « bouton de session ».

    // ── Tableau de bord ──
    railTitre: "Tout part d'ici",
    railTexte: "Ce rail te suit sur toutes les pages, même quand tu descends. Il porte les trois choses que tu fais tous les soirs : lancer une session, ajouter une partie, et payer ce que tu dois. Sur téléphone il se replie derrière ce bouton.",

    sessionTitre: "Lance ta soirée",
    sessionTexte: "Tu choisis le jeu, et l'application enregistre tes parties toute seule jusqu'à ce que tu l'arrêtes. Sur League elle lit le score directement dans la partie. Sur un jeu sans victoire ni défaite — Minecraft, un RPG — elle compte le temps passé à la place.",

    ajoutTitre: "Ou saisis à la main",
    ajoutTexte: "Une partie oubliée, un jeu qu'on ne sait pas lire, une soirée entière rattrapée le lendemain : tu entres le score ici et le coût se calcule exactement pareil. Le montant s'affiche avant que tu valides, jamais après.",

    detteTitre: "Ce que tu dois",
    detteTexte: "Ta dette s'accumule ici, partie après partie, et elle reste visible partout. Clique dessus quand tu es prêt : un décompte t'accompagne pendant l'effort, et si tu t'arrêtes en route, seule la part réellement faite est déduite.",

    statsTitre: "Où tu en es",
    statsTexte: "Ton nombre d'activités, ton taux de victoire et le total accumulé depuis le début. Ces trois chiffres ne se filtrent jamais : ils décrivent tout, pour que tu aies toujours un point de repère fixe.",

    graphiqueTitre: "Le chiffre qui compte vraiment",
    graphiqueTexte: "Le total ne peut que monter — il ne dit donc rien de tes progrès. Le coût MOYEN d'une partie, lui, baisse quand tu joues mieux. C'est le seul indicateur de l'application qui peut descendre, et c'est celui à surveiller.",

    // ── Historique ──
    navHistoriqueTitre: "Le détail de tout",
    navHistoriqueTexte: "On y va. L'historique garde chaque partie que tu as jouée, avec son coût et le calcul qui l'explique.",

    historiqueTitre: "Chaque partie, son coût",
    historiqueTexte: "Une ligne par activité : la date, le jeu, ton score, et ce que ça t'a coûté — avec le nom de l'exercice, pour ne pas confondre des pompes et des secondes de boxe. La flèche à droite déplie le calcul complet, et la croix supprime la ligne si elle est fausse.",

    // ── Réglages ──
    navReglagesTitre: "Règle-la à ta mesure",
    navReglagesTexte: "Dernière étape. Les réglages sont rangés par rubrique, comme sur un téléphone : tu ouvres celle que tu cherches et tu reviens.",

    reglagesEffortTitre: "Commence par ici",
    reglagesEffortTexte: "Le test de force est dans cette rubrique, et c'est par lui qu'il faut commencer : le nombre de pompes que tu enchaînes fixe le multiplicateur appliqué à TOUTE ta dette. Tant qu'il n'est pas fait, tu restes au niveau le plus bas. Tu y choisis aussi tes exercices — pompes, squats ou boxe.",

    reglagesJeuxTitre: "Un réglage par jeu",
    reglagesJeuxTexte: "Chaque jeu a son bloc : le compte à suivre pour League, et l'endroit où la pastille se pose à l'écran pendant la partie. Si tu as l'application Windows, c'est ici que tu la règles jeu par jeu.",

    finTitre: "À toi de jouer",
    finTexte: "Fais le test de force, lance une session, et joue. Le reste se remplit tout seul. Tu peux revoir cette visite depuis les réglages.",
  },
  en: {
    etape: (n: number, total: number) => `${n} / ${total}`,
    suivant: "Next",
    precedent: "Back",
    terminer: "Let's go",
    passer: "Skip the tour",

    railTitre: "It all starts here",
    railTexte: "This rail follows you on every page, even as you scroll. It holds the three things you do every night: start a session, add a match, and pay what you owe. On a phone it folds behind this button.",

    sessionTitre: "Start your night",
    sessionTexte: "You pick the game and the app logs your matches on its own until you stop it. On League it reads the score straight from the match. On a game with no win or loss — Minecraft, an RPG — it counts the time you spend instead.",

    ajoutTitre: "Or enter it by hand",
    ajoutTexte: "A forgotten match, a game we can't read, a whole evening caught up the next day: type the score here and the cost is worked out exactly the same. The amount shows before you confirm, never after.",

    detteTitre: "What you owe",
    detteTexte: "Your debt piles up here, match after match, and stays visible everywhere. Tap it when you're ready: a countdown walks you through the effort, and if you stop halfway only the part you actually did is taken off.",

    statsTitre: "Where you stand",
    statsTexte: "Your activity count, your win rate and the total built up since day one. These three never get filtered: they describe everything, so you always have a fixed reference point.",

    graphiqueTitre: "The number that really counts",
    graphiqueTexte: "The total can only go up — so it says nothing about your progress. The AVERAGE cost per match does drop when you play better. It's the only figure in the app that can go down, and it's the one to watch.",

    navHistoriqueTitre: "The detail of everything",
    navHistoriqueTexte: "Let's go there. History keeps every match you've played, with its cost and the maths behind it.",

    historiqueTitre: "Every match, its cost",
    historiqueTexte: "One row per activity: date, game, your score, and what it cost you — with the exercise named, so push-ups and seconds of boxing never get confused. The arrow on the right unfolds the full calculation, and the cross deletes a row that's wrong.",

    navReglagesTitre: "Set it to your size",
    navReglagesTexte: "Last stop. Settings are filed by section, like on a phone: you open the one you want and come back.",

    reglagesEffortTitre: "Start here",
    reglagesEffortTexte: "The strength test lives in this section, and it's where to begin: how many push-ups you do in a row sets the multiplier applied to ALL your debt. Until you take it, you stay at the lowest level. This is also where you pick your exercises — push-ups, squats or boxing.",

    reglagesJeuxTitre: "One setting per game",
    reglagesJeuxTexte: "Each game gets its own block: the account to follow for League, and where the panel sits on screen during a match. If you have the Windows app, this is where you tune it game by game.",

    finTitre: "Over to you",
    finTexte: "Take the strength test, start a session, and play. The rest fills itself in. You can replay this tour from the settings.",
  },
};
