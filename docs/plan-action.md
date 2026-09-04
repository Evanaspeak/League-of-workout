# Plan d'action — le reste du Second Interrogatoire

> **À lire avant de choisir sur quoi travailler.** Ce fichier est la source de
> vérité sur ce qui reste à construire. Il vient du Second Interrogatoire, où le
> propriétaire du produit a répondu à 308 questions ; chaque réponse a été
> confrontée au code pour savoir ce qui existait déjà.
>
> **Quand une ligne est faite**, cocher sa case ici et le committer dans le même
> commit que le code. Un plan qui n'est pas tenu à jour ment, et c'est pire
> qu'un plan absent : on lui obéit quand même.

Établi le 2 septembre 2026. Dernière mise à jour : 2026-09-02.

**54 construits · 103 restants · ~60 nuits de travail**

## Ce que le recensement montre, et qui n'est pas confortable

Ce qui a été construit est presque entièrement de la **plomberie et de la
rétention** : les séries, les rappels, le bilan, la sauvegarde, la supervision,
les tests, les six langues. C'est solide, et c'est ce qu'on fait quand on
travaille seul la nuit sans retour d'utilisateurs.

Ce qui n'a pas été construit est presque entièrement **ce qui donne envie** :
le social en entier, les défis en entier, les badges et les titres, le suivi du
poids et les calories, l'argent. Il avait dit oui à tout, et rien n'est là.

Et le fait qui décidait de l'ordre, au moment où le plan a été écrit :
**personne n'utilisait l'application**. Une semaine sans une inscription, sans
une partie. Construire soixante nuits de fonctionnalités pour quatre comptes
aurait été la même erreur en plus grand.

## L'ordre

### [~] 01 — Aller chercher dix utilisateurs qui parlent
*Cette semaine · aucun code*

Rien de ce qui suit ne se décide correctement sans retours. Le déclencheur des envois programmés se règle en trente minutes ; les messages Reddit et Discord sont écrits depuis un mois. Dix personnes qui te disent ce qui manque valent mieux que mes soixante nuits d'hypothèses.

Ce qu'il te reste à faire toi-même : poser les tâches planifiées Vercel, envoyer un message, ouvrir un endroit où on te répond.

**État au 2 septembre, dans la soirée.** Le message est parti sur un serveur
Discord d'une cinquantaine de membres, avec un second message plus court dans
le chat général. Il reste **une moitié, et elle appartient au propriétaire du
produit** : poser les tâches planifiées Vercel. Sans elles, le rappel du matin
et la relance des absents restent suspendus au `schedule` de GitHub Actions,
qui passe trois à six fois par jour à des heures imprévisibles.

### [~] 02 — Le social minimal — amis, classement, parrainage
*5 à 6 nuits*

C'est le seul bloc qui agit à la fois sur la rétention et sur l'acquisition : le parrainage amène des gens, le classement entre amis les fait revenir. Tu as dit oui à tout, et c'est ce qui manque le plus à un produit dont le sujet est de rendre des comptes.

Dans l'ordre : les amis, puis le classement sur le volume payé avec la dette en retard visible, puis le lien de parrainage. Les équipes et le mode fantôme viennent après.

### [ ] 03 — Badges, titres, niveau de compte
*3 nuits*

Les paliers existent déjà et ne récompensent rien. Ces trois-là se branchent sur des données qu'on a déjà, coûtent peu, et donnent une raison de continuer une fois la nouveauté passée. C'est le meilleur rapport entre l'effort et l'effet du document.

### [ ] 04 — Les défis
*6 nuits*

Défi quotidien tiré au sort d'abord — c'est le plus simple et le plus fréquent. Puis les défis mensuels à trois niveaux avec malus, puis l'objectif collectif. Le mur des records et les événements de patch en dernier.

### [ ] 05 — Le corps et les calories
*8 nuits*

Le plus gros bloc, et un vrai changement de nature : l'application cesse d'être un compteur de dette pour devenir un suivi. À faire d'un seul tenant — calculateur, trois modes, poids cible, graphique, rappel de pesée — parce qu'à moitié fait il ne sert à rien.

Je le place après les défis parce qu'il double la surface du produit sans rien changer pour ceux qui viennent pour le jeu.

### [ ] 06 — Le calcul de la dette, tes trois corrections
*4 nuits*

