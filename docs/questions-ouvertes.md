# Ce qui attend une décision

Ce document rassemble les arbitrages de produit, les décisions
d'infrastructure et les questions auxquelles seul le propriétaire peut
répondre. CLAUDE.md dit ce qu'on en fait — « ce qui demande un arbitrage
produit ne se décide pas seul : ça part dans les questions, pas dans le
code » — et jusqu'ici « les questions » ne vivaient nulle part : elles étaient
écrites au journal, à l'endroit du chantier qui les avait rencontrées, donc
introuvables sans les chercher au mot près.

Chacune porte **ce qui est mesuré** — pas une impression — et **ce que ça
coûterait**.

Une question tranchée quitte ce fichier et devient une ligne du plan, ou une
entrée du journal si elle se règle en une nuit. Le tableau du bas garde la
trace de celles qui sont parties, et dit où elles sont allées : sans lui, une
décision prise redevient introuvable au bout de deux semaines, ce qui est
exactement le défaut que ce fichier existe pour corriger.

**Le 8 septembre, quinze des dix-neuf questions ont été tranchées d'un
coup.** Ce qui reste vit dans les sections ci-dessous, et se compte en les
lisant : aucun total n'est écrit ici, parce qu'un nombre posé une fois au-dessus
de quelque chose qui bouge est le défaut que ce dépôt trouve le plus souvent —
celui-ci annonçait « quatre, plus cinq » alors qu'il y en avait treize.

---

## Ce qui demande un accès qu'on n'a pas

### 1 · Les poids par rôle sur de vraies données (ligne 051)
La réponse dit « à analyser tout de même ». Les données vivent en PRODUCTION,
et cette session n'a aucun accès à la base : le compte de mesure local est
SEMÉ, donc synthétique, et l'analyser reviendrait à mesurer le générateur.
**Ce n'est pas un arbitrage, c'est une limite d'accès.**

L'accès Vercel qui arrive ne la lève pas : il donne les journaux de
construction et l'état des déploiements, pas une console sur Neon.

---

## Ce qui attend une réponse écrite

### 2 · La durée de conservation des données (ligne 279)
**Née de la décision du 8 septembre.** Le propriétaire a tranché « ne supprime
rien » sur les comptes inactifs, ce qui renverse la réponse 280 de
l'interrogatoire. La ligne 280 est donc close.

La 279 ne l'est pas, et elle devient plus visible : le règlement demande
d'annoncer **combien de temps** on garde les données, et « pour toujours » est
une réponse valable à condition d'être écrite. Aujourd'hui la politique de
confidentialité ne dit rien du tout.

**À décider** : la phrase à mettre dans la politique. « Tant que le compte
existe, et supprimées avec lui » est cohérent avec « ne supprime rien » et
avec le fait que la suppression de compte est déjà en cascade — c'est la
formulation la plus probable, mais elle engage l'éditeur du site, donc elle
n'est pas écrite sans accord.

### 3 · Le cardio s'accumule, le reste se paie entre deux parties (ligne 049)
**Née en construisant la ligne 047, et c'est une CONTRADICTION, pas une
question neuve.** La réponse 049 dit : « la dette hormis pour la boxe ou pour
toute activité cardio est à faire entre chaque partie, pas à cumuler ».

Le produit fait l'inverse depuis V387, et pour une raison mesurée : tant que la
dette ne s'accumulait que pour les exercices comptés au TEMPS, quelqu'un qui
fait des pompes — le cas par défaut — ne voyait jamais rien monter. La pastille
n'apparaissait pas, le compteur était inatteignable, et **aucune ligne
`Paiement` n'était jamais écrite**. Neuf cent soixante parties, deux points
payés : classement, mur des records et niveau restaient vides par
construction.

**Ce qui reste du raisonnement d'origine est déjà appliqué**, mais à l'ÉCRAN et
non au registre : ce qui se compte en répétitions se solde d'une tape, ce qui se
compte en temps garde son chrono.

**À décider** : est-ce que « ne pas cumuler » veut dire ce que V387 a mis en
place — le registre enregistre tout, l'écran distingue — ou est-ce qu'il faut
vraiment que la dette en pompes disparaisse si elle n'est pas payée tout de
suite ? La seconde lecture rouvre le trou mesuré en V387, et elle demande de
décider ce qu'on fait de la dette non payée à la partie suivante : elle
s'efface, ou elle s'ajoute quand même.

**Ce que ça coûterait** : rien si la première lecture est la bonne — la ligne se
coche avec sa raison. Une nuit et une migration si c'est la seconde, plus la
perte de ce que V387 a réparé.

### 4 · La durée de la partie, mesurée (réf. 052)
Ta réponse est **« Explique l'effet »**. Ce qui suit est mesuré avec le moteur
de barème lui-même — `calcScore` et `calcScoreTemps`, avec le barème livré —
et non raisonné à côté.

**Ce que la durée change aujourd'hui : rien, sauf sous cinq minutes.** Une
défaite mid 3/6/8 au niveau 1 coûte **onze points à cinq minutes comme à
soixante**. Le seul seuil est celui du remake : sous cinq minutes, la partie
n'a pas eu lieu et ne coûte rien.

**Et la durée n'arrive que par UN des trois chemins d'entrée.** C'est le fait
qui décide de tout le reste :

