export const landing = {
  fr: {
    navDownload: "Télécharger",
    navLoggedIn: "Mon espace",
    navLoggedOut: "Se connecter",
    heroBadge: "Bêta ouverte — Google, Discord ou un simple pseudo",
    // Sans point final : le titre est une phrase, pas deux, et la virgule fait
    // le travail que faisaient deux points mal placés.
    heroTitleLine1: "Gagne ta game,",
    heroTitleLine2: "ou paie en sueur",
    heroSubtitle: "Chaque partie a un prix, calculé sur ta performance. Tu le paies en pompes, en squats ou en boxe — et plus tu joues bien, moins tu paies.",
    heroTelecharger: "Télécharger pour Windows",
    heroTelechargerNote: "Gratuit · Windows 10 et 11 · aucune carte bancaire",
    heroVersion: (v: string) => `Version ${v}`,
    heroNavigateur: "Ou l'essayer dans le navigateur",
    heroGamesLive: "15 jeux pris en charge",
    heroGamesNext: "League · Valorant · CS2 · Fortnite · Apex · Warzone · Rocket League · TFT · Minecraft…",
    heroDownload: "Télécharger l'app Windows",
    heroBeta: "Créer mon compte",
    heroLogin: "Se connecter",
    heroApercuTitre: "Win or Workout — Tableau de bord",
    heroApercuAlt: "Le tableau de bord de Win or Workout : 105 activités, 55 % de winrate, 2 203 points de dette et la progression vers l'objectif.",

    // ── La bande des jeux ──
    jeuxLegende: "Les jeux pris en charge",
    jeuxTitre: "Quinze jeux, un seul compteur",

    // ── La boucle d'usage ──
    boucleEyebrow: "La boucle",
    boucleTitre: "Trois temps, et c'est réglé",
    boucleSoustitre: "Ce que tu fais avec l'application, en entier. Il n'y a rien d'autre à apprendre.",
    boucleLegende: "Les trois temps de la boucle",
    boucleAria: "Démonstration : une partie perdue, le calcul de la dette, puis le paiement",
    boucleTemps: [
      {
        numero: "01",
        titre: "Tu perds ta game",
        texte: "Le score de fin de partie décide de tout : ton KDA sur un MOBA, ton classement sur un battle royale, ou le temps que tu viens de passer sur un jeu qui ne se gagne pas.",
      },
      {
        numero: "02",
        titre: "L'app chiffre l'addition",
        texte: "Ta performance, ton niveau de forme et le résultat donnent un nombre. Il s'affiche pendant que tu saisis — rien à calculer, rien à valider.",
      },
      {
        numero: "03",
        titre: "Tu paies avant la suivante",
        texte: "Trente-huit points, c'est trente-huit pompes. Ou cinquante-sept squats. Ou quatre minutes vingt-cinq de sac. Tu choisis la monnaie, l'app tient les comptes.",
      },
    ],

    // ── Les captures ──
    produitEyebrow: "Le produit",
    produitTitre: "Voilà à quoi ça ressemble",
    produitSoustitre: "Des captures de l'application, telle qu'elle tourne aujourd'hui. Aucune n'est un montage.",
    produitCaptures: [
      {
        image: "/images/produit/historique.png",
        titre: "L'historique",
        legende: "Chaque partie, son coût, et le cumul qui monte. Modifiable et supprimable, ligne par ligne.",
        cadre: "Win or Workout — Historique",
        alt: "L'historique de Win or Workout : une liste de parties League of Legends, Valorant, Fortnite et Minecraft avec la dette de chacune et le cumul.",
        largeur: 2720, hauteur: 1660,
      },
      {
        image: "/images/produit/stats.png",
        titre: "Les statistiques",
        legende: "Le cumul ne fait que monter. Le coût moyen par partie, lui, descend quand tu joues mieux — c'est le seul chiffre qui dit si tu progresses.",
        cadre: "Win or Workout — Statistiques",
        alt: "Trois graphiques : la dette par jeu, la progression cumulative sur trois mois et le coût moyen par activité semaine après semaine.",
        largeur: 1880, hauteur: 1106,
      },
      {
        image: "/images/produit/mobile.png",
        titre: "Sur téléphone",
        legende: "Le même compte, la même dette. Pratique pour enregistrer une partie depuis le canapé.",
        cadre: "Win or Workout — Mobile",
        alt: "Win or Workout sur téléphone : le tableau de bord adapté à un écran étroit.",
        largeur: 1170, hauteur: 1680,
      },
    ],

    feedTitle: "Ta soirée, facturée",
    feedCount: "5 activités",
    feedTotalLabel: "Dette totale",
    feedPointsUnit: "points",
    // Une même dette, trois façons de la payer : c'est tout le modèle en une ligne.
    feedConversion: "= 121 pompes · 182 squats · 14 min 05 de boxe",
    // ── Pastille d'overlay du héros ──
    // Les valeurs sont figées et cohérentes entre elles : un KDA médiocre, donc
    // une dette réelle, et l'écart entre victoire et défaite qu'impose le
    // barème. Une capture doit rester vraie même en illustration.
    pastilleSoiree: "joué ce soir, hors menus",
    pastilleJeu: "League of Legends",
    pastilleKda: "KDA",
    pastilleKdaValeur: "5 / 7 / 14",
    pastilleSiGagne: "Si gagné",
    pastilleSiPerdu: "Si perdu",
    pastilleGagne: "11",
    pastillePerdu: "16",
    pastilleTemps: "1:08:40",
    feedEntries: [
      { r: "D", jeu: "League of Legends", detail: "Classée Solo/Duo · 2/9/4", pts: 38 },
      { r: "V", jeu: "Valorant", detail: "Compétitif · 18/14/5", pts: 9 },
      { r: "D", jeu: "Fortnite", detail: "Squad · 31e sur 25", pts: 27 },
      { r: "N", jeu: "Minecraft", detail: "Session · 2 h 10", pts: 43 },
      { r: "V", jeu: "Rocket League", detail: "Classée · 3-1", pts: 4 },
    ],

    statsLabel: "La réalité des gamers",
    stats: [
      { value: "-30%", label: "de pas quotidiens chez les gamers par rapport à la population générale (Withings)" },
      { value: "13h", label: "de jeu par semaine en moyenne — soit près de 2h par jour (ESA, 2023)" },
      { value: "4ème", label: "cause de mortalité mondiale — la sédentarité, devant l'obésité (OMS)" },
      { value: "+20%", label: "de mémoire et concentration après 20 min d'exercice modéré (PNAS / Univ. Illinois)" },
    ],

    problemEyebrow: "Le problème",
    problemTitleLine1: "On est tous assis à",
    problemTitleLine2: "ne rien faire pendant",
    problemTitleHighlight: "des heures",
    problemPara1: "Une soirée de jeu dépasse facilement les six heures. Entre les parties, les lobbies, les replays et le stream, on reste assis des journées entières. Le corps paie la note.",
    problemPara2: "La sédentarité chronique augmente les risques cardiovasculaires, réduit la concentration et dégrade les performances cognitives — exactement ce dont tu as besoin pour carry.",
    problemStats: [
      { label: "Temps assis moyen / jour (gamer PC)", value: "8-10h" },
      { label: "Adultes insuffisamment actifs (OMS)", value: "1 sur 4" },
      { label: "Décès liés à la sédentarité / an (OMS)", value: "3,2M" },
      { label: "Risque maladies chroniques", value: "+20-30%" },
    ],

    // ── Comment tu paies : le cœur du modèle, une dette convertible ──
    payEyebrow: "Une dette, trois monnaies",
    payTitle: "Tu choisis comment tu paies",
    paySubtitle: "L'app ne compte pas des pompes : elle compte des points d'effort. Le même coût se convertit dans l'exercice qui te va — et tu peux même le partager entre plusieurs. Rien à acheter, rien à installer, ça se fait entre deux parties.",
    payUnitLabel: "Pour une partie à 38 points",
    payModes: [
      {
        icon: "layers",
        name: "Pompes",
        valeur: "38 pompes",
        desc: "Le haut du corps en un seul mouvement : poitrine, bras et épaules travaillent pendant que tout le tronc gaine pour tenir la planche.",
      },
      {
        icon: "target",
        name: "Squats",
        valeur: "57 squats",
        desc: "Le bas du corps : cuisses, fessiers et mollets. Plus de répétitions pour le même effort, parce qu'un squat coûte moins cher qu'une pompe.",
      },
      {
        icon: "zap",
        name: "Boxe",
        valeur: "4 min 25",
        desc: "Sac ou shadow, au choix. Comptée en temps de travail effectif, elle s'accumule au fil de la soirée et se paie en une vraie séance plutôt qu'en micro-séries.",
      },
    ],
    payShareNote: "Deux exercices cochés ? La dette se partage entre eux : 19 pompes et 2 min 15 de boxe.",

    sourcesTitle: "Sources",
    payFootnote: "Le poids du corps suffit, et ça se tient scientifiquement :",
    paySources: [
      {
        label: "Yang et al., JAMA Network Open (2019) — la capacité à faire des pompes est fortement associée à un risque cardiovasculaire plus faible",
        href: "https://doi.org/10.1001/jamanetworkopen.2018.8341",
      },
      {
        label: "Calatayud et al., J. Strength & Conditioning Research (2015) — à activation musculaire comparable, pompes et développé couché produisent des gains de force similaires",
        href: "https://pubmed.ncbi.nlm.nih.gov/?term=Calatayud+bench+press+push-up+comparable+strength+gains",
      },
      {
        label: "Cogley et al., J. Strength & Conditioning Research (2005) — analyse EMG de l'activation des pectoraux et triceps pendant les pompes",
        href: "https://pubmed.ncbi.nlm.nih.gov/?term=Cogley+muscle+activation+hand+positions+push-up",
      },
    ],

    howEyebrow: "Comment ça marche",
    howTitle: "3 étapes, c'est tout",
    steps: [
      {
        num: "01",
        title: "Choisis ton jeu",
        desc: "Quinze jeux au catalogue, du MOBA au battle royale en passant par les jeux qui se comptent en heures. Chacun ne te demande que ce qu'il possède vraiment.",
      },
      {
        num: "02",
        title: "Joue, puis enregistre",
        desc: "Lance une session pour chronométrer, ou ajoute la partie après coup en dix secondes. La dette se calcule pendant que tu remplis, sans rien avoir à valider.",
      },
      {
        num: "03",
        title: "Paie l'addition",
        desc: "Ton score dépend de ta performance et de ton niveau. Pompes, squats ou boxe : tu choisis la monnaie, l'app tient les comptes.",
      },
    ],

    benefitsEyebrow: "Pourquoi s'y mettre",
    benefitsTitle: "L'exercice améliore ton jeu",
    benefitsSubtitle: "Accessoirement, ça te fait jouer mieux.",
    benefits: [
      {
        icon: "zap",
        title: "Concentration",
        desc: "L'exercice physique augmente le flux sanguin cérébral, améliorant la concentration et les prises de décision en game.",
      },
      {
        icon: "target",
        title: "Réflexes",
        desc: "Une activité physique régulière réduit les temps de réaction. Tes réflexes en jeu s'améliorent avec ton cardio.",
      },
      {
        icon: "brain",
        title: "Mental",
        desc: "L'exercice libère des endorphines qui réduisent le stress et la tilté. Tu joues mieux quand tu vas bien.",
      },
      {
        icon: "heart",
        title: "Santé long terme",
        desc: "Rester assis plus de 6h par jour augmente de 34% les risques cardiovasculaires. Quelques séries cassent ce cycle.",
      },
    ],

    featuresEyebrow: "Fonctionnalités",
    featuresTitle: "Ce que fait l'app",
    features: [
      { title: "Quinze jeux, un seul compteur", desc: "MOBA, FPS, battle royale ou jeu au temps : chacun est noté selon ses propres règles, et tout se convertit dans la même monnaie." },
      { title: "Scoring adapté au jeu", desc: "KDA et maîtrise du champion sur un MOBA, classement final sur un battle royale, durée sur une session. Jamais une donnée que le jeu n'a pas." },
      { title: "Saisie en dix secondes", desc: "Le coût s'affiche pendant que tu remplis, dans l'unité de chaque exercice. Rien à calculer, rien à valider." },
      { title: "Une dette, plusieurs monnaies", desc: "Pompes, squats ou boxe. Coche-en plusieurs et la dette se partage entre eux." },
      { title: "Compteur de boxe", desc: "La boxe s'accumule au lieu de se payer en micro-séries. Passé ton seuil, l'app te prévient et lance le chrono." },
      { title: "Mode session", desc: "Chronomètre pour les jeux au temps, et suivi automatique des parties League dès que Riot nous ouvre l'API." },
      { title: "Statistiques par jeu", desc: "Chaque jeu a sa synthèse, et une vue d'ensemble compare ce qui est comparable entre eux." },
      { title: "App desktop", desc: "Application Windows, avec un overlay en cours de développement pour suivre ta dette sans quitter la partie." },
    ],

    // Sans point : c'est un titre, pas une phrase de paragraphe.
    ctaTitle: "Ta prochaine soirée a un prix",
    ctaSubtitle: "Télécharge l'application, ou crée ton compte en trente secondes. Google, Discord, ou un simple pseudo.",
    ctaDownload: "Télécharger l'app",
    ctaBeta: "Créer mon compte",
    overlayEtiquette: "Partie en cours",
    overlayLegende: "La surcouche s'affiche par-dessus le jeu, dans le coin que tu choisis. Elle montre ce que la soirée te coûte, et ce que la partie en cours coûtera selon qu'elle se gagne ou se perd.",
    footerCgu: "CGU",
    footerConfidentialite: "Confidentialité",
    footerLogin: "Se connecter",
    footerDisclaimer: "Win or Workout n'est affilié à aucun éditeur de jeux.",
  },
  en: {
    navDownload: "Download",
    navLoggedIn: "My space",
    navLoggedOut: "Log in",
    heroBadge: "Open beta — Google, Discord or just a nickname",
    heroTitleLine1: "Win your game,",
    heroTitleLine2: "or pay in sweat",
    heroSubtitle: "Every match has a price, based on how you played. You settle it in push-ups, squats or boxing — and the better you play, the less you pay.",
    heroTelecharger: "Download for Windows",
    heroTelechargerNote: "Free · Windows 10 and 11 · no credit card",
    heroVersion: (v: string) => `Version ${v}`,
    heroNavigateur: "Or try it in the browser",
    heroGamesLive: "15 games supported",
    heroGamesNext: "League · Valorant · CS2 · Fortnite · Apex · Warzone · Rocket League · TFT · Minecraft…",
    heroDownload: "Download the Windows app",
    heroBeta: "Create my account",
    heroLogin: "Log in",
    heroApercuTitre: "Win or Workout — Dashboard",
    heroApercuAlt: "The Win or Workout dashboard: 105 activities, 55% win rate, 2,203 points owed and progress toward the goal.",

    jeuxLegende: "Supported games",
    jeuxTitre: "Fifteen games, one counter",

    boucleEyebrow: "The loop",
    boucleTitre: "Three beats, and you're done",
    boucleSoustitre: "Everything you do with the app, in full. There is nothing else to learn.",
    boucleLegende: "The three beats of the loop",
    boucleAria: "Demo: a lost match, the debt being calculated, then the payment",
    boucleTemps: [
      {
        numero: "01",
        titre: "You lose your game",
        texte: "The end-of-match score decides everything: your KDA in a MOBA, your placement in a battle royale, or the time you just spent on a game that can't be won.",
      },
      {
        numero: "02",
        titre: "The app works out the bill",
        texte: "Your performance, your fitness level and the result give a number. It appears as you type — nothing to compute, nothing to confirm.",
      },
      {
        numero: "03",
        titre: "You pay before the next one",
        texte: "Thirty-eight points means thirty-eight push-ups. Or fifty-seven squats. Or four minutes twenty-five on the bag. You pick the currency, the app keeps the books.",
      },
    ],

    produitEyebrow: "The product",
    produitTitre: "Here's what it looks like",
    produitSoustitre: "Screenshots of the app as it runs today. None of them is a mockup.",
    produitCaptures: [
      {
        image: "/images/produit/historique.png",
        titre: "History",
        legende: "Every match, its cost, and the running total. Editable and deletable, row by row.",
        cadre: "Win or Workout — History",
        alt: "The Win or Workout history: a list of League of Legends, Valorant, Fortnite and Minecraft matches with the debt of each and the running total.",
        largeur: 2720, hauteur: 1660,
      },
      {
        image: "/images/produit/stats.png",
        titre: "Statistics",
        legende: "The total only ever goes up. The average cost per match goes down when you play better — it's the one number that tells you whether you're improving.",
        cadre: "Win or Workout — Statistics",
        alt: "Three charts: debt per game, cumulative progress over three months, and average cost per activity week by week.",
        largeur: 1880, hauteur: 1106,
      },
      {
        image: "/images/produit/mobile.png",
        titre: "On your phone",
        legende: "Same account, same debt. Handy for logging a match from the sofa.",
        cadre: "Win or Workout — Mobile",
        alt: "Win or Workout on a phone: the dashboard fitted to a narrow screen.",
        largeur: 1170, hauteur: 1680,
      },
    ],

    feedTitle: "Your evening, billed",
    feedCount: "5 activities",
    feedTotalLabel: "Total owed",
    feedPointsUnit: "points",
    feedConversion: "= 121 push-ups · 182 squats · 14 min 05 of boxing",
    pastilleSoiree: "played tonight, menus excluded",
    pastilleJeu: "League of Legends",
    pastilleKda: "KDA",
    pastilleKdaValeur: "5 / 7 / 14",
    pastilleSiGagne: "If you win",
    pastilleSiPerdu: "If you lose",
    pastilleGagne: "11",
    pastillePerdu: "16",
    pastilleTemps: "1:08:40",
    feedEntries: [
      { r: "L", jeu: "League of Legends", detail: "Ranked Solo/Duo · 2/9/4", pts: 38 },
      { r: "W", jeu: "Valorant", detail: "Competitive · 18/14/5", pts: 9 },
      { r: "L", jeu: "Fortnite", detail: "Squad · 31st of 25", pts: 27 },
      { r: "N", jeu: "Minecraft", detail: "Session · 2 h 10", pts: 43 },
      { r: "W", jeu: "Rocket League", detail: "Ranked · 3-1", pts: 4 },
    ],

    statsLabel: "The gamer reality check",
    stats: [
      { value: "-30%", label: "fewer daily steps for gamers compared to the general population (Withings)" },
      { value: "13h", label: "of gaming per week on average — almost 2h a day (ESA, 2023)" },
      { value: "4th", label: "leading cause of death worldwide — inactivity, ahead of obesity (WHO)" },
      { value: "+20%", label: "boost in memory and focus after just 20 min of moderate exercise (PNAS / Univ. of Illinois)" },
    ],

    problemEyebrow: "The problem",
    problemTitleLine1: "We're all sitting there",
    problemTitleLine2: "doing nothing for",
    problemTitleHighlight: "hours on end",
    problemPara1: "A gaming night easily runs past six hours. Between matches, lobbies, replays, and stream, you're glued to your chair all day. Your body pays the price.",
    problemPara2: "Chronic inactivity raises cardiovascular risk, kills your focus, and tanks cognitive performance — exactly what you need to carry.",
    problemStats: [
      { label: "Avg. time seated / day (PC gamer)", value: "8-10h" },
      { label: "Adults not active enough (WHO)", value: "1 in 4" },
      { label: "Deaths linked to inactivity / year (WHO)", value: "3.2M" },
      { label: "Chronic disease risk", value: "+20-30%" },
    ],

    payEyebrow: "One debt, three currencies",
    payTitle: "You pick how you pay",
    paySubtitle: "The app doesn't count push-ups: it counts effort points. The same cost converts into whichever exercise suits you — and you can even split it across several. Nothing to buy, nothing to set up, it fits between two matches.",
    payUnitLabel: "For a game costing 38 points",
    payModes: [
      {
        icon: "layers",
        name: "Push-ups",
        valeur: "38 push-ups",
        desc: "Your upper body in a single movement: chest, arms, and shoulders working while your whole core braces to hold the plank.",
      },
      {
        icon: "target",
        name: "Squats",
        valeur: "57 squats",
        desc: "Your lower body: thighs, glutes, and calves. More reps for the same effort, because a squat costs less than a push-up.",
      },
      {
        icon: "zap",
        name: "Boxing",
        valeur: "4 min 25",
        desc: "Heavy bag or shadow, your call. Counted in actual working time, it piles up through the night and gets paid in one real round instead of pointless 30-second sets.",
      },
    ],
    payShareNote: "Ticked two exercises? The debt splits between them: 19 push-ups and 2 min 15 of boxing.",

    sourcesTitle: "Sources",
    payFootnote: "Your bodyweight is enough, and the research backs it:",
    paySources: [
      {
        label: "Yang et al., JAMA Network Open (2019) — push-up capacity is strongly associated with lower cardiovascular risk",
        href: "https://doi.org/10.1001/jamanetworkopen.2018.8341",
      },
      {
        label: "Calatayud et al., J. Strength & Conditioning Research (2015) — at matched muscle activation, push-ups and bench press produce similar strength gains",
        href: "https://pubmed.ncbi.nlm.nih.gov/?term=Calatayud+bench+press+push-up+comparable+strength+gains",
      },
      {
        label: "Cogley et al., J. Strength & Conditioning Research (2005) — EMG analysis of chest and triceps activation during push-ups",
        href: "https://pubmed.ncbi.nlm.nih.gov/?term=Cogley+muscle+activation+hand+positions+push-up",
      },
    ],

    howEyebrow: "How it works",
    howTitle: "3 steps, that's it",
    steps: [
      {
        num: "01",
        title: "Pick your game",
        desc: "Fifteen games in the catalogue, from MOBAs to battle royales to the ones you count in hours. Each one only asks for what it actually has.",
      },
      {
        num: "02",
        title: "Play, then log it",
        desc: "Start a session to run the clock, or add the match afterwards in ten seconds. The debt computes as you type, with nothing to confirm.",
      },
      {
        num: "03",
        title: "Settle up",
        desc: "Your score depends on how you played and on your level. Push-ups, squats or boxing: you pick the currency, the app keeps the books.",
      },
    ],

    benefitsEyebrow: "Why bother",
    benefitsTitle: "Exercise makes you play better",
    benefitsSubtitle: "It also happens to make you play better.",
    benefits: [
      {
        icon: "zap",
        title: "Focus",
        desc: "Physical exercise boosts blood flow to the brain, sharpening focus and decision-making mid-game.",
      },
      {
        icon: "target",
        title: "Reflexes",
        desc: "Regular physical activity cuts reaction time. Your in-game reflexes improve along with your cardio.",
      },
      {
        icon: "brain",
        title: "Mental game",
        desc: "Exercise releases endorphins that cut stress and tilt. You play better when you feel better.",
      },
      {
        icon: "heart",
        title: "Long-term health",
        desc: "Sitting more than 6 hours a day raises cardiovascular risk by 34%. A few sets break that cycle.",
      },
    ],

    featuresEyebrow: "Features",
    featuresTitle: "What the app does",
    features: [
      { title: "Fifteen games, one counter", desc: "MOBA, FPS, battle royale or time-based: each is scored on its own terms, and everything converts into the same currency." },
      { title: "Scoring that fits the game", desc: "KDA and champion mastery on a MOBA, final placement on a battle royale, duration on a session. Never a stat the game doesn't have." },
      { title: "Ten-second logging", desc: "The cost appears as you type, in each exercise's own unit. Nothing to compute, nothing to confirm." },
      { title: "One debt, several currencies", desc: "Push-ups, squats or boxing. Tick more than one and the debt splits between them." },
      { title: "Boxing counter", desc: "Boxing piles up instead of being paid in useless micro-sets. Past your threshold, the app tells you and starts the clock." },
      { title: "Session mode", desc: "A stopwatch for time-based games, and automatic League match tracking as soon as Riot opens the API to us." },
      { title: "Per-game stats", desc: "Every game gets its own summary, and an overview compares what's actually comparable between them." },
      { title: "Desktop app", desc: "Windows app, with an overlay in development so you can watch your debt without leaving the match." },
    ],

    ctaTitle: "Your next gaming night has a price",
    ctaSubtitle: "Download the app, or create your account in thirty seconds. Google, Discord, or just a nickname.",
    ctaDownload: "Download the app",
    ctaBeta: "Create my account",
    overlayEtiquette: "Match in progress",
    overlayLegende: "The overlay sits on top of the game, in whichever corner you pick. It shows what the evening is costing you, and what the current match will cost depending on whether you win or lose.",
    footerCgu: "Terms",
    footerConfidentialite: "Privacy",
    footerLogin: "Log in",
    footerDisclaimer: "Win or Workout is not affiliated with any game publisher.",
  },
};
