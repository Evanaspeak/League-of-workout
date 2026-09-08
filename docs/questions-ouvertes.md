# Ce qui attend une décision

Dix-sept choses ont été rencontrées, mesurées, et **volontairement pas
tranchées** : ce sont des arbitrages de produit, des décisions
d'infrastructure, ou des questions auxquelles seul le propriétaire peut
répondre. CLAUDE.md dit ce qu'on en fait — « ce qui demande un arbitrage
produit ne se décide pas seul : ça part dans les questions, pas dans le
code » — et jusqu'ici « les questions » ne vivaient nulle part : elles étaient
écrites au journal, à l'endroit du chantier qui les avait rencontrées, donc
introuvables sans les chercher au mot près.

Ce document les rassemble. Chacune porte **ce qui est mesuré** — pas une
impression — et **ce que ça coûterait**. Aucune n'est urgente ; plusieurs sont
gratuites à décider et chères à laisser traîner.

Une question tranchée quitte ce fichier et devient une ligne du plan, ou une
entrée du journal si elle se règle en une nuit.

---

## Ce qui coûte de l'argent ou du monde

### 1 · L'historique grandit pour toujours
`/api/games` rend **644 233 octets bruts à 1 116 parties**, et la réponse
grandit linéairement : une partie jouée ne se supprime pas. À dix mille
parties elle fera six mégaoctets. Ce n'est pas de la bande passante — brotli
la ramène à 22 ko — c'est du processeur et de la mémoire, des deux côtés.

La réponse structurelle est la **pagination**, et elle n'est pas gratuite :
l'historique filtre et trie AU NAVIGATEUR, donc paginer change ce que l'écran
sait faire.

**À décider** : à partir de combien de parties, et qu'est-ce qu'on perd du
filtrage ? Un an de jeu à ta cadence te met dans la zone.

### 2 · La page d'accueil est rendue à la demande, pour trois boutons
C'est la page la plus visitée du produit, et la seule page publique qui ne
soit pas prérendue. La raison tient en un appel : elle lit la session pour
adapter trois boutons entre « Candidater à la bêta » et « Tableau de bord ».

**Mesuré en production, huit relevés de chaque** : à chaud l'écart est de
soixante millisecondes. Ce qui compte est la QUEUE — la page dynamique a rendu
**1,42 s puis 2,11 s** sur deux séries, le démarrage à froid de sa fonction,
quand la page prérendue n'a jamais dépassé 0,28 s. Et un démarrage à froid
tombe exactement sur qui arrive de loin, c'est-à-dire sur le premier visiteur.

**Le prix de la corriger** : quelqu'un de connecté verrait « Candidater à la
bêta » pendant un instant sur sa propre page d'accueil. C'est déjà ce que fait
la barre du site partout ailleurs — mais un scintillement sur la page la plus
vue est un arbitrage de marque, pas une décision technique.

### 3 · Les envois programmés partent un jour sur deux
Mesuré sur **cent exécutions, douze jours** : 8,3 passages par jour, et **six
jours sur douze sans aucun passage dans la fenêtre** de 9 h à midi. Le rappel
du matin part donc environ un jour sur deux, et le bilan hebdomadaire — qui ne
part que le lundi — **perd une semaine sur deux**.

Le déclencheur de GitHub Actions est au mieux disant : il décale et il saute.
La fenêtre de trois heures rend le système tolérant ; elle ne le rend pas
ponctuel.

**À décider** : poser un déclencheur fiable (les tâches planifiées de Vercel)
est une décision d'infrastructure — un coût, un compte, un réglage. Élargir la
fenêtre au-delà de midi ferait un « rappel de la journée », ce qui n'est pas
la même promesse.

### 4 · Trois notifications par semaine, et le rappel du matin les mange
La réponse 103 fixe le plafond à trois. Le rappel du matin peut partir sept
fois par semaine ; la notification de SEUIL part le soir, pendant qu'on joue.
Premier arrivé, premier servi : le rappel du matin épuise donc le budget du
lundi au mercredi, et le seuil — dont le module écrit qu'il est la RAISON
d'être du canal — ne passe plus du jeudi au dimanche.