| chemin | la durée arrive-t-elle ? |
|---|---|
| l'application Windows, détection locale | **oui** (`PartieDetectee` l'envoie) |
| la saisie à la main | **non** — le formulaire ne la demande pas pour une partie |
| l'import depuis Riot | **non** — la route ne lit même pas `gameDuration`, que l'API donne |

Une règle de durée s'appliquerait donc aujourd'hui aux seules parties détectées
par l'application de bureau. La saisie à la main est, tant que la clé Riot de
production n'est pas arrivée, le **seul** moyen d'employer le produit : la
règle y serait inapplicable, ou il faudrait ajouter un champ de plus sur le
seul écran qui marche.

**La trouvaille, et je ne l'attendais pas : le barème facture DÉJÀ le temps, à
peu près exactement.** Une heure de League — deux défaites de trente minutes,
mid 3/6/8 — contre une heure d'un jeu compté au temps :

| niveau | une heure de League | une heure comptée au temps |
|---|---|---|
| 1 | 22 pts | 20 pts |
| 2 | 36 pts | 33 pts |
| 3 | 52 pts | 47 pts |
| 4 | 70 pts | 67 pts |
| 5 | 96 pts | 93 pts |

Trois à onze pour cent d'écart, aux cinq niveaux. Autrement dit : « League ne
fait pas payer le temps » est vrai de la partie et **faux de la soirée**. Une
partie moyenne dure une demi-heure et coûte à peu près une demi-heure de
tarif.

#### Les trois options, chiffrées

**A · Un tarif horaire AJOUTÉ au coût de la partie** — vingt points par heure,
multiplicateur de niveau compris, exactement comme un jeu compté au temps.

| | niveau 1 (base 11) | niveau 3 (base 26) | niveau 5 (base 48) |
|---|---|---|---|
| 15 min | 16 pts (+45 %) | 38 pts (+46 %) | 71 pts (+48 %) |
| 25 min | 19 pts (+73 %) | 45 pts (+73 %) | 87 pts (+81 %) |
| 35 min | 23 pts (+109 %) | 53 pts (+104 %) | 102 pts (+113 %) |
| 45 min | 26 pts (+136 %) | 61 pts (+135 %) | 118 pts (+146 %) |

Ça **double la dette d'une soirée** — la partie moyenne fait trente minutes,
donc +73 %. Et ça compte le temps DEUX fois, puisque le tableau ci-dessus
montre que le KDA le facture déjà : une partie longue a mécaniquement plus de
morts qu'une partie courte. *(Cette dernière phrase est un raisonnement, pas
une mesure : il faudrait les vraies parties pour l'établir, et c'est la
ligne 051.)*

**B · Un prorata sur trente minutes** — le coût actuel multiplié par la durée
rapportée à une partie moyenne.

| | niveau 1 (base 11) | niveau 3 (base 26) |
|---|---|---|
| 15 min | 6 pts | 13 pts |
| 25 min | 9 pts | 22 pts |
| 35 min | 13 pts | 30 pts |
| 45 min | 17 pts | 39 pts |

La dette d'une soirée ne bouge pas — c'est une redistribution, pas une
majoration. C'est la seule option qui réponde à « perdre en quinze minutes
n'est pas perdre en quarante-cinq » sans changer l'échelle du produit.

**C · Ne rien faire.** Le seul cas où la durée change la NATURE de la partie —
le remake — est déjà traité.

#### Ce qui vaut pour A comme pour B, et qui n'est pas un détail
Dans les deux cas, **une défaite courte coûte moins cher**. Or on peut
abandonner une partie de League à quinze minutes. Le produit se mettrait donc
à récompenser le vote d'abandon, c'est-à-dire à peser sur la façon de jouer et
non seulement sur ce qu'on doit après. C'est un choix qui t'appartient ; il ne
se prend pas en passant.

### 14 · Ce qu'on peut annoncer AVANT la partie (réf. 057)
Ta réponse est **« pas compris l'intérêt »**, et la mesure te donne raison sur
la question telle qu'elle était posée — puis elle désigne autre chose, qui
n'est pas la même et qui, elle, tient debout.

**Ce qui existe déjà.** La pastille en jeu affiche « si gagné », « si perdu »
et ce qui est déjà dû. Ces deux projections sont calculées **à partir du KDA
en cours**, relevé toutes les deux secondes : elles n'existent donc que PENDANT
la partie. À l'écran de chargement, la pastille publie deux chaînes vides et ne
montre que la dette en attente. Vérifié dans `DetteDirecte.tsx`.

**Ce que la ligne demande, c'est le moment d'AVANT — et c'est le moment où le
chiffre n'existe pas.** Ce qui décide du coût est le KDA, et il n'est pas
encore écrit. L'éventail, mesuré au niveau 3 sur quatre défaites toutes
plausibles :

| la partie | Mid | Support |
|---|---|---|
| propre, 0/2/10 | 12 pts | 12 pts |
| moyenne, 3/6/8 | 26 pts | 12 pts |
| ratée, 2/11/4 | 74 pts | 51 pts |
| soirée noire, 0/14/2 | 105 pts | 76 pts |

**Un facteur neuf.** « Si tu perds celle-ci, tu devras 42 » serait donc une
devinette habillée en chiffre — et tout le crédit du produit tient à ce que le
chiffre soit vrai. C'est déjà écrit dans le simulateur, et la phrase vaut ici
mot pour mot : *un simulateur qui ment est pire qu'aucun simulateur.*

