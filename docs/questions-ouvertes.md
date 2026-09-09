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
coup.** Il en reste quatre, plus cinq nées des décisions et des chantiers
eux-mêmes.

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

### 4 · Deux questions du plan qui attendent une réponse de toi
**Constatées en cochant la ligne 047**, en lisant les cinq lignes qui restent
dans « Le calcul de la dette ». Deux d'entre elles ne sont pas des décisions
prises : ce sont des questions qui te sont retournées, et le plan les portait
avec un chiffrage d'effort comme si elles étaient prêtes à construire.

- **052, « tenir compte de la durée de la partie »** → ta réponse est
  « Explique l'effet ». Perdre en quinze minutes ne coûte pas comme perdre en
  quarante-cinq ; aujourd'hui le barème ne regarde que le KDA et le résultat.
  Ce qu'un facteur de durée changerait : une défaite courte coûterait moins,
  une longue davantage — donc rester dans une partie perdue d'avance coûterait
  plus cher que de la finir vite, ce qui n'est pas forcément ce qu'on veut.
- **057, « annoncer la dette AVANT la partie »** → ta réponse est « pas compris
  l'intérêt ». Et c'est en partie déjà là : **la pastille en jeu affiche « si
  gagné » et « si perdu » pendant la partie**. Ce que la ligne ajouterait est de
  le dire avant de lancer, sur le site.

**Ce que ça coûterait** : rien tant qu'elles ne sont pas tranchées. Elles sont
écrites ici pour ne pas être réexaminées à chaque passe — c'est ce qui est
arrivé quatre fois aux lignes 051, 275, 280 et 287.

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