Le journal dit lui-même que le rappel du matin est le RATTRAPAGE du seuil. Un
budget dépensé par le rattrapage avant que le principal n'ait tiré inverse la
relation.

**À décider** : lesquelles des trois passent en priorité. C'est un rang, donc
un arbitrage.

---

## Ce qui touche ce que les gens lisent

### 5 · Deux chiffres qui portent presque le même nom
Le bilan de saison affiche « journée la plus chère », qui somme l'effort
**GÉNÉRÉ** par les parties du jour. Le mur des records affiche le plus gros
jour d'effort **PAYÉ**. Les deux sont vrais, les deux sont utiles, et rien ne
dit lequel est lequel — sur un produit dont tout le reste du registre est en
effort payé.

**À décider** : renommer l'un des deux, ou changer ce que « journée la plus
chère » mesure.

### 6 · Sur quoi porte le palier de VOLUME
Deux décisions écrites se contredisent dans le code. `badges.ts` s'ouvre sur
« quelqu'un qui **paie** sa cinq-centième pompe ne voit rien se passer », ce
qui reprend la réponse 145 ; `progression.ts` écrit, quelques lignes plus bas,
« les paliers récompensent le volume **joué** ». Le code suit la seconde.

Le panneau annonce donc « Ce que tu as déjà fait · 100 points d'effort » à
quelqu'un qui n'a fait aucune pompe. Le libellé a été corrigé pour rendre la
contradiction lisible ; la source, non.

**À décider** : changer la source ferait redescendre les paliers de tous ceux
qui les ont obtenus en jouant. Ce n'est pas une correction, c'est un
arbitrage — et il va contre une décision écrite dans le code.

### 7 · Le vouvoiement des deux pages d'acquisition
`/telechargement` et `/calculateur` vouvoient en **français** et tutoient dans
les cinq autres langues : « Instala la aplicación en tu PC »,
« Installiere die Anwendung auf deinem Windows-PC ». Le reste du produit
tutoie partout.

Le témoin qui distingue un choix d'un oubli est déjà écrit ici : « un choix de
marque se prend dans les six langues ; un oubli n'en touche qu'une ». Ici
c'est le français qui est seul.

**À décider** : c'est la voix de la seule surface d'acquisition du produit.

### 8 · « qui vous a invité », dans la politique de confidentialité
Le participe s'accorde avec « vous », donc il donne un genre au lecteur. Le
produit n'en donne à personne — c'est une décision écrite, appliquée partout
ailleurs. Le neutre demande de réécrire la ligne (« qui vous a fait venir »),
ce qui change la formulation d'un texte juridique.

### 9 · Le bouton du rail, sur téléphone
Sous 1180 px le rail se replie. Deux constats, capture à l'appui :

- l'ajout d'une partie est à **deux touches** au lieu d'une, alors que sans la
  clé Riot de production la saisie à la main est le SEUL moyen d'employer le
  produit ;
- le bouton recouvre, selon l'endroit où l'on s'arrête de défiler, une
  étiquette de carte ou une croix de suppression dans l'historique.

L'écran vide de l'historique dit maintenant où se trouve l'ajout ; le bouton,
lui, n'a pas bougé. **Le déplacer est une décision de mise en page.**

---

## Ce qui demande un accès qu'on n'a pas

### 10 · Le tableau de bord Vercel
Relancer un déploiement, dépingler une adresse de production ou lire un
journal de construction demandent l'accès au tableau de bord. La nuit du
4 septembre, huit versions ont traversé `main` sans arriver en ligne pendant
au moins deux heures quarante, et **la cause n'a jamais été nommée** : les
deux hypothèses — constructions en échec, adresse épinglée — ne se tranchent
pas d'ici.