#### Ce qui EST connu avant la partie, et que personne ne voit
Le KDA manque ; la **chaîne de multiplicateurs**, elle, est entièrement connue
dès la sélection de champion — le niveau du compte, la file, et le champion.
Mesuré sur une seule et même défaite, mid 3/6/8, niveau 3 :

| | coût |
|---|---|
| normale, champion jamais joué | 26 pts |
| normale, 100 parties sur ce champion | 39 pts |
| **classée, 100 parties sur ce champion** | **49 pts** |
| *(pour comparaison : la victoire, mêmes chiffres)* | *13 pts* |

**La même partie, +88 %**, et rien ne le dit nulle part. Quelqu'un qui prend
son main en classée ne sait pas qu'il vient de doubler le prix de la soirée.

C'est la seule chose qu'on puisse annoncer avant la partie sans mentir : pas un
montant, un **taux**. « Cette partie te coûtera 1,9 fois le tarif : classée, et
c'est ton champion ». Exact, vérifiable, et disponible au moment où l'on peut
encore changer d'avis.

**Ce que ça coûterait** : une demi-nuit, sur la pastille seule. Le calcul
existe déjà — `/api/games/preview` rend `surcharge` et le niveau — et le
lanceur publie déjà la phase, la file et le champion (`lcu.js`). C'est un
affichage, pas un barème.

**Ce que ça ne fait PAS** : ça ne s'affiche que dans l'application Windows. Sur
le site il n'y a pas de « avant la partie » — on y arrive après.

### 15 · Si Riot coupe son API du jour au lendemain (réf. 292)
Ta réponse est **« Je ne sais pas »**. C'est une question de FAIT, donc elle se
recense : voici ce qui dépend de l'API web de Riot, et ce qui n'en dépend pas.

**Toute la dépendance tient en trois routes et deux écrans** — recensé sur tout
`src`, par ce qui lit `RIOT_API_KEY` ou passe par `riotFetch` :

| ce qui meurt | ce que ça enlève |
|---|---|
| `/api/riot/resolve-puuid` | on ne peut plus RATTACHER un compte Riot |
| `/api/riot/match-history` | la liste des vingt dernières parties disparaît |
| `/api/riot/last-game` | le mode session cesse de sonder |

**Et voici ce qui ne bouge pas d'un pouce.** La détection automatique de
l'application Windows **ne passe pas par l'API web de Riot** : `liveclient.js`
lit `https://127.0.0.1:2999`, `lcu.js` lit le lanceur sur `127.0.0.1`. Ce sont
deux services LOCAUX, sur la machine du joueur, sans clé et sans réseau. Riot
peut fermer son API publique demain : **une partie de League jouée avec
l'application ouverte continue de s'enregistrer toute seule**, avec son score,
son rôle, sa file et son issue.

Survivent aussi, sans rien avoir à changer : la saisie à la main, les seize
jeux du catalogue — un seul porte `riot: true` —, la dette, les paiements, les
exercices, les amis, les groupes, le classement, les paliers, les défis, le
bilan de saison, la pastille en jeu, les notifications, le courriel
hebdomadaire.

**La réponse tient donc en une phrase : le produit survit, la COMMODITÉ
meurt.** Ce qui disparaît est le rattrapage — reprendre les parties jouées
sans l'application ouverte — et le rattachement du compte, qui ne sert
aujourd'hui qu'à ça.

**Et ce n'est pas une hypothèse : c'est l'état actuel.** La clé de production
n'est pas arrivée, donc les trois routes rendent déjà **503** avec leur message
(« le suivi Riot est indisponible, le reste marche, les parties s'enregistrent
à la main »). Le produit tourne dans le scénario 292 depuis le premier jour.

**Un seul point à surveiller, et il est ailleurs.** Les icônes de champion
viennent de Data Dragon (`ddragon.leagueoflegends.com`), qui est un dépôt de
fichiers STATIQUE, sans clé — donc un service différent, avec une autre
probabilité de fermeture. Si celui-là tombait, `ChampionIcon` retombe déjà sur
la première lettre du champion dans un carré, et c'est éprouvé.

**Ce qui reste à décider** : rien d'urgent. La seule chose qui se déciderait
est de savoir si l'on garde l'écran de rattachement de compte quand il ne peut
plus rien rattacher — aujourd'hui il dit pourquoi, ce qui est le bon
comportement.

### 16 · Deux mois sans toi : ce qui s'arrête tout seul (réf. 293)
Ta réponse est **« Je ne sais pas »**, et la question porte un chiffre qui n'est
pas anodin : **deux mois, c'est soixante jours**, et soixante jours est
exactement le seuil auquel GitHub désactive un workflow programmé quand le
dépôt n'a plus d'activité. *(Règle documentée par GitHub, pas mesurée ici : elle
prévient par courriel avant de couper — un courriel adressé à la personne qui,
par hypothèse, a lâché.)*

Le dépôt porte **trois travaux programmés**, et les trois tombent sous cette
règle :

| travail | rythme | ce que sa mort coûte |
|---|---|---|
| `supervision.yml` | 4 fois par heure | **plus rien ne dit que le site est tombé** |
| `sauvegarde.yml` | tous les jours à 03 h 17 | plus aucune archive n'est produite |
| `envois-programmes.yml` | toutes les heures | voir ci-dessous : c'est le moins grave |