Ratios personnels, jetons d'annulation, cardio cumulé contre le reste payé entre deux parties. Ce sont des décisions que tu as prises et que je n'ai pas portées dans le code. Elles touchent le cœur, donc elles se font quand il y a des utilisateurs pour dire si le résultat est juste.

### [ ] 07 — L'argent
*3 nuits, après une décision qui t'appartient*

Rien ne se code avant que tu aies une entreprise pour encaisser. Ensuite : abonnement à 3 €, tarif fondateur, et les statistiques avancées dont je te dois la liste. Ton critère était un nombre d'utilisateurs — on n'y est pas.

### [ ] 08 — Le reste, au fil de l'eau
*en remplissage*

Catalogue d'exercices élargi, Overwatch, deux tons au choix, exercices adaptés et fauteuil, durée de conservation, suppression des comptes inactifs, découpage des styles. Ce sont les chantiers que je peux prendre seul entre deux gros blocs, sans t'attendre.

## Le détail, domaine par domaine

Coche `[x]` = construit, `[~]` = entamé. Les efforts sont ceux estimés à l'écriture du plan.

### Le corps, les calories, la santé
*11 à faire · 4 faits.* Tu as dit oui à un pilier entier qui n'existe pas encore. C'est le plus gros bloc non construit.

| | réf | | effort |
|---|---|---|---|
| [ ] | 015 | Le calculateur d'objectif calorique, formule Mifflin-St Jeor | 2 nuits |
| [ ] | 019 | Les trois modes : perte, maintien, prise de masse | 1 nuit |
| [ ] | 020 | Un poids cible, pas seulement une direction | ½ nuit |
| [ ] | 016 | Aucune date d'objectif promise — la règle des 7 700 kcal est fausse | — |
| [ ] | 017 | Un avertissement plutôt qu'un plancher bloquant sous 1 500 / 1 200 kcal | ½ nuit |
| [ ] | 018 | Afficher l'objectif même sous 18,5 d'IMC, avec avertissement | ½ nuit |
| [ ] | 021 | Le suivi du poids dans le temps, avec un graphique | 1 nuit |
| [ ] | 022 | Un rappel de pesée hebdomadaire, optionnel | ½ nuit |
| [ ] | 023 | L'estimation de masse grasse au mètre-ruban, en option | 1 nuit |
| [ ] | 013 | Le tout activable, visible mais discret | ½ nuit |
| [x] | 002 | Poids, taille, âge modifiables dans les réglages | — |
| [x] | 003 | Le consentement RGPD pour les données de santé | — |
| [x] | 027 | Le mode genou au sol, annoté dans l'historique | — |
| [x] | 029 | Déclarer une blessure et suspendre un exercice | — |
| [ ] | 026 | Une courte vidéo de forme par exercice | 1 nuit + tournage |

### Le social
*6 à faire · 7 faits.* Tu as dit oui à absolument tout. Les amis, les groupes, le classement de la semaine, le lien de parrainage, le mode fantôme et le profil d'un ami existent ; le reste attend.

| | réf | | effort |
|---|---|---|---|
| [x] | 113 | Le principe : oui au social | — |
| [x] | 114 | Des amis qu'on ajoute ET des groupes qu'on rejoint | 2 nuits |
| [x] | 115 | Un classement entre amis, sur le volume payé | 1 nuit |
| [x] | 116 | Le classement montre la dette en retard | ½ nuit |
| [x] | 118 | Une équipe de cinq avec une dette commune | 2 nuits |
| [ ] | 142 | La dette de groupe quand on joue à cinq ensemble | 1 nuit |
| [x] | 119 | Un lien de parrainage, avantage pour les deux | 1 nuit |
| [x] | 120 | Voir les statistiques d'un ami selon ce qu'il autorise | 1 nuit |
| [x] | 121 | Un profil public à adresse partageable, au choix | 1 nuit |
| [x] | 129 | Un mode fantôme : participer sans apparaître | ½ nuit |
| [x] | 122 | Une image de partage après une grosse séance | 1 nuit |
| [ ] | 130 | Validation par vidéo pour apparaître dans les classements | 3 nuits |
| [ ] | 128 | Pseudo Riot ou pseudo interne, au choix | ½ nuit |

### Défis, saisons, événements
*10 à faire · 0 faits.* Même chose : tout validé, rien construit.