Depuis, le retard mesuré est passé sous les dix minutes. Mais le jour où il
revient, il faudra ce tableau.

### 11 · Les poids par rôle sur de vraies données (ligne 051)
La réponse dit « à analyser tout de même ». Les données vivent en PRODUCTION,
et cette session n'a aucun accès à la base : le compte de mesure local est
SEMÉ, donc synthétique, et l'analyser reviendrait à mesurer le générateur.
**Ce n'est pas un arbitrage, c'est une limite d'accès.**

---

## Ce qui attend une réponse écrite

### 12 · Chiffrer poids et taille au niveau des colonnes (ligne 275)
La réponse est **« Explique-moi »**. Ce qu'elle demande est une explication,
pas un chantier.

**La réponse courte** : chiffrer une colonne empêche de la LIRE sans la clé —
donc plus de tri, plus de comparaison, plus de moyenne en base. Sur le poids
et la taille, tout ce que l'application en fait est un calcul par personne :
le coût est faible. Ce qu'on achète : une copie de la base qui fuite ne dit
plus combien pèse qui. Ce qu'on paie : la clé doit vivre quelque part, et si
elle est perdue les données le sont aussi.

### 13 · Supprimer les comptes inactifs depuis deux ans (ligne 280)
La réponse est « Oui », et la durée est dans la ligne. Trois choses ne le sont
pas, et chacune est un arbitrage : ce qui compte comme INACTIF (aucune
connexion, ou aucune partie), le délai entre l'avertissement et la
suppression, et ce que deviennent les lignes `Paiement` sur lesquelles la
dette d'équipe des autres s'appuie.

C'est **l'action la plus irréversible du produit**, et elle tournerait toute
seule.

### 14 · La progression physique (lignes 152 et 153)
La 152 demande de montrer une progression physique. Le produit ne garde qu'un
`pompesMax` COURANT : il n'y a aucune histoire à montrer. La construire est
exactement ce que la réponse 153 — « une courbe de force dans le temps » —
remet à plus tard. **La faire quand même reviendrait à décider 153 par la
bande.**

### 15 · Un mode séance plein écran (ligne 205)
Le plan la chiffre « 1 nuit » et la réponse dit **« Plus tard »**. L'un des
deux a tort.

---

## Ce qui demande une machine qu'on n'a pas

### 16 · La branche POST du canal de connexion local
`desktop/src/main.js` sert `/set-session` en `GET` **et** en `POST`, et la
branche POST n'a **plus aucun appelant** — recensé sur tout le dépôt. Ses
quarante-cinq lignes réécrivent la validation de la branche GET.

Elle n'est pas retirée pour deux raisons : ça demande une version
d'application de bureau, et surtout **ça ne se vérifie pas d'ici** —
`main.js` ne se charge pas dans les tests, et le seul contrôle possible serait
de se connecter depuis une application installée. Toucher à un canal
d'authentification sans pouvoir l'éprouver n'est pas un travail de nuit.

### 17 · Le rôle deviné quand Riot ne le donne pas
`riot-role.ts` fait retomber une position inconnue sur « Mid ». Un support
compté comme jungler paie ses morts **trois points au lieu de deux et deux
dixièmes**.

C'est la forme du défaut déjà corrigé côté détection locale — mais les deux ne
se valent pas : refuser ferait perdre une partie entière importée de Riot pour
un détail de pondération, alors que ce qu'on refusait de l'autre côté était
une ISSUE inventée, qui crée une dette qu'on ne doit pas. Le repli est donc
**figé par un test plutôt que changé**.

### 18 · Rendre du React dans les tests unitaires
Un seul composant sur soixante-douze est importé par un test. Le chiffre a
l'air terrible et ne veut presque rien dire : la suite unitaire tourne en
environnement Node, sans DOM, et les composants sont éprouvés par les 249
parcours navigateur.

Monter jsdom est un **changement de stratégie de test**, pas un rattrapage.