**La supervision est la perte qui compte.** C'est la seule chose du système qui
crie, et elle a été conçue pour ne crier qu'au CHANGEMENT d'état — donc pour
qu'on la lise. Sans elle, une panne de deux semaines ne se voit que si
quelqu'un ouvre le site.

**La sauvegarde a un second compte à rebours, et il est écrit dans le
workflow** : `retention-days: 90`. La dernière archive est produite au
soixantième jour et expire quatre-vingt-dix jours plus tard. **Au cent
cinquantième jour, il n'existe plus aucune sauvegarde restaurable, nulle
part.** Les données, elles, vivent toujours dans Neon — ce qui disparaît est le
moyen de les remettre en état après un incident, pas les données.

**Les envois, eux, survivent — et c'est la bonne nouvelle du recensement.**
`vercel.json` porte deux tâches planifiées vers `/api/cron/matin`, à 8 h et 9 h
UTC, et Vercel ne les désactive pas pour cause d'inactivité. Le rappel du matin,
le bilan hebdomadaire et **la relance des absents** continuent donc de partir.
Ce que la mort du travail GitHub enlève est la COUVERTURE DES AUTRES FUSEAUX :
deux heures UTC fixes couvrent la matinée française, pas celle de Tokyo. Un
compte japonais cesse d'être notifié ; un compte français non.

Sans les crons Vercel, la conclusion aurait été bien plus sombre : **la relance
des absents est précisément le mécanisme qui rattrape une absence**, et il
serait mort de l'absence qu'il existe pour rattraper.

#### Les autres horloges, recensées et sans danger
- **la clé Riot de développement** expire toutes les vingt-quatre heures. C'est
  déjà le cas, et la question 15 dit exactement ce que ça coûte ;
- **Neon** suspend son calcul quand personne ne se connecte — c'est ce que
  `/api/sante` appelle `reveil`, et le premier appel du matin met six cents
  millisecondes au lieu de vingt. Ça ne perd aucune donnée ;
- **Vercel** ne périme pas un déploiement, et renouvelle le certificat seul ;
- **l'application de bureau installée** continue de se mettre à jour par
  `latest.yml`, et de fonctionner si plus rien ne bouge ;
- **le nom de domaine**, lui, se renouvelle et ça t'appartient. C'est la seule
  horloge de la liste qui puisse tout éteindre d'un coup.

#### Ce qui se décide, et ce que ça coûterait
**A · Ne rien faire.** Tu reçois le courriel de GitHub, tu cliques pour
réactiver. Coût nul, et ça suppose de lire ce courriel-là.

**B · Déplacer la supervision sur Vercel.** C'est le travail dont la mort coûte
le plus. Mais le plan Hobby n'autorise que **deux** tâches planifiées, et les
deux sont prises par les envois du matin. Il faudrait donc arbitrer entre la
supervision et la couverture des fuseaux, ou passer au plan payant.

**C · Un travail qui entretient les autres.** Un workflow programmé qui écrit
quelque chose dans le dépôt remet le compteur à zéro. Ça marche, et ça salit
l'historique avec des commits vides — ce qui est précisément ce que ce dépôt
refuse ailleurs, le marqueur de version étant déjà posé par commit vide en cas
de besoin.

**Rien n'est fait** : les trois options changent le comportement du système
hors de l'application, et c'est ta décision.

### 5 · La distance du consentement santé, dans une seule langue
**Née de la décision du 8 septembre.** « Tutoie partout, c'était un oubli » a
fait tomber six dispenses de vouvoiement. La septième porte une raison d'une
autre nature : `consentementSante.ts` vouvoie « exprès, c'est un avertissement,
pas une conversation ».

**La mesure dit que cette décision n'a jamais été appliquée qu'au français** :

| | français | allemand | espagnol |
|---|---|---|---|
| `consentementSante` | 23 vous | 2 Sie, **15 du** | 0 usted, **19 tu** |

Le témoin de ce projet — « un choix de marque se prend dans les six langues ;
un oubli n'en touche qu'une » — désigne donc le français comme l'exception.
Mais ici, contrairement aux six autres, il existe une décision ÉCRITE qui dit
le contraire, et elle porte sur des données de santé.

**À décider**, et les deux réponses sont défendables : appliquer la distance
aux six langues (donc reprendre l'allemand et l'espagnol), ou la retirer et
tutoyer là aussi. Ce qui n'est pas défendable est l'état actuel, où le texte
qui recueille un consentement met de la distance à un lecteur sur six.

### 6 · Le bouton principal du produit n'a pas le dégradé de marque
**Née du chantier de la palette (V538–V540).** Le dégradé de marque est nommé
`--brand-gradient` et lu à cinq endroits. Il en existe **quatre versions
différentes** dans le dépôt :

| lieu | dégradé | employé par |
|---|---|---|
| `--brand-gradient` | `#FF4D2E → #FF8A3D 62 % → #FFB454` | le compteur de dette, deux blocs du tableau de bord, deux règles de titrage |
| `.lol-btn` | `#FF4D2E → #FF7A35` | **le bouton principal, 92 emplois** |
| l'appel à l'action de l'accueil | `#FF4D2E → #FF7A35 58 % → #FF9A3D` | un bouton, sur la page la plus visitée |
| le bouton des courriels | `#FF4D2E → #FF8A3D` | le bilan hebdomadaire et le lien de récupération |

