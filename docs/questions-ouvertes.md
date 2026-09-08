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

**Le 8 septembre, quatorze des dix-huit questions ont été tranchées d'un
coup.** Il en reste quatre, plus deux nées des décisions elles-mêmes.

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

### 3 · La distance du consentement santé, dans une seule langue
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

---

## Ce qui demande une machine qu'on n'a pas

### 4 · La branche POST du canal de connexion local
`desktop/src/main.js` sert `/set-session` en `GET` **et** en `POST`, et la
branche POST n'a **plus aucun appelant** — recensé sur tout le dépôt. Ses
quarante-cinq lignes réécrivent la validation de la branche GET.

Elle n'est pas retirée pour deux raisons : ça demande une version
d'application de bureau, et surtout **ça ne se vérifie pas d'ici** —
`main.js` ne se charge pas dans les tests, et le seul contrôle possible serait
de se connecter depuis une application installée. Toucher à un canal
d'authentification sans pouvoir l'éprouver n'est pas un travail de nuit.

### 5 · Le rôle deviné quand Riot ne le donne pas
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

### 6 · Rendre du React dans les tests unitaires
Un seul composant sur soixante-douze est importé par un test. Le chiffre a
l'air terrible et ne veut presque rien dire : la suite unitaire tourne en
environnement Node, sans DOM, et les composants sont éprouvés par les parcours
navigateur.

Monter jsdom est un **changement de stratégie de test**, pas un rattrapage.

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