| | réf | | effort |
|---|---|---|---|
| [ ] | 131 | Des défis mensuels, en volume ET en nombre de parties | 2 nuits |
| [ ] | 132 | Individuels et communs | — |
| [ ] | 137 | Trois niveaux, récompenses exponentielles, malus si échoué | 1 nuit |
| [ ] | 138 | Un défi quotidien tiré au sort, valable 24 h | 1 nuit |
| [ ] | 133 | Un objectif collectif à l'échelle de l'application | 1 nuit |
| [ ] | 135 | Un événement au lancement d'un patch | 1 nuit |
| [ ] | 140 | Un mur des records par exercice et par période | 1 nuit |
| [ ] | 141 | Records publics ou entre amis, au choix | ½ nuit |
| [ ] | 144 | Classement hebdomadaire et cumul, deux onglets | ½ nuit |
| [ ] | 136 | D'autres défis absurdes à te proposer | je te dois la liste |

### Progression et récompenses
*8 à faire · 1 faits.* Les paliers existent. Tout ce qui les entoure reste à faire.

| | réf | | effort |
|---|---|---|---|
| [x] | 146 | Les paliers cumulés, annoncés au franchissement | — |
| [ ] | 147 | Des badges | 1 nuit |
| [ ] | 148 | Un niveau de compte, séparé du niveau de force | 1 nuit |
| [ ] | 149 | Un titre affiché à côté du pseudo, gagné par l'usage | 1 nuit |
| [ ] | 150 | Des cosmétiques : couleurs, cadres, thèmes | 2 nuits |
| [ ] | 151 | Un thème visuel par jeu | 1 nuit |
| [ ] | 152 | Progression physique ET volume, les deux | 1 nuit |
| [ ] | 154 | Inciter à la photo avant-après sans jamais la transmettre | ½ nuit |
| [ ] | 087 | Un système de niveau, comme tu l'as ajouté à l'objectif | 1 nuit |

### Le calcul de la dette
*6 à faire · 5 faits.* Le cœur du produit. Trois de tes décisions ne sont pas passées dans le code.

| | réf | | effort |
|---|---|---|---|
| [ ] | 047 | Des ratios personnels par utilisateur, pas globaux | 1 nuit |
| [ ] | 049 | Des jetons d'annulation, cotisés, pour effacer une mauvaise partie | 2 nuits |
| [ ] | 049 | Le cardio se cumule, le reste se paie entre deux parties | 1 nuit |
| [ ] | 052 | Tenir compte de la durée de la partie | 1 nuit |
| [ ] | 051 | Analyser les poids par rôle sur de vraies données | ½ nuit |
| [x] | 055 | La maîtrise AUGMENTE la dette | — |
| [x] | 196 | Les parties classées coûtent plus cher | — |
| [x] | 199 | Un remake ne compte pas | — |
| [x] | 054 | Suggérer d'arrêter après une série de défaites, sans insister | — |
| [x] | 060 | Un simulateur dans les réglages | — |
| [ ] | 057 | Annoncer la dette AVANT la partie | 1 nuit |

### Les exercices
*5 à faire · 5 faits.* Le gros du travail est fait. Reste l'ouverture du catalogue.

| | réf | | effort |
|---|---|---|---|
| [x] | 062 | La planche, comptée en secondes | — |
| [x] | 063 | Les tractions, avec mention du matériel requis | — |
| [x] | 064 | La course, en kilomètres | — |
| [x] | 067 | Des groupes musculaires pour la rotation | — |
| [ ] | 078 | Sac et shadow boxing séparés | 1 nuit |
| [ ] | 065 | Une liste fermée mais beaucoup plus grande, en sous-catégories | 2 nuits |
| [ ] | 061 | Le plus varié possible | voir ci-dessus |
| [ ] | 068 | Le partage entre exercices au choix, pas à parts égales | 1 nuit |
| [ ] | 071 | Refaire le test de force tous les mois | ½ nuit |
| [x] | 073 | Un rappel d'échauffement avant une grosse dette | — |

### Les objets connectés
*6 à faire · 3 faits.* Une seule chose à faire tout de suite, le reste attend des chiffres.

| | réf | | effort |
|---|---|---|---|
| [ ] | 040 | La saisie manuelle des calories | 1 nuit |
| [ ] | 040 | Un système de capture pour éviter la triche | 2 nuits |
| [ ] | 041 | Elle nourrit l'objectif calorique | dépend du calculateur |
| [ ] | 042 | Brancher Strava | 2 nuits |
| [ ] | 044 | Publier automatiquement, sans bouton | ½ nuit |
| [ ] | 035 | Demander à l'inscription si la personne porte une montre | ½ nuit |
| [x] | 037 | Wahoo : API réservée aux partenaires, sans musculation | — |
| [x] | 038 | Garmin : attendre des chiffres | — |
| [x] | 039 | Terra à 399 $/mois : pas avant des revenus | — |