`#FF7A35` et `#FF9A3D` n'existent nulle part ailleurs et n'ont pas de nom.

**Ce qui est sûr, et ce qui ne l'est pas.** Celui des courriels est clairement
une COPIE qui a dérivé : un client de messagerie ne lit aucune propriété
personnalisée, donc le dégradé y a été réécrit à la main, en deux points au
lieu de trois, en s'arrêtant au point médian. Les deux autres peuvent être des
choix — un bouton se peint souvent plus court qu'un héros — et ça, ça ne se
décide pas ici : c'est l'identité du bouton le plus employé du produit, et la
réponse 251 dit que la marque visuelle est validée.

**À décider** : est-ce que le bouton doit porter le dégradé de marque, ou
est-ce que son dégradé à lui est voulu ? Dans le second cas il lui faut un nom,
parce qu'aujourd'hui il n'en a pas et que rien n'empêche une cinquième version
d'apparaître. Le coût est d'une demi-nuit dans les deux sens, et le garde de la
palette est déjà là pour tenir la décision une fois prise.

### 13 · Une seule frontière du produit atteint le contraste exigé (ligne 300)
**Née en mesurant la seconde moitié de la ligne 300**, qui demande d'uniformiser
les styles en ligne et les classes utilitaires. Trois écrans écrivent leur champ
à la main — inscription, connexion, récupération — et le reste du produit emploie
`.lol-input`. Je l'avais mise de côté comme une affaire de goût : passer à
`.lol-input` fait passer la bordure de `--line-strong` (alpha 0,18) à `--line`
(alpha 0,08), donc rend les champs plus pâles sur l'entonnoir d'acquisition.

**Ce n'en est pas une, et la mesure le dit.** Le critère 1.4.11 des WCAG demande
**3:1** entre ce qui identifie une commande et ce qui l'entoure. Mesuré au
navigateur, sur les pixels réellement composés :

| traitement | emplois | bordure | fond | verdict |
|---|---|---|---|---|
| `.lol-input`, `.lol-select` | 64 | **1,20:1** | 1,05:1 | échoue |
| **sélecteur de langue**, dans la barre | **19 pages** | **1,35:1** | 1,08:1 | échoue |
| champ en ligne (inscription, connexion, récupération) | 3 écrans | **1,64:1** | 1,05:1 | échoue |
| `.lol-btn-blue` (bouton fantôme) | 3 | **1,64:1** | 1:1 | échoue |
| `.lol-btn-danger` (déconnexion, arrêt de session) | 2 | **1,70:1** | 1:1 | échoue |
| `.lol-btn` (bouton plein) | **93** | — | dégradé opaque | **passe** |

**Cinq sur six échouent, et le fond ne rattrape RIEN.** Il rend 1 à 1,08:1, et
ce n'est pas une erreur de mesure : le fond d'un champ est `var(--ink)` à 60 %
et le fond de la page est `--ink`. De l'encre sur de l'encre donne de l'encre.
La bordure est donc le seul repère qui existe.

**Ce que les boutons ont ajouté au constat**, mesuré le 9 septembre sur
quatre-vingt-douze d'entre eux : **aucun n'est sans texte visible**. Un bouton
sans frontière visuelle sort donc du champ de 1.4.11 — c'est son texte qui
l'identifie, et 1.4.3 s'y applique déjà. Ce qui reste, ce sont les trois qui
DESSINENT une frontière, et le seul qui passe est celui qui la peint en plein.

**La frontière la plus VUE est le sélecteur de langue** : il vit dans la barre,
donc sur les dix-neuf pages du produit, et il rend 1,35:1.

Uniformiser sur `.lol-input` irait par conséquent dans le MAUVAIS sens — de 1,64
à 1,20 — sur les trois écrans par lesquels tout le monde entre. Et `.lol-input`
n'est pas réservé aux écrans connectés : l'outil le trouve aussi sur
`/calculateur/league-of-legends`, une page publique.

**Ce qu'il faudrait, calculé** : l'opacité de la bordure doit monter à **0,36**
pour atteindre 3:1, contre 0,08 et 0,18 aujourd'hui. C'est un changement visible
sur tous les écrans.

**Pourquoi ça ne se décide pas seul.** `--line` est lu **91 fois** et
`--line-strong` **46 fois** ; `.lol-panel` seul en compte 104. Monter le jeton
commun redessine le chrome du produit entier — c'est l'apparence de
l'application, pas un détail d'implémentation, et la réponse 251 dit que la
marque visuelle est validée.

**Trois options, chiffrées :**

- **A — ne rien changer.** Le produit reste tel qu'il est, et l'écart est écrit
  ici. Coût nul, et une non-conformité connue.
- **B — un jeton propre aux COMMANDES.** `--line-commande` à 0,36, lu par
  `.lol-input`, `.lol-select`, les trois styles en ligne, le sélecteur de langue
  et les deux boutons fantômes ; les panneaux ne bougent pas. Quatre-vingt-huit
  éléments changent d'aspect, les 104 panneaux non. Une demi-nuit, et c'est
  l'option qui corrige sans redessiner le produit.
- **C — monter `--line` pour tout le monde.** Cohérent, et ça change chaque
  écran. Une nuit, plus une campagne de comparaison de rendu.

**Ce que je n'ai PAS mesuré, écrit plutôt que tu** : les boutons. Un bouton plein
est identifié par son fond et passerait ; un bouton fantôme ne passerait
probablement pas. Le contrôle ajouté à `scripts/accessibilite.mjs` les écarte
donc explicitement, faute de les avoir regardés.


---

## Ce qui demande une machine qu'on n'a pas

### 7 · La branche POST du canal de connexion local
`desktop/src/main.js` sert `/set-session` en `GET` **et** en `POST`, et la
branche POST n'a **plus aucun appelant** — recensé sur tout le dépôt. Ses
quarante-cinq lignes réécrivent la validation de la branche GET.

Elle n'est pas retirée pour deux raisons : ça demande une version
d'application de bureau, et surtout **ça ne se vérifie pas d'ici** —
`main.js` ne se charge pas dans les tests, et le seul contrôle possible serait
de se connecter depuis une application installée. Toucher à un canal
d'authentification sans pouvoir l'éprouver n'est pas un travail de nuit.

### 8 · Le rôle deviné quand Riot ne le donne pas
`riot-role.ts` fait retomber une position inconnue sur « Mid ». Un support
compté comme jungler paie ses morts **trois points au lieu de deux et deux
dixièmes**.

C'est la forme du défaut déjà corrigé côté détection locale — mais les deux ne
se valent pas : refuser ferait perdre une partie entière importée de Riot pour
un détail de pondération, alors que ce qu'on refusait de l'autre côté était
une ISSUE inventée, qui crée une dette qu'on ne doit pas. Le repli est donc
**figé par un test plutôt que changé**.

La clé Riot de production n'étant pas arrivée, aucune partie n'emprunte ce
chemin aujourd'hui : la question ne se pose pour de vrai qu'à ce moment-là.

### 9 · Rendre du React dans les tests unitaires
Un seul composant sur soixante-douze est importé par un test. Le chiffre a
l'air terrible et ne veut presque rien dire : la suite unitaire tourne en
environnement Node, sans DOM, et les composants sont éprouvés par les parcours
navigateur.

Monter jsdom est un **changement de stratégie de test**, pas un rattrapage.

---

### 10 · D'autres défis absurdes, comme tu me l'as demandé (réf. 136)
Ta réponse était « Montre-m'en d'autres », et le plan la porte depuis comme
une dette : « je te dois la liste ». La voici. **Rien n'est construit** — tu
choisis, et ce qui est retenu devient une ligne du plan.

Trois contraintes gouvernent la liste, et elles viennent du code existant :

- **un défi doit demander un GESTE.** « Solde ta dette » quand on ne doit rien
  se lit comme une flatterie, et une flatterie quotidienne finit par ne plus
  rien vouloir dire ;
- **il ne rapporte pas de points d'effort**, seulement de l'XP. Un point donné
  est une pompe que personne n'a faite, et la dette, le classement, les paliers
  et le bilan deviendraient faux ensemble ;
- **il est le même pour tout le monde**, décidé par le seul jour. Un défi
  commun se raconte ; un défi personnel ne se raconte à personne.

Le coût annoncé est réel : `/api/progression` charge déjà les parties du mois
avec `{ result, jeu, date }`, donc un défi qui lit une colonne de plus de cette
table coûte un champ, pas une requête.

#### Ce qui se mesure aujourd'hui, sans rien ajouter
| | le défi | ce qu'il mesure | coût |
|---|---|---|---|
| A | Paie avant minuit tout ce que tu as généré aujourd'hui | points payés du jour ≥ points générés du jour | les deux sont déjà calculés |
| B | Solde plus de 300 points en une seule séance | un paiement de 300 ou plus | rien |
| C | Fais-les en trois fois plutôt qu'en une | trois paiements dans la journée | rien |
| D | Quatre jeux différents dans la journée | jeux distincts | la mesure existe déjà à deux |

#### Ce qui coûte une colonne au chargement déjà fait
| | le défi | ce qu'il mesure | coût |
|---|---|---|---|
| E | Une partie sans mourir | `deaths = 0` | un champ au `select` |
| F | Gagne juste après deux défaites | l'ordre des parties dans la journée | deux champs |
| G | Trois rôles différents | `role` | un champ |
| H | Une partie classée, et une seule | `fileClassee` | un champ |

#### La famille que ton exemple ouvre, et son prix
Ton exemple était « paie ta dette avant la fin de l'écran de défaite ». C'est
une mesure de DÉLAI entre la partie et le paiement, et elle est déjà prouvée :
l'exploit du paiement éclair fait exactement ça, à une heure. Descendre à
quelques minutes coûte le même mécanisme, plus finement.

| | le défi | le délai |
|---|---|---|
| I | Paie dans les dix minutes qui suivent la partie | 10 min |
| J | Paie avant la fin de l'écran de défaite | environ 60 s |

**Une réserve sur le J, et elle est de fond.** Presque personne ne le
remplira, et un défi que personne ne remplit cesse d'être lu au bout de trois
jours. Il vaut peut-être mieux comme exploit permanent, à côté du paiement
éclair, que comme défi du jour.

#### Ce qui ne se mesure PAS honnêtement, et pourquoi
C'est la moitié utile de cette liste. Trois idées naturelles sont fausses :