### Le premier jour
*4 à faire · 4 faits.* Ce qui décide si quelqu'un revient. À moitié construit.

| | réf | | effort |
|---|---|---|---|
| [x] | 089 | Un guide de démarrage plutôt qu'un écran vide | — |
| [x] | 087 | L'objectif de première semaine | — |
| [x] | 088 | Des cadres vides mais expliqués | — |
| [x] | 086 | Modale d'accueil et visite guidée, les deux gardées | — |
| [ ] | 082 | Une partie de démonstration préremplie, sans avoir à jouer | 1 nuit |
| [ ] | 090 | Demander l'objectif à l'inscription et adapter l'application | 2 nuits |
| [ ] | 080 | Mesurer le temps jusqu'à la première partie enregistrée | ½ nuit |
| [ ] | 085 | Te montrer les deux formulaires d'inscription pour choisir | je te dois la maquette |

### Revenir
*3 à faire · 8 faits.* Presque tout construit. C'est le bloc le plus avancé.

| | réf | | effort |
|---|---|---|---|
| [x] | 096 | La série de jours consécutifs, sur la dette payée | — |
| [x] | 110 | L'état « en retard » à partir de trois jours | — |
| [x] | 102 | Le rappel du matin qui résume la nuit | — |
| [x] | 104 | Le récapitulatif hebdomadaire par courriel | — |
| [x] | 105 | Le bilan de saison avec image partageable | — |
| [x] | 106 | La relance des absents, au ton provocateur | — |
| [x] | 107 | La dette dans le titre de l'onglet | — |
| [x] | 108 | La pastille sur l'icône de l'application desktop | — |
| [ ] | 099 | Un gel de série à gagner ou à acheter | 1 nuit |
| [ ] | 103 | Trois notifications par semaine au maximum | ½ nuit |
| [ ] | 100 | Des notifications moins fades | ½ nuit |

### Le multi-jeu et la détection
*5 à faire · 4 faits.* 

| | réf | | effort |
|---|---|---|---|
| [x] | 195 | Un journal de synchronisation dans les réglages | — |
| [x] | 183 | Le scoring battle royale validé | — |
| [x] | 184 | Rocket League : buts, passes, arrêts | — |
| [ ] | 179 | Ajouter Overwatch au catalogue | ½ nuit |
| [ ] | 180 | Laisser déclarer un jeu absent, et compter les demandes | 1 nuit |
| [ ] | 185 | Surveiller si un jeu paie deux fois plus qu'un autre | 1 nuit |
| [ ] | 176 | Tester TFT, jamais vérifié | ½ nuit |
| [ ] | 187 | Les quatre logos manquants | à toi |
| [x] | 182 | Les jeux au temps : payer son temps de jeu | — |

### Mobile
*4 à faire · 2 faits.* 

| | réf | | effort |
|---|---|---|---|
| [x] | 203 | Proposer l'installation sur l'écran d'accueil à la troisième visite | — |
| [x] | 209 | Le mode hors ligne, synchronisé au retour du réseau | — |
| [ ] | 207 | Vibration à chaque répétition, en option | 1 nuit |
| [ ] | 210 | Sur téléphone, ouvrir sur l'ajout de partie | ½ nuit |
| [ ] | 204 | Une application native, un jour | hors périmètre |
| [ ] | 205 | Un mode séance plein écran | 1 nuit |

### L'argent
*8 à faire · 0 faits.* Rien n'est construit, et une décision t'appartient avant tout le reste.

| | réf | | effort |
|---|---|---|---|
| [ ] | 225 | Déclarer une entreprise pour pouvoir encaisser | à toi |
| [ ] | 216 | Un abonnement à 3 € par mois | 2 nuits |
| [ ] | 218 | Un tarif fondateur à vie pour les premiers inscrits | ½ nuit |
| [ ] | 214 | Te proposer les statistiques avancées du payant | je te dois la liste |
| [ ] | 219 | La publicité n'est pas exclue | — |
| [ ] | 227 | Un sponsor : matériel ou équipe esport | à toi |
| [ ] | 220 | Trancher entre affiliation et vente en propre | décision |
| [ ] | 228 | Attendre un nombre d'utilisateurs avant de monétiser | — |