- **« joue avant telle heure »** ne dit pas quand tu as joué. `Game.date` se
  corrige à la main, et `Game.createdAt` dit quand tu as ENREGISTRÉ. Une partie
  ajoutée le lendemain matin passerait le défi sans l'avoir mérité ;
- **tout défi de RÔLE ou de KDA est vide pour cinq jeux du catalogue.**
  Minecraft, World of Warcraft, GTA V, Elden Ring et Les Sims se comptent au
  temps : ni rôle, ni mort, ni victoire. Le défi du jour étant le même pour
  tout le monde, il serait impossible pour qui joue à ceux-là ;
- **« ne perds aucune partie, ou paie double »** est un MALUS, c'est-à-dire de
  la dette ajoutée qu'aucune partie n'a produite. C'est la réponse 137, et tu
  l'as remise à plus tard : elle n'est pas proposée ici.

#### Un que je n'ose pas proposer sans te le dire
**« Pèse-toi. »** Techniquement gratuit — une ligne dans `Pesee` suffit. Mais
c'est une donnée de santé, et en faire un défi commun affiché à tout le monde
change sa nature : le rappel de pesée existe déjà, il est facultatif et il ne
dit rien du poids. Un défi le rendrait public dans son principe. À toi.

---

### 11 · Les statistiques avancées du payant, comme tu me l'as demandé (réf. 214)
Ta réponse était « Propose-moi ». Voici la liste, avec pour chacune ce qu'elle
coûte vraiment. **Rien n'est construit**, et il y a deux choses à trancher
avant de construire quoi que ce soit.

#### Deux règles avant la liste
**Le payant AJOUTE, il ne retire pas.** Le gratuit montre déjà beaucoup :
winrate, champions, graphiques par heure, jour, mois et calendrier,
progression, paliers, niveau, titre, mur des records, classement entre amis,
bilan de saison. Reprendre l'un d'eux pour le vendre est le moyen le plus
rapide de perdre les comptes qui existent. Tout ce qui suit est donc en plus.

**L'export de données ne se vend JAMAIS.** Il existe pour l'article 20 du
règlement, il est gratuit, et il doit le rester. C'est la seule ligne de cette
page qui n'est pas négociable.

#### Ce que la base contient DÉJÀ, et que personne ne voit
Aucune de ces cinq-là ne demande une colonne nouvelle. Le coût est un écran,
pas de la plomberie.

| | la statistique | ce qu'elle lit | pourquoi elle vaut d'être vue |
|---|---|---|---|
| A | **Ce que la classée te coûte en plus** | `fileClassee`, `pompesCalculees` | Le barème fait déjà payer les classées plus cher (réponse 196) et **rien ne le montre nulle part**. On remplit la colonne, on facture dessus, et on ne le dit pas. |
| B | **L'heure à laquelle tu perds** | `date`, `result` | Le gratuit a un onglet « Heure », mais il compte des POINTS, pas un winrate. C'est la mesure qui dit « ne joue pas après minuit », et c'est la réponse 054 rendue chiffrée au lieu d'être devinée. |
| C | **Ton taux de dette payée** | `pompesCalculees` contre `Paiement.points` | Les deux nombres sont déjà dans la réponse de `/api/progression`, côte à côte, et **leur rapport n'est affiché nulle part**. C'est pourtant le seul chiffre qui dise si le produit fonctionne pour toi. |
| D | **Le coût par champion, en entier** | `champion`, `pompesCalculees`, `result` | Le gratuit montre deux champions : le plus joué et le plus difficile. Le tableau complet, trié, avec winrate et coût moyen, est une autre chose. |
| E | **Ton délai de paiement** | `Game.createdAt`, `Paiement.createdAt` | Combien de temps entre la dette et l'effort. L'exploit du paiement éclair prouve que le rapprochement se fait ; il n'en montre que le cas extrême. |

#### Ce qui coûte un peu plus
| | la statistique | ce qu'il faut en plus |
|---|---|---|
| F | La plus longue série de défaites, et ce qu'elle a coûté | un tri par date dans la journée, rien de neuf en base |
| G | Le coût réel d'une heure de jeu | `dureeSec` n'est rempli que pour les jeux comptés au temps : la mesure ne vaut que pour cinq jeux sur seize, et il faut le DIRE plutôt que d'afficher un chiffre partiel |
| H | « À ce rythme, tu paieras X ce mois-ci » | une projection, donc une décision : une prévision fausse se retient mieux qu'une prévision juste |

#### Ce qui n'est pas possible aujourd'hui, et pourquoi
- **tout ce qui compare aux autres joueurs** (rang, percentile, moyenne des
  gens de ton niveau) demande la clé Riot de production, qui n'est pas
  arrivée, et un volume de comptes qu'on n'a pas ;
- **tout ce qui parle de patchs** demande de retenir la version du jeu au
  moment de la partie, colonne qui n'existe pas ;
- **tout ce qui parle d'adversaires** n'est jamais entré en base : on
  n'enregistre que ta partie.

#### Les deux choses à trancher
1. **Le moment.** Ton critère était un nombre d'utilisateurs, et l'étape 07 du
   plan le redit : on n'y est pas. Construire un mur payant devant quatre
   comptes coûterait plus que ça ne rapporte.
2. **Où passe la ligne.** A, B et C sont les trois qui feraient payer — ce sont
   celles qui apprennent quelque chose qu'on ne peut pas deviner. D et E sont
   agréables et se devinent. Mon avis, puisque tu me le demandes : **A, B, C au
   payant, D et E gratuites**, parce qu'un payant fait de trois choses qu'on ne
   trouve nulle part ailleurs se défend mieux qu'un payant fait de dix choses
   dont sept sont du confort.

---

### 12 · Les deux formulaires d'inscription, côte à côte (réf. 085)
Ta réponse était « Montre-moi les deux ». Une description ne montre rien, donc
c'est une PAGE, dans la peau du produit — mêmes couleurs, mêmes polices, mêmes
libellés que ceux du dictionnaire :

**https://claude.ai/code/artifact/b4983778-9dbb-43f1-997d-e0c6ca3fa287**

**Ce ne sont pas deux versions d'un même formulaire**, et c'est la trouvaille de
l'exercice. Celui d'aujourd'hui demande QUI TU ES — un pseudo, une adresse, un
corps replié en six champs. Celui de la 085 demande CE QUE TU VAS FAIRE — un
jeu, un exercice, un niveau. Ils ne collectent pas les mêmes choses et ne
servent pas la même idée de ce qu'est une inscription.

**Et les trois questions ne sont pas des données nouvelles** : ce sont trois
réglages qui EXISTENT déjà — « Tes jeux », « Ton effort », le test de force. La
proposition ne collecte pas plus, elle les déplace plus tôt. Ce qu'elle achète
est un premier tableau de bord déjà juste, au lieu d'un tableau de bord réglé
par défaut sur League of Legends, pompes, niveau 1.

**Ce que ça coûte** : chaque champ obligatoire coûte des inscrits, et il faut de
toute façon un défaut pour qui ne répond pas — donc l'écran d'aujourd'hui
revient par la fenêtre. Deux nuits, plus la reprise de la modale d'accueil, qui
explique déjà ces trois choses.

**La troisième question est DÉDUITE, et il faut le dire.** La ligne 085 est
tronquée dans l'interrogatoire lui-même : « Quel jeu, quel exercice, co… ».
« Combien d'affilée » est la lecture la plus probable, parce que le jeu,
l'exercice et le niveau sont exactement les trois choses dont le barème a besoin
pour chiffrer une partie. Si ce n'était pas ça, c'est la colonne de droite qu'il
faut corriger, pas la comparaison.

**Ce que la mesure dit avant que tu choisisses** : quatre comptes, aucune
activité depuis une semaine. Le goulot n'est pas la longueur du formulaire,
c'est que personne n'arrive jusqu'à lui. La question vaudra le jour où des gens
arriveront ; elle passe après l'étape 01, qui est d'aller en chercher dix.

---

## Ce qui a été tranché, et où c'est parti

Quatorze questions, répondues le 8 septembre. Le tableau existe pour qu'une
décision prise reste retrouvable : une question qui disparaît sans laisser
d'adresse se repose six semaines plus tard.

**Une destination qui dit « plan » NOMME ce qu'elle désigne** — `plan, ligne 152`
ou `plan, étape 01` — et
`src/decisionsRangees.test.ts` vérifie que cette ligne existe. La convention
n'est pas une coquetterie : la première version de ce tableau annonçait « plan,
section Technique » pour l'historique à cinquante parties, et **la ligne
n'existait pas**. Une adresse qu'on n'a pas vérifiée ne vaut pas mieux que pas
d'adresse.

| question | réponse | où |
|---|---|---|
| L'historique grandit pour toujours | garder les 50 dernières, archiver le reste, et que l'archive reste accessible | plan, ligne q1 |
| La page d'accueil rendue à la demande | « trouve autre chose » que le scintillement | journal (V530) : `/commencer` aiguille au clic, la page est prérendue |
| Les envois programmés partent un jour sur deux | poser les tâches Vercel, « si c'est utile vas-y » | plan, étape 01 · fait en V529 |
| Trois notifications par semaine | « je te laisse trancher » le rang | journal (V530) : rang 1 le seuil et la relance, rang 2 le matin et la pesée |
| « Journée la plus chère » contre le mur des records | renommer « journée la plus chère » | journal (V529) |
| Sur quoi porte le palier de VOLUME | le volume JOUÉ : tant qu'aucun système ne vérifie les exercices, on suppose les pompes faites entre deux parties | journal (V529) |
| Le vouvoiement des deux pages d'acquisition | « tutoie partout, c'était un oubli » | journal (V529) : six fichiers, pas deux |
| « qui vous a invité » | laisser, c'est du juridique | close |
| Le bouton du rail sur téléphone | laisser, « je verrai à l'usage » | close |
| Le tableau de bord Vercel | « je te donne l'accès » | en cours |
| Chiffrer poids et taille (275) | plus tard | plan, ligne 275 · différée |
| Supprimer les comptes inactifs (280) | **« finalement, ne supprime rien »** — renverse la réponse 280 | close ; ouvre la 279 ci-dessus |
| La progression physique (152 et 153) | « fais la courbe de force maintenant » — débloque les deux | plan, ligne 152 · fait en V531 |
| Un mode séance plein écran (205) | « fais-le » — renverse le « plus tard » de la réponse 205 | plan, ligne 205 · fait en V532 |
| Des ratios personnels par utilisateur (047) | « Oui, par utilisateur » | plan, ligne 047 · fait en V536 |