### La marque et le ton
*4 à faire · 1 faits.* 

| | réf | | effort |
|---|---|---|---|
| [ ] | 248 | Deux tons au choix à l'inscription, sévère ou bienveillant | 2 nuits |
| [ ] | 254 | Raccourcir les textes de la page d'accueil | 1 nuit |
| [ ] | 256 | Faire relire l'anglais par un anglophone | à toi |
| [x] | 251 | La marque visuelle, validée | — |
| [ ] | 252 | Une mascotte, plus tard | — |

### Accessibilité
*2 à faire · 6 faits.* Les vérifications sont faites. Les adaptations restent.

| | réf | | effort |
|---|---|---|---|
| [x] | 262 | Les contrastes vérifiés et corrigés | — |
| [x] | 263 | L'utilisation entière au clavier, vérifiée | — |
| [x] | 264 | Le lecteur d'écran, vérifié | — |
| [x] | 265 | L'animation réduite, respectée partout | — |
| [x] | 266 | Victoire et défaite distinguables par un daltonien | — |
| [x] | 268 | Le genre « non précisé », avec la moyenne des deux | — |
| [ ] | 260 | Un exercice adapté par défaut pour les déconditionnés | 1 nuit |
| [ ] | 261 | Rendre l'application utilisable en fauteuil | 2 nuits |

### Données, confiance, incidents
*7 à faire · 4 faits.* 

| | réf | | effort |
|---|---|---|---|
| [x] | 281 | Une sauvegarde de la base, vérifiée par restauration | — |
| [x] | 283 | Une supervision qui alerte quand le site tombe | — |
| [x] | 286 | Un bouton « signaler un problème » dans l'application | — |
| [x] | 277 | CGU et confidentialité relues et complétées | — |
| [ ] | 279 | Définir une durée de conservation des données | décision + ½ nuit |
| [ ] | 280 | Supprimer les comptes inactifs depuis deux ans, après avertissement | 1 nuit |
| [ ] | 275 | Chiffrer poids et taille au niveau des colonnes | 1 nuit |
| [ ] | 287 | Voir les erreurs qui se produisent chez les utilisateurs | 1 nuit |
| [ ] | 290 | Un message de prévention en cas d'excès manifeste | ½ nuit |
| [ ] | 291 | Une alerte admin quand un compte dépasse un volume anormal | ½ nuit |
| [ ] | 292 | Que devient l'application si Riot coupe son API | à répondre |

### L'overlay et le desktop
*4 à faire · 2 faits.* 

| | réf | | effort |
|---|---|---|---|
| [x] | 166 | Un raccourci clavier pour masquer l'overlay | — |
| [x] | 168 | Une source navigateur pour OBS, avec la dette en direct | — |
| [ ] | 165 | L'overlay réagit en direct : rouge au franchissement du seuil | ½ nuit |
| [ ] | 161 | Un certificat de signature à 200–400 € par an | à toi |
| [ ] | 174 | Les statistiques de partie en temps réel, ton critère de réussite | 2 nuits |
| [ ] | 171 | Une version macOS, plus tard | — |

### Technique
*3 à faire · 5 faits.* 

| | réf | | effort |
|---|---|---|---|
| [x] | 295 | Continuer la couverture de tests | — |
| [x] | 296 | Des tests de bout en bout avec un vrai navigateur | — |
| [x] | 297 | Une CI qui refuse un push cassé | — |
| [x] | 298 | Découper le fichier de la page d'accueil | — |
| [x] | 301 | Mesurer et corriger la performance | — |
| [ ] | 299 | Découper le fichier des styles | 1 nuit |
| [ ] | 302 | Affiner la régénération des pages | ½ nuit |
| [ ] | 300 | Uniformiser styles en ligne et classes utilitaires | 2 nuits |

## Ce qui est dû au propriétaire du produit

Trois choses promises et jamais rendues :

- la liste des statistiques avancées de la version payante (réf. 007) ;
- d'autres idées de défis absurdes (réf. 136) ;
- les deux maquettes de formulaire d'inscription.

## Ce qui n'appartient pas à ce plan

Les corrections, les audits, les campagnes de mesure et les gardes de test ne
figurent pas ici : ils vivent dans le journal de `CLAUDE.md`. Ce fichier ne
porte que ce que le produit doit devenir.
