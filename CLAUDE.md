# League of Workouts — CLAUDE.md

## Projet
App Next.js 15 (App Router) qui transforme les parties League of Legends en pompes. Chaque défaite/victoire génère un nombre de pompes calculé selon un système de scoring (niveau gainage, KDA, rôle, maîtrise du champion).

Stack : Next.js 15, React 19, TypeScript, Prisma 7 + PostgreSQL (Neon), Auth.js v5, Recharts, Tailwind v4, Vercel (prod), Electron (desktop app).

## Branche de travail
Toujours développer sur `claude/excel-app-conversion-5hk2fg`, puis merger sur `main` pour la prod Vercel.

```bash
git checkout claude/excel-app-conversion-5hk2fg
# ... changements ...
git add . && git commit -m "feat: ..."
git push -u origin claude/excel-app-conversion-5hk2fg
git checkout main && git merge claude/excel-app-conversion-5hk2fg
git push origin main
```

## Quoi construire ensuite (IMPORTANT)

**`docs/plan-action.md` dit sur quoi travailler.** Il faut le LIRE avant de
choisir un chantier produit, et ne pas improviser une liste à sa place : le
plan a été établi avec le propriétaire, à partir de ses 308 réponses au Second
Interrogatoire, et proposer autre chose sans le dire revient à défaire une
décision qu'il a prise.

Il porte huit étapes ordonnées et cent trois lignes cochables. La raison de
l'ordre est écrite dans le document ; s'en écarter se discute, mais ça se
discute — ça ne se fait pas en silence.

**Quand une ligne est faite**, cocher sa case dans le même commit que le code.
Un plan qu'on ne tient pas à jour ment, et on lui obéit quand même.

`docs/interrogatoire-2.txt` porte les 308 réponses dont le plan dérive. Quand
une ligne du plan est ambiguë, la réponse fait foi.

Ce qui relève de la correction, de l'audit, de la mesure ou d'un garde de test
ne figure PAS dans le plan : ça vit dans le journal, plus bas.

## Ce qu'on lance avant de publier (IMPORTANT)

**Pas les 203 parcours.** La CI les joue déjà à chaque poussée sur `main`
(`.github/workflows/tests.yml`, travail « parcours », six tronçons), en
parallèle du déploiement Vercel. Les rejouer en local avant chaque fusion,
c'est payer neuf minutes deux fois — ce qui a été fait toute la journée du
3 septembre.

**Et `npx jest` n'est pas optionnel, même quand on n'a touché à aucun `src/`.**
Une CI restructurée a fait tomber quatre contrôles de `controleSchema.test.ts`
— ils cherchaient une étape dans `tests.yml`, qui avait déménagé — et j'avais
lancé `tsc` sans `jest`. Quinze secondes auraient remplacé une exécution de CI
rouge. Les gardes de ce projet lisent les workflows, le schéma Prisma, les
dossiers : ils tombent sur des changements qui ne touchent pas une ligne de
TypeScript.

Avant de publier :

1. `npx tsc --noEmit` et `npx jest` — dix secondes, et c'est ce qui attrape le
   plus ;
2. **les parcours qui couvrent le changement**, choisis à la main. Un
   changement de l'historique appelle `historique.spec.ts`, un changement de
   détection appelle `detection-partie.spec.ts`. Trente secondes à quatre
   minutes.

La suite ENTIÈRE en local reste, pour ce qui touche une fondation — middleware,
authentification, schéma Prisma, plomberie des langues, mise en page racine —
là où une régression peut sortir n'importe où. C'est rare, et c'est justement
ce qui la rend supportable.

Si la CI casse après une fusion, on corrige : le retard est de quelques
minutes, pas de neuf, et il ne se paie que quand quelque chose a
effectivement cassé.

## La suite navigateur, et ce que le parallélisme lui coûte

Deux workers, `bareme-gele.spec.ts` seul à la fin, une adresse IP par worker.
Mesuré sur la même machine, même construction :

| workers | durée | résultat |
|---|---|---|
| 1 | 14 min 30 à 15 min | 203 passés |
| 4 | 6 min 24 | **2 échecs**, 7 non joués |
| 2 | 9 min 55 | 203 passés |

**Quatre est trop, et la raison est le PROCESSEUR, pas la base.** La machine a
quatre cœurs ; il faut y loger quatre Chromium, quatre processus de test ET le
serveur Next, qui hache les mots de passe en bcrypt coût 12 — du calcul pur,
un quart de seconde par connexion. Les deux parcours morts expiraient tous
deux sur la CONNEXION, jamais sur ce qu'ils éprouvaient. Un banc d'essai qui
sature la machine ne mesure plus le produit, il mesure sa propre file
d'attente.

Les deux obstacles réels au parallélisme, tous deux levés :

- `bareme-gele.spec.ts` écrit les ratios GLOBAUX dans `SystemConfig`. Il vit
  dans un projet Playwright qui ne démarre qu'une fois le reste terminé —
  lancé en parallèle, il changerait le barème sous les pieds des autres, et
  l'échec tomberait n'importe où sauf chez lui ;
- le limiteur d'inscription est indexé sur l'adresse IP, commune à tous les
  workers. Chacun envoie la sienne par `x-forwarded-for`, que `getClientIp`
  lit quand l'en-tête de plateforme est absent.

`fullyParallel` reste à `false` : plusieurs parcours d'un même fichier
partagent le compte ouvert par le premier test, et cette dépendance-là est
voulue.

**Mais un fichier peut lever la règle pour lui-même, et l'un devait.**
`langues.spec.ts` porte 87 tests sur 201 — 43 % de la suite — et ses six blocs
de pages PUBLIQUES ne partagent rien : chacun ouvre son onglet, navigue,
mesure, et s'en va. `test.describe.configure({ mode: "parallel" })` les
libère, et le fichier seul passe de 234 à 123 s. Le bloc « écrans connectés »,
lui, déclare son mode série lui-même : c'est la bonne façon de dire la
dépendance, à l'endroit où elle existe.

Ça ne raccourcit PAS la suite locale — 549 s avant, 550 s après — parce que le
second worker était déjà le long pole. Ça sert en intégration continue, où il y
a des machines pour absorber le travail libéré, et ça équilibre le découpage en
tronçons au passage : 101/100 au lieu de 141/60, Playwright répartissant alors
ces tests un par un au lieu du fichier entier.

**En CI, ce sont six travaux et non un**, parce que le dépôt est public et
qu'aucune de ces minutes n'est facturée : quatre tronçons de parcours **d'un
worker chacun**, `bareme-gele` seul avec sa propre base — la protection
redevient structurelle au lieu d'être un ordre d'exécution — et l'accessibilité
à côté.

Un worker par runner, et c'est la leçon la plus chère de la série : à deux
workers par runner, la CI a rendu l'échec d'août — `waitForURL` qui expire sur
la CONNEXION — parce que les tests de langue devenus parallèles chargent des
pages sans interruption pendant que bcrypt coût 12 attend son tour. On ne
baisse pas le coût du haché, on ne rallonge pas le délai : on donne une machine
entière à chaque worker.

L'autre prix à surveiller est la PRÉPARATION : à cinq travaux simultanés,
`npm ci` est monté de dix-huit secondes à sept minutes, ce qui mangeait presque
tout le gain. D'où les caches de `node_modules`, du navigateur et de la
construction.

## Lire la CI, et savoir qu'une étape ROUGE en SAUTE d'autres (IMPORTANT)

Le travail `parcours` enchaîne : monter la base par les migrations, vérifier
qu'elle correspond au schéma, construire, jouer les parcours, mesurer
l'accessibilité. **Un échec à la deuxième étape saute les quatre suivantes.**

C'est arrivé de V353 à V355 : deux index créés par une migration sans être
déclarés dans `schema.prisma` faisaient échouer la correspondance, donc la
suite navigateur ne tournait plus en CI — pendant que je m'appuyais sur elle
pour ne plus la jouer en local. Trois versions publiées sans qu'aucun parcours
ne soit joué nulle part.

**Le témoin qui saute aux yeux, c'est la DURÉE.** Une exécution complète prend
quinze à dix-huit minutes. Une exécution d'une minute n'a pas joué les
parcours, quoi que dise sa couleur. Regarder la durée avant la pastille.

`src/indexDeclares.test.ts` attrape désormais la cause exacte, statiquement,
donc avant de publier : tout index créé par une migration doit être déclaré au
schéma. Une seule exemption, l'index fonctionnel sur `lower(email)`, que le
langage de schéma de Prisma ne sait pas exprimer.

## Diagnostiquer, et ne pas deviner (IMPORTANT)

Quand un test échoue pour une raison qu'on ne sait pas NOMMER, on instrumente
avant la deuxième tentative. Pas trois hypothèses essayées à la suite : une
sonde qui relève l'état réel — la console de la page, la réponse d'une route,
le nombre d'abonnés à un canal.

Ça s'est payé le 3 septembre : quatre hypothèses formulées et essayées, neuf
minutes, contre une exécution du script de diagnostic qui a donné la cause du
premier coup — `/api/settings` rendait la page de connexion, donc la question
n'était jamais posée. Aucune des quatre hypothèses n'était la bonne.

Le corollaire pour l'outillage : **une sonde se lance contre le serveur qui
tourne déjà.** Reconstruire pour diagnostiquer coûte une minute et demie à
chaque essai, et ne sert que si la SOURCE a changé.

## Travail sur une fenêtre longue (IMPORTANT)

Quand l'utilisateur annonce qu'il s'absente pour une durée donnée — « je pars
huit heures », « je reviens demain matin » — cette durée est la durée du
travail attendu, pas un délai maximal.

**Et il n'a pas besoin d'annoncer une durée.** « Vas-y je te laisse enchaîner,
je te ferai signe quand je suis de retour », ou n'importe quelle formule qui
dit la même chose, veut dire : **travailler en continu jusqu'à son retour ou
jusqu'à épuisement des jetons.** Rendre un bilan puis s'arrêter là n'est pas
une réponse à cette demande — c'est s'arrêter au premier tour. La fenêtre est
alors ouverte, donc les reprises s'arment de la même façon, et elles se
réarment à chaque tour tant que personne n'a repris la main.

Une réponse s'arrête quand elle se termine : il n'y a personne qui continue
entre deux messages. Il faut donc **armer des reprises** au moment où
l'absence est annoncée, sans quoi le travail s'arrête à la fin du premier tour.

Procédure :
1. Constituer une liste de travaux qui ne demandent aucune décision de
   l'utilisateur — tests, audits, performance, accessibilité, rangement,
   documentation. Elle doit couvrir la fenêtre entière.
2. Programmer une reprise (`send_later`, ou une boucle programmée) avant de
   rendre la main.
3. À chaque reprise : prendre le travail suivant, le finir, le publier, puis
   reprogrammer la suivante. **Reprogrammer AVANT de rendre la main**, jamais
   après : une fois le tour terminé, plus rien ne s'exécute.
4. Ne rendre le bilan qu'à la fin de la fenêtre annoncée.

Ce qui demande un arbitrage produit ne se décide pas seul : ça part dans les
questions, pas dans le code.

## Publier l'application de bureau (IMPORTANT)

**Dès qu'une modification touche `desktop/`, on publie une version.** C'est une
consigne du propriétaire du produit, et elle a sa raison : le site se déploie
en quelques minutes, l'application non. Une correction qui reste dans le dépôt
n'existe pour personne — et pire, elle crée un écart entre ce que le site
attend du pont et ce que les copies installées savent faire.

Procédure :
1. incrémenter `desktop/package.json` (le correctif suffit : 0.9.9 → 0.9.10) ;
2. si le pont gagne une méthode, écrire la version dans son commentaire
   (`(0.9.10+)`) des DEUX côtés — `desktop/src/preload.js` et
   `src/types/electron.d.ts` — et prévoir ce que fait la page quand elle
   tourne devant une application plus ancienne ;
3. merger sur `main` ;
4. déclencher `Build Desktop App` (`workflow_dispatch`) sur `main`. La version
   vient du fichier, pas d'une saisie : une valeur tapée à la main pouvait ne
   pas correspondre à ce qui venait d'être compilé.

**Les étiquettes git ne servent pas ici** : `git push --tags` échoue côté
proxy. Le déclenchement se fait à la main, jamais par `desktop-v*`.

**Le bouton de téléchargement met cinq minutes à suivre.** `dernierInstalleur`
lit l'API GitHub avec `revalidate: 300` : la page reste statique, et le retard
après une publication est borné. Il était d'une heure, ce qui allait tant qu'on
publiait une fois par mois. Les copies déjà installées, elles, se mettent à
jour toutes seules par `latest.yml` — le retard ne concerne que qui installe
pour la première fois.

**Ce que la page doit toujours prévoir** : quelqu'un qui n'a pas mis à jour.
Une méthode absente du pont ne se voit qu'à l'exécution, sur SA machine — ni
TypeScript ni les parcours navigateur ne peuvent le dire, puisque les tests
posent un faux pont. Le repli se choisit donc à l'écriture, et il ne doit
jamais être plus permissif que ce qu'on demandait : le repli d'un réglage qui
dit « demande-moi » ne peut pas être « fais-le sans demander ».

## Les heures se disent en heure française (IMPORTANT)

Consigne du propriétaire. La machine, les journaux de CI, `git log` et les
travaux programmés sont tous en UTC ; lui vit en France, donc **UTC + 2** de
fin mars à fin octobre (CEST) et **UTC + 1** le reste de l'année (CET).

Ça vaut pour ce qu'on lui DIT, pas pour ce qu'on écrit dans le code : une
comparaison d'heure, un cron, un horodatage de journal restent en UTC — les
convertir serait le défaut que `fenetreEnvoi.ts` existe pour éviter. La
conversion se fait au moment de rendre compte, et jamais avant.

Et on ne déduit pas une durée du fil de la conversation : `date -u` coûte une
seconde, et une heure estimée « au ressenti » s'est déjà trompée de vingt
minutes dans ce projet, ce qui a fait prendre un travail parfaitement normal
pour un travail bloqué.

## Versionnage des déploiements Vercel (IMPORTANT)
À chaque mise en prod (merge sur `main`), nommer le **commit de merge** avec un
préfixe de version incrémental `Vx — description` (V1, V2, V3…) pour que la
dernière version soit immédiatement identifiable dans le dashboard Vercel
(colonne "Source"). Le compteur se déduit de l'historique de `main`
(les tags ne sont pas poussables sur ce remote).

Procédure à chaque merge sur main :
```bash
# 1. Trouver le dernier numéro de version dans l'historique de main
git log main --grep='^V[0-9]' --pretty='%s' | head -1   # ex: "V3 — ..."
# 2. Merger en nommant le commit de merge avec le numéro suivant (--no-ff obligatoire)
git checkout main && git merge --no-ff claude/excel-app-conversion-5hk2fg \
  -m "V4 — description courte du changement"
git push origin main
# 3. REVENIR SUR LA BRANCHE, tout de suite
git checkout claude/excel-app-conversion-5hk2fg && git merge main
```

**La fusion laisse sur `main`, et c'est là qu'on se fait prendre.** Le travail
suivant s'écrit alors directement sur `main` sans que rien ne le signale : la
fusion d'après se fait en avance rapide — `--no-ff` n'y peut rien, il n'y a
plus rien à fusionner — donc **le commit part sans son numéro de version**, et
le tableau Vercel n'a plus de `Vx` à montrer. Arrivé sur V378. Le marqueur se
repose alors par un commit vide plutôt qu'en réécrivant `main`, qui est déjà
poussée : additif et réversible, contre une force qui ne l'est pas.
`git branch --show-current` avant de committer coûte une seconde.
Si aucun commit `Vx` n'existe encore, commencer à V1. **Ne pas** utiliser de
tags git (`git push --tags` échoue côté proxy) — le numéro vit dans le message
du commit de merge.

## Architecture fichiers clés

```
src/
  app/
    [locale]/                       # Toutes les pages, une version par langue
      page.tsx                      # Dashboard (client) — stats, graphiques, mode session
      history/page.tsx              # Historique parties + pompes (client)
      amis/page.tsx                 # Amis et groupes (server) — la porte
      amis/AmisClient.tsx           # Amis et groupes (client) — l'écran entier
      admin/page.tsx                # Panel admin (server) — restreint à evantocquet@gmail.com
      admin/AdminChampionEditor.tsx # Éditeur liste champions (client)
      admin/AdminRatiosExercices.tsx # Réglage des ratios squats et boxe (client)
      settings/page.tsx             # Réglages utilisateur
      login/page.tsx                # Login
      telechargement/page.tsx       # Page download app desktop
      not-found.tsx                 # 404 dans la langue de la page
    (diffusion)/obs/[jeton]/        # Source OBS : sa propre coquille, sans langue
    api/
      dashboard/route.ts            # GET stats globales (totalPompes, statsByPeriod, dailyPompes, etc.)
      dashboard/daily/route.ts      # GET ?date=YYYY-MM-DD → détail horaire du jour
      games/route.ts                # GET liste games, POST nouvelle game
      games/[id]/route.ts           # DELETE + PATCH (date, ou résultat rejoué)
      games/preview/route.ts        # POST preview scoring sans sauvegarder
      amis/route.ts                 # GET liste + demandes + groupes, POST demande par pseudo
      classement/route.ts           # GET classement de la semaine entre amis, sur l'effort payé
      parrainage/route.ts           # GET son lien d'invitation, et combien sont venus par lui
      amis/[id]/route.ts            # PATCH accepter, DELETE refuser/annuler/retirer
      groupes/route.ts              # POST créer un groupe (code tiré)
      groupes/rejoindre/route.ts    # POST rejoindre par code
      groupes/[id]/route.ts         # PATCH refaire le code, DELETE quitter
      champions/route.ts            # GET liste champions (DB override ou défaut)
      admin/config/champions/route.ts  # GET/PUT/DELETE liste champions (admin only)
      admin/config/exercices/route.ts  # GET/PUT/DELETE ratios entre exercices (admin only)
      exercices/ratios/route.ts     # GET public — ratios en vigueur, relus par le navigateur
      riot/match-history/route.ts   # GET 20 dernières parties Riot
      riot/last-game/route.ts       # GET dernière partie Riot
  components/
    Nav.tsx           # Navigation — lien Admin visible uniquement pour evantocquet@gmail.com
    ChampionInput.tsx # Input autocomplete champions (fetch /api/champions dynamique)
    ChampionIcon.tsx  # Icône champion via Data Dragon CDN
    SessionContext.tsx (lib/) # Context mode session (polling toutes les 2min)
  lib/
    champions.ts      # Liste LoL hardcodée (~170 champions) + findChampion() + suggestChampions()
    prisma.ts         # Client Prisma singleton
    auth-helpers.ts   # getCurrentUser() → User | null
    dette.ts          # Ajout et retrait de dette, atomiques
    social.ts         # Les règles du social : demande croisée, code d'invitation, reprise
    classement.ts     # La fenêtre de sept jours, l'ordre, les rangs à égalité
    sansEnjeu.ts      # Le souvenir d'une partie refusée, entre les deux composants
    profilAmi.ts      # Ce qu'un ami a le droit de voir, et qui en décide
    parrainage.ts     # Ce qu'on fait d'un code reçu, et pourquoi l'avantage est une amitié
    i18n/cheminLocalise.ts  # La langue dans l'adresse : préfixe, retrait, négociation
    i18n/useChemin.ts       # Le chemin SANS la langue, pour tout le reste du projet
    i18n/metadonnees.ts     # Titres et descriptions des pages publiques, six langues
prisma/
  schema.prisma       # Modèles DB
  migrations/
    20260629000000_create_system_config/migration.sql  # Crée table SystemConfig
desktop/src/          # App Electron Windows
  main.js             # Fenêtre, canal d'authentification local, raccourcis
  liveclient.js       # API de partie (port 2999) : début, fin, relevés
  lcu.js              # Lanceur League : phase, file, rôle, écran de fin
  issueLocale.js      # Les deux lectures d'issue, et la règle commune
  attenteIssue.js     # Retient une fin de partie sans issue, le temps du lanceur
  jeuxProcessus.js    # Détection des autres jeux par la liste des processus
  overlay.js / overlay.html  # La pastille en jeu
  origine.js          # « Est-ce bien chez nous ? », comparé par origine entière
  langue.js / textes.js      # Les six langues de la coquille
.github/workflows/desktop-build.yml  # CI build .exe → GitHub Release
```

## Modèles Prisma importants

- `User` — pseudo, riotId, riotPuuid, riotRegion, gainageMaxSec, passwordHash
- `Game` — date, role, champion, kills/deaths/assists, result, gainageSec, niveauCalcule, pompesCalculees, source (manuel|riot_api)
- `Goal` — objectifTotalPompes par user
- `RoleWeight` — poids K/D/A par rôle (config globale)
- `LevelConfig` — niveaux 1-5, seuils gainage, multiplicateur, malusDefaite
- `MasteryConfig` — surchargeMax (0.5), partiesPourMax (100)
- `SystemConfig` — key/value JSON pour config admin (clés : "champions", "exercices")
- `Amitie` — demandeur, receveur, etat (attente|acceptee). Un refus SUPPRIME la ligne
- `Groupe` — nom, code d'invitation unique et régénérable
- `MembreGroupe` — groupe, compte, role (proprietaire|membre)

## Fonctionnalités implémentées

### Dashboard (page.tsx)
- Stats globales : games, winrate, total pompes, record/game
- Barre de progression vers objectif
- Champion spotlights (plus joué, plus difficile)
- Mode Session : polling Riot toutes les 2min, auto-log des parties
- Graphique rôles (total/avg)
- Graphique progression cumulative
- Graphique période avec toggle **Moyenne/Total** + onglets : Heure | Jour | Mois | **Calendrier**
  - Calendrier : date picker → détail horaire via `/api/dashboard/daily`

### « Tes jeux » depuis un navigateur
La section annonce « chaque jeu a ses réglages » et n'en montre qu'un. C'est
exact : sans l'application Windows, il n'y a ni pastille en jeu ni détection
automatique, et il ne reste que le compte Riot à rattacher. Ce qui ne l'était
pas, c'est de ne rien en dire — on cherchait où étaient passés les autres jeux.
`ReglageJeux` affiche donc, hors application, ce qu'on peut y faire, ce qui
demande l'application, et le lien pour l'installer.

Une section qui promet plus qu'elle ne donne doit au moins dire pourquoi.

### Amis et groupes (amis/page.tsx)
Un écran, deux moitiés, et la même règle des deux côtés : **rien n'est
explorable par un inconnu.** Elle vient de la réponse 127 — le propriétaire du
produit n'est pas prêt à modérer un espace social, et un annuaire ou un champ
de texte libre demanderait quelqu'un pour le surveiller.

- **Une amitié** se demande à un pseudo EXACT et n'existe qu'après acceptation.
  Deux homonymes font refuser plutôt que choisir : l'unicité des pseudos vit
  dans l'application et pas en base, et envoyer la demande à la mauvaise
  personne ne se rattrape pas.
- **Un refus supprime la ligne.** La garder dirait à qui insiste qu'il a été
  refusé, et personne n'arbitre ce qui suivrait.
- **Redemander à qui vous a déjà demandé vaut acceptation**, sinon deux
  demandes croisées s'installent et l'amitié ne peut plus se conclure.
- **Un groupe** se rejoint avec son code, et seulement avec son code. Il n'est
  listé nulle part. Le code part à TOUS les membres — c'est ce qui distingue un
  groupe d'une liste : celui qu'on a invité peut inviter à son tour. Le
  propriétaire garde ce qui répare : refaire le code, donc révoquer celui qui
  circule.
- **Retirer un ami et quitter un groupe demandent deux gestes**, comme la
  correction d'un résultat de partie.

- **Un lien de parrainage** vit sur le même écran. Celui qui l'ouvre et crée
  son compte devient ami tout de suite : rien n'est offert en points d'effort,
  ce serait une pompe que personne n'a faite. Le code se tire à la première
  lecture, l'adresse partagée ne porte pas de préfixe de langue, et un code
  fautif ne fait jamais échouer une inscription.
- **Le profil d'un ami** s'ouvre depuis la liste, et montre ce que la personne
  autorise : son total d'effort et son retard toujours, sa série, son nombre de
  parties et son jeu le plus joué si elle l'a choisi. Le défaut est le plus
  fermé, et le filtre est en base.
- **Le mode fantôme**, dans les réglages, retire entièrement sa ligne des
  classements de ses amis — pseudo, effort et retard compris. On continue de
  voir le sien, soi-même compris. Le filtre est en base : écarter la ligne à
  l'affichage la ferait quand même traverser le réseau.
- **Le classement de la semaine** vit sur le même écran : sept jours
  glissants, sur l'effort PAYÉ, avec le retard de chacun. Ni les parties
  jouées ni le classement en jeu — perdre beaucoup ne fait pas monter. Les
  décisions sont dans `src/lib/classement.ts`, la lecture dans
  `/api/classement`.

`src/lib/social.ts` porte les décisions ; les plafonds y remplacent la
modération.

### Historique (history/page.tsx)

**Sur téléphone, ce sont des cartes, pas un tableau.** Le tableau compte
jusqu'à neuf colonnes et réclame 760 px ; en dessous il défilait
horizontalement, et on ne voyait jamais une activité entière — la date d'un
côté, le résultat de l'autre, le KDA coupé au milieu d'un chiffre. Les deux
présentations sont rendues et c'est `historique.css` qui choisit : un
basculement en JavaScript dépend de la largeur, que le rendu serveur ne
connaît pas, et la première peinture montrerait la mauvaise vue. Les deux
lisent le même tableau `lignes`, préparé une seule fois, pour qu'une
correction faite d'un côté ne manque pas de l'autre.

Ce défaut n'était attrapé par rien. Les tests de langue refusent qu'une PAGE
déborde, et celle-ci ne débordait pas : c'est un conteneur intérieur qui
défilait, ce qui est même la bonne façon de faire déborder un tableau.
`e2e/historique.spec.ts` regarde maintenant les vrais conteneurs défilants —
ceux dont `overflow-x` vaut `auto` ou `scroll` — et non tout élément dont le
contenu dépasse : la première version signalait les libellés coupés par une
ellipse, qui débordent par construction et ne se font jamais défiler.
- Vue "Parties" : 20 dernières Riot + quick-add + ARAM du chaos manuel
- Vue "Pompes" : tableau filtrable/triable avec édition de date inline (✎ → datetime-local)
- **Correction du résultat** : le même crayon à côté de la victoire ou de la
  défaite. La route rejoue le barème et porte l'écart au compteur de dette ;
  elle refuse les séances au temps et les battle royale, dont le résultat se
  déduit du classement
- Formulaire ajout manuel :
  - **lastRole** et **lastGainageSec** persistés en localStorage
  - **ChampionInput** autocomplete avec validation (rejette hors liste)
  - Preview scoring avant confirmation

### Ratios entre exercices (admin)
- Panneau `/admin` → squats et boxe réglables par rapport aux pompes
- Les pompes restent l'unité de référence, non modifiable : `Game.pompesCalculees`
  stocke des points d'effort où 1 point = 1 pompe depuis le premier jour
- Chargés par `chargerRatios()` dans le layout racine (cache mémoire 60 s) et
  dans `/api/dette` et `/api/games` ; relus côté navigateur via
  `/api/exercices/ratios`, parce que les pages prérendues gardent sinon la
  valeur du déploiement — `revalidatePath` ne débloque pas une page statique

### Langues
Six langues : français, anglais, espagnol, allemand, chinois, japonais.
`src/lib/i18n/dictionaries/` — un fichier par écran, un bloc par langue. Le
français et l'anglais sont exigés ; une langue absente retombe sur l'anglais,
jamais sur du vide (`useT`).

**La langue vit dans l'adresse** : `/fr/history`, `/ja/cgu`. Toutes les pages
sont sous `src/app/[locale]/`, et les six versions sont engendrées à la
construction. Le middleware redirige en 308 une adresse sans langue vers celle
du cookie, à défaut celle du navigateur, à défaut l'anglais.

- Les règles d'adresse vivent dans `src/lib/i18n/cheminLocalise.ts` : ce qui
  prend un préfixe, ce qui n'en prend pas (API, `/obs`, fichiers), et la
  négociation.
- `useChemin()` rend le chemin SANS langue : c'est sous cette forme que tout le
  reste du projet raisonne. `usePathname` est interdit ailleurs.
- `Lien` remplace `next/link` partout : un `href` écrit tel quel changerait de
  langue au clic.
- Les métadonnées des pages publiques vivent dans `src/lib/i18n/metadonnees.ts` :
  Next.js les rend au serveur, sans composant, donc `useT` ne peut pas y servir.
- Ce qui part hors du navigateur porte la langue du COMPTE dans son lien :
  courriel hebdomadaire, lien de récupération, notification push.

Règles :
- Aucun texte dans un composant. Un composant ne compare jamais `locale` à une
  langue — un test le refuse.
- Les jours, les mois, les dates et les nombres passent par `Intl`, avec
  `etiquetteLocale(locale)`. Jamais de table écrite à la main.
- La minuscule au fil d'une phrase passe par `enMinuscule` / `useMinuscule` :
  en allemand, les noms communs gardent leur majuscule.
- Les erreurs des routes API se traduisent dans `src/lib/i18n/apiErrors.ts`,
  la clé étant le message français tel qu'il circule sur le réseau.
- Ce qui part hors du navigateur — notification push, courriel — ne peut pas
  passer par `useT` : il n'y a ni composant ni stockage local. La langue est
  donc rangée sur le compte (`User.langue`, remontée par `LangueDuCompte`) et
  les textes vivent dans `src/lib/i18n/notifications.ts`. Sans ça, le texte
  écrit en dur partait en français à tout le monde, et rien ne le signalait :
  celui qui écrit l'application la lit en français.
- CGU et politique de confidentialité existent dans les six langues, avec une
  clause qui dit laquelle fait foi : la française. Le bandeau qui annonçait la
  limite est parti avec elle.

### Ce qui récompense, et ce qui ne récompense rien
Cinq mécaniques, toutes déduites de ce qui est déjà en base, et toutes rendues
par `/api/progression` — c'est-à-dire sans un aller-retour de plus vers Neon.
Aucune ne donne de points d'effort : un point donné est une pompe que personne
n'a faite, et le registre entier — dette, classement, paliers, bilan — s'en
trouverait faux.

- **Les paliers** (`badges.ts`, ligne 146) : volume, parties, série. Ils se
  DÉDUISENT, donc ils peuvent redescendre quand une partie est supprimée.
- **Le niveau de compte** (`niveauCompte.ts`, ligne 148) : `25 × n × (n−1)`
  points PAYÉS pour atteindre le niveau n. Payés, jamais générés — sinon
  perdre beaucoup ferait monter, sur un produit dont le sujet est de payer.
  Le champ s'appelle `pointsPayes` et non `totalPoints` précisément pour que
  la confusion ne puisse pas se refaire.
- **Le titre** (même module, ligne 149) : six, du plus facile au plus rare,
  ordonnés par le TEMPS qu'ils demandent. On porte le plus rare qu'on ait, et
  aucun n'est désobligeant — qui n'a rien gagné n'a pas de titre plutôt qu'un
  titre qui le dit. Il est rangé du côté du DÉTAIL du profil d'un ami :
  « Increvable » dit une série de trente jours, que le mode « total » tait.
- **L'exploit du paiement éclair** (`exploits.ts`, ligne 147) : une dette
  SOLDÉE dans l'heure qui a suivi sa naissance. C'est la seule chose de la
  progression qui se range en base (`User.paiementEclairLe`), parce qu'un
  délai est un MOMENT et non un total : la dette d'hier soir n'existe plus, et
  rien ne dira jamais après coup en combien de temps elle a été payée. Il ne se
  perd donc pas, et ne se regagne pas.

### Les défis, et l'objectif qu'on poursuit ensemble
- **Le défi du jour** (`defiQuotidien.ts`, ligne 138) : le même pour tout le
  monde, décidé par le seul JOUR, donc entièrement déductible sans table ni
  écriture. Six défis parcourus par blocs de six — jamais deux jours de suite
  le même — avec le premier et le dernier de chaque bloc FIXÉS par
  construction : un rattrapage de couture après coup ne peut pas se refermer,
  parce que le bloc d'avant a peut-être tourné lui aussi.
- **Les deux défis du mois** (`defiMensuel.ts`, ligne 131) : en volume ET en
  parties, montrés ensemble. Un mois est trop long pour qu'on se souvienne d'un
  objectif vu une fois.
- **L'objectif collectif** (`objectifCollectif.ts`, ligne 133) : tout l'effort
  payé par tout le monde sur le mois, avec le nombre de CONTRIBUTEURS à côté.
  Ce dernier n'est pas une décoration — « 8 420 sur 100 000 » décourage à
  quatre, « 8 420 sur 100 000, à 4 » est vrai à toutes les tailles. C'est la
  seule lecture du produit qui ne filtre pas par compte, et sa dispense porte
  sa raison : un total et un décompte ne désignent personne.

### Le mur des records (lignes 140 et 141)
Le plus gros JOUR d'effort, ce mois-ci et depuis toujours. Il ne remplace pas
le classement — celui-ci additionne une fenêtre, celui-là retient une pointe —
et c'est pourquoi il vit dans sa propre section.

Il se regroupe sur le COUPLE compte-jour : un `_max` sur les points rendrait le
plus gros PAIEMENT, ce qui se verrait le soir où quelqu'un paie en deux fois. À
égalité, le plus ANCIEN tient — un record ne se prend pas en égalant.

**Entre amis par défaut, ouvert à tous au choix** (`User.recordsPublics`, faux
par défaut). Le **mode fantôme reste au-dessus** : un mur est un classement,
donc se cacher des classements se cache du mur, ouvert ou non. Les deux
conditions sont en base, jamais à l'affichage.

**Ce que la ligne 140 ne fait PAS** : le classement par exercice. `Paiement` ne
porte que des points et un jour ; retenir l'exercice demanderait une colonne et
une décision sur les paiements déjà écrits.

### Le classement : la semaine, et le cumul (ligne 144)
Deux onglets, et la SEMAINE est le défaut, y compris pour une période inconnue.
Un cumul est décidé par la date d'inscription : le dernier venu y regarde un
tableau où sa place ne dépend plus de ce qu'il fait. La borne haute reste dans
les deux cas, sinon un paiement daté du futur entrerait au cumul.

L'onglet ouvert vit dans un `useRef` : le classement se recharge de trois
autres endroits, qui repasseraient sinon la période par défaut, et le tableau
reviendrait à la semaine sous un onglet disant « cumul ».

### Objectif de première semaine
Ce que quelqu'un fait dans ses sept premiers jours décide s'il reviendra ; le
reste du produit n'y peut plus grand-chose après. L'objectif est donc petit —
cinq parties, ce qu'on enregistre en une soirée — et il ne demande aucun geste
nouveau. Il disparaît au bout de sept jours, atteint ou non : un objectif raté
qui reste affiché n'est plus un objectif, c'est un reproche.

Atteint, il **reste jusqu'à la fin de la fenêtre**, dans un état atteint. Il
s'effaçait à la seconde où on l'atteignait : réussir et ignorer produisaient
exactement le même écran, c'est-à-dire rien. Un objectif raté qu'on laisse est
un reproche ; un objectif réussi qu'on laisse est un trophée. Les deux ne se
traitent pas pareil.

Il se calcule au serveur (`premiereSemaine()` dans `/api/dashboard`) parce que
la date d'inscription n'est pas remise au navigateur, et n'a aucune raison de
l'être pour ce seul usage. Une date illisible ne montre rien plutôt que de
faire vivre l'objectif à vie.

### Envois programmés
`.github/workflows/envois-programmes.yml` appelle `/api/push/programme` et
`/api/mail/hebdo` ; les routes regardent chez qui c'est le **matin
localement**, à partir de `User.fuseau` remonté par `ContexteNavigateur`.
Trois envois en sortent :

- **Le rappel du matin.** Une soirée qui finit à deux heures laisse une dette
  que personne ne paie avant d'aller dormir, et le rappel de seuil est déjà
  parti la veille au milieu d'une partie.
- **Le bilan de la semaine**, par courriel, le lundi matin en heure locale.
  L'application ne sait dire que le présent — ce qu'on doit, là, maintenant.
  Sept jours mis bout à bout disent autre chose. Rien ne part sur une semaine
  vide : un courriel qui dit zéro est celui qu'on se désabonne en l'ouvrant, et
  l'absence est déjà traitée par la relance. Il s'éteint d'un clic
  (`User.bilanActif`, réglages) et le courriel porte le lien — un envoi
  récurrent sans bouton d'arrêt fait se désabonner de tout, y compris de ce
  qui servait.
- **La relance des absents**, après deux semaines sans une partie. Une fois, et
  une seule (`User.relanceLe`) : une application qui redit tous les jours « tu
  nous manques » se fait couper, et elle l'a cherché. La date se pose même si
  personne n'a reçu la notification — sans abonnement, réessayer chaque jour
  ne changerait rien et referait le tour de la base. L'absence se mesure sur
  `Game.createdAt` et non `Game.date` : une partie ajoutée à la main se date
  dans le passé.

**Une FENÊTRE, et non une heure.** Le travail était réputé passer toutes les
heures ; il passe trois à six fois par jour, à des heures imprévisibles, et sur
huit jours d'observation jamais à celle qu'il fallait. Les trois envois n'ont
donc jamais eu lieu, en répondant 200 à chaque passage. `src/lib/fenetreEnvoi.ts`
porte la règle : la fenêtre va de neuf heures à midi local, et une marque par
compte empêche d'envoyer plusieurs fois dans la même matinée — `User.rappelLe`
pour le rappel, `User.bilanLe` et `User.relanceLe` qui existaient déjà. La
marque se compare par JOUR LOCAL et non en heures écoulées, sinon elle dérive
et l'envoi saute un jour sur deux.

`src/envoisProgrammes.test.ts` refuse qu'une route appelée par un travail
programmé compare l'heure locale à une valeur exacte, et exige une fenêtre d'au
moins trois heures. La liste des routes se lit dans les workflows, pas à la
main.

Ça rend le système tolérant à un déclencheur irrégulier ; ça ne le rend pas
ponctuel. Un déclencheur fiable est une décision d'infrastructure et figure
dans `docs/lancement.md`.

Un compte sans fuseau connu n'est jamais notifié : envoyer « bonjour » à trois
heures du matin est pire que ne rien envoyer, et `heureLocale()` rend `null`
plutôt que de faire passer une heure UTC pour une heure locale.

Deux secrets à poser dans le dépôt : `SITE_URL` et `RAPPEL_SECRET`, ce dernier
devant valoir la même chose que la variable d'environnement du même nom côté
Vercel. Sans secret configuré, la route refuse tout le monde — une variable
oubliée ne doit pas transformer un déclencheur en porte ouverte.

**Ils sont posés, et ça se vérifie dans le journal, pas sur la pastille.** Le
25 août à 04h02, les deux déclencheurs répondent 200 :
`{"examines":0,"envoyes":0,"relances":0}` pour le rappel du matin,
`{"examines":1,"envoyes":0}` pour le bilan. Zéro envoi est le résultat normal à
cette heure-là et un mardi. Un 401 dirait que le secret ne correspond pas à
celui de Vercel ; un `::warning::` dirait qu'il manque. C'est la seule façon de
le savoir : par conception ce travail rend du vert quoi qu'il arrive, pour ne
pas envoyer vingt-quatre courriels d'échec par jour.

Tant qu'ils manquent, le travail **s'arrête sans échouer**. Un travail horaire
qui échoue enverrait vingt-quatre courriels d'échec par jour jusqu'à ce que
quelqu'un cède et le coupe : c'est l'inverse de ce qu'on veut. Voir « Les
courriels d'échec » plus haut : la sauvegarde suit la même règle depuis, et
seule la supervision alerte.

### Les courriels d'échec, et pourquoi il n'y en a presque plus
Une nuit a produit **cinquante courriels d'échec quasi identiques** : un travail
resté rouge vingt-cinq versions d'affilée, et deux exécutions par changement
(poussée sur la branche, puis sur `main`). La conséquence n'est pas l'agacement,
c'est qu'on finisse par filtrer l'alerte — et qu'on ne la lise plus le jour où
elle compte.

Quatre règles depuis :

- **La supervision est la seule à crier.** Elle n'alerte qu'au *changement
  d'état* : premier échec, puis rappel une fois par vingt-quatre heures tant que
  la panne dure, puis à nouveau si le site retombe après être revenu. Une panne
  d'une nuit passe de trente-deux courriels à un. L'état voyage d'une exécution
  à l'autre par le cache GitHub, et la décision vit dans
  `.github/alerte-etat.sh`, éprouvé par `src/alerteEtat.test.ts` — sabotage
  compris : sans mémoire, les vingt-quatre cris reviennent.
- **Les envois programmés ne crient jamais.** Ils tournent à l'heure : un échec
  y vaut vingt-quatre courriels par jour, tous identiques. Ils notent en
  `::warning::` et passent. C'est la supervision qui verra la même panne.
- **La sauvegarde garde son échec bruyant**, parce qu'elle tourne une fois par
  jour : un courriel quotidien se lit. En revanche, des secrets absents ne sont
  plus un échec mais un avertissement — ce n'est pas une sauvegarde qui rate,
  c'est une sauvegarde pas encore configurée, et le redire tous les jours ne
  sert personne.
- **Une exécution de tests par changement**, sur `main` et sur les demandes de
  fusion seulement, avec `cancel-in-progress` : une poussée qui en suit une
  autre de près annule la précédente, et une exécution annulée n'envoie rien.

`src/alerteUnique.test.ts` refuse qu'un travail programmé se remette à crier :
seule la supervision le peut, la sauvegarde figure en exception avec sa raison
écrite, et les deux détections sont éprouvées sur un fichier fabriqué pour
qu'elles ne puissent pas rendre « non » à tout.

### Admin (/admin)
- Accès restreint : `user.email === "evantocquet@gmail.com"`
- Éditeur liste champions (1 par ligne) → stocké en DB table SystemConfig
- GET `/api/champions` retourne la liste DB ou la liste hardcodée par défaut
- Le lien "Admin" apparaît dans la Nav uniquement pour cet email (via fetch `/api/auth/session`)

### Installation sur téléphone (PWA)
Le manifeste existait depuis longtemps ; l'application n'était pas installable
pour autant. Chrome n'émet `beforeinstallprompt` que si un service worker
actif sait répondre hors ligne — sans quoi l'invitation n'a aucun chemin sur
Android, et personne ne va chercher « ajouter à l'écran d'accueil » dans un
menu de navigateur.

Ce qui a été posé :
- `public/hors-ligne.html` — page de secours entièrement autonome, sans
  feuille de style, sans police, sans script externe. Un test refuse tout
  `src=`, `href=` ou `url(` : c'est au moment où plus rien ne se charge qu'on
  en a besoin, et le défaut ne se voit jamais en développement.
- `public/sw.js` — met cette seule page en cache, n'intercepte que les
  navigations, et seulement quand elles échouent. **Aucun cache d'assets** :
  sur une application qui se redéploie plusieurs fois par jour, un fragment
  périmé servi à une page neuve donne un écran sans style dont le symptôme ne
  ressemble jamais à sa cause.
- `ServiceWorkerActif` l'enregistre au chargement, pour tout le monde. Il ne
  l'était que par le réglage des notifications, c'est-à-dire pour la poignée
  de gens qui les activent.
- L'invite du navigateur est attrapée par un petit script du `layout`, dans la
  page elle-même. `beforeinstallprompt` n'est émis qu'une fois, et ce moment ne
  se commande pas : il tombe souvent avant que le paquet JavaScript ne
  s'exécute. Un écouteur posé dans un composant, même au chargement de son
  module, arrive alors trop tard, et il n'y a pas de seconde émission. Éprouvé
  dans les deux sens : le test passe avec le script, échoue sans.
- `InvitationInstallation` propose à la troisième visite, sur pointeur tactile
  seulement, et une seule fois. Sur iPhone, Safari n'implémente pas l'invite :
  on y décrit le geste, ce qui est la seule chose à faire — et c'est là que ça
  compte le plus, puisque c'est la seule façon d'y recevoir une notification.

### App Desktop (Electron)
- Build Windows NSIS via GitHub Actions (`workflow_dispatch` ou tag `desktop-v*`)
- OAuth flow : ouvre Chrome externe, callback local port 3099, cookie session
- Page `/telechargement` : bouton download si `NEXT_PUBLIC_DOWNLOAD_URL` défini (Vercel env var)

## Conventions CSS
- Classes utilitaires custom : `lol-panel`, `lol-btn`, `lol-input`, `lol-select`, `stat-card`
- Couleurs : gold `#C8AA6E`, win `#4caf50`, loss `#ef5350`, blue `#0bc4e3`
- Font heading : `var(--font-heading)` = Russo One
- Tout inline style ou Tailwind, pas de modules CSS

## Sécurité à respecter
- Ne jamais afficher/committer d'identifiants ou tokens
- Admin check toujours côté serveur (getCurrentUser + email check)
- Toutes les routes API vérifient getCurrentUser() avant d'accéder aux données

### Pourquoi le CSP porte `'unsafe-inline'` sur les scripts
Ce n'est pas un oubli, et ça mérite d'être écrit une fois pour qu'on ne le
redécouvre pas tous les six mois. Next.js pose ses propres scripts en ligne
dans chaque page, et leur contenu change à chaque construction : les autoriser
par empreinte est impossible. Reste le nonce, qui se génère par requête — donc
qui rend **toutes** les pages dynamiques, y compris les dix pages publiques dont
le temps d'affichage est le seul canal d'acquisition qui travaille sans qu'on
s'en occupe.

Ce que `'unsafe-inline'` coûte réellement ici : rien tant qu'aucune donnée
d'utilisateur n'atteint un point d'injection. React échappe tout ce qu'il rend,
et les deux seuls `dangerouslySetInnerHTML` de l'application portent des
constantes — le bloc de données structurées de l'accueil et l'écouteur
d'invitation à installer. C'est une défense en profondeur qui manque, pas une
porte ouverte.

À vérifier avant d'ajouter un troisième `dangerouslySetInnerHTML` : s'il devait
porter quoi que ce soit venu d'un compte, c'est cet arbitrage qu'il faudrait
reprendre, pas seulement échapper la valeur.

## Tests
2134 tests unitaires, 193 suites. Base et session doublées : aucune dépendance à
PostgreSQL ni aux variables d'environnement, `npx jest` suffit. La CI
(`.github/workflows/tests.yml`) lance types et tests à chaque poussée, puis les
parcours navigateur dans un second job avec un PostgreSQL de service.

Les tests de routes API appellent les handlers directement, avec les outils de
`src/test/api.ts`. Ce qui est systématiquement éprouvé : refus sans session,
refus pour un compte non administrateur là où c'est requis, et filtrage par
compte sur chaque requête en base.

Toutes les routes ont un test, sauf `auth/[...nextauth]`, qui appartient à
Auth.js. Les six dernières couvertes — configuration du scoring, rejeu de
l'intro, expiration de session, fin de connexion desktop, session volatile,
dernière partie Riot — l'ont été après un recensement qui résout les imports des
tests jusqu'aux fichiers de route : chercher le nom du dossier dans le texte des
tests donnait des faux positifs.

L'empreinte du mot de passe ne sort pas de la base : `getCurrentUser` la retire
par `omit`, et un test le vérifie sur la requête elle-même. Les deux routes qui
rendent le compte par diffusion passent en plus par `comptePublic`
(`src/lib/compte.ts`), parce qu'un `{ ...user }` publie tout ce qu'on lui remet.
Cette fonction vit à part d'`auth-helpers` : les tests de routes doublent ce
module entier, et le filtre y serait remplacé par une doublure — les tests de
fuite éprouveraient alors un filtre qui n'est pas celui qui tourne.

Au navigateur (`npm run e2e`), 220 tests : `e2e/parcours.spec.ts` suit le chemin
complet d'un compte neuf, **deux fois, sur un écran de poste et en 390 px
tactile**, `e2e/langues.spec.ts` ouvre les neuf pages publiques puis les cinq
écrans connectés — tableau de bord, historique, amis, réglages, saison — dans les six
langues et à trois largeurs, sur un compte qu'il ouvre lui-même, en demandant
chaque langue par son ADRESSE, et
`e2e/installation.spec.ts` éprouve l'invitation à installer l'app et la page
de secours hors ligne, `e2e/historique.spec.ts` regarde l'historique sur un
écran de téléphone, et `e2e/reglages.spec.ts` vérifie que « Tes jeux » explique
pourquoi il n'y a qu'un jeu hors application, et `e2e/social.spec.ts` fait
jouer deux comptes l'un contre l'autre — trois pour le classement, dont un
tiers qui ne doit apparaître nulle part — c'est la seule chose qu'un seul
contexte de navigateur ne sait pas éprouver.

`e2e/panne-serveur.spec.ts` est devenu le fichier des échecs : il coupe une
route à la fois et vérifie que l'écran le dit ET que rien n'a bougé en base.
`e2e/detection-partie.spec.ts` simule le pont Electron pour éprouver ce que la
détection locale enregistre, et surtout ce qu'elle n'enregistre plus.

L'application de bureau a ses propres tests, en `desktop/src/*.test.ts` :
les deux lectures d'issue, l'attente de l'écran de fin, les trois boucles de
détection, la comparaison d'origine, la langue, les textes, et ce que la
pastille fait quand personne ne regarde. Ils tournent
avec les autres, sans Electron ni jeu ouvert, parce que tout ce qui dépend du
monde extérieur s'y injecte.

Le parcours complet a échoué en CI dès l'arrivée de la demande de
consentement santé : elle est modale, elle recouvre la modale d'accueil, et
rien ne se cliquait derrière. Une modale ajoutée se traverse dans
`passerIntro`, avant les deux autres.

### Ce que les tests de langue attrapent
- `src/lib/i18n/dictionaries.test.ts` — mêmes clés d'une langue à l'autre,
  mêmes natures de valeur, aucune clé morte, et aucune écriture étrangère aux
  six langues (une frappe qui dérape ne se voit pas autrement).
- `src/lib/i18n/langueEnDur.test.ts` — refuse toute comparaison de `locale` à
  une langue hors du dossier `i18n`. C'est le raccourci qui avait laissé un
  écran en anglais pour quatre langues sur six.
- `e2e/langues.spec.ts` — aucun « undefined » à l'écran, aucun débordement
  horizontal (c'est ainsi qu'un mot allemand trop long se signale), `lang`
  posé sur la page, et six textes réellement différents.
### La porte des routes d'API
`src/porteRoutes.test.ts` regarde le dossier `src/app/api` plutôt que les
fichiers connus. Chaque route doit exiger une session, ou figurer dans
`SANS_SESSION` avec la raison de sa dispense. Et une route dispensée qui
**écrit en base** doit montrer un autre verrou : limite par adresse IP, secret
partagé, jeton reçu par courriel, adresse-laissez-passer. Une porte ouverte qui
ne fait que lire est une décision ; une porte ouverte qui écrit est un accident.

Les tests par route restent, et ils sont bons. Leur angle mort est celui de
tous les tests écrits à la main : ils ne disent rien de la route qu'on ajoutera
demain. Éprouvé en fabriquant une route qui écrit sans rien pour la garder,
puis en la dispensant sans lui donner de verrou : chaque sabotage tombe sur son
propre test.

La revue qui a précédé ce garde n'a trouvé **aucune faille exploitable** sur les
quarante-sept routes : tout est filtré par `userId`, aucun SQL brut, aucun
secret en dur, la région Riot passe par une liste fermée avant d'entrer dans une
URL, et le CSP écrit `base-uri` et `form-action`, qui ne retombent pas sur
`default-src`.

### Les fenêtres modales
`src/modalesAnnoncees.test.ts` refuse tout recouvrement plein écran qui ne
porte pas `role="dialog"` et `aria-modal`. Trois fenêtres étaient dans ce cas —
accueil, décompte de dette, suppression de compte — et l'audit navigateur les
avait toutes déclarées « rien à signaler » : il ne cherchait pas ce qui
manquait. Le test, lui, est statique, donc il voit aussi les fenêtres qui ne
sont pas ouvertes au moment où l'on regarde.

Le motif se cherche sur un fichier dont les espaces ont été aplatis. La
première version lisait le texte tel quel et ratait tous les styles écrits sur
plusieurs lignes — dont `OnboardingModal`, c'est-à-dire précisément la fenêtre
qui a motivé le test. Deux exemptions, chacune avec sa raison : la source de
diffusion OBS (page entière, pas une fenêtre) et l'écran d'ouverture (il ne
pose aucune question et disparaît seul).

### Code mort
`src/codeMort.test.ts` refuse un fichier de `src/` que rien n'importe. Trois
trouvailles à l'écriture : deux dictionnaires de langue survivant de six
semaines à la suppression de leurs écrans, et `DesktopLoginButton`, remplacé
par la version intégrée à `LoginButtons`. Rien ne les signalait — TypeScript ne
se plaint pas d'un fichier que personne ne lit, et le compilateur l'écarte du
paquet livré : le coût est humain, pas technique. On le paie en le traduisant,
en le corrigeant, en l'auditant, pour rien.

Le test résout les imports relatifs comme les alias `@/`, et exempte les
fichiers que Next.js charge par convention de nom (`page`, `layout`, `route`,
`sitemap`, `manifest`…), les déclarations `.d.ts` et `src/generated/`.

Un cran plus fin, `noUnusedLocals` et `noUnusedParameters` sont activés dans
`tsconfig.json`. Ils attrapent ce qu'aucun script ne peut voir : une constante
qu'on ne lit plus, un import devenu partiel, une déstructuration dont personne
ne se sert. `ROLES_FILTER` avait survécu au départ du filtre par rôle, et la
réponse d'ajout de partie était déstructurée sans être lue.

Restent 36 symboles exportés qu'un seul fichier emploie. Ce n'est pas du code
mort — juste un `export` plus large que nécessaire. Le resserrer sur les seules
valeurs aurait du sens ; sur les types qui figurent dans la signature d'une
fonction exportée, non : le module deviendrait pénible à consommer. Laissé en
l'état, faute d'un gain qui justifie la retouche.

- `dictionaries.test.ts` refuse aussi un dictionnaire que personne n'importe.
  Deux fichiers de langue avaient survécu six semaines à la suppression de
  leurs écrans, et ont fini traduits en quatre langues de plus avant qu'on s'en
  aperçoive : 364 lignes écrites pour des pages qui n'existent plus.

## Scripts de mesure

Six scripts, dont trois pilotent un Chromium sur l'application lancée en local.
Ils ne tournent pas en CI : ils servent à constater, pas à bloquer une poussée.

```bash
node scripts/accessibilite.mjs   # quinze pages, six langues, règles WCAG
node scripts/performance.mjs     # LCP, CLS, poids du JavaScript par page
node scripts/comparer-rendu.mjs  # captures avant/après, par largeur d'écran
node scripts/charge.mjs          # montée en charge par paliers, jusqu'au point de rupture
node scripts/routes.mjs          # poids et temps de chaque route d'API
node scripts/semer-parties.mjs   # de quoi mesurer autre chose qu'un compte vide
```

Depuis que la langue vit dans l'adresse, les quatre prennent `--langue=xx`
(français par défaut) et `scripts/langue.mjs` porte la règle — le drapeau ET le
découpage des arguments de position, qui l'écarte : posé avant l'adresse, il en
tenait lieu, et l'outil mesurait n'importe quoi en rendant un rapport d'allure
normale. Sans ça, `/cgu`
répond 308 vers `/fr/cgu` et les trois premiers refusent de chronométrer une
redirection : ils se seraient arrêtés net, ce qui est le bon comportement mais
pas un usage. L'audit d'accessibilité, lui, n'a plus besoin de poser la langue
dans le stockage — c'est l'adresse qui la porte, et c'est une source d'erreur
de moins : la pose se faisait AVANT le ménage des clés `low_`, qui l'emportait,
et six passes tournaient en français en annonçant six langues.

`charge.mjs` ne tape JAMAIS sur la production : une montée en charge y
écrirait des comptes de test dans la vraie base, consommerait le quota, et le
but même de l'exercice est de trouver où ça tombe. Il se lance sur le serveur
local, et les plafonds de production se calculent à partir de la structure.

### Leurs pièges, tous rencontrés
- **Mesurer la mauvaise page.** Avec un cookie de session périmé, les trois
  scripts rendaient un rapport vert sur des pages de connexion qu'ils n'avaient
  jamais quittées. Chacun vérifie désormais qu'il est bien où il croit être et
  sort en erreur sinon. C'est le premier contrôle à écrire, pas le dernier.
- **Chercher un mot là où on veut un attribut.** Le test de suppression de
  cookie lisait `toMatch(/Secure/)` sur l'en-tête entier. Or le nom du cookie
  commence lui-même par `__Secure-` : la condition était vraie quoi qu'il
  arrive, et le test survivait au retrait pur et simple de l'attribut. Les
  attributs se lisent après le premier point-virgule, jamais dans la chaîne
  entière.
- **Comparer une chose à elle-même.** Le contrôle du focus lisait
  `getComputedStyle(el, ":not(:focus)")` — l'argument est un pseudo-élément, pas
  un pseudo-classe : la fonction rendait deux fois le même style et concluait
  toujours à la conformité. Il faut comparer l'élément au focus à l'élément sans
  focus, en le retirant réellement.
- **Poser la langue trop tôt.** `low_locale` était écrit avant la boucle qui
  nettoie les clés `low_` : l'audit annonçait six langues et les passait six
  fois en français.
- **Attendre une image qui ne se charge jamais.** Les images en chargement
  différé sous la ligne de flottaison ne commencent jamais : l'attente doit être
  bornée (`Promise.race` à 4 s), sinon la capture ne rend jamais la main.
- **Reconstruire pendant une mesure.** Un `npm run build` en cours de campagne
  invalide les fragments CSS déjà servis : la page se capture sans style et
  toutes les comparaisons deviennent fausses. Ne jamais reconstruire ni tuer le
  serveur pendant qu'un test navigateur tourne.
- **Une page qui dépend d'un service extérieur** (`/telechargement` lit les
  releases GitHub) diffère d'une exécution à l'autre sans que rien n'ait changé.
  `comparer-rendu.mjs` les liste à part, sous « à vérifier à la main ».
- **Ne contrôler que la moitié du script.** Le contrôle d'atterrissage ajouté
  aux trois outils ne couvrait, dans `performance.mjs`, que la passe sur poste.
  La passe sur téléphone bridé mesurait sans vérifier où elle était — et la
  page de connexion, qui se charge vite, y aurait rendu un chiffre flatteur.
  Un contrôle qu'on ajoute se pose partout où la mesure se fait, pas au premier
  endroit rencontré.
- **Afficher un seuil sans dire s'il est franchi.** « LCP 3776 ms (bon en
  dessous de 2500) » se lit comme un satisfecit. C'est au rapport de trancher.
- **Peser ce que le serveur annonce, pas ce qui arrive.** `performance.mjs`
  lisait la taille dans l'en-tête `content-length`. Next.js ne l'envoie pas sur
  les fragments JavaScript : compressés, ils partent en `Transfer-Encoding:
  chunked`, sans longueur annoncée. Le script rendait donc « script 0 ko » sur
  toutes les pages — précisément la mesure pour laquelle il existe — et seules
  les polices, servies en fichiers statiques, apparaissaient. Il lit maintenant
  l'API de chronométrage des ressources du navigateur, en gardant l'en-tête
  pour les ressources d'un autre domaine qui n'autorisent pas la lecture de
  leurs temps. Le tableau de bord passait de 131 ko annoncés à 545 ko réels.
- **Prendre un préchargement pour un chargement.** Sur `/settings`, 104 ko de
  recharts apparaissaient dans les ressources. Ce n'était pas la page qui les
  chargeait : le routeur préchargeait `/dashboard`, lié depuis la navigation.
  Un préchargement par `import()` s'annonce `initiatorType: "script"`, comme un
  chargement ordinaire — c'est l'instant de la requête qui les distingue, après
  le `load`, et `renderBlockingStatus: "non-blocking"`.
- **Confondre « rien trouvé » et « rien regardé ».** `accessibilite.mjs`
  comptait dans le même total les défauts trouvés et les pages qu'il n'avait
  pas pu atteindre. Un rapport annonçant « 45 constats » pouvait donc désigner
  quarante-cinq pages jamais ouvertes — l'inverse exact d'un audit. Les deux
  chiffres sont désormais séparés, et les pages non mesurées s'annoncent sous
  le total au lieu de s'y fondre.
- **L'environnement local tombe tout seul, et deux fois par heure.** Le
  4 septembre à 05:45 puis à 06:35, PostgreSQL ET `next start` étaient morts
  sans que rien ne les tue — le conteneur les reprend pendant les périodes
  d'inactivité. Le symptôme est « le code ne s'affiche pas » à l'ouverture de
  compte, qui ne ressemble en rien à sa cause, et c'est le troisième déguisement
  de cette panne recensé ici. Deux contrôles d'une seconde avant tout parcours :
  `pg_isready -h 127.0.0.1 -p 5433` et un `curl` sur le port du serveur. Les
  relancer coûte `sudo service postgresql start` puis `npx next start -p 3311`.
- **Tuer le serveur avec `pkill -f`.** Le motif `next start -p 3311` figure
  aussi dans la ligne de commande du shell qui lance la commande : `pkill` tue
  le shell, le serveur survit, et le `next start` suivant échoue sur
  EADDRINUSE dans un journal que personne ne lit. **Retombé dedans le 25 août,
  sur `playwright` cette fois** : un travail de fond dont le script contient
  `npx playwright test` porte ce mot dans sa propre ligne de commande, donc
  `pkill -f playwright` posé au début du même travail le tue lui-même. Sortie
  144, aucun journal, pas même le fichier que le script devait écrire — la
  panne ne ressemble à rien. La règle vaut pour tout motif, pas seulement pour
  celui du serveur. Huit tests navigateur ont
  ainsi échoué sur un `.next` d'avant la reconstruction, et le diagnostic est
  parti vers une feuille de style absente qui n'a jamais existé. Trouver le
  processus (`ps -eo pid,args | grep next-server`) et le tuer par son numéro.

Chacun de ces contrôles a été éprouvé en le sabotant volontairement : un outil
de mesure qui ne sait pas échouer ne mesure rien.

### Campagne du 23 août — et ce qu'elle a appris sur les outils
Le premier passage annonçait que les trois écrans connectés dépassaient les
2500 ms sur téléphone bridé : tableau de bord 3376, réglages 3240, historique
3132. C'était faux, et ça a demandé deux corrections pour le voir.

`performance.mjs` ne relevait que le TEMPS du plus grand élément, jamais LEQUEL.
Un chiffre sans nom ne se diagnostique pas — il ne dit ni ce qui est apparu, ni
ce que ça attendait. Le nom ajouté, la réponse est tombée en une exécution : le
plus grand élément était **la modale de consentement santé**, sur les trois
pages. Les écrans n'étaient pas mesurés du tout.

Consentement donné, deuxième surprise : le plus grand élément devenait **la
modale d'accueil**. Sa mémoire est rattachée au compte (`low_onboarded:<id>`),
le script lit l'identifiant dans `/tmp/uid.txt` — et acceptait de tourner sans.
Le piège était décrit en commentaire depuis des semaines, et rien ne
l'empêchait. Un piège qu'on documente sans le fermer se retombe dedans.

Les vrais chiffres, une fois les deux modales écartées :

| écran | LCP téléphone bridé | plus grand élément |
|---|---|---|
| `/history` | 900 ms | pied de page |
| `/settings` | 920 ms | pied de page |
| `/dashboard` | 3456 ms | le rappel du test de force |

Donc : aucune régression. Le tableau de bord reste le seul écran au-dessus du
seuil, pour la raison déjà connue — il n'a rien à montrer tant que ses données
ne sont pas revenues — et le nom de l'élément le confirme maintenant tout seul.

Sur poste, tout est large sous les seuils (LCP 128 à 436 ms, CLS 0).
Accessibilité : **0 constat** sur neuf pages et six langues, aucune page
laissée de côté.

Trois gardes ajoutés, dans les deux scripts :
- refus de démarrer quand un jeton est présent sans `/tmp/uid.txt` — **éprouvé**,
  les deux scripts sortent en erreur ;
- refus de publier un chiffre quand le plus grand élément est dans un
  `[role="dialog"]` (`performance.mjs`) ;
- page marquée « NON MESURÉ » quand une modale la recouvre
  (`accessibilite.mjs`) — **éprouvé** : avec un identifiant bidon, les écrans
  connectés remontent « une modale recouvre la page — Bienvenue dans Win or
  Workout », dans la langue de la passe.

La première tentative de sabotage n'a rien produit, et c'était la trouvaille :
`OnboardingModal` et le décompte de dette ne portaient pas `role="dialog"`. Le
garde cherchait donc quelque chose qui n'existait pas — et surtout, un lecteur
d'écran lisait ces fenêtres comme un morceau de page ordinaire, sans rien qui
dise qu'il faut en sortir. Elles passaient à travers l'audit parce que l'audit
ne cherchait pas ce qui manquait. Trois fenêtres corrigées : accueil, décompte
de dette, suppression de compte.

Une piste écartée en la mesurant : `ContexteNavigateur` écrivait en base à
chaque chargement de page. Gaspillage réel, corrigé, et **sans effet sur le
temps d'affichage** — mesuré avant et après. Une requête de moins, pas une page
plus rapide.

## Journal des corrections

Ce qui suit n'est pas de la documentation d'API : c'est ce qui a cassé, ce qui
l'a causé, et ce qui l'empêche de recommencer. Douze cents lignes vivaient sous
« Scripts de mesure », qui ne les annonçait pas — on ne trouvait une entrée
qu'en la cherchant au mot près.

**Où écrire une entrée nouvelle** : ici, juste en dessous, avant les autres.
Les plus récentes en haut. Ce qui décrit une fonctionnalité telle qu'elle est
aujourd'hui va dans « Fonctionnalités implémentées » ; ce qui raconte une
correction va ici.

### « Convertir en », et le compteur qui accepte de n'en faire qu'une partie
Demandé par le propriétaire en deux temps, et c'est la SECONDE phrase qui a
décidé de la forme. D'abord le bouton : « il faudrait un bouton convertir en
quand on clique sur le rappel de la boxe ». Puis, la question posée : « si on
sélectionne les pompes, on met un cliqueur qu'on peut éditer manuellement aussi
pour dire le nombre de pompes qu'on a pu faire, **si on convertit 10 min de
boxe ça peut faire beaucoup de pompes à faire en une fois** ».

**Ça écarte le « c'est fait » d'un coup, et pour une raison qui se démontre.**
Dix minutes de boxe font quatre-vingts pompes ; personne ne les fait d'affilée.
Un bouton unique mentirait dans les deux sens — il paierait tout à qui n'a fait
que la moitié, et il n'offrirait rien à qui a fait la moitié. Le compteur est
donc le pendant exact du chrono : ce qu'on a fait compte, et le reste reste dû.

**Le cliqueur ET la saisie, pas l'un ou l'autre.** On tape sur le plus pendant
la série, on corrige à la main quand on a compté dans sa tête. Et le nombre EST
le champ : un chiffre affiché à côté d'un champ de saisie fait deux vérités à
l'écran, ce qui est le défaut déjà payé sur la pastille et le décompte.

**La conversion se fait au SERVEUR, et c'est la décision de fond.** La réponse
de `/api/dette` porte désormais `conversions` — la dette entière exprimée dans
chaque exercice qu'on peut proposer. La calculer au navigateur aurait rouvert le
défaut corrigé en août à l'endroit exact où on venait de le fermer : la pastille
convertissait les points chez le client pendant que le décompte lisait la durée
calculée au serveur, et les deux annonçaient deux nombres pour la même dette.

**Un seul chemin de paiement pour les trois formes.** `payer(charge)` remplace
`cloturer(toutFait)`, qui devient une enveloppe. Quatre règles vivent là et ont
chacune leur raison écrite — la file hors ligne, le rejeu d'un 500 ou d'un 401,
la proposition de partage, le jour local — et écrire un second `cloturer` pour
le compteur les aurait recopiées toutes les quatre.

**Ce qu'on ne propose PAS, avec sa raison.** Les exercices comptés au temps sont
écartés : convertir vers un second exercice au temps demanderait de recibler le
chrono, ce qui est un autre écran. Le besoin va d'ailleurs dans l'autre sens —
échapper à une dette au temps. Proposer un bouton sans avoir construit ce qu'il
ouvre serait pire que ne pas le proposer.

**Un piège du réseau, trouvé par un test qui a mordu.** `JSON.stringify(NaN)`
rend `null`, et `Number(null)` vaut **zéro** : une quantité que le navigateur
n'a pas su écrire arrivait donc comme un abandon immédiat, et la route répondait
200 en ne payant rien. C'est « absent et aberrant sont deux choses différentes »
sous une forme nouvelle — le type se vérifie AVANT la conversion, et le cas de
test est écrit sous la forme que le réseau en fait, pas sous celle qu'on tape.

**Et le garde des messages d'API a mordu**, ce qui est son travail : mes deux
refus n'étaient pas traduits. « Exercice inconnu » existait déjà — le doublon est
parti, et c'est `tsc` qui l'a dit, pas moi.

Trois sabotages au navigateur, trois échecs : le compteur qui paie tout, le
serveur qui cesse d'envoyer les conversions, et le plus qui n'incrémente plus.
Le second n'a pas compilé au premier essai — les imports devenus inutiles — et
c'est noté comme tel plutôt que compté comme un test qui mord.

### Un module dont le seul lecteur est son propre test passe pour vivant
Trouvé en m'y appuyant sans le vouloir. J'ai commis `conversionDette.ts` — un
module complet, éprouvé, et que RIEN n'utilise encore, l'écran restant à
écrire — et `codeMort.test.ts` est resté vert.

La raison est dans sa construction : il écarte les fichiers de test de la liste
des CANDIDATS (un test n'a pas à être importé), mais pas de la liste des
LECTEURS. Un module importé par son seul fichier de test compte donc comme lu.

**C'est l'angle mort exact de ce garde**, et il est plus gênant que la moyenne
parce que celui-ci est de ceux qui font SUPPRIMER du code sur la foi de ce
qu'ils lisent : il attrape le fichier que plus personne n'appelle, sauf quand
le dernier appelant est le test écrit pour lui — c'est-à-dire précisément le
cas d'un module qu'on a écrit puis abandonné.

**Ce n'est PAS corrigé, et la raison est écrite plutôt que tue.** Le resserrer
demande de décider ce qu'on fait des modules légitimement éprouvés seuls, et il
y en a — un module peut naître avec ses tests une nuit et recevoir son écran la
suivante, ce qui est exactement ce qui vient de se produire. Le refuser
mécaniquement obligerait à commettre le composant à moitié pour satisfaire un
garde, ce qui est pire que le défaut qu'il attrape. Ce qui manque n'est pas la
détection mais une TOLÉRANCE datée, et ça ne se décide pas en huit minutes.

En attendant : un module commis sans lecteur reste sur la branche, jamais
fusionné sur `main`. C'est ce qui a été fait ici.

### Le jeu que je venais d'ajouter était invisible à l'application, et je l'ai trouvé en cherchant autre chose
Troisième divergence de la même famille en une heure, et celle-ci est la
meilleure démonstration du problème : **c'est moi qui venais de la créer.**

Overwatch est entré au catalogue en V402 — page de calculateur, plan du site,
bande de l'accueil, tout se déduit automatiquement. La table des processus de
l'application de bureau, elle, ne se déduit de rien : elle vit dans
`desktop/src/jeuxProcessus.js`, et la coquille Electron se construit sans le
paquet du site, donc elle ne peut pas importer le catalogue.

**Il a donc manqué quarante minutes sans qu'aucun contrôle ne le dise.** Le
symptôme aurait été l'ABSENCE : le jeu figure partout sur le site, on le
choisit, et l'application ne le voit jamais démarrer. Pas de pastille, pas de
session, pas d'enregistrement automatique. C'est le pire genre de défaut —
celui qui n'a aucun signe sauf que rien ne se passe.

`src/jeuxDetectables.test.ts` compare les deux, comme le test qui compare
depuis longtemps les six langues du site à celles recopiées dans
`desktop/src/langue.js`. C'est le motif à retenir : **ce qui ne peut pas
s'importer se compare.** Deux sabotages, deux échecs.

Il tient aussi l'autre sens — un processus surveillé pour un jeu retiré du
catalogue ouvre une session sur un nom que le site refusera, et c'est du code
mort dans un fichier qu'on n'ouvre presque jamais.

**Ce que le recensement des listes a rendu en tout, ce jour-là** : les jeux de
la bande (V402), les sept rôles (V404), les processus de détection (celle-ci).
Rien du côté des exercices — `src/lib/exercices.ts` est seul, et les
identifiants isolés trouvés ailleurs sont des valeurs par défaut ou des clés de
graphique, pas des listes. Les six langues restent le seul doublon VOULU du
projet, et il porte déjà son test.

Application de bureau en **0.9.15**.

### Les sept rôles étaient écrits trois fois, et l'écran pouvait proposer ce que le serveur refuse
Recensement lancé dans la foulée de la bande de jeux : d'autres listes écrites
deux fois. Il en rend une, et elle est plus dangereuse que la première.

Les sept rôles — Top, Jungle, Mid, ADC, Support, ARAM, Arena — vivaient à la
main dans le formulaire d'ajout, dans le simulateur de dette et dans le filtre
de l'historique, en plus du barème qui les sème dans `RoleWeight`.

**Les quatre coïncidaient**, ce qui est le cas normal : une duplication ne se
remarque jamais tant qu'elle n'a pas divergé, et c'est exactement ce qui la
rend chère.

**Ce que la divergence coûterait.** `/api/games` rend « Rôle inconnu » quand le
rôle envoyé n'a pas de ligne au barème — c'est une correction déjà faite ici,
le jour où « MID » ne trouvait pas « Mid ». Un écran qui proposerait un rôle
absent ferait donc refuser une saisie parfaitement conforme à ce qu'il venait
de demander, et le message accuserait la personne. C'est le défaut du champion
refusé, une table plus loin.

`ROLES` se déduit maintenant de `ROLES_DEFAUT`, et les trois écrans le lisent.
La LISTE appartient au barème ; les POIDS restent réglables par le panneau
d'administration, qui ne touche pas à la première. « Tous », dans le filtre,
n'est pas un rôle mais l'absence de filtre : il est préfixé à l'affichage et
n'a rien à faire au barème.

**Le garde ne peut pas se contenter de l'import**, parce qu'un composant qui
réécrirait les sept noms compilerait parfaitement. Il cherche donc DEUX rôles
VOISINS entre guillemets — la forme qu'une liste réécrite prend forcément, et
ce qui la distingue d'un nom mentionné seul, comme la valeur par défaut
mémorisée du formulaire. Il exige en plus que les trois écrans lisent
vraiment la source : le premier contrôle est un refus, pas une exigence, et
retirer la liste sans la remplacer y passerait.

Trois sabotages, trois échecs — dont le barème vidé, qui doit faire tomber le
témoin plutôt que de rendre les comparaisons vertes sur des listes vides.

**Ce que le recensement n'a PAS trouvé, et qui vaut d'être dit** : les six
langues sont bien écrites deux fois — dans `src/lib/i18n/` et dans
`desktop/src/langue.js` — mais c'est le seul cas VOULU du projet, la coquille
Electron étant construite sans le paquet du site, et un test compare déjà les
deux. Les exercices, eux, n'ont qu'une liste.

### La partie refusée levait son propre silence
Signalé par le propriétaire, en une phrase : « je viens de mettre non à la
question de démarrer une session ou pas et j'ai quand même la pastille ».

Le silence existe depuis 0.9.12 et il est testé. Ce qui manquait est l'ORDRE.
Pour League, la séquence réelle est :

1. écran de chargement — le lanceur publie `GameStart`, la page pose la
   question, on répond **non** : `muet = true`, la pastille se retire ;
2. la partie démarre pour de bon — l'API de partie répond, `game-started`
   arrive, `definirEnPartie(true)` posait `muet = false` et la pastille
   revenait.

**Le commentaire disait « une partie qui commence lève le silence de la
PRÉCÉDENTE ».** C'est faux ici, et c'est toute la faute : la question se pose
AVANT que la partie commence, donc la partie qui démarre ensuite est celle-là
même qu'on vient de refuser. Elle levait son propre silence, quelques secondes
après le clic.

Le silence se lève maintenant à la question SUIVANTE, ce qui est exactement ce
qui avait été demandé — « caché jusqu'au prochain écran de chargement ». La
question EST cet écran ; c'est le seul événement qui le désigne sans ambiguïté.

**Et un trou refermé au passage, qui n'existait pas avant cette correction.**
Le silence ne se levant plus qu'à la question, quelqu'un qui passerait ensuite
son réglage sur « lance sans demander » n'aurait plus jamais de question, donc
plus jamais rien pour le lever : sa pastille resterait éteinte pour toujours,
sans que rien ne le lui dise. `leverSilence()` est donc appelée quand le JEU se
ferme — la fin d'une soirée, où il n'y a rien à afficher de toute façon.

**Ce chemin de détection, en revanche, ne va PAS être atteint par un jeu
détecté par ses processus seuls** : là, la pastille paraît d'abord et la
question suit, donc le refus était déjà respecté. Le défaut ne touchait que
League, c'est-à-dire le seul jeu qui publie son écran de chargement — et le
seul auquel joue celui qui l'a signalé.

**Le test qui tombe est celui qui défendait le défaut.** Il s'appelait « la
partie suivante la ramène » et exigeait le relèvement qu'on vient de retirer.
C'est la forme la plus coûteuse d'un mauvais test, déjà rencontrée sur
l'en-tête de cache des ratios : il ne se contente pas de ne rien attraper, il
fait échouer la correction.

**Et mon test de remplacement ne prouvait rien**, ce que seul le sabotage a
dit. Il regardait la visibilité juste après `poserQuestion` — or celle-ci
affiche par un geste EXPLICITE, qui passe outre le silence de toute façon. La
fenêtre était donc visible dans les deux cas. Il repart maintenant d'une
fenêtre cachée et demande un affichage AUTOMATIQUE, le seul que le silence
arrête.

**Ce qui n'est éprouvé par aucun test, et qui est écrit plutôt que tu** :
l'appel à `leverSilence()` depuis `main.js`. Ce fichier ne se charge pas dans
les tests — c'est la limite connue de la coquille — donc le contrôle porte sur
la fonction, pas sur son branchement.

Application de bureau en **0.9.14**. Le pont ne gagne aucune méthode : la
correction est entièrement dans la coquille, donc il n'y a pas de repli à
prévoir devant une copie plus ancienne. Ce qu'une copie ancienne garde, c'est
le défaut.

### Overwatch au catalogue, et la seconde liste de jeux qui avait déjà divergé
Ligne 179 du plan, réponse « Overwatch » à « quel jeu manque le plus ? ». Une
demi-nuit annoncée, et l'ajout lui-même tient en une ligne : il se juge comme
Valorant, une victoire ou une défaite et un score éliminations / morts /
assistances.

**Deux choses qu'il a et qu'on ne lui donne PAS, avec leur raison écrite dans
le catalogue.** `roles` désigne les lanes d'un MOBA, et `RoleWeight` ne
contient que celles de League : l'activer proposerait « Jungle » à quelqu'un
qui joue tank, et pondérerait ses morts avec un poids qui ne le concerne pas.
`champions` fait valider la saisie contre la liste de `champions.ts`, qui est
celle de League : Tracer y serait refusée comme un champion inconnu et le
bouton d'enregistrement resterait éteint — le défaut déjà corrigé sur
`useChampions`, mais permanent cette fois. Les deux se branchent le jour où le
barème saura distinguer les trois rôles d'Overwatch ; les livrer à moitié
rendrait le jeu inutilisable au lieu d'incomplet.

**Ce que l'ajout a mis au jour vaut plus que l'ajout.** `BandeJeux.tsx` — la
bande de pastilles de la page d'accueil — portait sa PROPRE liste de jeux,
écrite à la main, sous le même nom `JEUX`. Elle annonçait « les jeux pris en
charge » et en montrait **treize sur quinze** : « Call of Duty » et « Les Sims »
manquaient depuis on ne sait quand.

Rien ne pouvait le signaler. Une bande de treize pastilles ressemble beaucoup à
une bande de quinze, TypeScript ne se plaint pas d'une liste plus courte qu'une
autre, et c'est la page que personne ne relit ligne à ligne. C'est le motif que
ce projet paie en boucle, et il ne prend jamais la forme d'une copie qu'on
remarque : il prend celle d'une correction qui n'en répare qu'une moitié.

**Et cette table-là ne peut PAS se déduire du catalogue**, ce qui est
précisément pourquoi elle existait. L'abréviation, la teinte et le genre n'y
sont pas, et n'ont rien à y faire : le catalogue décide de ce qu'une partie
COÛTE, pas de ce à quoi elle ressemble. Ce qu'on peut faire est de cesser d'en
refaire la LISTE — le catalogue donne les jeux et leur ordre, la table les
habille, et `src/bandeJeux.test.ts` refuse qu'un jeu arrive sans parure.

Il tient aussi l'autre sens (une parure qui ne désigne plus rien est du code
mort que la bande saute en silence) et l'unicité des codes de fichier : deux
jeux qui partagent un code partagent leur logo, et le symptôme — le mauvais
logo sur une pastille — ne ressemble pas à sa cause.

**Le prix d'un jeu ajouté, mesuré plutôt que supposé** : six pages de
calculateur de plus, prérendues, et quarante-huit lignes au plan du site
(six langues, chacune avec ses six alternatives et son `x-default`).
`/fr/calculateur/overwatch` rend « Combien de pompes pour une défaite sur
Overwatch ? », `/de/…` répond 200, et une adresse inventée rend toujours 404.
Aucune traduction à écrire : le titre est un gabarit qui prend le nom du jeu,
et c'est ce qui rend l'ajout d'un jeu bon marché.

Trois sabotages sur le garde, trois échecs — dont le jeu ajouté au catalogue
sans parure, qui est le cas exact qui vient de se produire.

### Un drapeau posé avant l'adresse devenait l'adresse, et le rapport avait l'air d'un rapport
Retombé dedans pour la deuxième fois, la seconde après l'avoir écrit ici.
`node scripts/accessibilite.mjs --langue=fr http://…` rend **quinze pages
« injoignables »** puis une pile d'appels sur une URL invalide. La cause tient
en un rang : `BASE` se lisait `process.argv[2]`, donc le drapeau devenait
l'adresse.

**Ce n'était pas un défaut d'un script, c'était une divergence entre quatre.**
Trois prenaient la langue par `--langue=xx` et un la prenait NUE, en troisième
position ; trois lisaient en plus leur adresse par le rang. C'est le motif que
ce projet paie en boucle — une règle écrite en plusieurs exemplaires finit par
avoir une version en retard, et c'est celle qu'on emploie le moins souvent qui
la garde.

**Et le contrôle d'atterrissage NE PEUT PAS voir ce défaut.** Il compare le
chemin d'arrivée au chemin transformé, c'est-à-dire à lui-même : c'est déjà
écrit ici pour `/fr/fr/dashboard`, mesuré à d'excellents chiffres sur « Cette
adresse ne mène nulle part ». Il faut donc l'empêcher à l'écriture, pas le
détecter à l'exécution.

`positionnels(argv)` rejoint `langueDemandee` et `enLangue` dans
`scripts/langue.mjs` : le rang se compte sur ce qui n'est pas un drapeau, et
l'ordre des arguments cesse d'être une source d'erreur. Les quatre outils
prennent maintenant le MÊME drapeau, où l'on veut.

`src/scriptsMesure.test.ts` tient les deux règles, avec le témoin habituel — un
dossier renommé rendrait les contrôles verts en n'ouvrant aucun fichier — et la
seule dispense est `langue.mjs`, qui PORTE la règle. Trois sabotages, trois
échecs.

**Ce que la campagne a dit une fois l'outil réparé.** Le tableau de bord vient
de recevoir une section au milieu de son panneau de paliers, et le journal dit
depuis le mur des records que toute section ajoutée au milieu se paie en temps
d'affichage. Mesurée sur un compte à soixante parties et quatre cent quatre-vingts
points payés : **LCP 228 ms sur poste, 1144 ms sur téléphone bridé, CLS 0,000**
— c'est-à-dire exactement les chiffres d'avant. Le plus grand élément reste le
bandeau d'attente Riot, ce qui confirme que la section ajoutée n'entre pas dans
la course.

**Accessibilité : 0 constat sur 90 passes** — quinze pages, six langues, et
**aucune page laissée de côté** ; c'est le second chiffre qui compte, et c'est
lui que le drapeau cassé rendait faux. La ligne du niveau de souffrance est en
rouge (`--loss`) avec une opacité de 0,8 sur son second chiffre, ce qui est
précisément le genre de choix qui casse un contraste sans qu'on le voie.

### Un mot juste devenu faux, et le niveau qu'il a fallu couper en deux
Signalé par le propriétaire, en deux messages qui disent la même chose sous
deux angles : « comment ça se fait que j'ai plus de 900pt d'activité et que je
suis que niveau 5 », puis « attend mais quand tu dis activité ce n'est pas le
nombre de pompe et de boxe ect ?! ».

**Rien n'était cassé, et c'est ce qui rend le cas instructif.** Le mot
« activité » désignait une PARTIE dans tout le produit — c'est ainsi qu'il avait
été écrit, et c'était exact le jour où il l'a été. Le chiffre qu'il regardait
sur son tableau de bord, lui, était de la DETTE, exprimée en pompes. Deux
unités, un seul mot, et un compteur qui semblait ne pas suivre. Il a lu son
propre écran de travers pendant des semaines, et aucun test ne pouvait le voir :
tous les chiffres étaient justes.

Deux corrections, et la seconde est de sa main.

**« Activité » devient « partie », partout où le mot désigne une partie.**
Onze clés dans six dictionnaires. Ce qui n'a PAS bougé : `cgu.ts` et
`confidentialite.ts`, où « activité physique » veut dire l'exercice — le même
mot, l'autre sens, et le renommer là aurait fabriqué le malentendu inverse.

**Un second niveau, qui compte ce qu'il croyait compter.** Le niveau de COMPTE
répond à « depuis combien de temps tu es là » : dix d'XP par partie, un par
point payé. Le niveau de SOUFFRANCE répond à « qu'est-ce que tu as vraiment
fait » : l'effort PAYÉ, et lui seul. `50 × n × (n−1)` points — cent pompes pour
le niveau 2, mille pour le 5.

Les deux se recouvrent sur l'effort payé, et c'est assumé : ce qui les sépare
est qu'un compte qui joue sans jamais payer monte sur le premier et reste au
plancher sur le second. C'est exactement la distinction demandée.

**Rien n'est stocké**, comme pour le niveau de compte : le chiffre se recalcule
depuis les paiements à chaque lecture, donc il ne peut pas diverger de ce qui le
produit.

**Le piège du niveau de compte se rejoue ici, en pire.** Il avait coûté une nuit
en juillet : le module annonçait « l'effort PAYÉ » et la route lui passait
l'effort GÉNÉRÉ, les deux chiffres portant le même nom. Ici les deux niveaux
vivent CÔTE À CÔTE dans la même réponse, ce qui rend la confusion plus facile,
pas moins. Sabotage fait — `source.totalPoints` à la place de
`sourceNiveau.pointsPayes` : **aucun test unitaire ne tombe**, exactement comme
la première fois. Le contrôle qui manquait est celui de la route, sur le double
qui rend 9 000 générés contre 120 payés : niveau 13 contre niveau 2, onze
paliers d'écart qu'aucun arrondi ne confond.

**Une garde a été écrite, sabotée, et retirée.** J'avais posé
`if (!Number.isFinite(points) || points <= 0) return 1;` en tête de
`souffrancePourPoints`. La retirer ne fait tomber aucun test, et la raison est
arithmétique : zéro donne `n = 1`, un négatif donne `NaN` par la racine,
l'infini donne `Infinity`, et les trois retombent sur 1 par la condition
FINALE — qui, elle, mord quand on la sabote. C'est le troisième cas de ce motif
au journal, après le `muet = false` de la pastille et les deux boucles de
comparaison du niveau de compte : **une ligne qu'on peut retirer sans qu'un test
tombe ne tient rien, et elle se relit comme une garantie.**

**Et le parcours ne regardait que l'API, ce qui laissait le trou qui compte.**
Le composant déclare `souffrance?:` — optionnel, comme les deux champs voisins —
donc un champ renommé côté route ne fait échouer ni la compilation ni une
lecture d'API : la section disparaît du panneau, sans erreur et sans test rouge.
C'est le défaut déjà écrit sous « un champ renommé vidait un panneau entier », et
`contratJson.test.ts` ne l'attrape pas ici : il garde les champs de PREMIER
niveau des routes fusionnées, et celui-ci vit sous `badges`, déclaré `unknown`.
Le parcours recharge donc la page et lit la ligne à l'écran.

Sept sabotages. Deux passés au vert — la garde morte, et la source du niveau —
et ce sont les deux qui ont appris quelque chose. Un n'a pas compilé plutôt que
de faire tomber un test (`false && etat.souffrance` fait perdre à TypeScript la
restriction de `etat`) : réécrit en `niveau > 9999`, il fait tomber le parcours.

**Ce que ça apprend au-delà du cas**, et c'est la troisième fois cette semaine :
le défaut n'a été trouvé ni par un test, ni par un audit, ni par une relecture,
mais par le propriétaire du produit qui REGARDE son écran. Les tests éprouvent
ce que le code fait ; ils ne disent rien de ce que les mots veulent dire pour
celui qui les lit. Un mot juste le jour où on l'écrit devient faux quand le
produit bouge sous lui, et rien ne le signale jamais.

### Le panneau des ratios pouvait écraser la configuration par les valeurs d'origine
Trouvé en recensant les `catch` silencieux des fichiers touchés cette semaine.
La règle du projet est écrite depuis longtemps : une lecture au montage qui
retombe sur une valeur par défaut SAINE est l'usage légitime du silence. Ici la
valeur par défaut n'est pas saine, elle est **fausse et crédible**.

`AdminRatiosExercices` part sur `RATIOS_DEFAUT`, ce qu'il faut bien afficher le
temps de la requête. Une lecture qui échouait laissait ces valeurs à l'écran
**comme si c'était la configuration du site** — et un seul clic sur
« Enregistrer » écrivait les valeurs d'origine par-dessus les vrais ratios.

Ce n'est pas un panneau parmi d'autres : il règle une conversion GLOBALE. Ce
que doit tout le monde s'exprimerait d'un coup dans une autre unité, sans que
personne l'ait demandé, et le seul indice serait un chiffre qui a changé. Le
journal porte déjà une entrée entière sur le jour où un ratio a semblé réécrire
tout l'historique.

**On n'écrit donc pas une valeur qu'on n'a pas lue.** Les deux boutons sont
inertes tant que la lecture n'a pas abouti, et l'échec se dit avec `role`
plutôt que de paraître sous deux boutons devenus muets — c'est le défaut déjà
corrigé sur le signalement et sur la mise de côté d'un exercice.

**Le second panneau global avait la même famille de défaut, en plus bénin.**
`AdminChampionEditor` n'avait AUCUN `catch` : une lecture qui échoue laissait
« Chargement… » pour toujours, et la promesse partait en rejet non rattrapé.
L'éditeur restait inerte, ce qui est le bon comportement — la liste des
champions sert à VALIDER une saisie, et une liste vide enregistrée par mégarde
ferait refuser tous les champions du jeu. Mais rien ne le disait : on attendait
devant un panneau qui ne chargerait plus jamais. Le verrou reste, la phrase
s'ajoute.

**`AdminSeuilDette` a le même motif et se garde tel quel**, avec sa raison :
c'est un outil de TEST qui force le compteur du compte administrateur
lui-même. Une lecture ratée y laisse cinq minutes dans les champs, et
enregistrer écrit cinq minutes sur sa propre dette. C'est le geste que l'outil
existe pour faire.

**Le parcours REND l'adresse administrateur** à qui la portait, au lieu de la
laisser sur un compte jetable. `bareme-gele.spec.ts` la reprend lui-même au
début, donc la suite tient sans ça — mais sur une base locale qu'on ne
remonte pas entre deux exécutions, le vrai administrateur se retrouvait sans
son panneau, et le symptôme ne ressemble pas à sa cause.

Le parcours coupe la LECTURE et laisse l'écriture ouverte : c'est ce qui le
rend discriminant, puisqu'un panneau qui laisserait partir la requête changerait
vraiment la configuration. Il regarde l'écran ET la base — sans le second
contrôle, un écran qui se contente d'afficher un message passerait. Sabotage :
l'échec de lecture traité comme une lecture réussie, le parcours tombe.

### Le produit tutoie, sauf quand il a une raison de vouvoyer — et la règle a dérivé
Recensement fait en lisant les écrans : **174 « vous » contre 233 « tu »** dans
les blocs français des dictionnaires. Le chiffre brut ne dit rien de faux — la
plupart de ces vouvoiements sont légitimes — mais il cachait une quinzaine de
lignes qui vouvoyaient au milieu d'écrans qui tutoient partout.

L'écran des réglages disait « Toutes VOS données » sous un titre « TES
DONNÉES ». Le panneau des paliers disait « Ce que VOUS avez déjà fait » au
milieu d'un tableau de bord qui tutoie de bout en bout. Les sept étapes des
premiers pas — ce qu'un compte neuf lit en premier — vouvoyaient entièrement.

Ce n'est pas une préférence de style. Le seul retour d'acquisition qu'on ait
jamais eu portait sur la VOIX du produit — « ça fait trop IA » — et un texte
qui change de registre d'un panneau à l'autre est précisément ce qui donne
cette impression. C'est la même famille que les tirets cadratins, déjà chassés
pour la même raison.

**Trois familles vouvoient, chacune pour sa raison**, et c'est la règle qui
manquait : le JURIDIQUE (CGU, confidentialité), la SANTÉ (consentement, mises
en garde de volume — la distance y est voulue), et les pages PUBLIQUES
d'acquisition, qui s'adressent à quelqu'un sans compte. Tout ce qui est derrière
la porte tutoie.

`src/lib/i18n/registre.test.ts` la tient, avec les deux contrôles habituels :
un témoin de non-vacuité — un dossier renommé rendrait le test vert en
n'examinant rien — et le refus d'une dispense qui ne désigne plus de fichier
existant.

**Le garde a mordu sur sa première exécution, et il avait raison.** Il a
signalé « ${pseudo} t'avait déjà demandé : **vous** êtes amis » — qui n'est pas
un vouvoiement mais un PLURIEL. Aucun motif ne peut distinguer les deux : c'est
une question de sens. La tolérance porte donc sur la CLÉ, avec sa raison
écrite, et non sur le fichier — posée sur le fichier, elle aurait couvert tout
l'écran des amis.

**L'allemand n'avait qu'un seul vrai vouvoiement**, et le recensement naïf en
annonçait sept : « Sie » y est aussi le pronom de la troisième personne, donc
« Sie zeigt », « Sie blockiert nichts » et « Sie ist nirgends aufgelistet » sont
tous des faux positifs. Un motif qui ne distingue pas les deux ferait corriger
de l'allemand parfaitement juste.

**Et un parcours a mordu sur le changement de texte**, ce qui est son travail :
`premier-ecran.spec.ts` cherchait le bouton « Enregistrer VOTRE première
partie ». Un libellé d'interface ne change pas en silence.

### Un réglage qui parlait encore de boxe alors qu'il gouverne toute la dette
Trouvé en lisant l'écran des réglages. Depuis V387 la dette monte pour TOUS les
exercices, les pompes comprises — et le seuil de rappel, qui compare `dureeSec`
à `seuilSec`, s'applique donc à tout le monde. Son titre disait encore
« Rappel du compteur de boxe », et son explication « la boxe s'accumule au fil
des parties ».

Quelqu'un qui fait des pompes — le cas par défaut, celui de presque tout le
monde — voyait donc un réglage nommé pour un exercice qu'il ne pratique pas,
et pouvait raisonnablement conclure qu'il ne le concernait pas. C'est
exactement la même famille que les deux « niveau » de tout à l'heure : un mot
juste le jour où il a été écrit, devenu faux quand le produit a bougé sous lui.

Le titre devient « Rappel de la dette » dans les six langues, et l'explication
parle d'un SEUIL plutôt que d'un temps — puisque pour un exercice compté en
répétitions, ce n'est plus une durée qu'on attend.

### Une troisième liste de pages publiques, sur la barre que tout le monde voit
Trouvé en continuant à lire les écrans, celui-ci sans compte du tout. Sur
`/telechargement`, sur les CGU et **sur les quinze pages du calculateur**, un
visiteur sans compte voyait « Dashboard · Historique · Amis · Ta saison ·
Réglages » — cinq liens qui le renvoient tous à un écran de connexion.

`Nav.tsx` portait sa PROPRE liste de chemins publics, `["/login", "/"]`, deux
entrées, quand `routesPubliques.ts` en compte dix. C'est le troisième
exemplaire de la même règle, et la divergence est celle que ce projet a déjà
payée : deux listes de chemins publics avaient laissé quatre routes partir en
307 vers `/login` pendant des semaines, et `routesPubliques.ts` est né de là.

**Le pire endroit possible.** Les pages du calculateur existent pour être
trouvées par une recherche — c'est le seul canal d'acquisition qui travaille
sans qu'on s'en occupe. Le défaut tombait donc exactement sur les gens qui
arrivent, et sur eux seuls : ceux qui ont un compte ne le voyaient jamais.

**La correction n'est pas de recopier la liste une troisième fois.** La barre
ne pose plus la question au CHEMIN : ce qui décide, c'est d'avoir une session,
et elle la connaît déjà — elle demande le compte pour savoir qui est
administrateur. Le chemin sert encore, mais seulement à éviter un
scintillement : derrière la porte, le middleware a déjà exigé une session, donc
les liens partent au premier rendu ; sur une page publique on ne sait pas
encore, et on ne promet rien avant de savoir.

**Le parcours tient les DEUX moitiés**, et la seconde porte autant que la
première : sans elle, retirer la barre partout satisferait le premier contrôle,
et quelqu'un de connecté perdrait sa navigation sur les CGU sans que rien ne le
dise. Deux sabotages, deux échecs, chacun sur son propre test.

**Et un piège de la méthode, à noter avant qu'il produise un faux positif.**
Lire un écran par `innerText` colle les éléments EN LIGNE sans espace : la
cellule de dette de l'historique se lit « 20pompes » alors qu'un
`margin-left: 5px` la sépare correctement à l'écran. Ce qu'on lit ainsi est le
texte, pas la mise en page — pour la seconde, il faut regarder les styles
calculés.

### Lire l'écran comme quelqu'un qui s'en sert, sur un compte à mille parties
Trois défauts en une lecture, sur un tableau de bord qui passait tous ses
contrôles. Aucun n'était visible en lisant le code, et aucun ne l'était sur un
compte de mesure ordinaire : il a fallu un compte à **neuf cent soixante
activités et trente jours payés**, c'est-à-dire celui du propriétaire.

- **« Objectif atteint · 960 sur 5 ».** L'objectif de première semaine n'était
  borné nulle part. Il dessinait une barre de **dix-neuf mille deux cents pour
  cent** — invisible, le conteneur la rogne — et donnait à un lecteur d'écran
  un `aria-valuenow` de 960 pour un `aria-valuemax` de 5, ce qui n'est pas un
  état valide. La borne vit dans le module, sous le nom `avancement`, et le
  compte réel reste dans `parties` : c'est le NOM qui empêche de reprendre le
  mauvais des deux, comme pour `pointsPayes` et `totalPoints`.
- **« 14 personnes y a contribué ce mois-ci ».** Le gabarit accordait le nom et
  pas le verbe. Même défaut en espagnol — « personas ha contribuido ». L'anglais
  et l'allemand étaient justes, le chinois et le japonais n'accordent pas.
- **Deux « niveaux » sur le même écran**, corrigé juste avant et trouvé de la
  même façon.

**Ce que ça dit de la méthode.** Les deux signalements du propriétaire, ce
matin, venaient tous deux de l'usage : un chiffre faux dans l'onglet social, un
niveau bloqué à 1. Aucun test ne les voyait, et pour cause — ils portent sur ce
qui est VRAI à l'écran, pas sur ce qui est présent dans le DOM. C'est la même
leçon que la capture d'écran de la veille, et elle mérite d'être une habitude :
après un chantier, ouvrir les écrans sur un compte à l'échelle d'un vrai
utilisateur et LIRE, phrase par phrase.

**Et une ambiguïté laissée aux questions plutôt que tranchée seule.** Le bilan
de saison affiche « journée la plus chère », qui somme l'effort GÉNÉRÉ par les
parties du jour ; le mur des records affiche le plus gros jour d'effort PAYÉ.
Les deux sont vrais, les deux sont utiles, et rien ne dit lequel est lequel —
sur un produit dont tout le reste du registre est en effort payé. Changer ce
que ça mesure ou renommer l'un des deux est un arbitrage de produit ; il part
dans les questions.

### Publier plus vite que la CI ne tourne annule ses exécutions
Constaté sur V393, V394 et V395 : les trois figurent en **« cancelled »**. Ce
n'est pas une panne, c'est `cancel-in-progress` qui fait ce pour quoi il
existe — une poussée qui en suit une autre de près annule la précédente, et une
exécution annulée n'envoie aucun courriel. La règle est écrite plus bas, dans
l'entrée sur les cinquante courriels d'échec.

Ce qu'elle implique n'y était pas : **seule la DERNIÈRE version d'une rafale
est réellement jugée.** Trois versions ont donc traversé `main` sans qu'aucun
parcours ne tourne en intégration continue sur leur arbre. Le risque est
contenu — chacune a eu ses tests unitaires et les parcours qui la couvrent en
local — mais ce n'est pas la même chose que la suite entière sur une machine
propre, et c'est précisément ce que la CI apporte.

La conséquence pratique est une cadence : quand on publie plusieurs fois de
suite, on attend que la dernière exécution ABOUTISSE avant de recommencer.
Une rafale de six versions en quarante minutes ne laisse jamais une seule
exécution finir, et le tableau se remplit de gris qu'on lit comme du vert.

### Ce qui pèse dans la plus grosse réponse, et deux choses qu'on ne fait pas
Le journal portait « `/api/games` : 35 634 octets avant, **24 834** après » le
resserrement des colonnes. Ce chiffre a vieilli : la même mesure, sur les mêmes
soixante parties, rend aujourd'hui **32 094 octets**. Un nombre écrit une fois
au-dessus de quelque chose qui bouge — c'est le défaut que ce projet trouve le
plus souvent, et il valait mieux le remesurer que le laisser.

La croissance s'explique entièrement, et elle est voulue : trois colonnes se
sont ajoutées depuis, dont `ratios`, le barème gelé sur chaque partie. Pesé
champ par champ :

| champ | octets | part |
|---|---|---|
| `ratios` | 6 180 | 19,3 % |
| `date` | 2 040 | 6,4 % |
| `id` | 1 980 | 6,2 % |
| `jeu` | 1 560 | 4,9 % |

**Un cinquième de la réponse est le même objet de deux nombres, recopié
soixante fois.** L'historique le lit ligne par ligne — c'est ce qui empêche un
changement de barème de réécrire le passé, et cette décision-là ne se rouvre
pas. Ce qu'on pourrait faire est de n'envoyer que les barèmes DISTINCTS avec un
renvoi par ligne ; ce serait six kilo-octets sur trente-deux, contre une
indirection dans la réponse et un composant qui doit la suivre. **Laissé en
l'état**, comme les trente-six exports trop larges : le gain ne justifie pas la
retouche, et la mention vaut mieux qu'une optimisation qu'on regrette.

**Et la comparaison de rendu entre V387 et la tête n'a PAS pu se faire.** Un
arbre de travail git à V387 avec `node_modules` en lien symbolique est refusé
par Turbopack — « Symlink [project]/node_modules is invalid, it points out of
the filesystem root ». C'est la troisième fois que Turbopack refuse une
construction pour une raison de CHEMIN et non de code ; les deux premières sont
plus haut. Installer un second jeu de dépendances pour capturer huit pages ne
vaut pas le coup, et le dire est plus honnête que de laisser croire que la
comparaison a été faite. Ce qui couvre le même terrain, et qui a été fait : les
quinze pages en six langues de l'audit d'accessibilité, et les cinq écrans
connectés mesurés un par un.

### Deux « niveaux » sur le même écran, et un seul qui dit lequel
Trouvé en éprouvant l'XP à l'échelle du propriétaire : un compte de neuf cent
soixante activités, pour voir si la courbe et l'affichage tiennent à mille
alors qu'ils sont calés sur des repères de dix à cent. **Ils tiennent** —
niveau 14, 9 900 XP, 600 restants, barre à 57 %, et aucun débordement à 320 px
en français, en allemand ni en japonais.

Ce qui ne tenait pas est ailleurs. Le tableau de bord affiche maintenant
« Niveau 14 » dans les paliers, et, deux panneaux plus haut, le test de force
dit « tant qu'il manque, tu restes au niveau 1 ». Les deux sont vrais et
parlent de deux choses différentes : le niveau de FORCE fixe le multiplicateur
de dette, le niveau de COMPTE compte l'XP. Le plan les sépare depuis la
ligne 148 — « un niveau de compte, séparé du niveau de force » — mais rien à
l'écran ne le disait, et la contradiction saute aux yeux.

C'est la PHRASE du test de force qui est qualifiée, pas l'étiquette du niveau
de compte : elle vit dans un panneau qui l'explique déjà en prose, donc elle
peut porter le mot sans risque de mise en page, là où « Niveau de compte 14 »
allongerait la ligne la plus visible de l'écran dans six langues. Les autres
phrases du même panneau n'ont pas bougé : « niveau 3, dette ×1,2 » se
comprend par le multiplicateur qui la suit.

**Le défaut n'existait pas avant hier**, et c'est ce qui le rend intéressant :
il n'a pas été introduit par une erreur mais par une fonctionnalité qui rend
visible un chiffre qui ne l'était pas. Un mot juste devient ambigu quand un
autre écran se met à employer le même.

### Une régression de deux fois, mesurée une seule fois, qui n'existait pas
Deuxième fois dans la même journée, et cette fois j'étais allé jusqu'à écrire
le code.

`/api/progression` écrit une ligne `DefiAccompli` quand elle CONSTATE qu'un
défi est rempli. `skipDuplicates` rend l'écriture sans effet dès le second
passage — mais elle repart quand même, à chaque chargement d'un écran
connecté, pour tout le reste du mois dès qu'un défi mensuel est rempli.
Mesuré : **62 requêtes par seconde** sur un compte dont le défi du mois est
rempli, contre **125** sur un compte neuf. Deux fois moins, sur la route que
toute page appelle.

La correction s'écrivait toute seule : lire dans le même `Promise.all` ce qui
est déjà retenu pour les deux périodes en cours, et ne plus écrire que ce qui
manque. Une lecture bornée en parallèle contre une écriture par page. Écrite,
testée, mesurée : **104 req/s**.

**Puis j'ai remesuré l'état d'AVANT trois fois, et il rend 112, 128 et
131 req/s.** L'écriture ne coûte rien. Les 62 étaient du bruit — une mesure
prise pendant qu'autre chose tournait sur une machine à quatre cœurs. La
correction elle-même donne 93, 104 et 134 : le même nuage.

**Le code est donc revenu en arrière**, tests compris. Il n'y avait pas de
défaut, et garder une lecture de plus au motif qu'elle « ne peut pas faire de
mal » revient à laisser dans le produit une ligne que rien ne justifie — c'est
le défaut déjà écrit ici pour le module de stockage et pour la forme fermée du
niveau : une ligne qu'on peut retirer sans qu'un test tombe ne tient rien, et
elle se relit comme une garantie.

**Ce qu'il faut retenir tient en une phrase, et le journal la répétait déjà
pour les temps d'affichage : une mesure unique n'est pas une mesure.** Le
1636 ms de `/fr/amis`, ce matin, était le même défaut sous une autre forme —
et là aussi il ressemblait beaucoup à une régression connue, ce qui est
précisément ce qui rend le piège efficace. La règle pratique est de mesurer
l'état d'AVANT autant de fois que l'état d'après, et de le faire avant
d'écrire la correction plutôt qu'après.

### Dépendances au 4 septembre, et deux mesures corrigées
`npm audit` rend **les deux mêmes vulnérabilités qu'hier**, toutes deux dans
`mysql2` et toutes deux inatteignables : ce projet parle à PostgreSQL, le
paquet n'arrive que par l'outillage en ligne de commande de Prisma, et le seul
« correctif » proposé reste un retour de version majeure sur le client d'accès
aux données. `src/dependanceMysql.test.ts` garde le raisonnement plutôt que la
conclusion, et rien n'a bougé de ce qui le soutient.

Deux mises à jour prises, toutes deux mineures ou correctives :
`lucide-react` 1.40 → 1.41 et, côté bureau, `electron` 43.5.1 → 43.6.0. Les
majeures écartées le restent — `typescript` 7, `eslint` 10, `@types/node` 26,
`prisma` 8 en version candidate, `@libsql/client` 0.18, `electron` 44 — et
`next-auth` s'affiche « en retard » sur 4.24.15, ce qui est faux à chaque
audit : c'est l'ancienne branche stable, le projet est sur la 5 en préversion.

**L'application de bureau passe donc en 0.9.13**, pour la règle du
propriétaire : dès qu'une modification touche `desktop/`, on publie. Rien de ce
qui s'installe ne change de comportement ; le pont est identique, et les copies
installées se mettront à jour toutes seules.

**Et un chiffre de la campagne était faux, corrigé plutôt que laissé.** J'avais
relevé `/fr/amis` à **1636 ms** sur téléphone bridé, avec le paragraphe du
parrainage comme plus grand élément — ce qui ressemblait beaucoup à la
régression de réconciliation déjà rencontrée deux fois sur cet écran. Remesuré
**quatre fois** sur un compte neuf, puis sur le même compte une fois la dette
posée : **1092 à 1140 ms**, le paragraphe du classement, c'est-à-dire
exactement les 1116 ms du relevé de la veille. La valeur haute ne s'est pas
reproduite une seule fois.

Ce qui reste vrai : la mesure d'origine tournait pendant qu'un audit de
dépendances et une suite navigateur se partageaient la machine, et ce journal
écrit depuis longtemps qu'on ne mesure pas pendant qu'on construit. Un chiffre
relevé sur une machine chargée ne se publie pas ; il se remesure au calme, et
c'est le second chiffre qui compte.

### Une récompense qu'on ne voit pas n'en est pas une
Suite immédiate de l'XP des défis. Le nombre monte, la table le retient, le
niveau en tient compte — et **rien à l'écran ne relie ce mouvement au défi
qu'on vient de finir.** Un compteur qui grandit tout seul n'est pas une
récompense : c'est un chiffre qui bouge.

Chaque barre porte donc ce qu'elle vaut, à côté de ce qu'elle demande —
« +50 XP » sur le défi du jour, « +300 XP » sur ceux du mois — et le chiffre
passe au vert quand c'est fait. Il sert aussi de raison de COMMENCER, ce qui
est la moitié du travail d'un défi : on ne se met pas à une tâche dont on ne
sait pas ce qu'elle rapporte.

**Les deux valeurs viennent du module qui les accorde**, jamais d'un chiffre
écrit dans le composant. Une récompense annoncée qui diffère de celle qu'on
reçoit est pire que pas d'annonce du tout, et c'est le genre d'écart qui ne se
voit qu'après coup, sur le compte de quelqu'un.

**`+50 XP` ne passe PAS par `Intl`, et la raison est écrite dans le
dictionnaire.** Cinquante et trois cents s'écrivent pareil dans les six
langues ; un séparateur de milliers ne s'y pose jamais. Le jour où un défi
vaudra 1 500, c'est le gabarit qu'il faudra formater — pas le composant, où la
règle se perdrait.

**Le sabotage n'a pas compilé au premier essai**, et c'est noté comme tel
plutôt que compté comme un test qui mord : retirer l'appel rend le paramètre
inutilisé, et `noUnusedLocals` le nomme. Réécrit pour compiler — la valeur
reste lue, le texte devient vide — il fait tomber le parcours.

**Et une image de la même famille que l'icône cassée, trouvée en recensant.**
`PartageSeance` affiche l'image de séance sans dimensions : la fenêtre n'a
aucune hauteur à garder tant qu'elle n'est pas là, elle grandit d'un coup à son
arrivée, et comme la fenêtre est centrée, la phrase du dessus remonte sous les
yeux de quelqu'un en train de la lire. 1200 × 630 avec `height: auto` suffit —
le navigateur en déduit le rapport et garde la place avant d'avoir un pixel.
Les deux autres images du produit étaient déjà bornées : celle du bilan porte
ses dimensions, et les logos de jeux ont un `alt` VIDE, donc rien à faire
grandir quand ils manquent.

**Ce qui a été regardé et ne se fait PAS : la ligne 152 du plan** — « la
progression physique ET le volume ». Elle demande de montrer une progression
physique, or le produit ne garde qu'un `pompesMax` COURANT : il n'y a aucune
histoire à montrer. La construire est exactement ce que la réponse 153 — « une
courbe de force dans le temps » — remet à plus tard. La faire quand même
reviendrait à décider 153 par la bande. Ça part dans les questions.

### Une icône cassée faisait sauter l'historique, et seule la lenteur le montrait
Campagne passée après V387, sur un compte de mesure à neuf parties et une
dette — c'est-à-dire un compte qui ressemble enfin à celui de quelqu'un. Quatre
écrans sur cinq tiennent largement ; `/fr/history` rend **CLS 0,102** pour un
seuil de 0,1, trois fois de suite, à trois millièmes près.

**La sonde a nommé la cause du premier coup, et ce n'était pas ce que je
cherchais.** J'allais regarder du côté de la pastille de dette, qui paraît
désormais pour tout le monde depuis V387. Les deux gros déplacements sont
ailleurs : toutes les lignes du tableau grandissent de dix pixels, puis
rapetissent de dix pixels **douze millisecondes plus tard**, à la toute fin du
chargement.

**Une image cassée n'est pas une image vide.** Le navigateur y rend le texte de
remplacement, qui passe à la ligne dans trente-huit pixels de large et fait
grandir la ligne. React reprend la main quelques millisecondes après et pose le
repli — la lettre du champion dans un carré — donc la ligne redescend. Deux
déplacements successifs, l'un dans chaque sens, et aucune mutation du DOM entre
les deux : l'observateur de mutations n'a rien vu du tout, ce qui est
exactement ce qui a écarté les fausses pistes.

**Le CDN coupé net ne reproduit RIEN**, et c'est le contrôle qui a tranché :

| Data Dragon | CLS | déplacements |
|---|---|---|
| coupé tout de suite | 0,020 | le seul pied de page |
| lent (3 s) puis en échec | **0,102** | pied de page + lignes, dans les deux sens |
| lent, après correction | 0,020 | le seul pied de page |

Il faut donc des lignes ET une réponse LENTE. Un compte vide ne le montre
jamais, un CDN qui répond vite non plus, et un CDN qu'on coupe pour mesurer —
la parade écrite pour `comparer-rendu.mjs` — le masque complètement. C'est la
combinaison de quelqu'un sur un réseau moyen, c'est-à-dire le cas courant.

**La correction est de poser la boîte en STYLE et pas seulement en attributs**,
avec `overflow: hidden` : le texte de remplacement ne peut plus l'agrandir, et
la ligne garde sa hauteur dans les trois états de l'icône. **0,102 → 0,020**,
mesuré sur le même compte et la même construction.

**Le garde a d'abord passé au vert, et le chiffre qui le sauve est un DÉLAI.**
À une seconde et demie d'attente avant l'échec, le sabotage ne faisait rien
tomber : le navigateur n'a pas peint l'état cassé avant que React ne pose le
repli, donc il n'y avait rien à mesurer. À trois secondes et demie, le
déplacement des lignes vaut 0,034 sans la correction et **exactement zéro**
avec. Un test qui éprouve une course doit laisser à la course le temps d'avoir
lieu.

**Et il compte les LIGNES, pas la page.** Le pied de page se pose après le
premier rendu et déplace tout ce qui est sous lui : il vaut à lui seul 0,072
dans les conditions du parcours, donc plus que le seuil qu'on veut tenir. Le
mêler à la mesure noierait ce qu'on éprouve. Il est écarté par la source du
déplacement, pas par un seuil relevé — un seuil qu'on relève pour faire passer
un test ne garde plus rien.

**Les chiffres de clôture, sur un compte à neuf parties et une dette.**

| écran | LCP poste | LCP téléphone bridé | CLS |
|---|---|---|---|
| `/fr/settings` | 152 ms | 936 ms | 0,000 |
| `/fr/dashboard` | 268 ms | 1144 ms | 0,000 |
| `/fr/amis` | 240 ms | 1120 ms | 0,027 |
| `/fr/history` | 516 ms | 1124 ms | **0,020** |
| `/fr/bilan` | 272 ms | 2216 ms | 0,000 |

`/fr/bilan` reste le plus proche du seuil sur téléphone bridé, pour la raison
déjà écrite : son plus grand élément est l'image de saison, et 2216 ms est à
peu près l'instant où elle finit d'arriver.

**Accessibilité : 0 constat sur 90 passes**, quinze pages et six langues — mais
il a fallu réparer l'outil pour pouvoir l'écrire. La première exécution
annonçait **une page NON MESURÉE**, `/en/history`, « injoignable ». Mesuré
plutôt que supposé : cette page met **treize secondes et demie** à atteindre le
silence du réseau, parce que chacune de ses lignes demande son icône à un
domaine tiers — et une fois sur trois elle dépasse les trente secondes du
délai par défaut. Le tirage au sort décidait donc de quelle langue manquait à
l'audit.

C'est le piège de `networkidle` déjà écrit ici pour la suite navigateur —
« attendre un silence qui ne vient jamais » — jamais appliqué aux outils de
mesure. Les trois prennent une minute maintenant. **Couper le CDN, la parade de
`comparer-rendu.mjs`, aurait été une faute ici** : sans lui les icônes tombent
sur leur repli, qui est un carré de texte et non une image, donc l'audit
porterait sur une autre page que celle qui est servie.

Le contre-témoin est le compte : 90 passes relevées, et zéro page laissée de
côté. Un rapport qui annonce zéro sur des pages qu'il n'a pas ouvertes est
l'inverse d'un audit, et c'est le second chiffre qui le dit.

### L'XP des défis, et la seule chose du produit qui ne peut pas se recalculer
Réponse à la question 139 — « qu'est-ce qu'on gagne à finir un défi ? » — restée
« à voir » depuis l'écriture des défis, et tranchée par le propriétaire : de
l'XP, et rien d'autre, pour les défis **personnels**. Les défis PARTAGÉS restent
en suspens, il les a explicitement remis à plus tard, et rien n'est inventé à
leur place.

**Ça se STOCKE, alors que rien d'autre de la progression ne se stocke.** Les
paliers, le niveau et le titre se déduisent à tout instant de ce que la base
contient déjà, et c'est ce qui les empêche de diverger. Un défi fini ne peut pas
se déduire après coup : le tirage du jour est une fonction pure du jour, mais
savoir s'il a été REMPLI le 12 août demanderait les parties et les paiements de
ce jour-là, qu'on ne relit pas et qu'on ne relira jamais. C'est la deuxième
exception du produit, après `paiementEclairLe`, et pour la même raison — un
MOMENT ne se recalcule pas.

**Des LIGNES, jamais un total.** `DefiAccompli` porte le compte, la clé du défi,
la période et ce qu'il vaut ; l'XP se déduit par somme. Un total rangé en base
finirait par diverger de ce qui le produit, ce qui est exactement le défaut que
tout le reste de la progression évite en ne stockant rien.

**La PÉRIODE fait partie de l'identité de la ligne**, et c'est elle qui rend
l'écriture idempotente : un défi du jour se regagne un autre jour, un défi du
mois le mois suivant, aucun des deux deux fois dans la même période. L'unicité
est posée EN BASE (`@@unique([userId, cle, periode])`) et non dans le code : deux
chargements simultanés de la même page lisent tous deux « pas encore retenu »,
et c'est le raisonnement déjà tenu pour la date de début de dette.

**L'écriture passe en DERNIER, et son échec ne coûte que lui-même.** Un défi non
retenu se reretiendra au prochain chargement ; une route de progression qui tombe
en 500 vide le tableau de bord. C'est l'ordre déjà choisi pour le badge du
paiement éclair, et c'est un `try` et non un `.catch()`, qui ne rattraperait
qu'une promesse rejetée.

**Et une limite écrite plutôt que découverte** : la ligne s'écrit quand la route
CONSTATE que le défi est rempli, donc au prochain chargement d'un écran connecté.
Un défi rempli un jour où l'on n'ouvre jamais l'application n'est pas retenu. Le
rattraper demanderait de relire l'historique de chaque journée, ce qui coûte plus
que ça ne rapporte — et le cas est rare : on remplit un défi en jouant, et on
joue avec l'application ouverte.

**Le parcours navigateur éprouve ce qu'aucun test unitaire ne peut voir**, et il
tient à un décalage : le premier appel lit la somme d'XP AVANT d'écrire la ligne,
donc son chiffre ne porte pas encore les cinquante points ; le deuxième les
porte ; le troisième ne redonne rien. Trois lectures dont la seule différence est
un aller-retour par PostgreSQL — c'est-à-dire par l'index unique, qui est une
propriété de la migration et non du code.

**Le sabotage de cet index a laissé sa propre preuve.** Index supprimé, le
troisième chargement fait passer l'XP de 455 à 505 : le niveau monterait tout
seul tant qu'on laisse un onglet ouvert. Et l'index refusait ensuite de se
recréer — `Key ("userId", cle, periode)=(…, paye300, 2026-09-04) is duplicated` —
ce qui est la meilleure démonstration possible qu'il servait à quelque chose.

**Le défi du jour change tous les jours, donc le parcours ne peut pas s'écrire
contre un défi précis** : il passerait au vert cinq jours sur six en n'éprouvant
rien. Il lit le défi du jour et le remplit, quelle que soit sa mesure — parties,
victoires, jeux distincts, ou une dette qu'on fait monter puis qu'on solde.

**Deux sabotages n'ont pas compilé, et c'est noté comme tel** plutôt que compté
comme un test qui mord. `if (false && …)` fait perdre à TypeScript la
restriction de `user` posée plus haut ; `[] && …` est nommé « toujours vrai ».
Le sabotage qui compile est de passer des entrées vides à `defisAAcquitter` —
la route cesse alors de constater ce qui est rempli, et le parcours tombe sur
« aucune ligne DefiAccompli écrite ».

Sept sabotages unitaires, sept échecs. Deux au navigateur, deux échecs.

### Un parcours tombé une fois en CI, et ce qu'on en sait vraiment
V373 est **rouge**, en 7 min 42 — donc les parcours ont bien tourné, ce que la
durée dit avant la pastille. Un seul test est tombé, dans le premier tronçon :

```
e2e/detection-partie.spec.ts:208 › une partie que le serveur refuse le dit
  Expected pattern: /Rôle inconnu/
  Received string:  "Partie terminée | 1 pompes à faire."
```

Ce test DÉTOURNE `POST /api/games` pour rendre un 400. Le message reçu est
celui du succès : l'interception n'a pas pris, la vraie route a répondu, et la
partie s'est enregistrée. Ce n'est donc pas la route qui a changé de
comportement — c'est le détournement qui a manqué.

**Ce qu'on sait, et rien de plus :**

- V372, juste avant, est verte ; le fichier passe en local sur la tête, neuf
  sur neuf ;
- V373 ne touche ni `/api/games`, ni la détection, ni le barème : elle ajoute
  une colonne de réglage, un panneau et six traductions ;
- le service worker a été soupçonné — Playwright n'intercepte pas ce qui passe
  par lui — et **écarté** : `sw.js` ne répond que pour `mode === "navigate"`,
  donc un `POST` d'API le traverse sans qu'il s'en mêle.

**Le tronçon relancé passe.** Ce n'est pas « ça repasse donc c'est réglé » —
c'est le seul geste qui distingue un aléa d'une régression, et il fallait le
faire avant de conclure quoi que ce soit. Le même code, le même tronçon, le
même exécuteur : vert. La cause reste inconnue ; ce qui est établi, c'est
qu'elle n'est pas dans V373.

**Ce que la prochaine occurrence dira d'elle-même.** Le détournement se COMPTE
maintenant, et le contrôle porte sur le compteur AVANT le message. Sans lui, le
symptôme est « Partie terminée » à la place du refus — ce qui se lit comme « la
route ne dit plus son motif », et envoie chercher le défaut dans la route.
La vérité était que l'interception n'avait pas pris. Deux causes, un seul
symptôme ; le compteur les sépare. Éprouvé en retirant le détournement : le
test rend `"detourne": 0` au lieu du message.

**Et une conséquence d'outillage à retenir** : relancer les travaux échoués
d'une ancienne exécution ANNULE celle qui tourne, les deux partageant le même
groupe de concurrence. V375 est partie ainsi. Ce n'est pas grave — la version
suivante en relance une complète — mais il vaut mieux le savoir que de
chercher pourquoi une exécution s'est arrêtée toute seule.

**Ce qui n'a PAS été fait, et pourquoi.** Poser `serviceWorkers: "block"` dans
la configuration Playwright supprimerait une source d'imprévu — mais deux
fichiers de parcours éprouvent justement le service worker, et on ne change pas
une configuration globale sur une hypothèse déjà écartée, pour un échec unique
qui ne se reproduit pas.

### Une section ajoutée au milieu, et un décalage que je ne sais pas reproduire
Le mur des records s'est glissé ENTRE les deux panneaux miroités de `/amis`, et
la campagne de clôture l'a dit tout de suite : **3032 ms sur téléphone bridé**,
le plus grand élément redevenu le paragraphe du parrainage. C'est le même
défaut que la veille, sous sa forme suivante — React apparie par RANG, et le
parrainage était sixième d'un côté, septième de l'autre.

Corrigé de la même façon : la section du mur est TOUJOURS rendue dans l'arbre
chargé, et le rendu d'attente en porte une au même rang. **3032 → 1116 ms**,
mesuré.

**Et le garde ne mord pas. Trois sabotages, aucun échec, et la mesure ne bouge
pas non plus.** J'ai essayé la section retirée du rendu d'attente, la même
remise derrière un conditionnel dans le rendu chargé, puis les deux ensemble :
1100 ms dans les trois cas, et le parcours au vert. Chacune des deux moitiés
suffit donc à garder l'alignement — mais les retirer toutes les deux ne
reproduit pas non plus les 3032 ms, ce que je n'explique pas.

Ce qui est sûr tient en trois mesures : 3068 avant la première correction,
1116 après, 3032 après l'ajout du mur, 1116 après celle-ci. Ce qui ne l'est pas
est le mécanisme exact, et **« ça remesure bien » n'est pas un diagnostic**.

Le parcours est gardé pour ce qu'il éprouve — les deux paragraphes ne sont pas
recréés — avec écrit noir sur blanc ce qu'il n'éprouve pas. Ce qui tient
réellement le temps d'affichage de cet écran est la campagne de mesure : elle
l'a attrapé les DEUX fois, à trois heures d'intervalle, et c'est le seul outil
dont on sache qu'il voit ce défaut. Un test dont on croit qu'il prouve autre
chose que ce qu'il prouve est pire qu'aucun test.

**La leçon d'usage, elle, est nette** : sur cet écran, toute section ajoutée au
milieu se paie en temps d'affichage, et la mesure est le seul contrôle qui le
dise. Une campagne après chaque ajout de panneau, et pas une fois par semaine.

**Les chiffres de clôture, une fois tout remis.**

| écran | LCP poste | LCP téléphone bridé | CLS |
|---|---|---|---|
| `/fr/dashboard` | 244 ms | 1116 ms | 0,003 |
| `/fr/amis` | 232 ms | 1108 ms | 0,013 |
| `/fr/history` | 144 ms | 908 ms | 0,000 |
| `/fr/settings` | 168 ms | 920 ms | 0,000 |
| `/fr/bilan` | 144 ms | 904 ms | 0,000 |

Les cinq écrans connectés sont sous le seuil sur les deux mesures, ce qui
n'était vrai d'aucun d'eux il y a vingt-quatre heures. **Accessibilité : 0
constat sur 90 passes**, quinze pages et six langues, aucune page laissée de
côté — l'audit lancé SEUL, la suite navigateur purgeant les comptes
`@example.test` dont celui de la mesure.

### Le mur ouvert à tous, et deux défauts qu'aucun test ne regardait
Ligne 141, réponse « au choix ». Le mur des records de la veille restait dans
le cercle ; il s'ouvre maintenant à tous les comptes pour qui le demande.

**Trois règles, toutes reprises du mode fantôme, parce que c'est la même
nature de réglage.** Le défaut est FAUX — le plus fermé : personne ne se met à
publier davantage parce qu'on a ajouté une fonctionnalité. Une valeur qui n'est
pas un booléen est REFUSÉE et jamais convertie : `Boolean("non")` rend vrai, et
quelqu'un qui demande à se refermer serait ouvert sans jamais le vérifier. Et
le filtre est EN BASE : l'écarter à l'affichage ferait sortir le pseudo et le
volume de quelqu'un qui a demandé l'inverse, et ils seraient dans l'onglet
réseau de qui regarde.

**Le mode fantôme reste AU-DESSUS**, et c'est la seule décision qui ne se
déduisait pas des précédentes. Les deux réglages ne parlent pas de la même
chose — l'un dit « pas dans les classements », l'autre « devant qui » — et on
pourrait les croire indépendants. Ils ne le sont pas : un mur est un classement,
donc se cacher des classements doit se cacher du mur, ouvert ou non.
`where: { recordsPublics: true, fantome: false }`, et un test tient chacune des
deux conditions séparément.

**La requête ne part pas du tout quand personne n'a ouvert le sien**, ce qui
est le cas courant : à quatre comptes tous fermés, l'écran ne paie aucun
aller-retour de plus. Et la réponse rend `null` plutôt qu'un mur vide — une
section vide dirait « il n'y a personne », alors que la vérité est « personne
n'a choisi de figurer ici ». Ce n'est pas la même phrase.

**Deux sabotages sur quatre sont passés au vert, et c'étaient les deux
règles qui comptent le plus.**

- **le défaut du schéma basculé à `true`** : aucun test ne le regardait. Le
  défaut décide pour tous les comptes qui n'ouvriront jamais leurs réglages,
  c'est-à-dire la plupart, et il vit dans le SCHÉMA — pas dans le code
  applicatif, où on aurait pensé à le chercher. Un contrôle lit maintenant les
  deux réglages de confidentialité du modèle `User` et exige `@default(false)` ;
  il sera là pour le troisième ;
- **une valeur non booléenne convertie** : le refus était écrit dans la route
  et éprouvé par rien. Cinq valeurs y passent maintenant, dont `"non"`, que
  `Boolean` rend VRAI — c'est le cas exact où la conversion silencieuse ouvre
  le compte de quelqu'un qui demandait de le fermer.

Six sabotages, six échecs après correction.

### Le mur des records, et deux moitiés de ligne qu'on ne fait pas
Ligne 140, réponse « Oui » : « un mur des records, par exercice et par période.
Le plus grand nombre de pompes en une journée. »

**Ce qu'il apporte, et pourquoi il n'est pas un second classement.** Le
classement additionne une fenêtre, la série dit qui n'a pas lâché, le record
retient une POINTE — la plus grosse soirée. Les trois ne se remplacent pas, et
c'est pour ça que le mur est une section à part et pas un tri de plus sur les
mêmes pseudos. Répéter les mêmes noms dans un second ordre n'apprend rien et
double la place.

**Par période, oui. Par exercice, NON, et c'est une limite écrite.**
`Paiement` ne porte que des points et un jour : l'exercice vit sur le compte,
où il change quand on en change, et sur la partie, qui n'est pas ce qu'on paie.
Un mur « par exercice » demanderait de retenir l'exercice à chaque paiement,
donc une colonne ET une décision sur les paiements déjà écrits. La case du plan
porte la mention plutôt que de laisser croire la ligne entière faite.

**Entre amis, et pas au choix — la 141 reste ouverte.** Elle demande « public
ou entre amis, au choix ». Un mur PUBLIC est une surface d'exposition nouvelle :
il donne à qui n'a rien demandé une liste de pseudos et d'efforts, c'est-à-dire
exactement ce que la réponse 127 a refusé en refusant l'annuaire. Ça se
construit avec son réglage et son défaut fermé, et ce n'est pas la même
nuit. Le mur reste donc dans le cercle, comme le classement.

**Le mode fantôme le couvre sans qu'on ait rien à écrire**, et c'est le seul
point qui demandait de l'attention : le mur lit les pseudos des LIGNES du
classement, déjà passées par `nomPublie` et par le filtre en base. Quelqu'un
qui s'est retiré des classements ne réapparaît donc pas par le record — ce qui
serait le pire endroit possible pour réapparaître. Un test de route tient ce
cas précis.

**Le regroupement porte sur le COUPLE compte-jour**, pas sur le compte. Un
`_max` sur les points rendrait le plus gros PAIEMENT, ce qui n'est pas la même
chose : ça se verrait le soir où quelqu'un paie sa dette en deux fois. Et une
seule lecture pour les deux périodes — le mois se découpe ensuite sur le
préfixe.

**À égalité, le plus ANCIEN tient.** Un record ne se prend pas en égalant ;
sans cette règle, le titre changerait de main à chaque soirée où quelqu'un
refait le même chiffre.

**Un piège de doublure, nouveau celui-là.** La route fait désormais DEUX
`groupBy` sur la même table — les sommes, puis les jours. Une doublure qui rend
la même chose aux deux fait lire des sommes comme des jours, et le mur plante
sur un `jour` absent. Elle répond maintenant selon l'axe de regroupement
demandé, et le contrôle des bornes va chercher l'appel des SOMMES au lieu du
dernier : prendre le dernier faisait passer les deux onglets pour identiques,
puisque le mur borne toujours de la même façon.

Cinq sabotages, cinq échecs.

### L'objectif collectif, et un garde plus faible que ce que le journal en disait
Ligne 133, réponse « Oui » : « Ensemble, 100 000 pompes ce mois-ci ». C'est la
seule chose du produit qui additionne l'effort de TOUT LE MONDE, et c'est ce
qui la rend intéressante — un compte neuf y voit qu'il n'est pas seul avant
même d'avoir un ami.

**La cible est celle de la réponse, et il faut dire ce qu'elle vaut
aujourd'hui.** À quatre comptes, la barre affiche quelques pour cent, et une
barre à trois pour cent décourage. Ce qui la sauve n'est pas de rabaisser
l'objectif — un objectif qui recule quand quelqu'un arrive n'en est pas un —
c'est de dire COMBIEN de gens l'ont rempli. « 8 420 sur 100 000, à 4 » est une
phrase vraie à toutes les tailles ; « 8 420 sur 100 000 » tout court ne l'est
qu'à partir d'une foule. Le nombre de contributeurs n'est donc pas une
décoration, c'est ce qui rend l'objectif honnête avant qu'il ne soit
atteignable.

**Et il se compte sur les GROUPES, pas sur les lignes** : un compte qui paie
trois fois dans le mois est un contributeur, pas trois.

**La trouvaille est ailleurs : le garde du filtrage par compte est plus faible
que ce que ce journal affirme.** L'entrée du classement disait le
resserrement — « ce qui précède le nom suffit à trancher : un point en fait une
lecture de résultat, un guillemet une chaîne » — et le code, lui, cherchait
toujours `userId` n'importe où dans les quatre cents caractères autour de
l'appel. `groupBy({ by: ["userId"] })` et `s.userId` passaient donc pour des
filtres. **Ma somme collective, qui lit toute la base sans filtre, est entrée
par là sans que rien ne le dise.**

C'est le pire genre d'écart : le journal décrit une correction, on la croit
faite, et on cesse de vérifier. La règle est écrite maintenant dans
`porteUnFiltre`, sortie de la boucle pour être ÉPROUVÉE — sur les routes
réelles, remettre la recherche naïve ne fait tomber aucun contrôle, faute d'un
cas qui les distingue. Un resserrement qu'aucun test ne peut voir n'est pas un
resserrement ; trois cas fabriqués lui donnent ses dents.

**Et la dispense est déclarée bien que le garde ne l'exige pas.** Sa fenêtre de
quatre cents caractères attrape le `where` de l'appel VOISIN — c'est une
coarseness assumée depuis l'écriture du garde — donc il laisse passer ma somme
même resserré. Une lecture sans filtre se déclare là où on la cherchera, pas là
où le motif veut bien la voir. La raison y est écrite : un total et un décompte
sur tout le monde ne désignent personne.

Cinq sabotages, cinq échecs après correction — dont celui du garde, qui a
d'abord passé au vert et qui a fait écrire les trois cas.

### Campagne du 4 septembre : l'écran des amis sautait de 0,145
Passée après les six versions de la nuit, sur un compte de mesure neuf. Douze
écrans mesurés ; un seul défaut, et il est sur l'écran que je venais
d'enrichir.

| écran | LCP poste | LCP téléphone bridé | CLS |
|---|---|---|---|
| `/fr/dashboard` | 256 ms | 1096 ms | 0,003 |
| `/fr/history` | 136 ms | 908 ms | 0,000 |
| `/fr/settings` | 140 ms | 908 ms | 0,000 |
| **`/fr/amis`** | 136 ms | **3068 ms** | **0,145** |

**Accessibilité : 0 constat sur 90 passes** — quinze pages, six langues,
**aucune page laissée de côté**. C'est le second chiffre qui compte : un
rapport qui annonce zéro sur des pages qu'il n'a pas ouvertes est l'inverse
d'un audit.

**Un CLS de 0,145 pour un seuil de 0,1**, et la cause est une réserve qui a
vieilli. L'écran portait depuis longtemps un bloc d'attente de 420 pixels,
posé en s'inspirant de l'historique. Il a gagné depuis le classement, le
parrainage, les groupes et deux onglets : la page mesure 1883 pixels, la
réserve en tenait 420, et tout ce qui est visible sautait encore. Une réserve
écrite comme un NOMBRE vieillit avec l'écran ; personne ne pense à la
rouvrir quand on ajoute un panneau.

Elle est remplacée par la STRUCTURE — cinq panneaux, chacun gardant à peu près
la place du sien. Mesuré : la page d'attente passe de 900 à 1592 pixels sur
1883, soit de 48 % à 85 % de la hauteur finale. **CLS 0,145 → 0,000.**

**Puis les deux panneaux ont reçu leurs vrais textes**, et c'est ce qui compte
le plus. Le titre du classement, sa phrase d'explication, le titre du
parrainage et la sienne ne dépendent d'AUCUNE donnée : ils disent ce que
l'écran fait, pas ce qu'il contient. Ce composant étant rendu au serveur avant
d'être hydraté, ils partent dans le HTML — et le plus grand élément de la page
cesse d'attendre `/api/amis`. Vérifié dans la réponse servie, pas dans le DOM.

Le prix est un CLS qui remonte à **0,076** : les panneaux ont maintenant du
contenu, donc leur remplacement déplace un peu. C'est sous le seuil, et
l'échange se fait dans le bon sens — du vrai texte tout de suite contre un
seizième de point de décalage.

**Le LCP de téléphone bridé, et une sonde qui m'a menti avant de me servir.**
3068 ms pour un seuil de 2500. J'ai d'abord écrit une sonde qui bloquait
`/api/amis` : 6320 ms bloquée contre 6340 ms passante, donc « l'attente des
données n'y est pour rien ». **C'était faux, et la sonde était cassée** — elle
ne neutralisait pas les fenêtres d'accueil, donc son plus grand élément était
le pied de page, et elle mesurait autre chose que ce qu'elle annonçait. Le
script, lui, pose `low_onboarded` et compagnie avant de mesurer ; ma sonde
écrite à côté ne l'avait pas.

Refaite aux MÊMES conditions que le script : **1652 ms route bloquée, 2964 ms
route passante**. L'attente des données est bien la cause, et l'hypothèse
écartée une heure plus tôt était la bonne.

**Le mécanisme est la réconciliation de React, et il se corrige par le RANG.**
Deux `<main>` dont les enfants ne s'alignent pas font démonter puis remonter
tout ce qui est dedans : les paragraphes déjà peints sont recréés, et le
repeint tardif devient un nouveau candidat au plus grand élément. Le rendu
d'attente miroite donc le rendu chargé, position par position — en-tête, trois
messages, panneau du classement, panneau du parrainage — et les deux panneaux
sont TOUJOURS rendus, seul leur contenu attendant la réponse.

Trois itérations, chacune mesurée, et les deux premières ont appris quelque
chose :

- panneaux toujours rendus, mais la phrase d'aide descendue d'un cran dans un
  conditionnel : **3040 ms**, aucun gain. Une profondeur qui change vaut un
  rang qui change ;
- phrase ressortie du conditionnel, mais la liste d'onglets absente du rendu
  d'attente : **2976 ms**. La phrase était deuxième enfant d'un côté et
  troisième de l'autre, donc appariée à autre chose, donc recréée ;
- onglets miroités eux aussi (désactivés, faute de tableau à basculer) :
  **1116 ms**.

**3068 → 1116 ms, et CLS 0,145 → 0,009.** Ce qui rend la correction possible
est que la phrase la plus grande de l'écran ne dépend d'aucune donnée : elle
dit ce que le classement EST, pas ce qu'il contient. Le nombre de jours vient
du classement quand il est là, de la constante sinon — c'est la même valeur.

**Accessibilité : 0 constat sur 90 passes**, refaite après. Une première
exécution en annonçait 18 non mesurées, et c'était mon erreur d'enchaînement :
je l'avais lancée EN MÊME TEMPS que la suite navigateur, qui purge les comptes
`@example.test` — donc celui de la mesure. L'ordre est écrit depuis longtemps
ici : la suite d'abord, le compte ensuite, la mesure enfin.

**Un piège d'outillage, à moi, et il vaut d'être noté.** J'ai lancé
`performance.mjs http://… /fr/dashboard` — avec le préfixe de langue. Le script
le pose LUI-MÊME (`scripts/langue.mjs`), donc il a mesuré `/fr/fr/dashboard`,
qui rend un 404. Et **son contrôle d'atterrissage ne peut pas le voir** : il
compare le chemin d'arrivée au chemin transformé, c'est-à-dire à lui-même. Le
rapport annonçait de très bons chiffres sur « Cette adresse ne mène nulle
part », ce qui est exactement le premier piège écrit pour ces outils — mesurer
la mauvaise page — sous une forme que le garde posé pour lui ne couvre pas. Le
chemin se passe SANS préfixe.

### Les défis du mois, et une ligne qu'on ne peut pas faire seul
Ligne 131, réponse « en volume ET en nombre de parties » : deux objectifs
mensuels, montrés ensemble. C'est ce qui les distingue du défi du jour, qui
change tous les jours et n'en montre qu'un — un mois est assez long pour qu'on
ne se souvienne pas d'un objectif vu une fois, donc il faut qu'il soit toujours
là.

**La ligne 137 ne se fait PAS, et la raison est écrite plutôt que contournée.**
Elle demande « trois niveaux, récompenses exponentielles, et pour les niveaux
moyen et difficile des malus si échoué ». Or la réponse 139 — « qu'est-ce qu'on
gagne à finir un défi ? » — dit **« à voir »**. Une échelle de récompenses
exponentielle suppose une monnaie qui n'existe pas, et un malus dans ce produit
veut dire de la dette AJOUTÉE sans qu'aucune partie ne l'ait produite : les
deux se décident avec le propriétaire, pas ici. Ce qui est construit est donc
l'objectif seul — il se voit, il se poursuit, il se termine — et les niveaux
viendront se poser dessus le jour où on saura ce qu'ils donnent. La case du
plan porte la mention.

**Une requête de moins, pas une de plus.** Le défi du jour avait besoin des
parties d'aujourd'hui, ceux du mois de toutes celles du mois. Le mois CONTIENT
le jour : une seule requête suffit, et la journée se redécoupe en mémoire.
Écrire les deux aurait coûté deux allers-retours vers Neon pour des lignes dont
l'une est un sous-ensemble de l'autre.

**Un mois faux ne fait tomber aucune requête, et c'est ce qui le rend
dangereux.** « 2026-13-01 » a la forme d'une date et n'existe pas ; employé
comme préfixe, il ne compterait simplement jamais aucun paiement, et l'objectif
du mois resterait à zéro pour toujours sans que rien ne le dise. C'est la
famille du défaut déjà corrigé deux fois sur `estJourValide`, sous une
troisième forme : ici il ne faut pas l'aller-retour d'une date, il faut le
contrôle du mois pour lui-même.

**Le sabotage a de nouveau trouvé un jeu de données qui ne distingue rien.**
« le défi du jour compte tout le mois » est passé au vert : le 2 septembre 2026
tombe sur un défi de PAIEMENT, donc le découpage des parties n'y change rien.
Il fallait une date dont le défi porte sur les parties — le 8 septembre, «
enregistre 3 parties » — avec deux parties ce jour-là et trois autres plus tôt
dans le mois. C'est la troisième fois cette nuit que le même défaut se
présente : **un test peut porter sur la bonne propriété et n'avoir aucune
donnée capable de la mettre en défaut.**

**Et la barre de progression est écrite une seule fois** pour le jour et pour
le mois. Écrite deux fois, elle aurait fini par diverger — c'est le motif
trouvé six fois sur ce projet, et il ne prend jamais la forme d'une copie qu'on
remarque : il prend celle d'une correction qui n'en répare qu'une moitié.

Six sabotages, six échecs après correction.

### Les deux onglets du classement, et un écart à l'ordre du plan
Ligne 144, réponse « les deux onglets ». **Et c'est un écart à l'ordre de
l'étape 04**, qui dit de faire les défis mensuels avant tout le reste : cette
ligne-ci vaut une demi-nuit et termine un écran livré la veille, quand les
défis mensuels en valent deux et n'auraient pas tenu dans ce qui restait de la
fenêtre. C'est dit ici plutôt que fait en silence, ce qui est la règle.

**La semaine reste le DÉFAUT, et ce n'est pas un choix d'affichage.** Le
raisonnement qui a présidé au classement vaut toujours : un cumul est décidé
par la date d'inscription, le premier arrivé a un total que personne ne
rattrape, et le dernier venu regarde un tableau où sa place ne dépend plus de
ce qu'il fait. Ouvrir sur le cumul reviendrait à montrer d'abord celui des deux
qui décourage. Une période inconnue y retombe aussi — un paramètre mal écrit ne
doit pas décider ça à la place de quelqu'un.

Le cumul a pourtant sa raison, et c'est l'inverse : au bout de six mois, la
semaine ne dit plus rien de ce qu'on a fait. Les deux répondent à deux
questions différentes, et c'est pour ça qu'il en faut deux.

**Le cumul ne coûte pas un aller-retour de plus, il en coûte un DIFFÉRENT.**
La même requête, bornée ou non. Écrire deux appels et n'en garder qu'un aurait
fait payer les deux. Et **la borne HAUTE reste dans les deux cas** : sans elle,
un paiement daté du futur entrerait au cumul comme il entrait dans la semaine.

**Le défaut qu'il fallait éviter était ailleurs**, et il ne se serait vu qu'à
l'usage : le classement se recharge de trois autres endroits — au montage, au
rafraîchissement de la dette, après avoir accepté une demande — et tous trois
passaient la période par défaut. Le tableau serait revenu à la semaine sous un
onglet qui dit « cumul », c'est-à-dire un écran qui se contredit lui-même sans
que rien ne le signale. L'onglet ouvert vit donc dans un `useRef`, lisible
depuis un rappel qui reste stable.

**Ce que le parcours navigateur prouve et qu'aucun test unitaire ne peut
voir.** Le fichier social posait déjà un paiement de trente jours, écrit à
l'époque pour éprouver la borne BASSE de la semaine. Il sert maintenant deux
fois : la semaine l'ignore, le cumul le compte. Sans ce chiffre, un onglet qui
rechargerait la même période rendrait exactement le même tableau et le test
passerait en n'éprouvant rien. Et le contrôle vaut **dans les deux sens** — le
retour à la semaine doit reperdre les cinq mille points, sinon un onglet resté
bloqué sur le cumul passerait la première moitié.

Cinq sabotages, cinq échecs : le cumul mis par défaut, une période inconnue
convertie en cumul, la borne haute retirée, la période absente de la réponse,
et l'onglet qui recharge toujours la semaine — ce dernier au navigateur, avec
sa reconstruction et son redémarrage de serveur.

### Le défi du jour, et une couture qu'on ne peut pas rattraper après coup
Ligne 138, première de l'étape 04 : « un défi quotidien tiré au sort, différent
chaque jour, valable 24 heures ».

**Ce qu'on gagne à le finir : rien de matériel, et c'est écrit.** Le produit
n'a ni monnaie ni objet, et en inventer un reviendrait à offrir des points
d'effort que personne n'a faits — ce qui fausserait la dette, le classement et
les paliers d'un coup. C'est le raisonnement déjà tenu pour le parrainage. Ce
qu'un défi quotidien apporte est une RAISON D'OUVRIR, et c'est déjà ce qu'on
cherche.

**Le même pour tout le monde.** La réponse dit « différent chaque jour », pas
« différent par personne ». Un défi commun se raconte ; un défi personnel ne se
raconte à personne. Faute d'une raison de faire autrement, c'est le jour qui
décide, et lui seul — ce qui a l'avantage de rendre le tirage entièrement
déductible, donc sans table ni écriture.

**Chaque défi demande un GESTE.** Un défi qu'on remplit sans rien faire — «
solder ta dette » quand on ne doit rien — se lit comme une flatterie, et une
flatterie quotidienne finit par ne plus rien vouloir dire. Un test le tient sur
les six.

**La vraie difficulté était la couture, et le premier jet la traitait par
rattrapage.** Tirer au hasard chaque jour ferait tomber deux fois le même défi
une fois sur six, ce qui contredit la seule chose que la ligne promette. J'ai
donc mélangé les six défis par blocs de six — chacun paraît une fois par bloc —
puis fait tourner le bloc d'un cran quand son premier valait le dernier du bloc
d'avant.

**Ça ne marche pas, et le contrôle sur une année entière l'a dit : treize
répétitions.** Le bloc d'avant a peut-être tourné lui aussi, donc son dernier
n'est pas celui du mélange brut, et la question remonte de proche en proche
sans jamais se refermer. Un rattrapage qui a besoin de connaître le résultat du
rattrapage précédent n'est pas un rattrapage.

La construction remplace la correction : le premier et le dernier de chaque
bloc sont FIXÉS par une rotation simple, et seuls les quatre du milieu sont
mélangés. La couture ne peut alors plus se produire — le premier du bloc
suivant vaut `DEFIS[(b + 1) % n]`, qui ne peut égaler `DEFIS[(b + 3) % n]` que
si 3 ≡ 1 modulo n, c'est-à-dire pour n = 2. Un test tient cette condition,
parce qu'ajouter un septième défi la remettrait en jeu.

**Deux de mes témoins ne discriminaient rien, et le sabotage les a nommés.**

- « l'ordre n'est pas celui de la déclaration » comparait le premier bloc à
  `DEFIS`. Ça passe SANS aucun mélange : la construction déplace déjà le
  quatrième défi à la fin, donc l'ordre diffère de toute façon. Ce qui
  distingue vraiment, ce sont deux blocs dont les BOUTS coïncident — les blocs
  0 et 6, puisque premier et dernier se prennent modulo six — et dont seuls les
  milieux peuvent différer.
- le contrôle de route vérifiait que le défi a bien une cible et un
  avancement borné. Ça passe aussi quand le défi compte TOUS les paiements au
  lieu de ceux du jour. Il fallait choisir une date dont le défi est un défi de
  paiement — le 2 septembre 2026 tombe sur « paie 300 points » — et poser cent
  vingt points ce jour-là contre neuf mille un autre jour. Les deux chiffres
  encadrent la cible : c'est ce qui rend le contrôle discriminant.

C'est la même leçon que celle de la veille sur le niveau, sous une autre forme :
**un test qui vérifie qu'une valeur est plausible n'éprouve pas d'où elle
vient.**

**Un aller-retour de plus, assumé et nommé.** Le défi a besoin des parties du
JOUR, que `/api/progression` ne lisait pas — elle n'avait qu'un agrégat de
toujours. Une requête étroite s'y ajoute, sur une poignée de lignes. Ses bornes
sont en UTC, comme celles de `/api/dashboard/daily` qui découpe déjà les
journées ainsi : c'est une approximation pour qui joue loin du méridien, et
c'est la MÊME dans les deux endroits, ce qui vaut mieux qu'une seconde règle
qui divergerait à la première correction.

**Et un garde pour les clés construites**, la famille déjà rencontrée deux
fois : le libellé se lit par la clé du défi, donc le recensement des clés
mortes ne peut pas garantir qu'elle existe, et une clé absente écrirait
« undefined » en travers du tableau de bord. Un test exige les six clés dans
les six langues, et qu'aucune phrase n'ignore la cible qu'on lui passe — un
gabarit qui la laisserait tomber dirait « gagne 2 parties » quel que soit le
seuil, alors que le seuil vit dans le code.

Sept sabotages, sept échecs après correction — dont les deux qui ont d'abord
passé au vert, et qui étaient les deux témoins.

### Un badge qui ne se déduit pas, et la seule chose de la progression qui se range en base
Ligne 147, la dernière de l'étape 03 : « des badges. Le premier 100, la
première semaine complète, la première défaite payée dans l'heure ». Les deux
premiers existaient déjà — ce sont les paliers `volume100` et `serie7`. **C'est
le troisième qui fait toute la ligne**, et il est d'une autre nature.

**Un palier est un TOTAL, un exploit est un MOMENT.** Un total se recalcule à
tout instant depuis la base, et c'est précisément pourquoi les paliers ne se
stockent pas : un badge rangé finit par diverger de ce qu'il prétend décrire.
Un délai, lui, ne se recalcule pas — la dette d'hier soir n'existe plus, et
rien ne dira jamais après coup en combien de temps elle a été payée. Il se
retient donc, et une seule fois. `User.paiementEclairLe` est la seule colonne
de progression de tout le produit, et la raison de l'exception est écrite au
schéma.

La conséquence à assumer : **un exploit ne se PERD pas.** Supprimer une partie
fait redescendre un palier, et c'est juste ; ça n'efface pas le fait qu'un soir
on a payé dans l'heure. Retirer un exploit reviendrait à nier quelque chose qui
a eu lieu.

**Quatre conditions, et celle qui compte est « soldée ».** « Payée dans
l'heure » veut dire payée, pas entamée : un paiement partiel rapide laisse la
dette courir, donc il ne dit rien de ce que la ligne récompense. Les trois
autres : quelque chose a été payé, la dette existait avec un début lisible, et
le délai n'est pas NÉGATIF — une horloge reculée entre deux ouvertures donne un
délai négatif, qui passerait toute comparaison à un plafond. C'est la
correction déjà écrite pour le chrono de session, retombée telle quelle.

**La condition est posée à la BASE, pas après lecture.** `updateMany` avec
`paiementEclairLe: null` dans le `where` : deux paiements partis en même temps
liraient tous deux « pas encore d'exploit », et le second écraserait la date du
premier. C'est le même raisonnement que pour la date de début de dette, et il
n'y a toujours pas de transaction pour le tenir à notre place.

**L'exploit se pose en DERNIER, et son échec ne coûte que lui-même.** L'ordre
de cette route est désormais : la trace, le décompte, le badge. Ce qui se
rattrape à la main passe après ce qui ne se rattrape pas — un badge manqué se
regagne au prochain soir, un paiement refusé après décompte, non. Et c'est un
`try` et non un `.catch()` : celui-ci ne rattrape qu'une promesse rejetée, pas
un jet synchrone, ce qui est exactement ce qu'aurait produit une méthode
absente de la doublure.

**La date ne SORT PAS du compte, mais elle figure à l'export.** L'écran ne
reçoit qu'un booléen, composé au serveur ; la date elle-même n'a aucun lecteur,
et une donnée qui voyage à chaque chargement de page sans que personne ne la
lise est du gaspillage avant d'être un risque. L'article 20, lui, couvre TOUT
ce qu'on garde et pas seulement ce qu'on affiche — une donnée qu'on ne montre
pas est précisément celle qu'on oublie d'exporter.

**Trois gardes ont mordu sur la colonne**, ce qui est leur travail :
`compte.test.ts` a exigé qu'on la range d'un côté ou de l'autre de ce qui sort,
puis — une fois rangée du côté « ne sort pas » — que `comptePublic` la retire
POUR DE BON, ce qui n'était pas fait ; et `politiqueComplete.test.ts` a exigé
une ligne de politique dans les six langues.

Et le piège déjà écrit ici, retombé dedans : `jest.mock` remplace le MODULE
ENTIER, donc `user.updateMany` n'existait pas dans la doublure. Il n'a rien
cassé tout de suite — le chemin n'était pas emprunté par les tests existants —
et c'est ce qui rend ce piège coûteux : il attend le premier test qui passe
vraiment par là.

Cinq sabotages, cinq échecs : le paiement partiel accepté, la condition retirée
du `where`, l'exploit rendu regagnable, le délai négatif accepté, et le `try`
retiré.

### Le niveau de compte et le titre, et deux chiffres qui portaient le même nom
Lignes 148 et 149, toutes deux répondues « oui ». Elles vont ensemble parce
qu'elles se déduisent des mêmes données : le niveau dit COMBIEN, le titre dit
QUOI, et aucun des deux n'est stocké — un niveau rangé en base finit par
diverger de ce qu'il prétend décrire le jour où une partie est supprimée. La
contrepartie est qu'un niveau peut BAISSER ; c'est le prix, il est assumé, et
c'est déjà celui des paliers.

**La trouvaille de la nuit est un mot.** Le module annonçait « le niveau se
calcule sur l'effort PAYÉ » — la décision de la réponse 115, qui refuse de
faire monter celui qui perd sans jamais payer. La route, elle, lui passait
`source.totalPoints`, qui est l'effort **GÉNÉRÉ**, c'est-à-dire ce que les
parties ont coûté. Le commentaire disait une chose, le code en faisait une
autre, et **aucun test ne pouvait les distinguer** : les deux chiffres portaient
le même nom, dans une forme que j'avais réemployée telle quelle au motif
qu'elle se ressemblait trait pour trait.

C'est le sabotage qui l'a dit. `avancementNiveau(source.parties)` à la place de
`avancementNiveau(source.totalPoints)` passait au vert : rien n'éprouvait la
SOURCE du niveau, seulement qu'il en sortait un nombre plausible. Le champ
s'appelle `pointsPayes` maintenant, et `SourceNiveau` ne réemploie plus
`SourceBadges`. **Deux formes identiques ne sont pas la même chose quand l'une
compte ce qu'on doit et l'autre ce qu'on a fait** — et c'est le NOM qui empêche
la confusion, pas le commentaire. Le double de la route rend désormais 9 000
générés contre 120 payés, deux valeurs qui encadrent le seuil du titre
« endurant » : sans cet écart, les deux sources donnaient le même titre et le
contrôle passait sans rien prouver.

**Une ligne écrite, sabotée, retirée.** J'avais corrigé la forme fermée du
niveau par deux boucles de comparaison, au motif qu'une racine carrée flottante
peut rendre 2,9999997 au seuil exact — donc précisément à l'instant qu'on veut
fêter. Les retirer ne faisait tomber aucun test. La raison est algébrique : au
seuil du niveau n, `1 + 4 points / 25` vaut `(2n − 1)²`, un carré parfait, et la
racine d'un carré parfait est exacte en IEEE 754. La correction ne tenait rien
et se relisait comme une garantie. Elle est partie, remplacée par un test qui
vérifie **trois cent mille niveaux**, au seuil et un point en dessous.

**Et le témoin de ce test ne témoignait de rien.** Il rejouait un niveau isolé
HORS de la boucle : vider la boucle laissait la liste d'écarts vide et le cas
isolé juste, donc tout au vert. Il compte les tours maintenant. C'est le même
défaut, sous une troisième forme cette semaine : un garde posé à côté de ce
qu'il surveille ne surveille rien.

**Où le titre s'affiche, et où il ne s'affiche PAS.** Il fait un mot, il est
flatteur par construction, et on pourrait le croire anodin. Il ne l'est pas :
« Increvable » DIT une série de trente jours, c'est-à-dire exactement le chiffre
que le mode « total » du profil d'un ami existe pour taire. Il est donc rangé
du côté du DÉTAIL, sous le réglage `partageAmis` qui existe déjà — pas de
nouveau réglage, pas de nouvelle colonne. Un résumé d'un renseignement reste ce
renseignement, et le publier sous une autre forme est la façon la plus discrète
de défaire un réglage.

Sur le profil PUBLIC, en revanche, il s'affiche sans condition : la série et
les parties sont juste en dessous, et c'est la personne elle-même qui a publié
l'adresse.

**Pas dans le classement, et la raison est un coût.** Il faudrait l'historique
complet des paiements de CHAQUE ami pour calculer sa meilleure série, là où le
classement ne lit aujourd'hui qu'une somme sur sept jours. Un aller-retour par
ami vers Neon pour orner un tableau de rangs n'est pas un échange qui se fait.
C'est écrit plutôt que laissé à deviner.

**Aucun titre n'est désobligeant, et c'est une règle et non de la politesse.**
Il s'affiche à côté d'un pseudo, donc devant quelqu'un d'autre : « Débutant »
ferait du produit celui qui vous désigne publiquement. Quelqu'un qui n'a rien
gagné n'a donc PAS de titre — pas un titre qui dit qu'il n'a rien fait.

**Le titre porté est le plus RARE**, pas le dernier gagné : sinon il changerait
à chaque partie. Et l'ordre est celui du TEMPS que chacun demande, pas celui
d'un chiffre — sept jours d'affilée sont plus durs que dix jours épars, et c'est
ce qui les sépare.

Neuf sabotages. Trois sont passés au vert au premier essai, et ce sont les trois
qui ont appris quelque chose : la source du niveau, la source du titre, et le
témoin de la boucle. Un dixième n'a pas compilé plutôt que de faire tomber un
test — la colonne `points` retirée du `select` fait nommer sa lecture par
`tsc` — et c'est noté comme tel, pas compté comme un garde qui mord.

**Deux pièges d'outillage, dont un nouveau.**

`{tt.niveau} {valeur}` en JSX fait DEUX enfants texte, et React insère un
`<!-- -->` entre eux dans le HTML rendu au serveur. Un contrôle qui lit la
réponse — c'est-à-dire le seul qui prouve quelque chose ici — cherchait donc
`Niveau 3` dans une chaîne qui contient `Niveau<!-- --> <!-- -->3`. La bonne
correction n'est pas d'assouplir le motif mais de composer la chaîne d'un seul
tenant : le HTML devient ce qu'on croit qu'il est.

L'autre est connu, sous une variante : une requête faite HORS du navigateur
(`request.get`) n'emporte pas forcément l'en-tête de langue du contexte, donc
une adresse sans préfixe NÉGOCIE et rend l'anglais. Le premier jet cherchait
« Niveau » dans une page allemande de fait anglaise. L'adresse porte la langue
en clair maintenant.

**Un échec intermittent, et voilà exactement ce qu'on en sait.** Le PREMIER
test d'un fichier — celui qui ouvre le compte — est tombé deux fois dans des
exécutions à plusieurs fichiers, une fois sur `profil-public.spec.ts` et une
fois sur `hors-ligne.spec.ts`, en rendant 23 sur 23 puis 18 sur 18 à
l'exécution suivante des mêmes fichiers.

Ce qui est établi : ça ne touche que l'OUVERTURE DE COMPTE, et jamais en
exécution à un seul worker sur les essais faits. Ce qui ne l'est pas : la
cause. J'ai d'abord écrit « reproductible à deux workers » sur la foi d'un
échec suivi d'un succès à un worker — c'était une conclusion tirée d'une seule
exécution de chaque côté, et la suivante à deux workers est passée. Deux points
ne font pas une courbe.

**Ce que ça ne menace pas : la CI.** Elle joue un seul worker par exécuteur
depuis V358, précisément parce que le processeur ne suit pas — bcrypt coût 12
sur chaque connexion. Le cas ne s'y présente donc pas. C'est un défaut
d'outillage local, il est noté pour qu'une récidive se reconnaisse au lieu de
se redécouvrir, et il ne sera pas « corrigé » par un délai allongé : allonger
une attente sans savoir ce qu'on attend est la façon la plus sûre de rendre un
test muet.

### Campagne de clôture du 4 septembre, et l'historique d'un compte NEUF
Passée après les six versions de la nuit, sur un compte de mesure fraîchement
ouvert.

**Accessibilité : 0 constat sur 90 passes** — quinze pages, six langues,
**aucune page laissée de côté**. C'est le second chiffre qui compte : un
rapport qui annonce zéro sur des pages qu'il n'a pas ouvertes est l'inverse
d'un audit.

| écran | LCP poste | LCP téléphone bridé | CLS | plus grand élément |
|---|---|---|---|---|
| `/fr/bilan` | 128 ms | 912 ms | 0,000 | la mention Riot, en pied |
| `/fr/settings` | 144 ms | 912 ms | 0,000 | la mention Riot, en pied |
| `/fr/dashboard` | 296 ms | 1116 ms | 0,001 | le bandeau d'attente Riot |
| `/fr/calculateur/league-of-legends` | 476 ms | 1124 ms | 0,000 | le titre |
| `/fr/telechargement` | 480 ms | 1076 ms | 0,000 | le paragraphe SmartScreen |
| `/fr/confidentialite` | 500 ms | 1172 ms | 0,000 | le titre |
| `/fr/cgu` | 504 ms | 1140 ms | 0,000 | le premier paragraphe |
| `/fr/login` | 520 ms | 1128 ms | 0,000 | la mention des CGU |
| `/fr/beta` | 548 ms | 1124 ms | 0,000 | le titre |
| `/fr` | 956 ms | 1324 ms | 0,000 | « Comment ça marche » |
| **`/fr/history`** | 480 ms | **2984 ms** | 0,031 | **le message d'historique vide** |

**Onze écrans sur douze tiennent largement. Le douzième mérite d'être nommé
plutôt qu'arrondi.**

Sur `/fr/history`, le plus grand élément n'est pas le titre — c'est le
paragraphe « C'est depuis le tableau de bord qu'on enregistre… », celui qui
s'affiche quand il n'y a AUCUNE partie. Il ne paraît qu'une fois `/api/games`
revenu, donc après le paquet JavaScript, l'hydratation et un aller-retour. Sur
un réseau moyen et un processeur quatre fois plus lent, ça fait 2 940 ms,
mesuré trois fois de suite à quarante millisecondes près.

**Ça ne concernait qu'un compte NEUF**, et c'est ce qui le rendait gênant :
dès qu'il y a des parties, c'est le titre qui l'emporte à 480 ms. Autrement dit
l'écran était lent exactement pour la personne qu'on cherche le plus à garder,
et rapide pour celles qui sont déjà là. Le tableau de bord a eu ce défaut mot
pour mot, et sa correction était déjà écrite : rendre le premier écran AU
SERVEUR.

**Corrigé de la même façon, et sans convertir la page.** `/history` reste
cliente — la convertir serait un chantier, et le défaut ne portait que sur UNE
information : y a-t-il au moins une partie. C'est un comptage, il tient dans une
page serveur, et il se passe en `depart` au composant :

```tsx
const parties = await prisma.game.count({ where: { userId: user.id }, take: 1 });
return <Historique depart={{ aucuneActivite: parties === 0 }} />;
```

**2 984 ms → 900 ms**, mesuré sur le même compte et la même construction. Et le
`take: 1` n'est pas une coquetterie : la question est « y en a-t-il », pas
« combien », et compter toutes les parties de quelqu'un pour répondre oui ou non
est ce que la page faisait déjà par un autre chemin.

**Le squelette reste pour les comptes qui ont des parties.** Un écran vide
montré à quelqu'un qui a soixante parties serait un mensonge d'une seconde — et
c'est le pire moment pour en dire un, puisque c'est l'écran qui existe pour
prouver qu'on n'a rien perdu. Les deux états sont donc distincts, et c'est le
départ serveur qui tranche entre eux.

**Le garde regarde le HTML SERVI, pas la page rendue.** Une fois hydratée, la
page affiche le message dans les deux cas : le sabotage ne se verrait pas.
`e2e/historique.spec.ts` lit donc `response.text()`. C'est la leçon déjà écrite
pour le premier écran du tableau de bord, retombée telle quelle — et un détail
qui a coûté une exécution : le HTML servi échappe l'apostrophe en `&#x27;`, donc
l'extrait cherché n'en contient aucune.

**Le premier sabotage n'a pas compilé**, et c'est noté comme tel plutôt que
compté comme un test qui mord : retirer la condition rendait `depart` inutilisé,
et `noUnusedLocals` le nomme. Réécrit pour compiler — la branche devient
inatteignable sans que la valeur cesse d'être lue — il fait tomber le nouveau
test et lui seul, les douze autres du fichier passant.

**Et un garde a mordu sur le renommage**, ce qui est son travail :
`colonnesHistorique.test.ts` désignait l'écran par son CHEMIN, et le composant
venait de déménager sous un autre nom. Son témoin de non-vacuité a tenu — il
n'est pas passé au vert sur zéro colonne. Il cherche maintenant l'écran par sa
FORME : l'unique `.tsx` du dossier qui déclare `type Game`, et il lève si ce
n'est pas exactement un. Un garde épinglé sur un chemin devient muet le jour où
le fichier bouge, ce qui est précisément le jour où l'on aurait besoin de lui.

**Une note d'outillage :** `performance.mjs` mesure UNE page par appel
(`process.argv[3]`). Le lancer sans argument rend un rapport parfaitement
valable sur `/` et sur rien d'autre — et un rapport d'une page ressemble
beaucoup à une campagne quand on ne compte pas les blocs. Douze appels, douze
blocs comptés.

### Pseudo Riot ou pseudo interne, et le garde qui vaut plus que le réglage
Ligne 128, réponse « Au choix ». La question elle-même portait la raison : le
pseudo Riot est une donnée personnelle. Il relie un compte d'ici à une identité
qu'on peut chercher AILLEURS — historiques de parties, classements, forums —
là où le pseudo interne ne vaut que dans cette application.

**Le défaut est donc le pseudo interne**, comme pour le partage aux amis et le
profil public. Et le repli l'est aussi : une valeur inconnue retombe sur le
pseudo, jamais sur Riot. Un repli de réglage de confidentialité ne peut pas
être plus permissif que ce qu'on demandait.

**Sans compte Riot rattaché, on retombe sur le pseudo.** Le choix n'a alors
rien à désigner, et ne rien afficher serait bien pire : une ligne de classement
sans nom. Le discriminant ne s'affiche pas non plus — « Nom#EUW » se lit mal
dans une liste, et ce qui suit le dièse ne distingue rien entre gens qui se
connaissent.

**Le réglage ne vaut que s'il vaut PARTOUT, et c'est là que le travail était.**
Cinq surfaces publient un nom : la liste d'amis, le classement, la dette
d'équipe, le profil d'un ami, le profil public. Un seul endroit oublié publie
le pseudo Riot de quelqu'un qui ne l'a jamais demandé. `src/nomChoisi.test.ts`
regarde donc le DOSSIER : tout fichier de `src/app` qui lit `pseudo` dans un
`select` applique `nomPublie`, ou figure dans une liste de dispenses avec sa
raison — l'administration, qui doit reconnaître les comptes, et ce qui
s'adresse à VOUS, où le nom montré aux autres n'a rien à faire.

**Le garde suit UN saut d'import**, pas davantage : une route peut confier la
mise en forme à un module de `src/lib`, et c'est ce que font le classement et
la dette d'équipe. Au-delà d'un saut, il ne dirait plus rien de précis.

**Élargir le `select` a failli créer exactement le défaut qu'on corrigeait.**
La liste d'amis construisait sa réponse par `{ lien: l.id, ...autre(l) }` — un
étalement, donc tout ce que la requête ramène. Ajouter `riotId` et `nomAffiche`
au `select` pour appliquer le choix aurait publié le pseudo Riot de TOUT LE
MONDE, y compris de ceux qui viennent de demander l'inverse. C'est le défaut
déjà corrigé sur le compte par `comptePublic`, un modèle plus bas et pour la
même raison : un `{ ...ligne }` publie tout ce qu'on lui remet. Le test qui
gardait cette réponse a mordu, et il en garde deux choses maintenant : ce que
la requête LIT, et ce que la réponse PUBLIE.

**Un sabotage est passé au vert, et c'était la troisième fois de la nuit.**
Retirer l'appel à `nomPublie` du classement laissait le garde satisfait :
il cherchait le mot, et la ligne d'IMPORT le contient. `nomPublie\s*\(`
distingue les deux. C'est le même défaut que le garde du piège de focus et que
celui de la porte des routes — **un garde qui reconnaît un import reconnaît une
intention, pas un comportement** — et j'y suis retombé trois fois en une nuit,
dans trois fichiers différents. Deux tests de comportement ont été ajoutés en
plus, dans `classement.test.ts` et `detteGroupe.test.ts` : un garde structurel
dit qu'on a appelé la fonction, pas qu'elle fait ce qu'il faut.

Six sabotages, six échecs après correction.

### Trois routes en `.tsx` étaient invisibles à TOUS les gardes structurels
Trouvé par un sabotage qui n'a rien fait tomber, ce qui est la seule façon de
trouver ça. J'avais neutralisé le verrou de session de `/api/seance/image` —
`const user = (await getCurrentUser())!;` — et les huit contrôles de
`porteRoutes.test.ts` sont restés au vert, les quatre parcours navigateur
aussi.

**Deux causes, l'une derrière l'autre.**

La première : les trois gardes qui parcourent `src/app/api` cherchaient
`e.name === "route.ts"`. Next accepte aussi `route.tsx`, et trois routes de ce
projet en sont — les deux images rendues par `next/og` et l'icône de
l'application. Elles n'étaient donc examinées par AUCUN d'eux depuis qu'elles
existent : ni la porte, ni le filtrage par compte, ni l'écart des parties sans
enjeu. Le garde ne leur trouvait rien à reprocher parce qu'il ne les lisait
pas, et un recensement qui ne lit rien passe au vert.

La seconde : même en les lisant, `porteRoutes` cherchait l'APPEL à
`getCurrentUser`, jamais le REFUS. Une route qui appelle et ignore la réponse
le satisfaisait entièrement. C'est le défaut déjà écrit ici pour le piège de
focus — **un garde qui reconnaît un import reconnaît une intention, pas un
comportement** — et il vaut pour la porte de cinquante routes. Il cherche
maintenant un refus (401, 403, `redirect`, `notFound`) dans les quatre cents
caractères qui suivent chaque appel.

**Et le parcours navigateur ne pouvait pas le voir non plus**, ce qui est le
pire du lot : le middleware redirige déjà l'anonyme vers la connexion, donc le
verrou de la route ne sert QUE le jour où l'adresse entrerait par erreur dans
les chemins publics. C'est-à-dire précisément le jour où il compte, et le seul
où personne ne le teste.

**Trois défauts réels sont tombés dès que les gardes ont vu ces fichiers :**

- **l'image du bilan de saison comptait les parties SANS ENJEU.** La même
  requête est écrite deux fois — `/api/bilan` et `/api/bilan/image` — et une
  seule des deux filtrait. L'image affichait donc plus de parties et un autre
  taux de victoire que la page juste à côté, et c'est l'image qu'on partage.
  C'est le huitième cas de règle dupliquée de ce projet, et le premier qu'un
  garde existant aurait dû attraper ;
- **`/api/signalement` était ouverte en FAIT et pas en droit.** Elle figure
  dans les préfixes publics depuis toujours mais pas dans la liste des
  dispenses, et le premier contrôle la laissait passer parce qu'elle CONTIENT
  `getCurrentUser` — un appel qui rend `null` sans rien refuser. C'est ce
  qu'on veut d'une porte ouverte assumée, et ce qu'on ne veut pas d'une porte
  qu'on croit fermée. Elle est déclarée, avec sa raison : celui qui ne peut
  plus se connecter est celui qui a le plus besoin de signaler ;
- **le garde ne connaissait qu'une des DEUX façons de traverser le
  middleware.** `PUBLIC_PREFIXES` en est une ; l'autre est le `matcher` de
  `middleware.ts`, qui écarte certaines adresses avant tout contrôle — l'icône
  de l'application y figure. J'ai d'abord cru qu'elle était bloquée et j'allais
  l'écrire ; la sonde a rendu 200 et `image/png` sans session, et c'est la
  sonde qui avait raison. Le garde lit les deux listes maintenant.

Quatre sabotages sur les gardes réparés, quatre échecs.

### L'image de partage après une grosse séance
Ligne 122, réponse « Oui ». La question n'était pas l'image — le moteur existe
depuis le bilan de saison — mais **ce qu'est une GROSSE séance**. Ça ne peut
pas être un nombre fixe : cent points sont une soirée ordinaire pour qui joue
beaucoup et un record pour qui débute.

C'est donc un RECORD sur trente jours glissants, pour la raison déjà écrite
pour le classement : un record de toujours est décidé par une seule soirée, et
plus personne ne le bat. Avec un PLANCHER, parce qu'un record ne veut rien dire
quand il n'y a rien à battre — la toute première séance en est toujours un, et
proposer de partager quatre pompes met le produit en défaut de sérieux. Un ex
æquo ne compte pas : égaler son record n'est pas le battre, et reproposer la
même image pour le même chiffre est exactement la sollicitation qu'on veut
éviter.

**Le chiffre vient de la BASE.** Le prendre dans l'adresse laisserait n'importe
qui fabriquer une image à douze mille points, et une image qu'on peut écrire
soi-même ne dit plus rien de personne — donc plus personne ne la regarde.

**La proposition ne part qu'après un paiement ABOUTI.** Une séance mise en file
hors ligne n'est pas encore une séance : proposer une image de ce qui n'est pas
enregistré serait promettre deux fois.

**Un défaut attrapé en relisant le rendu, pas en le testant** : payer TOUTE sa
dette la ramène à zéro, et le composant prend alors une branche de sortie
anticipée qui ne rendait que le chrono. La proposition disparaissait donc au
moment exact où elle a un sens — après la plus grosse séance possible.

Six sabotages unitaires, six échecs. Au navigateur, l'image est éprouvée sur sa
SIGNATURE PNG et non sur sa taille : une page d'erreur rendue en 200 passerait
un contrôle de taille. Et le contrôle « pas d'image sans session » a d'abord
échoué à cause de MON test : Playwright suit les redirections, donc le 307 vers
la connexion devient un 200 sur la page de connexion. On regarde ce qui sort,
jamais le code de réponse.

### Le profil public, et l'adresse qu'on ne peut pas énumérer
Ligne 121, réponse « Au choix ». Deux règles du projet s'appliquent d'elles-
mêmes dès qu'on lit « au choix » :

- **le défaut est le plus FERMÉ.** Quelqu'un qui n'ouvre jamais ses réglages ne
  doit pas se mettre à publier une page parce qu'on a ajouté une
  fonctionnalité ;
- **l'adresse ne s'énumère pas.** La fonder sur le pseudo permettrait
  d'essayer des pseudos jusqu'à dresser la liste des comptes qui ont accepté
  d'être vus — c'est-à-dire de publier précisément ce que le réglage promet de
  tenir. Un jeton tiré au hasard ne dit rien de qui il désigne.

**La PRÉSENCE du jeton est le réglage**, et c'est ce qui évite une seconde
colonne qui pourrait la contredire. Il en découle qu'**éteindre, c'est
révoquer** : le rallumer tire un NOUVEAU jeton, donc un lien qu'on croyait
avoir coupé ne revient jamais à la vie. Ça surprend une fois, et c'est le seul
sens sûr — l'inverse serait le pire défaut possible sur cette page. Le
rallumer alors qu'il est DÉJÀ ouvert garde le lien en cours, sinon un
aller-retour dans les réglages casserait une adresse qu'on vient de coller
quelque part.

**Ni la dette, ni le retard**, et c'est une décision. Une page qu'on partage
soi-même est une fierté : « j'ai payé douze mille points ». Y publier ce qu'on
doit et depuis combien de temps on est en retard en ferait un pilori, personne
ne partagerait le lien, et la fonctionnalité n'existerait pas. C'est aussi ce
qui la distingue du profil d'un AMI, qui montre le retard : là, la pression
sociale est le but et elle s'exerce entre gens qui se connaissent ; ici,
l'adresse peut finir n'importe où.

**Hors des moteurs**, par la balise et non par `robots.txt` : c'est la leçon
déjà écrite au départ de `/waitlist` — interdire l'exploration n'empêche pas
l'indexation, et une page de profil indexée survit à la décision de la
refermer.

**Le jeton repart avec la réponse du réglage.** L'écran ne peut pas le
fabriquer, il est tiré au serveur ; le lui faire redemander coûterait un
aller-retour pour une valeur qu'on vient d'écrire. `undefined` quand le réglage
n'était pas dans la requête, et non `null` : une clé absente ne dit rien, une
clé nulle dirait « fermé » et l'écran effacerait un lien qui existe toujours.

**Trois gardes ont mordu, tous les trois à raison** : `comptePublic` a exigé
qu'on range le jeton d'un côté ou de l'autre de ce qui sort du compte — il ne
sort pas, même raison que le jeton de diffusion —, `pagesOrphelines` a exigé de
dire pourquoi cette page n'est atteignable par aucun lien du site, et
`politiqueComplete` a exigé qu'on la décrive dans les six langues.

**Et le garde de parité que je venais d'écrire a servi une heure plus tard.**
La ligne de politique était posée dans cinq langues sur six — l'anglais avait
un autre libellé de ligne voisine et ma recherche ne l'avait pas trouvée. Avant
ce garde, tout serait passé au vert. C'est la meilleure justification qu'un
contrôle puisse avoir : il attrape son auteur.

Six sabotages unitaires, six échecs. Au navigateur, trois tests — le compte
neuf n'a pas de profil, le lien ouvre sans session et ne montre pas la dette
(posée à 4242 exprès, pour que son absence veuille dire quelque chose), et le
fermer coupe le lien pendant que le rouvrir en donne un autre. Sabotage :
l'adresse retirée des chemins publics, le parcours tombe.

### La dette commune d'une équipe, et le registre qu'on n'a pas créé
Ligne 118, réponse « Oui » : « Cinq personnes, une dette commune, chacun paie
ce qu'il peut. Ça sauve celui qui décroche. » C'est la SECONDE moitié qui
décide de la forme — ce qu'on veut n'est pas un compteur de plus, c'est qu'un
effort fait par quelqu'un puisse acquitter la dette d'un autre.

**Il n'y a donc pas de second registre.** La dette commune est la SOMME des
dettes personnelles, c'est-à-dire une lecture. En créer une vraie obligerait à
décider, à chaque paiement, laquelle des deux baisse — et les deux réponses
sont fausses : l'une compte l'effort deux fois, l'autre le perd. Le seul
invariant qui tienne depuis le premier jour est qu'un point d'effort payé est
une pompe que quelqu'un a faite ; un transfert le respecte, un second compteur
non. C'est le même raisonnement qui avait écarté « offrir des points » comme
avantage de parrainage.

**`Paiement.userId` dit qui a fait l'effort, `pourUserId` de quelle dette il
est retiré.** Le classement compte donc le relais à celui qui l'a fait, ce qui
est juste — ce sont ses pompes. Et la colonne existe surtout pour une autre
raison : **sans elle, la dette du bénéficiaire baisserait sans que rien ne dise
pourquoi.** C'est la faute déjà écrite ici pour le paiement — « une dette qu'on
ne doit plus sans savoir pourquoi ne se rattrape pas » — et elle serait pire
ici, puisqu'elle se produirait sur le compte de quelqu'un d'autre.
`SetNull` et non `Cascade` : le bénéficiaire peut supprimer son compte, l'effort
a bien été fait et reste dans le registre de celui qui l'a fourni.

**Rien ne classe personne, et c'est une contrainte, pas un oubli.** La réponse
117 refusait le duel — « celui qui paie le plus gagne » — avec sa raison : « ça
incite au mauvaise performance ». On paie ce qu'on a perdu, donc désigner le
meilleur payeur d'une équipe dirait exactement la même chose sous un autre nom.
L'écran montre ce qui est DÛ ; la personne en tête est celle qu'on vient aider.

**Le mode fantôme s'applique**, et le total DIT ce qu'il omet. Un tableau
d'équipe montre le même couple pseudo + dette qu'un classement, et à cinq une
place suffit à désigner quelqu'un : un membre fantôme est donc absent, et sa
dette ne compte pas. Mais l'exclure en silence rendrait le total faux sans que
personne le sache — d'où le compte des masqués, affiché sous le tableau. On se
voit toujours soi-même, comme au classement.

**La part se choisit.** Un nombre figé — dix points — obligerait à cliquer
vingt fois pour solder une dette de deux cents, et c'est précisément la
personne qu'on vient aider qui en a une grosse.

**Ce qui n'est PAS fait, et pourquoi.** La ligne 142 — une dette de groupe
quand cinq perdent la MÊME partie — demande de rapprocher les
`Game.riotMatchId` de plusieurs comptes, donc la clé Riot de production, qui
n'est pas arrivée. Et la réponse 143 dit que le propriétaire ne joue pas en
groupe de cinq : il n'y a aucun terrain d'essai. Elle vient après.

Neuf sabotages sur le module, neuf échecs. Huit sur la route, huit échecs —
dont celui qui compte le plus, le décompte porté sur le payeur au lieu du
bénéficiaire. Le garde du filtrage par compte a mordu quand le contrôle
d'appartenance a été retiré : il passait donc pour la bonne raison, et non par
coïncidence de proximité.

**Et un trou trouvé dans un garde, en tombant dedans.** La ligne de politique
de confidentialité insérée dans DEUX langues sur six a laissé tout au vert :
`politiqueComplete.test.ts` ne lit que le français. C'est le bon choix pour
décider ce qui est décrit — le faire six fois n'apprendrait rien — mais ça
laissait passer une politique vraie en français et muette dans cinq langues.
Le tableau doit maintenant avoir le même NOMBRE DE LIGNES partout, avec le
témoin habituel : une détection qui ne trouve plus le tableau rendrait zéro
pour tout le monde et le test passerait en ne comparant rien. Elle a d'ailleurs
mordu tout de suite sur ma première version, qui cherchait le tableau un niveau
trop haut.

Au navigateur, un test à deux comptes : ce qu'aucun test unitaire ne peut voir,
c'est que l'effort fourni par l'un arrive sur la dette de l'autre. Il regarde
l'écran ET la base — sans le second, un écran qui affiche ce qu'on vient de
taper passerait. Sabotage : l'identifiant du membre retiré de l'envoi, le
parcours tombe.

**Et le piège du `git checkout --`, retombé dedans.** Il restaure depuis
l'INDEX : après un sabotage sur un fichier NON indexé, il efface la correction
elle-même. J'ai perdu les deux ajouts au garde de politique et il a fallu les
réécrire. C'est écrit dans ce journal depuis le plan du site ; la parade est
d'indexer avant de saboter.

### La parallélisation de la CI s'était presque entièrement mangée elle-même
Mesuré sur V357 avant d'y toucher, étape par étape : le travail `parcours`
durait 14 min 24, dont **9 min 53 de parcours et 2 min 40 d'accessibilité** —
87 % du temps dans deux étapes qui se suivent sur un seul runner. Le reste
tient en 1 min 25.

Le dépôt est **public**, ce qui décide de l'arbitrage : `billable.total_ms`
vaut zéro, donc paralléliser ne coûte aucune minute. Sur un dépôt privé le
raisonnement serait l'inverse — on paierait cinq préparations pour gagner du
temps d'attente, et à cinq exécutions par jour le quota gratuit y passerait.

Quatre travaux au lieu de deux : les parcours sur deux runners, `bareme-gele`
sur le sien, l'accessibilité à côté. Deux choses valent d'être notées :

- **`bareme-gele` n'a plus besoin d'un ordre d'exécution.** Il écrit les
  ratios GLOBAUX ; il attendait donc la fin de tous les autres, par un projet
  Playwright avec `dependencies`. Sur son propre runner il a sa PROPRE base :
  la protection devient structurelle. `--no-deps` empêche de rejouer les deux
  cents autres parcours pour satisfaire une dépendance qui ne sert plus là.
- **La préparation vit dans une action composite**, pas recopiée quatre fois.
  C'est le motif que ce projet paie régulièrement : ce n'est pas la copie
  qu'on remarque, c'est qu'une correction n'en répare qu'un quart.

**Et le premier résultat était mauvais, pour une raison que seule la mesure
pouvait dire.** Chemin critique 11 min 54 au lieu de 14 min 24 : deux minutes
et demie pour cinq runners. `npm ci` était passé de **dix-huit secondes à deux
travaux à SEPT MINUTES à cinq**, et la préparation variait de 3 min 24 à
8 min 01 d'un runner à l'autre. Le goulot avait changé de place — les tests
n'étaient plus le sujet, l'installation l'était.

D'où le cache de `node_modules` (et non seulement celui de npm), du navigateur
et de la construction Next. La première exécution après un changement de
verrous repaie l'installation ; les suivantes restaurent une archive depuis le
cache de GitHub, qui est bien plus près que le registre.

**`prisma generate` redevient une étape à part, et inconditionnelle.** Je
l'avais retirée en constatant que `postinstall` la faisait déjà. C'est vrai
tant qu'on installe ; un cache de `node_modules` retrouvé saute le
`postinstall`, et le client vit dans `src/generated/prisma`, **hors** de
`node_modules`. L'échec qu'une seconde évite ici est de ceux qu'on ne
comprend pas : des types de modèles absents sur une machine qui n'a rien
changé.

**Et le deuxième essai a rendu l'échec d'août, en CI cette fois.** Deux
tronçons de deux workers : `waitForURL` expire sur la CONNEXION dans
`bilan.spec.ts`, jamais sur ce que le test éprouvait. La cause se nomme
maintenant — les tests de langue passés en mode parallèle font tourner en
permanence des chargements de page rendus au serveur à côté des parcours qui
ouvrent un compte, et le haché bcrypt coût 12 perd sa place dans la file.

Deux réponses ont été écartées, et il vaut mieux dire pourquoi :

- **baisser le coût du haché en test.** C'est un choix de production ; lui
  donner un bouton, c'est accepter qu'une variable oubliée produise un jour
  des hachés faibles en ligne. La règle du projet vaut ici : un repli ne peut
  pas être plus permissif que ce qu'on demandait ;
- **allonger le délai de connexion.** C'est la façon la plus sûre de rendre un
  test muet, et ça ne réparerait rien — la file resterait aussi longue.

La réponse est de donner une MACHINE ENTIÈRE à chaque worker : **quatre
tronçons d'un worker chacun**. Un runner qui héberge un seul Chromium, un seul
processus de test et le serveur Next ne sature plus, et la contention disparaît
au lieu d'être arbitrée. En local il n'y a qu'une machine, donc deux workers y
restent le compromis mesuré.

**Le résultat, en quatre exécutions mesurées :**

| forme | chemin critique | préparation | état |
|---|---|---|---|
| deux travaux (V357) | 14 min 24 | 1 min 25 | vert |
| quatre travaux, 2 workers | 11 min 54 | 3 min 24 à 8 min 01 | vert |
| six travaux, 2 workers, avec caches | 10 min 20 | 0 min 49 à 5 min 45 | **un tronçon rouge** |
| neuf travaux, 1 worker, six tronçons | **6 min 52** | 0 min 40 à 1 min 02 | vert |

**52 % de moins**, et la préparation passe de trois à huit minutes à moins
d'une. Le dernier découpage a demandé SIX tronçons et non quatre, et c'est
l'équilibre qui l'a décidé : Playwright découpe au nombre de tests, qui ne dit
rien de la durée. À quatre, `parcours.spec.ts` — deux trajets complets, poste
et téléphone — partageait son tronçon avec `social.spec.ts`, qui fait jouer
trois comptes : 7 min 35 pendant que les trois autres finissaient sous deux
minutes et demie.

Ce que ça apprend au-delà du cas : **paralléliser ne divise pas le temps, ça
déplace le goulot.** Il est passé des tests à l'installation, puis de
l'installation au processeur d'un runner, puis au fichier le plus lent. Chaque
déplacement s'est vu à la mesure et à elle seule — aucun n'était visible dans
le fichier qu'on venait d'écrire, et le deuxième a failli passer pour un gain
alors qu'il ne rapportait que deux minutes et demie sur cinq runners.

### Un fichier de test tenait 43 % de la suite, sur un seul worker
`fullyParallel: false` enferme un FICHIER dans un worker : ses tests s'y
suivent, et c'est voulu — plusieurs parcours d'un même fichier partagent le
compte ouvert par le premier. Sauf que `langues.spec.ts` porte **87 tests sur
201**, et que ses six blocs de pages PUBLIQUES ne partagent rien du tout :
chacun ouvre son onglet, navigue, mesure, et s'en va. Le bloc « écrans
connectés », lui, déclare son mode série lui-même.

`test.describe.configure({ mode: "parallel" })` sur les six : le fichier seul
passe de **234 à 123 s**, 87 passés des deux côtés. Et le découpage en
tronçons s'équilibre au passage — **101/100 au lieu de 141/60** — parce que
Playwright répartit alors ces tests un par un au lieu du fichier entier.

**Ce que ça ne fait PAS, et il faut le dire.** La suite entière ne bouge pas
en local : 549 s avant, 550 s après, mesuré des deux côtés. Le second worker
était le long pole depuis le début, et libérer 111 s de travail ne raccourcit
rien tant qu'il n'y a pas une machine de plus pour l'absorber. Annoncer « la
suite est deux fois plus rapide » parce qu'un fichier l'est serait exactement
l'erreur que ce journal reproche ailleurs aux outils de mesure.

### Le premier test tombait, et je n'ai pas trouvé pourquoi
Quatre exécutions complètes sur six ont échoué sur le MÊME test, toujours en
position 1/203 — `clavier-modales`, toujours sur la connexion, `waitForURL`
expirant après trente secondes avec « Pseudo ou code incorrect » à l'écran.

Ce qui est établi, et qui suffit à ne pas s'en servir comme d'un prétexte :

- **c'est antérieur à mes modifications.** Le témoin, sans elles, tombe de la
  même façon, au même endroit ;
- **ça ne se produit pas en intégration continue**, où la suite passe ;
- **le message ne vient pas du client.** `LoginButtons` n'écrit
  `erreurPseudoCode` que sur `result?.error` — une panne réseau donnerait
  `erreurConnexion`. Donc `authorize` a bien rendu `null` ;
- **et pourtant la sonde posée dans `authorize` n'a jamais rien vu.** Les deux
  exécutions où elle était en place sont passées, 203 sur 203, sans une seule
  ligne « limite », « introuvable » ou « motdepasse ».

Autrement dit la sonde déplace le défaut, ce qui le range dans les courses.
Deux hypothèses ont été essayées et **démenties par la mesure**, ce qui vaut
mieux que de les garder :

- « le serveur est froid, Playwright le déclare prêt dès que `/cgu` répond, et
  `/login` n'est pas encore compilé ». Un réchauffage des trois chemins dans
  la préparation n'a rien changé. La ligne a été retirée : une ligne qui ne
  fait pas ce qu'elle annonce se relit comme une garantie ;
- « c'est le limiteur ». Impossible : sa clé porte le pseudo, qui est unique
  par test.

Rien n'est donc corrigé, et surtout rien n'est maquillé. Ce qui est fait :
c'est écrit ici avec le tableau des six exécutions, et la CI reste le juge —
elle est verte, elle joue la suite entière, et c'est elle qui garde `main`.
Un délai qu'on allonge sans savoir ce qu'on attend est la façon la plus sûre
de rendre un test muet ; une reprise posée sur la connexion masquerait un vrai
refus le jour où il arriverait.

**Et un rappel d'outillage, retombé dedans pour la troisième fois** :
`pkill -f "next-server"` tue le shell qui lance la commande, parce que le motif
figure dans sa propre ligne de commande. Sortie 144, aucun journal. On trouve
le processus par `ps -eo pid,args` et on le tue par son numéro.

**Un piège d'environnement, aussi** : la base locale écoutait sur 5432 quand
`.env` demande 5433. Toute requête authentifiée échouait, et le symptôme était
« le code ne s'affiche pas » — le troisième déguisement de cette panne-là
recensé ici. `pg_isready` ne suffit pas : il faut vérifier le PORT que
l'application demande.

### Avec les pompes, le produit n'enregistrait jamais rien
Trouvé en poursuivant une question du propriétaire qui partait d'une prémisse
fausse — « pourquoi le cumul ne court que depuis le 2 septembre ? ». Il court
depuis toujours : le cumul lit `jour <= aujourd'hui`, sans borne basse. S'il ne
montrait que le 2 septembre, c'est qu'il n'y avait **rien** avant.

Et la raison est structurelle. Une ligne `Paiement` n'est écrite que par un seul
chemin, `PATCH /api/dette`, le compteur de dette. Or la dette ne s'accumulait
que pour les exercices comptés en TEMPS (`pointsEnTemps`), et les pompes sont en
répétitions. Donc, pour qui joue avec l'exercice par défaut : la dette ne montait
jamais, la pastille n'apparaissait pas, le compteur était inatteignable, et
**aucun paiement n'était jamais enregistré**. Classement, mur des records et
niveau de compte restaient vides par construction, quoi qu'on joue. Neuf cent
soixante parties, deux points payés.

**Le raisonnement d'origine était juste et la conclusion ne l'était pas.** Il
est écrit dans le code : « des pompes se font tout de suite après la partie ;
un round de boxe n'a d'intérêt qu'une fois quelques minutes réunies ». C'est
vrai. Mais on en avait tiré « donc on n'enregistre rien », et c'est là que la
boucle du produit ne se refermait pas — celle qui fait tout son objet.

**Deux filtres se tenaient l'un l'autre**, et il fallait lever les deux :
l'accumulation (`pointsEnTemps` dans `/api/games`) et l'affichage
(`exercicesEnTemps` dans `reponseDette`). Chacun seul aurait donné un état
incohérent — une dette qui monte sans s'afficher, ou une pastille qui montre
zéro.

**Ce qui reste du raisonnement est désormais une affaire d'ÉCRAN.** Le registre
enregistre les deux ; c'est la fenêtre qui diffère. Une dette faite uniquement
de répétitions n'affiche aucun chrono et se solde d'une tape ; dès qu'un
exercice au temps est concerné, y compris mélangé à des pompes, le décompte
revient — c'est cette part-là qui demande qu'on réunisse quelques minutes, et
c'est elle qui commande. La décision vit dans `aChronometrer`, hors du
composant, parce qu'elle gouverne DEUX choses qu'on ne veut pas voir diverger :
ce que la fenêtre montre, et si un `setInterval` démarre.

**Le rattrapage, et pourquoi il est idempotent par construction.** Décision du
propriétaire : ce qui a déjà été enregistré a été fait. La migration écrit donc
un paiement par partie, daté du JOUR DE LA PARTIE — pas d'aujourd'hui, sans quoi
une seule journée porterait des mois d'effort et le mur des records n'aurait
plus de sens. Elle ne rattrape QUE la part non comptée en temps : la part en
temps avait déjà son chemin, et la reprendre la paierait deux fois. Le jeton
dérive de l'identifiant de la partie et il est unique en base, donc un second
passage ne peut rien insérer — éprouvé sur une vraie base : un passage insère,
le second rend zéro.

**Le seul trou connu, et il est petit** : une partie enregistrée entre le moment
où la migration passe et celui où le nouveau code sert n'est ni rattrapée ni
accumulée. Ça vaut quelques minutes de déploiement, et c'est écrit plutôt que
découvert plus tard.

**Deux tests tenaient l'ancienne règle, et ils l'ont tenue jusqu'au bout** —
« ne retient que les exercices comptés en temps » et « n'ajoute au compteur que
la part comptée en temps ». Ils sont tombés tous les deux, ce qui est exactement
leur travail : une règle de fond ne change pas en silence. Ils disent maintenant
la nouvelle, avec l'ancienne écrite au-dessus et la raison du changement.

**Et le parcours qui manquait était celui du cas par défaut.** Tous les
parcours qui touchaient à la dette commençaient par choisir la BOXE, avec un
commentaire expliquant pourquoi. C'était exact, c'était documenté, et personne
n'a demandé ce qui se passait pour les autres. `e2e/dette-pompes.spec.ts` suit
le chemin entier sans toucher aux réglages, et son dernier contrôle est le seul
qui compte : une ligne en base. Sabotage — le défaut d'origine remis à
l'identique — le parcours tombe.

### Une photo de l'écran a trouvé deux défauts que rien ne regardait
Le propriétaire a envoyé une capture pour trancher d'où venait un « 2 » qu'il
trouvait faux. Elle a tranché — c'était bien l'effort PAYÉ du classement, pas un
compteur d'activités — et elle a montré deux autres choses au passage, toutes
deux invisibles à qui lit le code.

**Le titre du panneau mentait sur l'onglet ouvert.** `classementTitre` valait
« Classement de la semaine » en dur, sous des onglets dont l'un dit « depuis
toujours ». L'écran se contredisait donc à chaque fois qu'on changeait d'onglet,
et le même libellé servait d'étiquette au groupe d'onglets, où il était faux de
la même façon.

Ce qui rend le cas instructif est que **la règle était écrite deux lignes plus
haut**, et appliquée à moitié : le commentaire du bloc dit « le libellé d'aide
suit celui qui est ouvert — une phrase qui parle de sept jours sous un tableau
cumulatif serait fausse ». C'est exact, ça a été fait pour la phrase d'aide, et
pas pour le titre. Une règle appliquée à un de ses deux endroits est la forme la
plus discrète de la duplication.

Le titre ne nomme plus de période : les onglets s'en chargent, et un titre qui
répète l'onglet ouvert n'apprend rien de toute façon.

**Le mur des records affichait une date de base de données.** `recordsLigne`
recevait `jour` tel qu'il sort de la table — « 2026-09-02 » — alors que la règle
du projet veut que toute date passe par `Intl`. Le symptôme visible sur la photo
est une coupure en travers de la ligne, « 2026-09- » puis « 02 » : le navigateur
coupe volontiers après un trait d'union. La date est formatée dans la langue de
l'écran, ses espaces rendus insécables pour qu'elle ne se casse pas non plus en
deux, et **le paramètre du gabarit s'appelle maintenant `jourFormate`** — c'est
le nom qui empêchera la prochaine date brute d'y entrer, pas le commentaire.

Recensé avant de corriger : c'est bien **une ligne et pas une classe**, aucun
autre gabarit de dictionnaire ne reçoit de date. Le dire évitera de chercher
une famille qui n'existe pas.

**Et aucun test ne pouvait voir ni l'un ni l'autre.** Le parcours du mur ouvert
vérifiait le pseudo et le chiffre, jamais la FORME de la date ; les tests de
langue refusent un « undefined » et un débordement, pas un titre qui contredit
l'onglet d'à côté. Le contrôle ajouté refuse désormais une date en `AAAA-MM-JJ`
dans la ligne du mur. Pour le titre, il n'y a rien à ajouter : le libellé ne
nomme plus de période, donc il ne peut plus être faux.

**La leçon d'outillage** : la capture d'écran a rapporté deux défauts en une
fois, sur un écran qui passait tous ses contrôles. Ce n'est pas un hasard —
elle regarde ce qu'aucun test ne regarde, c'est-à-dire ce qui est VRAI à
l'écran plutôt que ce qui est présent dans le DOM.

### Neuf cent soixante parties, niveau un — et le niveau passe à l'XP
Constaté par le propriétaire sur son propre compte, et c'est le genre de défaut
qu'aucun test ne pouvait trouver : **tout marchait exactement comme écrit.**

Le niveau se calculait sur l'effort PAYÉ et sur lui seul, pour une raison qui
reste bonne — quelqu'un qui perd beaucoup accumule de la dette, et faire monter
celui qui ne paie jamais serait le contresens d'un produit dont le sujet est de
payer. Le prix de cette règle ne s'est vu qu'à l'usage : à neuf cent soixante
parties enregistrées et deux points payés, on reste **niveau 1**. Le compteur
ne bougeait donc jamais pour la personne la plus assidue du produit, et un
niveau qui ne bouge pas n'est pas un niveau.

**Les deux symptômes signalés n'en faisaient qu'un.** « Le social dit que je ne
fais que deux activités » et « je suis à 960 parties et toujours niveau 1 » ont
la même cause : le chiffre affiché par le classement au cumul est l'effort
PAYÉ, et c'est lui qui décidait du niveau. Vérifié avant de conclure que le
compteur de parties était en cause : il lit `Game` filtré sur le compte et sur
`sansEnjeu: false`, et `sansEnjeu` ne peut être posé que par un `body.sansEnjeu
=== true` explicite — aucun chemin ne le met par accident.

**Ce que la nouvelle règle coûte, et il faut l'écrire.** Jouer rapporte
maintenant de l'XP quel que soit le résultat : perdre fait donc monter. Ce
n'est plus la porte que posait la première version. Ce qui la remplace est un
RAPPORT et non un mur — dix d'XP par activité, un par point payé — donc une
défaite de vingt points payée rapporte trente contre dix si on ne la paie
jamais. Payer reste de très loin le chemin le plus rapide ; ce n'est plus le
seul.

**La courbe est calée sur les repères donnés**, en activités et pas en XP,
parce que c'est ainsi que la demande a été formulée : dix activités pour le
niveau 2, trente pour le 3, soixante pour le 4, cent pour le 5. Le seuil vaut
`50 × n × (n−1)` d'XP, donc la même forme quadratique qu'avant avec un pas
doublé — et la démonstration de la forme fermée tient telle quelle, puisque
`1 + 4 xp / PAS` vaut `(2n − 1)²` quel que soit le pas. Le compte à l'origine
du signalement passe de **niveau 1 à niveau 14**, et le suivant lui demande
quatre-vingt-dix activités de plus.

**Le garde du pas a mordu, et c'était son travail.** `expect(PAS_NIVEAU).toBe(25)`
existait pour refuser qu'une courbe de progression change en silence. Il est
tombé ; le chiffre a été mis à jour AVEC sa raison, ce qui est la seule façon
correcte de faire taire un pin.

**Et la fonction que les écrans appellent prend désormais la SOURCE, pas un
nombre.** C'est structurel plutôt que documentaire : le sabotage avait montré
en juillet qu'on pouvait passer l'effort généré à la place du payé sans
qu'aucun test ne les distingue, puisque les deux sont des nombres. Avec la
source entière il n'y a plus de mauvais nombre à passer — c'est le module qui
décide ce que vaut un compte. Le témoin du test de route a dû être refait pour
la même raison : 9 570 d'XP donnent le niveau 14 contre 4 pour la bonne
source, et ces deux chiffres-là ne se confondent pas.

Quatre sabotages, quatre échecs.

**Ce qui n'est PAS fait, et pourquoi.** Les défis personnels doivent rapporter
de l'XP — c'est la réponse donnée à la question 139, restée « à voir » jusque-là.
Ça demande de RETENIR qu'un défi a été fini : un défi du jour est une fonction
pure du jour, mais savoir s'il a été rempli le 12 août demande les parties et
les paiements de ce jour-là, qu'on ne relit pas. Le stocker est la bonne
réponse — des LIGNES, comme `Paiement`, dont l'XP se déduit par somme, jamais
un total rangé qui finirait par diverger. C'est une migration et un chemin
d'écriture ; c'est la suite, pas ce commit. Et la récompense des défis
PARTAGÉS reste ouverte : le propriétaire l'a explicitement remise à plus tard.

### La fenêtre d'envoi est atteinte un jour sur deux, mesuré
Le journal disait « trois à six passages par jour », relevé avant que la
fenêtre existe. Vérifié sur les CENT dernières exécutions du travail programmé,
soit douze jours : **8,3 passages par jour, et six jours sur douze sans aucun
passage entre 07:00 et 10:00 UTC** — c'est-à-dire hors de la fenêtre 9 h–midi
en heure locale française.

Le rappel du matin part donc environ un jour sur deux. Et le bilan
hebdomadaire, qui ne part que le LUNDI, **perd une semaine sur deux** : un
lundi manqué n'est pas rattrapé le mardi, la marque par jour local le fait
simplement sauter.

C'est le même défaut que celui du plan, à un jour d'intervalle : un chiffre
écrit une fois, juste ce jour-là, au-dessus de quelque chose qui a bougé depuis.
« Aucun à l'heure qu'il fallait » était vrai avant la fenêtre et ne l'est plus ;
laissé tel quel, il fait croire que rien ne part, alors que la moitié part.
`docs/lancement.md` porte le chiffre mesuré.

Ce qui NE se décide pas ici : élargir la fenêtre au-delà de midi ferait un
« rappel de la journée », ce qui n'est pas la même promesse. Et poser un
déclencheur fiable — les tâches planifiées de Vercel — est une décision
d'infrastructure. Les deux figurent dans les questions, pas dans le code.

### Le plan comptait faux sur la section que je venais de remplir
Trouvé par acquit de conscience, en vérifiant l'arithmétique du plan avant d'en
rendre compte. La section « Le social » annonçait **6 à faire · 7 faits** ; son
tableau portait **2 à faire · 11 faits**. J'avais coché ses lignes une par une
toute la nuit — c'est la règle — sans jamais reprendre l'en-tête qui les compte.

Le coût n'est pas cosmétique. Le plan est ce qu'on LIT pour décider du chantier
suivant, et CLAUDE.md dit déjà pourquoi : « un plan qu'on ne tient pas à jour
ment, et on lui obéit quand même ». Celui-ci envoyait refaire quatre lignes déjà
faites, et cachait qu'il n'en restait que deux — dont aucune n'est à ma portée.

C'est la forme la plus discrète de la faute que ce projet rencontre sans cesse :
**un nombre écrit une fois, juste ce jour-là, au-dessus de quelque chose qui
bouge.** La réserve de 420 pixels de l'écran des amis était le même défaut ; les
trois numéros de version de PostgreSQL dans le workflow de sauvegarde aussi.

`src/planCompte.test.ts` compare chaque en-tête chiffré au tableau qui le suit.
Il ne juge pas ce qui est fait — il refuse seulement que l'annonce et le contenu
divergent. Deux témoins, parce que `toEqual([])` est vrai sur une liste vide :
au moins dix sections chiffrées trouvées, et aucune dont le tableau soit vide —
sans quoi on comparerait des zéros à des zéros.

Trois sabotages, trois échecs : l'en-tête remis à sa valeur périmée, une ligne
cochée sans reprendre l'en-tête, et le motif rendu aveugle.

### Un champ renommé vidait un panneau entier, sans erreur ni test rouge
Trouvé en cherchant si le défi du jour et l'objectif collectif méritaient un
parcours navigateur. La réponse est non, et ce qui manquait était ailleurs, un
cran plus bas.

`chargerProgression` déclare un type `Progression` dont **tous les champs sont
des `unknown`** : il ne dit rien de leur contenu, il dit seulement lesquels
existent. C'est un contrat de NOMS écrit à la main, en face d'un objet composé
à la main dans la route, avec du JSON entre les deux — donc entièrement hors du
compilateur. Un `defi` renommé `defiDuJour` dans la route ne casse rien :
`p?.defi` devient `undefined`, le panneau reste `null`, et le tableau de bord
perd un bloc entier. Aucune erreur, aucun test rouge, rien à l'écran qui le
dise.

C'est la famille de `colonnesHistorique.test.ts`, un cran plus loin : là-bas une
colonne manquante laissait une case vide, ici c'est un panneau qui ne se rend
plus.

**Et c'est une classe, pas une ligne.** Les DEUX routes fusionnées du projet ont
exactement cette forme — `/api/progression` avec `Progression`, `/api/contexte`
avec `ContexteCompte`. Elles ont été écrites pour la même raison, donc elles
portent le même trou. `src/contratJson.test.ts` les lit à la source et compare
dans les deux sens : un champ déclaré que la route n'envoie pas est un panneau
mort, un champ envoyé que personne ne déclare est du volume payé pour rien sur
une route appelée à chaque chargement. Une troisième route fusionnée s'ajoute au
tableau en une ligne — sans quoi elle naîtrait sans garde, comme les deux
premières.

**Le recensement dit treize, pas deux, et ma phrase était trop large.** Autant
d'écrans appellent une route en déclarant leur propre type en face. Quatre sont
gardés — `/api/games` par `colonnesHistorique.test.ts`, plus les trois du
tableau. Les neuf autres ne le sont pas, et c'est un choix écrit plutôt qu'un
oubli : ce sont des formulaires et des panneaux d'administration, où un champ
perdu se voit tout de suite parce qu'on vient de le saisir. Le danger est sur ce
qu'on LIT sans l'avoir écrit, et qu'on ne recalcule pas de mémoire.

**Le troisième contrat a trouvé un champ mort, puis un second ailleurs.**
`/api/classement` envoyait `fenetre` — une constante — que personne ne lit ;
`/api/seance` faisait exactement pareil. Deux fois le même petit gaspillage, sur
deux routes écrites à deux moments différents, et c'est précisément ce qu'un
garde attrape mieux qu'une relecture. `debut`, lui, reste et se déclare comme
toléré : `e2e/social.spec.ts` le lit pour vérifier la borne basse de la fenêtre
AVANT de regarder le tableau. Un champ qui sert à diagnostiquer ne se supprime
pas au motif qu'aucun composant ne l'affiche — il se déclare, et un test refuse
qu'une tolérance cesse de désigner quelque chose de vivant.

**Deux motifs trop étroits, tous deux déjà écrits ici sous une autre forme.**
Le type d'un écran n'est pas `export`é — il ne sert qu'à lui. Et une route
écrit `lignes,` en RACCOURCI d'objet : exiger les deux-points l'aurait rendue
invisible côté route, donc « déclarée mais non envoyée » côté écran, et le
garde aurait accusé un champ parfaitement présent. C'est la faute évitée de
justesse sur `filtreParCompte`, où la même exigence recalait
`where: { id, userId }`.

**Le premier `NextResponse.json` d'une route est presque toujours le 401.** Mon
extraction partait de lui — il est écrit sur une ligne — et balayait donc tout
ce qui suit, l'objet `source` compris : dix champs annoncés au lieu de six. Le
garde tombait, ce qui est le bon comportement, mais pour la mauvaise raison, et
un garde qui échoue pour la mauvaise raison envoie corriger ce qui n'a rien. Il
s'ancre maintenant sur la forme MULTILIGNE.

Huit sabotages, huit échecs : un champ renommé sur chacune des trois routes, un
champ ajouté sans lecteur, un champ retiré du type, le motif rendu aveugle, le
nom du type qui ne désigne plus rien, et une tolérance vidée de son objet.

### Le mur ouvert n'avait aucun test navigateur, et le sabotage a corrigé le mien
C'est la PREMIÈRE surface du produit où un compte voit le pseudo et l'effort de
quelqu'un avec qui il n'a aucun lien. Partout ailleurs il faut une amitié
acceptée des deux côtés ; ici il suffit d'avoir un compte. Ce qu'il publie
tient donc entièrement à deux conditions lues en base — `recordsPublics` et
`fantome` — et une seule des deux qui saute publie quelqu'un qui avait demandé
l'inverse.

Les tests de route disent ce que la route décide. Ils ne disent rien de ce qui
se joue ENTRE comptes : que le réglage cliqué par l'un ressorte sur l'écran de
l'autre, et que celui qui n'a rien touché n'y soit nulle part. Quatre comptes,
aucun ami de personne : un qui ouvre son mur **par l'écran de réglages**, un
qui garde le défaut et paie PLUS, un qui ouvre le sien tout en se cachant et
paie plus encore. Les chiffres sont plus gros exprès — si une condition saute,
la ligne prend la première place et l'échec est franc.

**Le troisième sabotage a corrigé mon commentaire.** J'avais écrit que le
contrôle sur la RÉPONSE distingue « filtré en base » de « filtré à
l'affichage ». Filtre déplacé dans le composant : c'est le contrôle de l'ÉCRAN
qui tombe en premier. Le mur ne publie que le VAINQUEUR de chaque période, donc
une ligne fermée qui traverse le réseau est forcément celle qui a pris la
place, et la cacher laisse le mur vide. **Il n'existe aucun état où la réponse
la porte et où l'écran reste juste**, et mon commentaire promettait le
contraire. Il dit maintenant ce que le contrôle prouve — et pourquoi il n'est
pas décoratif : il mordra le jour où ce mur publiera cinq lignes au lieu d'une.

C'est la leçon déjà écrite trois fois cette nuit sous d'autres formes : **un
test qui passe ne dit pas ce qu'il éprouve**, et seul le sabotage le dit. Ici
il n'a pas trouvé un défaut du produit, il a trouvé une phrase fausse dans mon
propre test — ce qui se relit comme une garantie et fait cesser de vérifier.

Deux pièges d'écriture, tous deux déjà dans ce fichier. La rubrique des
réglages s'ouvre par le FRAGMENT (`/settings#effort`) et non par un paramètre :
`/settings` seul rend la liste, où le bouton n'existe pas. Et le mur a DEUX
lignes gagnées par le même paiement — « ce mois-ci » et « depuis toujours » —
donc `toBeVisible` tombait sur une violation du mode strict. Le compte exact
plutôt qu'un `.first()` : il dit l'état réel, là où le premier trouvé passerait
aussi bien avec une ligne qu'avec dix.

Trois sabotages, trois échecs. Dix parcours au vert dans le fichier.

**Et l'intégration continue a trouvé ce que mes dix exécutions locales n'ont pas
vu.** Le test est tombé en CI sur une seule ligne : `corps.includes("800")` était
VRAI alors que le compte fermé était bien absent — `fermeVu` valait `false`, donc
le filtre faisait exactement son travail. « 800 » fait trois caractères, et du
JSON en contient : dans un identifiant, dans une date, dans un total. **Le
contrôle pouvait être vrai sans rien prouver, et sur une autre base il l'a été.**

**Et le recensement qui a suivi a trouvé six autres assertions de la même
famille, dans le même fichier — dont une qui ne prouvait rien seule.**
`toContainText("150")` est VRAI sur une ligne qui affiche 5150 : le contrôle du
retour à la semaine passait donc sur un onglet resté bloqué sur le cumul, et
n'était sauvé que par l'assertion voisine.

**La correction évidente était fausse, et la mesure l'a dit.** Poser une
frontière de mot (`\b150\b`) échoue aussi, parce que **`toContainText` colle
les textes des descendants sans séparateur** : la ligne rend
« 1Duelmtmj7qi83c5150 points », un pseudo qui finit par un chiffre se soude à
la valeur, et la frontière n'existe plus. Pire, ça marche dans les deux sens :
un `not` deviendrait faussement rouge le jour où une marque aléatoire finit par
le bon chiffre.

Les nombres se lisent donc DANS LEUR CELLULE — la troisième colonne ne porte
que l'effort — et on y lit le NOMBRE, pas une sous-chaîne. C'est exact,
indépendant de la langue, et impossible à satisfaire par accident. Sabotage : la
période forcée à la semaine dans la route, le parcours tombe.

Ce n'est donc pas un aléa, et il ne fallait surtout pas relancer : c'est la
famille déjà écrite ici — « une machine lente ne se trompe pas, elle révèle » —
sous une forme nouvelle. Un pseudo porte une marque tirée au hasard et ne peut
pas se trouver par accident ; un nombre nu, si. Les chiffres se lisent
maintenant à leur place, dans les lignes composées du mur, ce qui attrape en
prime un défaut que le pseudo ne verrait pas : le bon compte publié avec le
mauvais chiffre — un `_max` sur les points au lieu d'une somme par jour, dont le
commentaire de la route dit déjà qu'il se verrait le soir où quelqu'un paie sa
dette en deux fois.

**Et la ligne 087 du plan était la 148 sous un autre numéro** — « un système de
niveau » demandé deux fois, à deux endroits de l'interrogatoire. Elle est
cochée avec sa raison écrite, pour que personne n'aille chercher un second
système de niveau qui n'existera jamais.

### Dépendances, au 3 septembre : une haute réellement corrigée
`fast-uri` 3.0.0 à 3.1.5, quatre avis dont deux de falsification de requête
côté serveur. Elle arrive par `prisma` → `@prisma/dev` → `ajv`, c'est-à-dire
par l'outillage de la ligne de commande, et non par le client d'accès aux
données. Le correctif est un saut de correctif — 3.1.5 → 3.1.7 — donc il se
prend : c'est la première fois depuis longtemps qu'`npm audit` propose autre
chose qu'un retour de version majeure.

Le même paquet, plus `@xmldom/xmldom`, vivait dans l'application de bureau par
`electron-builder`. Les deux sont partis d'un `npm audit fix` : **zéro
vulnérabilité** côté bureau, contre une haute et une modérée avant.

**Ce qui reste est `mysql2`, et le raisonnement n'a pas bougé** — il a même
gagné un second avis, une bombe de décompression dans le protocole compressé.
Les deux exigent une connexion MySQL, ce projet parle à PostgreSQL, et le seul
« correctif » proposé est de revenir à `prisma@6.19.3`, un retour de version
majeure sur le client d'accès aux données. `src/dependanceMysql.test.ts` garde
le raisonnement plutôt que la conclusion : il tient à deux conditions — la base
est PostgreSQL, aucun code ne charge un pilote MySQL — et le jour où l'une
tombe, l'exemption tombe avec elle.

Deux mises à jour appliquées en plus, toutes deux mineures : `lucide-react`
1.39 → 1.40 et `@types/react-dom` 19.2.5 → 19.2.7. Les majeures écartées le
restent — `typescript` 7, `eslint` 10, `@types/node` 26, `prisma` 8 en version
candidate, `@libsql/client` 0.18 — et `electron` 43 → 44 avec elles : un saut
majeur se relit, il ne se prend pas de nuit. `next-auth` continue de s'afficher
« en retard » sur 4.24.15, ce qui est faux à chaque audit : c'est l'ancienne
branche stable, le projet est sur la 5 en préversion.

**L'application de bureau passe en 0.9.11 pour un fichier de verrous.** Rien de
ce qui s'installe ne change — `desktop/src` est intact, le pont est le même —
et la règle du propriétaire dit de publier dès qu'une modification touche
`desktop/`. Elle est suivie à la lettre plutôt qu'interprétée : une règle sans
exception se tient, une règle avec des exceptions qu'on invente au cas par cas
finit par ne plus rien garder. Le coût est une exécution de construction ; les
copies installées se mettent à jour toutes seules et ne verront rien.

### Le profil d'un ami, et qui décide de ce qu'on y voit
Ligne 120. La réponse est « ce qu'il autorise » : la décision appartient donc à
celui qu'on REGARDE, jamais à celui qui regarde.

**Deux niveaux, pas trois.** La question opposait le détail au total ; ajouter
un « rien du tout » aurait été inventer une réponse qu'on n'a pas. Qui ne veut
rien montrer retire l'ami, et ce geste existe déjà.

**Le défaut est le plus FERMÉ.** Quelqu'un qui n'ouvre jamais ses réglages ne
doit pas se mettre à partager davantage parce qu'on a ajouté une
fonctionnalité. C'est l'inverse de la règle du confort, et c'est la bonne pour
tout ce qui sort du compte.

**Le filtre est à la LECTURE**, comme pour le mode fantôme : au total, les
champs du détail ne sont pas dans la réponse, même pas vides. Filtrer à
l'affichage les ferait sortir de la base et traverser le réseau, donc figurer
dans l'onglet réseau de qui les demande — exactement là où on a choisi qu'ils
ne soient pas.

**Une amitié EN ATTENTE ne donne aucun droit**, sinon demander suffirait à
regarder et personne n'aurait à accepter. Et l'absence d'amitié rend 404, pas
403 : distinguer « pas votre ami » de « n'existe pas » apprendrait, identifiant
par identifiant, quels comptes existent. C'est la règle déjà posée pour le
groupe plein, qui répond comme un code inconnu.

**Une valeur non prévue est REFUSÉE côté écriture**, jamais ramenée au défaut.
Le défaut étant le plus fermé, une conversion silencieuse serait sûre — mais
elle enregistrerait « total » pour quelqu'un qui vient de demander « détail »,
et il croirait avoir ouvert quand il a fermé. Un réglage qu'on ne vérifie
jamais doit dire quand il n'a pas pris.

**Indépendant du mode fantôme**, qui ne parle que des CLASSEMENTS. Les deux se
combinent : visible au classement et fermé sur le détail, ou l'inverse.

Sept sabotages. Le dernier est passé au vert, et c'était encore un trou de mes
tests : je n'avais écrit aucun contrôle sur le REFUS d'une valeur inconnue à
l'écriture. Six valeurs y passent maintenant, chacune séparément. Sept échecs
après correction.

### Le mode fantôme, et le trou que le classement avait ouvert
Ligne 129, et elle referme quelque chose que j'avais ouvert le matin même. Le
classement publie le pseudo, le volume payé et l'état de retard à TOUS ses
amis, et la seule façon d'en sortir était de retirer l'ami — c'est-à-dire de
casser le lien pour éviter ce qu'il montre. Je l'avais écrit dans le journal en
livrant le classement ; c'est réparé.

**Ce qui est caché, c'est la LIGNE ENTIÈRE, pas seulement le nom.** La réponse
129 dit « sans y apparaître nommément », et masquer le seul pseudo serait du
théâtre : à trois amis, une place et un volume désignent quelqu'un aussi
sûrement qu'un pseudo.

**Le filtre est en base, pas à l'affichage.** Écarter la ligne après coup la
ferait quand même sortir de la base et traverser le réseau : elle serait dans
l'onglet réseau de qui regarde, c'est-à-dire exactement là où quelqu'un a
demandé à ne pas être. La différence ne se voit pas à l'écran, et c'est toute
la différence.

**On se voit toujours soi-même**, d'où le `OR` plutôt qu'un simple
`fantome: false`. Un classement où l'on ne figure pas n'est pas son classement,
et se cacher des autres n'est pas se cacher de soi.

**Une valeur qui n'est pas un booléen est REFUSÉE**, jamais convertie. C'est un
réglage de confidentialité : enregistrer « visible » pour quelqu'un qui vient
de demander l'inverse est le seul résultat qu'on ne peut pas rattraper — il
croit s'être caché, et il ne le vérifiera jamais. Même raison pour le retour en
arrière à l'écran quand le serveur refuse.

**La politique le DÉCRIT plutôt que de l'exempter.** C'est un réglage
d'affichage, donc exemptable au sens strict ; c'est surtout un contrôle de
confidentialité, et une politique qui ne le mentionne pas rate l'endroit exact
où quelqu'un cherche à savoir s'il existe. Il figure sur la ligne des amis,
avec ce qu'une amitié donne à voir.

Six sabotages. **Le dernier est passé au vert, et c'était mon test qui était
faux** : j'avais fait pointer le garde de politique sur « liste d'amis », le
libellé de la LIGNE, plutôt que sur la phrase du mode fantôme. Il serait donc
resté vert si la mention disparaissait — c'est-à-dire précisément ce qu'il
prétendait garder. C'est le motif déjà vu deux fois aujourd'hui, sous une
troisième forme : un test qui passe ne dit pas qu'il éprouve quelque chose. Six
échecs après correction.

### Une partie refusée comptait quand même
Signalé dans la foulée de la question en plein écran : « il faut même pas que
ça se mette dans l'historique si je dis non, ou ça peut m'annoter genre annulé
ou sans enjeu ».

Le refus n'empêchait que le mode SESSION. La partie, elle, s'enregistrait
normalement — avec son coût et sa dette. Autrement dit, refuser ne refusait
rien de ce qui compte.

**Trois façons de faire, et c'est le propriétaire qui a tranché** : la partie
s'enregistre, annotée « sans enjeu », à coût nul, ET hors de toute
statistique. Les deux autres options avaient chacune leur défaut — ne rien
enregistrer fait jouer cinq parties pour n'en montrer que deux sans que rien
n'explique l'écart ; annoter sans écarter laisse ces parties fausser le
winrate et les graphiques.

**Six lectures filtrent, quatre gardent, et la liste est tenue par un garde.**
Filtrent : le tableau de bord (winrate, champions, graphiques, progression), les
paliers, la progression, le détail horaire, le bilan de saison, et — le moins
évident — **le comptage de maîtrise du champion**. Sans ce dernier, une soirée
refusée ferait monter la surcharge de maîtrise, donc changerait le coût des
parties SUIVANTES : un défaut qui ne se voit jamais sur la partie qui l'a créé.
Gardent, avec leur raison écrite : l'historique (c'est tout l'objet), la
correction de date, l'export de données (l'article 20 couvre TOUT ce qu'on
garde), et la liste des parties Riot déjà enregistrées — l'écarter la ferait
proposer une seconde fois.

**Le souvenir vit dans le stockage du navigateur, pas dans la coquille**,
contrairement au silence de la pastille. Ce n'est pas une incohérence : le
silence est une décision d'AFFICHAGE, que seule la coquille peut appliquer ; le
sans-enjeu est une décision d'ENREGISTREMENT, prise et consommée par la page.
Le faire passer par le pont aurait ajouté une méthode au contrat, donc une
version à publier et un repli à tenir devant les copies installées, pour rien.

Il s'efface à chaque démarrage de partie, **avant toute autre sortie** de la
fonction. Placé plus bas, il survivrait à un jeu dont la détection ne lance pas
de session ou à une session déjà en cours, et la partie suivante
s'enregistrerait sans enjeu sans que personne l'ait demandé — le compteur de
dette resterait muet, ce qui ne ressemble pas à sa cause. Une péremption de six
heures rattrape le démarrage manqué.

**Dans le doute, on ENREGISTRE.** Une marque illisible, datée du futur ou
périmée ne vaut pas refus : perdre le coût d'une partie qu'on voulait compter
se voit et se corrige à la main, l'inverse est une dette qu'on n'a pas méritée.

Sept sabotages. **Trois sont passés au vert au premier essai, et ce sont eux
qui apprennent quelque chose :**

- « une partie sans enjeu coûte son prix » et « alimente la dette » ne
  faisaient tomber aucun test : je n'avais écrit aucun contrôle sur le coût ni
  sur la dette, les deux propriétés qui font tout l'objet du changement ;
- pire, le contrôle que j'ai ajouté pour la dette était **vrai par accident**.
  `accumulerDette` ne compte que les exercices mesurés en TEMPS, et le compte
  du fichier de test paie en pompes : aucune partie n'y alimente jamais la
  dette. Il a fallu donner la boxe au compte et ajouter le témoin — « une
  partie ordinaire, elle, l'alimente » — sans lequel le contrôle reste vrai
  quoi qu'il arrive ;
- et « une marque illisible vaut refus » passait parce qu'aucun de mes six cas
  ne distinguait le contrôle de TYPE : une date écrite en chaîne mais
  numériquement valable traverse la comparaison et la soustraction, qui
  coercent toutes les deux. Le cas manquant est `{"le":"1800000000000"}`.

C'est la même leçon sous trois formes : un test qui passe ne dit pas qu'il
éprouve quelque chose. Sept sabotages, sept échecs après correction.

Au navigateur, le parcours refuse une partie, **recharge la page**, puis la
termine — le rechargement est précisément ce qu'un état React ne survivrait
pas, et c'est la raison pour laquelle le souvenir vit dans le stockage.

### La question tenait dans un coin, et personne ne la voyait
Signalé dans la foulée : « je n'ai pas pensé à cocher et je n'ai pas vu le
message ».

**C'est le pire genre de défaut : tout fonctionne.** La question EST posée, le
pont répond, le délai court, la réponse revient. Simplement, elle fait 230
pixels dans un coin par-dessus un écran de chargement — donc on ne la voit pas,
donc on n'y répond pas, donc elle expire. Et une expiration vaut refus. Le
résultat est exactement celui qu'on aurait sans la question, et rien ne le
signale.

Elle prend maintenant tout l'écran : voile sombre sur le jeu, texte en
`clamp(28px, 4.2vw, 64px)` — la même question doit rester lisible sur un
portable de treize pouces et sur un ultra-large —, deux boutons qu'on ne rate
pas.

**Ce qui compte le plus n'est pas l'agrandissement, c'est le retour.** Une
pastille restée plein écran intercepte la souris pendant toute la partie, ce
qui est bien pire que pas de pastille du tout. La taille se rend donc AVANT
tout le reste dans la fermeture, et deux tests le tiennent : à la réponse, et
à l'expiration — ce second cas étant précisément celui qui a motivé le
changement.

**Un troisième cas, qui ne se serait vu qu'en jouant** : un jeu qui démarre
applique ses réglages de position, ce qui appelle `replacer()`. Pendant une
question, ça la réduisait à 230 pixels au pire moment — et la question restait
parfaitement fonctionnelle, donc rien ne l'aurait dit. Un drapeau fait passer
`replacer()` son tour tant qu'une question occupe l'écran.

Quatre tests, trois sabotages, trois échecs.

### Refuser la session laissait la pastille par-dessus le jeu
Signalé par le propriétaire du produit : « quand on met non pour lancer une
session quand la partie se lance, il faudrait que la pastille soit cachée
jusqu'au prochain écran de chargement ».

C'est juste, et l'oubli est de la même famille que celui d'avant : on avait
traité ce que le refus ne DOIT PAS faire — ne pas lancer de session — sans
traiter ce qu'il doit faire. La pastille restait donc à l'écran, c'est-à-dire
exactement la chose qu'on venait d'écarter.

**Un silence, pas une coupure.** `masquerJusquALaProchainePartie()` ne touche à
aucun réglage : couper la pastille pour de bon est un autre geste, dans les
réglages, et le confondre avec un refus ponctuel reviendrait à retirer une
fonction que personne n'a demandé à retirer.

**Le silence se lève à l'OUVERTURE d'une partie, pas à sa fermeture.** C'est la
portée demandée — « jusqu'au prochain écran de chargement ». Posé sur la fin de
partie, il sauterait dès qu'on quitte, donc AVANT l'écran où la question se
repose, et la pastille reviendrait entre deux parties. Un test tient ce cas
précis.

**L'état vit dans la COQUILLE, pas dans la page.** La page se recharge, la
coquille non, et c'est elle qui sait quand une partie commence. Un silence
tenu par la page disparaîtrait au premier changement d'écran.

**Seul un « non » cliqué tait la pastille.** Une question expirée se traite
comme un refus pour le LANCEMENT de session — c'est écrit des deux côtés du
pont — mais pas pour l'affichage : personne ne l'a vue, et retirer alors la
pastille enlèverait quelque chose que rien n'a demandé à enlever.

**Une ligne a été écrite, sabotée, et retirée.** J'avais ajouté un
`muet = false` sur la branche explicite d'`afficher`, en croyant que « un geste
explicite lève le silence ». Le sabotage l'a démenti : la retirer ne faisait
tomber aucun test, parce que le garde laisse déjà passer toute demande
explicite et qu'une partie qui commence lève le silence de toute façon. C'est
le défaut déjà écrit ici pour le module de stockage — **une ligne qu'on peut
retirer sans qu'un test tombe ne tient rien, et elle se relit comme une
garantie.** Elle est partie ; le test qui l'accompagnait dit maintenant ce
qu'il prouve vraiment : la demande PASSE OUTRE le silence, elle ne le lève pas.

Cinq tests, quatre sabotages, trois échecs — le quatrième est celui qui a fait
retirer la ligne. Et le garde du contrat du pont a mordu comme prévu quand la
méthode a été retirée de `preload.js` en la laissant déclarée : c'est
exactement le défaut qu'il existe pour attraper, « undefined is not a function »
dans l'application installée seulement.

Application de bureau en **0.9.12**, publiée dans la foulée : la page appelle
une méthode que les copies antérieures n'ont pas, et le repli est écrit — la
pastille reste, ce qui est le comportement d'avant.

### Le parrainage, et l'avantage qu'on ne pouvait pas donner
Ligne 119, et c'est le seul canal d'acquisition du plan qui travaille sans
qu'on s'en occupe. Le retour reçu de Reddit — « ça fait trop IA » — dit assez
que la page seule ne suffit pas : ce qui amène du monde ici, c'est quelqu'un
qui invite quelqu'un.

**La question difficile n'était pas le lien, c'était l'avantage.** La réponse
119 dit « avec un avantage pour les deux », et le produit n'a ni monnaie ni
palier payant : l'avantage ne peut donc être qu'une chose qui existe déjà.
Deux candidats ont été écartés, pour la même raison :

- **offrir des points d'effort** — ils sont l'unité de la dette, et un point
  donné est une pompe que personne n'a faite. Le classement, les paliers et le
  bilan deviendraient faux d'un coup ;
- **retirer de la dette** — même chose, à l'envers.

Ce qui reste, et qui ne coûte rien au registre : **les deux comptes deviennent
amis.** Le filleul arrive avec quelqu'un dans son classement au lieu de la
phrase « tu es seul ici » — celle-là même que le classement affichait la veille
— et le parrain gagne la personne qu'il a fait venir. C'est immédiat,
réciproque, et ça se retire des deux côtés comme n'importe quelle amitié.

Ce n'est pas un ajout non sollicité, et la distinction tient : le filleul a
cliqué le lien, le parrain l'a publié. Les deux ont consenti à ce que ce lien
fasse quelque chose. Le plafond de cent amis vaut toujours pour qui collerait
son lien partout.

**La règle qui gouverne tout le reste : un code fautif ne fait JAMAIS échouer
l'inscription.** Un lien tronqué par un client de messagerie, recopié de
travers, ou dont le parrain a supprimé son compte, laisse passer la création du
compte. Refuser reviendrait à perdre exactement la personne qu'on venait de
convaincre, en lui disant que c'est SA faute. C'est la décision déjà prise pour
l'objectif par défaut : une décoration qui manque ne refuse pas un compte.

**Le lien se pose dans la même écriture que le compte**, et pas après :
`parrainId` est passé au `create`. Posé ensuite, une panne entre les deux
laisserait un filleul sans parrain — et ça ne se rattrape pas, puisque le lien
ne se pose qu'à la création. L'amitié, elle, vient après et son échec ne coûte
que lui-même : le compte existe, le lien est posé, l'amitié se redemande à la
main. C'est l'ordre déjà choisi pour le paiement de dette, avec le même
raisonnement.

**Le code réemploie celui des groupes** plutôt que d'en écrire un second :
même problème — un code se dicte en vocal avant de se taper — donc même
alphabet sans caractères qui se confondent, et même rejet des octets hors d'un
multiple de sa taille. L'écrire une deuxième fois aurait été le septième cas de
règle dupliquée de ce projet.

**Il se tire à la PREMIÈRE LECTURE**, contrairement au jeton de diffusion qui
attend qu'on le demande. La différence n'est pas un oubli : une adresse
publique qui montre quelque chose de vous ne doit pas exister par défaut,
alors qu'un code de parrainage ne révèle rien — il ne permet que de créer un
compte en devenant votre ami. Le mettre derrière un bouton « engendrer »
ajouterait un geste entre quelqu'un et la seule chose qu'il vient chercher.

**Cinq collisions d'affilée valent un renoncement**, pas une boucle : sur
31^8 c'est improbable, et si ça arrive le tirage est cassé plutôt que
malchanceux. La route rend alors `null` et l'écran dit que le lien n'a pas pu
être créé — ce qui est vrai — au lieu de tourner. Une panne qui n'est PAS une
collision se laisse remonter : la masquer en « pas de code » enverrait chercher
un défaut de tirage là où la base est hors service.

**L'adresse partagée ne porte PAS de préfixe de langue.** `/beta?p=CODE` fait
négocier la langue à celui qui l'ouvre, plutôt que d'imposer celle de celui qui
a copié le lien. Quelqu'un qui partage sur un serveur international n'envoie
pas tout le monde sur une page française.

**Deux gardes ont mordu sur les colonnes ajoutées**, ce qui est leur travail.
`compte.test.ts` a exigé qu'on range `codeParrain` et `parrainId` d'un côté ou
de l'autre de ce qui sort du compte : les deux sont refusés, le code parce
qu'il n'a rien à voyager à chaque chargement de page — c'est la leçon du jeton
de diffusion — et `parrainId` parce que c'est un renseignement sur QUELQU'UN
D'AUTRE, qui dirait à qui regarde l'onglet réseau par quel compte celui-ci est
arrivé. Et `politiqueComplete.test.ts` a exigé une ligne de politique sur les
quatre champs, dans les six langues.

**`parrainId` a rejoint les colonnes de compte du garde de filtrage** :
compter ses filleuls, c'est filtrer `User` sur son propre compte, par une
colonne qui pointe vers lui.

Neuf sabotages unitaires, neuf échecs. Au navigateur, deux tests et deux
sabotages : le code retiré du corps de la requête, et un code fautif rendu
bloquant.

**Le premier sabotage n'a pas compilé**, et c'est noté comme tel plutôt que
compté comme un test qui mord : retirer `parrain` de l'envoi rendait l'état
inutilisé, et `noUnusedLocals` le nomme. Réécrit pour compiler — la valeur
part vide — il fait tomber le parcours.

**Ce que le parcours prouve et qu'aucun test unitaire ne peut voir** : que le
code SURVIT au formulaire. Il entre par l'adresse, traverse un composant qui ne
l'affiche jamais, et ressort dans le corps d'une requête — trois endroits où il
peut se perdre sans que rien ne le dise, puisqu'une inscription sans parrain
réussit exactement comme une inscription avec.

### V352 vérifiée, et le témoin qu'il a fallu chercher ailleurs
Le réflexe était de pousser `/api/classement` et de conclure du 307 que la
route existe. **Il ne prouve rien** : `/api/inventee` rend exactement le même
307 vers la connexion, puisque le middleware traite toute adresse d'API non
publique comme protégée. Un code de réponse identique pour « existe et est
gardée » et pour « n'existe pas » ne distingue rien — c'est la famille du
défaut déjà corrigé sur les PAGES, où une adresse inventée partait vers la
connexion au lieu de rendre 404.

Le témoin est ailleurs, et il est public : la politique de confidentialité
sert « en retard sur une dette », phrase qui n'existe que depuis V352. C'est
une page statique, lisible sans session, et elle porte la preuve du
déploiement.

`/fr/amis` rend 307 vers `/fr/login`, `/fr/nimportequoi` rend 404. La
construction de l'application a publié `desktop-v0.9.11` avec son installeur
de 120 Mo et son `latest.yml` : quarante-neuf exécutions, une seule en échec,
remontant à V185.

### Le classement, et le garde qui ne mordait pas sur un `groupBy`
Lignes 115 et 116 du plan. La 115 dit sur QUOI classer, et c'est la seule
décision qui compte : **sur l'effort payé, jamais sur les parties jouées.**
Quelqu'un qui perd beaucoup accumule beaucoup de dette ; classer sur les
parties reviendrait donc à récompenser la défaite, sur un produit dont le sujet
est de la payer. Le seul chiffre qui dise « j'ai fait l'effort » est celui des
séances acquittées.

**Sept jours glissants, et pas le total de toujours.** Un classement cumulatif
est décidé par la DATE D'INSCRIPTION : le premier arrivé a un total que
personne ne rattrape, et le dernier venu regarde un tableau où sa place ne
dépend plus de ce qu'il fait. C'est l'inverse d'une raison de revenir. Sept
jours se rejouent chaque semaine, et c'est la maille d'un rythme de jeu — on ne
joue pas tous les jours, on joue certains soirs. La fenêtre est bornée des DEUX
côtés : sans borne haute, un paiement daté du futur entrerait dans la semaine.

**Le jour vient du navigateur, et c'est le MIEN qui borne la semaine de tout le
monde.** Un classement où chacun mesurerait sa propre fenêtre ne comparerait
rien. C'est une approximation assumée pour un ami à l'autre bout du monde, et
la seule qui produise un tableau qui ait un sens.

**Deux règles d'ordre qui ne vont pas de soi.** À égalité le rang est le même
(1, 2, 2, 4) : le cas courant d'un groupe qui vient de se former est que tout
le monde est à zéro, et les numéroter de un à dix désignerait un dernier pour
rien — c'est-à-dire exactement celui qu'on veut voir revenir. Et à égalité
l'ordre est celui des pseudos : sans second critère, c'est celui que la base
rend, qui n'est garanti par rien, et la liste saute d'un rechargement à
l'autre. On croit alors avoir été dépassé.

**Soi-même figure toujours dans la liste**, même sans un seul ami. Un classement
où l'on n'est pas n'est pas son classement, et un compte neuf verrait un
tableau vide là où il devrait au moins se voir à zéro. C'est ce qui rend la
phrase « tu es seul ici » possible — et cette phrase explique mieux que le
formulaire à quoi sert le formulaire.

**La 116 ajoute le retard**, qui est la pression sociale la plus forte du lot.
Elle réemploie `etatRetard` sans le recalculer : une dette de quelques heures
n'est pas un retard, et une dette SOLDÉE ne l'est jamais, même quand sa date
traîne derrière elle. Marquer en retard quelqu'un qui ne doit plus rien est
l'accusation la plus désagréable que ce tableau puisse porter, et elle serait
fausse.

**Le garde du filtrage par compte ne mordait pas, et c'est la trouvaille.**
Sabotage fait — la somme des paiements privée de son `where` — le test de la
route est tombé, et `filtreParCompte` est resté vert. Il cherchait le NOM de la
colonne dans les quatre cents caractères autour de l'appel. Or `userId` y
figure deux fois sans rien filtrer : `groupBy({ by: ["userId"] })` le donne
comme axe de regroupement, et `sommes.map((s) => s.userId)` le lit dans le
résultat. Une somme portant sur toute la base passait donc au vert.

Ce qui précède le nom suffit à trancher : un point en fait une lecture de
résultat, un guillemet une chaîne. Le reste est une position de clé. **Exiger
les deux-points aurait été le réflexe et aurait été faux** : `games/[id]` écrit
`where: { id, userId }`, le raccourci d'objet, qui est un filtre parfaitement
juste — et il est tombé au premier essai, ce qui a évité de publier un garde
qui recale ce qu'il devrait accepter.

Une dispense d'appel ajoutée, avec sa raison : lire le pseudo et la dette de
ses amis est tout l'objet d'un classement. Elle porte sur `user.findMany` et
sur lui seul — la somme des paiements, elle, reste gardée, et le sabotage la
fait toujours tomber.

**Ce que ce tableau publie, et à qui.** Un pseudo, des points payés sur sept
jours, un état de retard — aux seuls comptes avec lesquels l'amitié a été
acceptée des deux côtés. La politique de confidentialité annonçait déjà le
pseudo et le volume d'effort ; le retard s'y ajoute, dans les six langues,
parce que c'est un renseignement sur quelqu'un d'autre que celui qui le lit.

**Ce qu'il ne fait PAS.** Participer sans y figurer — la réponse 129 — n'existe
pas encore : la seule façon de sortir d'un classement est de retirer l'ami.
C'est ordonné plus loin dans le plan, et ça se dit plutôt que de laisser croire
le contraire. Et rien ne vérifie que l'effort déclaré a été fourni : la réponse
130 demande une validation par vidéo, qui est un chantier de trois nuits. Entre
amis qui se connaissent, le contrôle est social ; il ne l'est plus le jour où
le classement s'ouvre.

Neuf sabotages, neuf échecs — dont les deux qui portent : l'ordre alphabétique
retiré (avec l'ordre d'entrée INVERSE de l'ordre attendu, sans quoi le tri
stable de V8 rendrait le bon résultat en ne comparant aucun pseudo) et le rang
par compétition remplacé par un simple 1..n.

Au navigateur, le test fait jouer TROIS comptes : deux amis et un tiers. Ce
qu'aucun test unitaire ne peut voir, c'est que l'effort payé par quelqu'un
d'autre remonte vraiment jusqu'à mon écran — et que celui d'un inconnu n'y
remonte pas, malgré ses neuf mille points. Un paiement de trente jours prouve
la borne basse : sans lui, une route qui ignorerait la fenêtre rendrait le même
classement et le test passerait en n'éprouvant rien. Deux sabotages, deux
échecs.

**Un échec que je n'explique pas, et qui ne se maquille pas.** La première
exécution complète a rendu 5150 au lieu de 150 sur une ligne — le paiement de
trente jours compté malgré la borne basse. Le test repasse seul sur une
reconstruction propre, et l'exécution complète suivante rend **199 sur 199**.
Mais « ça repasse » n'est pas un diagnostic. Deux choses sont sûres : j'ai
lancé deux `npm install` PENDANT cette exécution, ce que ce journal interdit
depuis longtemps — ça invalide la course comme preuve dans les deux sens — et
les traces ont été effacées par l'exécution suivante, donc la pièce à
conviction n'existe plus.

Ce qui en reste est un contrôle : la borne se lit désormais à la SOURCE avant
qu'on regarde l'écran. Une récidive nommera la cause — borne déplacée, jour
mal envoyé, `.next` d'avant — au lieu de montrer un nombre. C'est la leçon
déjà écrite pour `performance.mjs` : un chiffre sans nom ne se diagnostique
pas.

**Et les identifiants semés sont uniques par exécution.** Des identifiants
fixes marchent tant que la préparation purge les comptes `@example.test` avant
chaque suite — ce qu'elle fait. L'insertion tomberait sur une clé en double le
jour où l'ordre change, et l'échec ressemblerait à un défaut du classement
plutôt qu'à un reste de la veille.

### Les amis et les groupes, et la réponse qui décide de leur forme
Première ligne de l'étape 02 du plan d'action, et la réponse 114 disait « les
deux » : des amis qu'on ajoute ET des groupes qu'on rejoint. Ce n'est pas la
réponse la plus importante du lot. **C'est la 127 qui décide de tout** :

> Est-ce que tu es prêt à modérer un espace social ? → **Non**

Une réponse à laquelle il faut obéir en architecture, pas en intention. Un
annuaire de comptes, une recherche par début de pseudo, un champ de message
joint à une demande : chacun demande quelqu'un pour le surveiller, et il n'y a
personne. Donc :

- **rien ne se cherche.** On ajoute un pseudo qu'on connaît déjà — pas de
  recherche partielle, pas de suggestion, pas de liste. Un groupe se rejoint
  avec son code, et le groupe n'est listé nulle part ;
- **rien ne s'écrit.** Le seul texte qui circule est un pseudo et un nom de
  groupe, tous deux passés par la classe de caractères d'`identite.ts`. Il n'y
  a rien à modérer parce qu'il n'y a rien à écrire ;
- **les plafonds remplacent la modération.** Vingt demandes en attente au
  maximum : personne ne relit ce qui se passe ici, donc la seule protection
  contre quelqu'un qui demanderait tout le monde est de rendre la chose
  impossible. Ce que ça ne protège PAS est écrit dans le module — quelqu'un qui
  redemande à la même personne après chaque refus. Un refus supprime la ligne,
  donc rien ne s'en souvient. Le jour où ça arrivera il faudra un blocage.

**Le défaut qu'il fallait éviter est la demande croisée.** Si B m'a déjà
demandé et que je le demande à mon tour, créer une seconde ligne laisse deux
demandes en attente, chacun voyant « en attente de sa réponse ». L'amitié ne
peut plus se conclure, et **rien ne le signale** : les deux écrans disent
quelque chose de parfaitement sensé. Redemander vaut donc acceptation, et
`decisionDemande` porte la règle hors des routes — l'unicité en base porte sur
un couple ORIENTÉ, elle n'empêche pas le doublon inverse.

**Deux homonymes font refuser, jamais choisir.** L'unicité des pseudos vit
dans l'application et pas en base — des doublons existent déjà, un index
unique refuserait de se construire dessus. Prendre le premier enverrait la
demande à la mauvaise personne, ce qui est le seul résultat qu'on ne peut pas
rattraper : elle n'a aucun moyen de savoir qu'elle n'était pas la
destinataire.

**Un groupe plein rend la même réponse qu'un code inconnu.** Les distinguer
dirait, par la différence des deux réponses, quels codes existent : essayer
des codes au hasard deviendrait un moyen de trouver les groupes, c'est-à-dire
exactement ce que le code d'invitation existe pour empêcher.

**Pas de transaction, donc l'ordre est la seule protection**, et il est choisi
deux fois :

- créer un groupe écrit le GROUPE d'abord, l'appartenance ensuite. Une panne
  entre les deux laisse un groupe que personne ne voit — son code n'a jamais
  été rendu — et qui n'occupe qu'une ligne. L'inverse est impossible, la clé
  étrangère refusant une appartenance sans groupe ;
- quitter un groupe passe la propriété AVANT de partir. Un groupe sans
  propriétaire ne peut plus refaire son code : c'est une porte qu'on ne peut
  plus fermer, et rien ne la répare. Une panne entre les deux laisse deux
  propriétaires, ce qui est sans conséquence et se règle en refaisant le
  geste.

**Le code d'invitation, et le test qui a failli ne rien prouver.** L'alphabet
écarte les caractères qui se confondent à la lecture — ni O ni 0, ni I ni 1 ni
L — parce qu'un code se dicte en vocal avant de se taper, et qu'un code retapé
faux n'ouvre rien. Le tirage jette les octets hors d'un multiple de la taille
de l'alphabet au lieu de prendre un modulo : 256 n'est pas divisible par 31,
et un modulo direct rendrait les huit premières lettres neuf fois sur 256
contre huit pour les autres.

Mon premier test de ce rejet comptait les lettres sur quatre cents tirages
aléatoires et exigeait qu'aucune ne manque. **Il passait avec le modulo** : un
excès de douze pour cent se confond avec le bruit, et toutes les lettres
apparaissent quand même. C'est le défaut déjà écrit ici trois fois — un test
qui lit les vraies données éprouve les vraies données. La source d'octets
s'injecte maintenant, et les 256 valeurs sont posées une fois chacune : la
distribution attendue est exacte, huit fois chaque lettre. Avec un détail qui
fait tout : **les huit valeurs à rejeter sont servies en PREMIER.** Servies en
dernier, elles ne seraient jamais demandées — le tirage s'arrête dès qu'il a
ses huit lettres — et le rejet ne serait pas sur le chemin.

**Le garde du filtrage par compte a mordu sur les dix appels d'un coup**, et
c'était sa coarseness plutôt qu'une faute : il cherche le mot `userId`, ce qui
était vrai de toutes les tables du jour. `Amitie` porte DEUX colonnes de compte
et aucune de ce nom — un lien a un demandeur et un receveur, et filtrer sur
l'un ou l'autre est exactement le même geste. Les dispenser aurait été la pire
réponse : une dispense de ROUTE rend le garde muet sur tout le fichier. Il
connaît donc les colonnes par leur nom, et deux appels seulement sont dispensés
un par un, avec leur raison — résoudre un pseudo en compte, et créer un groupe
qui n'appartient encore à personne. Le contrôle habituel est là : une dispense
qui ne désigne plus rien de vivant tombe.

**Et la politique de confidentialité a dû recevoir deux lignes**, dans les six
langues, parce que `politiqueComplete.test.ts` l'a exigé sur les trois
relations ajoutées. C'est la bonne exigence : la liste d'amis est le
renseignement le plus personnel que le social produise, et il ne dit pas
seulement quelque chose de vous — il en dit sur quelqu'un d'autre. La politique
dit donc ce qu'une amitié donne à voir (le pseudo et le volume d'effort) et
qu'elle se retire.

Douze sabotages, douze échecs — dont l'acceptation croisée remise en doublon,
la recherche de liens dans un seul sens, l'acceptation ouverte au demandeur, le
groupe écrit après l'appartenance, le départ avant la reprise, et les deux
mécaniques ajoutées au garde du filtrage.

**Un sabotage a d'abord paru passer**, et c'était une erreur de méthode : ma
substitution laissait une erreur de SYNTAXE, la suite ne se chargeait plus, et
la ligne `Tests:` ne comptait alors aucun échec — vingt et un tests passés sur
vingt et un, parce que les dix de la suite morte n'y figuraient pas. Un
`Test Suites: 1 failed` était pourtant écrit deux lignes au-dessus. La leçon
est déjà ici sous une autre forme : lire le compte, pas la couleur — et lire
les DEUX lignes.

Au navigateur, `e2e/social.spec.ts` éprouve ce qu'aucun test unitaire ne peut
voir : ce qui se joue entre DEUX comptes. La demande arrive vraiment chez
l'autre, elle disparaît de chez soi quand il accepte, et un code tiré par l'un
ouvre le groupe de l'autre — retapé en minuscules avec un tiret, comme on le
lit. Chaque contrôle regarde l'écran ET la base : sans le second, un écran qui
se contente d'afficher ce qu'on vient de taper passerait le test.

**192 parcours au vert**, et les quatre nouveaux sabotés séparément — quatre
échecs, chacun sur son propre test : la demande reçue rangée du côté des
demandes envoyées, le premier clic qui retire l'ami tout de suite, le code qui
n'accepte plus les minuscules ni les tirets, et le refus rendu muet. Chaque
sabotage passe par une reconstruction et un redémarrage du serveur : sans eux,
`next start` sert le `.next` d'avant et le sabotage ne sabote rien.

Le quatrième a d'abord fait échouer la CONSTRUCTION plutôt qu'un test :
retirer le `setErreur` rendait `translateApiError` inutilisé, et
`noUnusedLocals` le nomme. Un échec de compilation n'est pas un test qui mord ;
réécrit pour compiler, le test tombe.

**Vérifié en production, et par ce qui n'est PAS 404.** `/fr/amis` répond 307
vers `/fr/login` : la page existe, elle est derrière la porte, et la langue
survit à la porte. Avant V351 cette adresse ne figurait pas dans
`PAGES_CONNUES` et rendait 404 — le 307 prouve donc que le déploiement est
bien celui-ci. Et comme la migration tourne DANS la commande de construction
de Vercel (`prisma migrate deploy && next build`), un échec y aurait fait
échouer la construction et laissé V350 en service. Les trois tables existent
donc, par déduction : elles ne se lisent pas d'ici, et l'annoncer comme une
observation serait faux. `/fr/nimportequoi` rend toujours 404, ce qui est le
témoin.

**Et `/amis` rejoint le balayage des six langues**, pour la raison qui a servi
à y faire entrer « Ta saison » : c'est l'écran où le texte est le plus long —
trois phrases pour expliquer qu'il n'y a pas d'annuaire — et où des libellés de
boutons se serrent sur une ligne à côté d'un pseudo de vingt-quatre
caractères. 87 passes, aucun débordement, aucune langue en retard.

### La session se lançait toute seule, et personne ne l'avait demandé
Signalé en même temps que le reste : « je viens de remarquer que la session se
lance toute seule dès que je lance une partie. Le but c'est pas ça. »

Ce n'est pas une petite chose. Une session ouverte sonde Riot, chronomètre les
jeux comptés au temps, et décide donc de ce qui entrera dans la dette. La
démarrer à la place de quelqu'un est une surprise sur un compteur qui fait
faire des pompes.

**Où la question se pose.** L'écran de chargement est le seul instant où l'on
sait qu'une partie commence et où l'on n'est pas encore en jeu. C'est aussi le
moment où l'application détecte le processus du jeu — donc le même événement
qu'avant, avec une question à la place d'un démarrage.

**Une question générique, écrite par la PAGE.** `overlayDemander({ texte, oui,
non })` : la coquille Electron affiche et rend la réponse, elle n'écrit rien.
C'est la même répartition que pour la détection de partie — « l'application se
contente de dire qu'un jeu vient de démarrer » — et c'est la seule qui tienne,
puisque la page seule connaît le compte et ses six langues. La coquille s'était
déjà fait prendre à parler français à tout le monde.

**Ce que la pastille doit rendre en repartant.** Elle cesse de laisser passer
les clics le temps de la question, comme en mode placement. Si elle ne les
laissait pas repasser ensuite, elle intercepterait la souris pendant toute la
partie — pire que pas de pastille du tout. Sauf en mode placement, où quelqu'un
est justement en train de la déplacer : lui reprendre la main au milieu serait
la deuxième façon de casser la même chose.

**Sans réponse, on ne lance rien.** La question se ferme d'elle-même après
quarante-cinq secondes : elle paraît sur l'écran de chargement, et si personne
n'a cliqué quand la partie commence, on ne va pas retenir quelqu'un qui joue.
`null` se traite comme un refus, jamais comme un accord — c'est écrit des deux
côtés du pont.

**Trois conduites, et le défaut est de demander** (`User.sessionAuto`) :
demander, lancer seul, ne rien faire. Une valeur inconnue retombe sur
« demander » côté lecture, mais la route de réglages la REFUSE côté écriture :
« demander » et « auto » ne se ressemblent pas, et enregistrer l'un pour
l'autre en silence rendrait le réglage inutile.

Une application antérieure à 0.9.10 ne sait pas poser la question : on ne lance
alors rien. Le repli d'un réglage qui dit « demande-moi » ne peut pas être
« fais-le sans demander ».

**Et un « non » tait la pastille pour cette partie** (0.9.12+), jusqu'à
l'écran de chargement suivant. Laisser la pastille par-dessus le jeu ferait
rester à l'écran la seule chose qu'on venait d'écarter.

**La question occupe tout l'écran** (0.9.12+). Dans la pastille, elle faisait
230 pixels dans un coin par-dessus un écran de chargement : on ne la voyait
pas, donc elle expirait, donc elle valait refus — le résultat exact qu'on
aurait sans elle.

**Et la partie s'enregistre SANS ENJEU.** Elle entre dans l'historique avec son
annotation, à coût nul, sans dette, et hors de toute statistique — winrate,
graphiques, paliers, bilan de saison, maîtrise du champion. Ne pas
l'enregistrer du tout était l'autre option : on jouerait cinq parties pour n'en
voir que deux, sans que rien n'explique l'écart.

Six sabotages, six échecs — dont les deux qui comptent le plus : la fenêtre qui
ne rend pas la souris, et la question qui ne se ferme jamais.

**Et deux gardes ont mordu sur la colonne ajoutée**, ce qui est leur travail :
`compte.test.ts` a exigé qu'on range `sessionAuto` d'un côté ou de l'autre de
ce qui sort du compte, et `politiqueComplete.test.ts` qu'on la décrive dans la
politique de confidentialité ou qu'on dise pourquoi elle en est absente. Elle
en est absente parce que c'est un réglage de COMPORTEMENT de l'application : il
ne sort jamais du compte, ne part dans aucun courriel, et ne dit rien de ce que
la personne fait. La langue et le fuseau, eux, avaient dû y entrer parce qu'ils
servent hors de l'Application.

### Aucun paiement n'a jamais abouti en production, et 1689 tests passaient
Le message posé la veille sur la pastille a donné la réponse en un mot : « Le
serveur refuse pour l'instant ». Pas de réseau coupé, pas de session expirée —
un 5xx sur `PATCH /api/dette`, à chaque fois, depuis toujours.

**La production ne supporte pas les transactions.** `src/lib/prisma.ts` choisit
son adaptateur d'après l'hôte : `PrismaPg` en TCP quand la base est locale,
`PrismaNeonHttp` sinon. Et l'adaptateur HTTP rejette explicitement :

```js
async startTransaction() {
  return Promise.reject(new Error("Transactions are not supported in HTTP mode"));
}
```

`PATCH /api/dette` ouvrait une transaction interactive. C'est le paiement
d'une séance, c'est-à-dire **la fonction principale du produit**. Elle
échouait à chaque appel en ligne ; la file hors ligne retenait la séance,
comme prévu ; et le seul symptôme visible était « six séances faites hors
réseau, en attente » sur une machine parfaitement connectée.

**C'est la divergence d'environnement la plus coûteuse qui soit** : celle que
rien ne peut voir depuis la machine où l'on développe. 1689 tests unitaires et
188 parcours navigateur passaient au vert, tous contre une base TCP. Le
commentaire de `prisma.ts` décrit d'ailleurs très bien pourquoi l'adaptateur
diffère en local — et personne n'en avait tiré la conséquence sur ce que le
pilote de production sait faire.

**Ce qui remplace la transaction, et pourquoi cet ordre-là.** Il n'y a plus
rien pour rattraper une écriture qui passe et l'autre pas :

- la TRACE d'abord (`Paiement`), le décompte ensuite. Une panne entre les deux
  laisse l'effort enregistré et la dette due : on la refait, c'est désagréable
  et rattrapable ;
- l'inverse effacerait une dette sans trace, et le renvoi la décompterait une
  seconde fois. Une dette qu'on ne doit plus sans savoir pourquoi ne se
  rattrape pas.

Le jeton d'unicité rend le renvoi sûr : `P2002` dit que cette séance-ci est
déjà enregistrée, donc qu'il ne faut surtout pas décompter à nouveau. Un test
tient l'ordre par `invocationCallOrder`, un autre tient le court-circuit.

Le second appel, `PATCH /api/games/dates`, passait par la forme tableau —
refusée de la même façon. Les dates se posent une par une, et le compte rendu
dit ce qui a RÉELLEMENT bougé : annoncer soixante corrections quand douze ont
abouti serait pire que d'échouer franchement.

`src/transactionsInterdites.test.ts` refuse `$transaction` partout dans `src`,
avec le témoin habituel. Sans exemption : il n'y a pas de cas où ça marche.

Trois sabotages, trois échecs. Et le garde du filtrage par compte a mordu au
passage, ce qui est exactement son travail : la boucle écrivait par `update`
avec le seul identifiant, quand la lecture au-dessus filtrait déjà par compte.
`updateMany` remet le compte dans le `where` — une écriture qui porte
elle-même son filtre vaut mieux qu'une écriture qui compte sur celle d'avant.

**Ce que ça apprend au-delà du cas.** Un test qui tourne contre une base d'un
autre type que la production n'éprouve pas la production. Ça ne se corrige pas
en changeant de base de test — ce serait payer très cher — mais en sachant ce
que le pilote de production ne sait pas faire, et en l'interdisant par un
garde. La liste est courte : les transactions.

### La même durée était calculée à quatre endroits, et les quatre divergeaient
Signalé après la correction du cache : la pastille passait en ALERTE à
3 min 35 sous un seuil réglé à 5 min, une notification Windows annonçait
8 min 06 que rien à l'écran ne montrait, et treize notifications identiques
étaient arrivées dans la soirée.

Trois symptômes, une seule cause : **la même dette était convertie à
plusieurs endroits, de plusieurs façons.**

- la PASTILLE convertissait les points dans le navigateur, avec les ratios
  qui y sont installés ;
- le SEUIL d'alerte et la NOTIFICATION lisaient `dureeSec`, calculé au
  serveur ;
- et le serveur lui-même en produisait deux : `dureeEffort` à la seconde
  près, quand l'affichage arrondit au pas de l'exercice — cinq secondes pour
  la boxe.

D'où l'alerte sous son propre seuil : l'écran montrait 3 min 35 pendant que la
comparaison portait sur 8 min 06. Le rapport entre les deux valait celui des
deux ratios, comme la veille, mais dans l'autre sens.

**Une seule conversion, faite là où les ratios font autorité.** `reponseDette`
rend désormais `quantites` — la dette déjà convertie, exercice par exercice —
et le navigateur affiche ce qu'on lui donne. `dureeAffichee` remplace
`dureeEffort` partout où un nombre est MONTRÉ ou comparé à un seuil ;
`dureeEffort` reste la bonne pour un calcul de proportion, où l'arrondi n'a
rien à faire.

**Et le type `Dette` était déclaré deux fois**, à la main, dans deux
composants. Un champ ajouté au serveur ne rejoignait ni l'un ni l'autre, et le
compilateur ne s'en plaignait pas — c'est la duplication la plus discrète de
toutes. `DettePourEcran` se déduit de `ReturnType<typeof reponseDette>` : le
sabotage qui retire `quantites` du serveur casse maintenant la compilation
chez le consommateur, ce qu'aucun test n'aurait fait aussi bien.

**Treize notifications, et la marque vivait dans un montage.** `notifieRef`
est une `useRef` : elle repart à zéro à chaque changement de page. Une soirée
passée à naviguer entre le tableau de bord, l'historique et les réglages
produisait donc une notification par navigation. Elle vit dans le stockage
maintenant, et s'efface quand la dette repasse sous le seuil — le palier
suivant doit pouvoir prévenir à son tour.

**Six séances attendaient depuis des heures sur une machine en ligne.** Le
renvoi de la file ne se déclenchait qu'au chargement d'une page et au retour
de l'événement `online`. Un envoi refusé alors qu'on est connecté — le serveur
qui tousse, une session qui vient d'expirer — n'était donc plus jamais retenté
tant qu'on ne changeait pas de page. Une reprise toutes les minutes tant qu'il
reste quelque chose ; la boucle ne coûte rien sur une file vide.

Et surtout **la file dit maintenant pourquoi elle n'avance pas** : session
expirée, pas de réseau, ou serveur qui refuse. Une file qui grossit en silence
sur une machine manifestement connectée est la pire des deux — on la voit, et
il n'y a aucune suite à donner. C'est la famille « répond juste, ne fait
rien », appliquée à ce qui ne répond pas du tout.

**Un quatrième producteur trouvé en recensant**, dans la notification qui part
à l'enregistrement d'une partie : elle comparait au seuil et écrivait son texte
avec la durée exacte, donc elle pouvait franchir le seuil à un autre moment que
la pastille, et annoncer un autre nombre.

`src/dureeAffichee.test.ts` garde la classe : `dureeEffort` n'est plus permise
que là où l'on calcule une PROPORTION — le paiement partiel d'une séance
interrompue — et chaque emploi restant porte sa raison écrite. Avec les deux
contrôles habituels : un recensement qui ne lit rien tombe, et une exemption
qui ne désigne plus rien de vivant tombe aussi.

Dix sabotages. Celui du serveur qui cesse d'envoyer `quantites` ne fait pas
tomber un test mais la COMPILATION, et c'est mieux : le type dérivé rend la
divergence impossible plutôt que détectable.

### Deux nombres se contredisaient sur le même écran, et un test exigeait la cause
Suite immédiate du défaut précédent, signalée dans la foulée : « le compteur
de boxe m'affiche encore 6 min 05 mais quand je clique dessus, j'ai
2 min 42 ». La pastille de dette et le décompte qu'elle ouvre annonçaient deux
durées différentes pour la même dette.

**Le rapport entre les deux nombres était celui des deux ratios**, et c'est ce
qui a désigné la cause : 365 ÷ 161 = 2,27, soit exactement 7 ÷ 3,09. La
pastille convertissait les points DANS LE NAVIGATEUR, avec le ratio installé
côté client ; le décompte affichait `dureeSec`, calculé AU SERVEUR. Les deux
n'avaient pas le même barème.

**La faute est dans l'en-tête de cache d'une route dont c'est tout l'objet.**
`/api/exercices/ratios` existe pour que le navigateur relise la valeur à la
source, parce que celle du HTML peut dater sur une page prérendue. Elle
portait `public, max-age=60, stale-while-revalidate=300` : le navigateur
servait donc l'ancienne valeur pendant une minute, puis jusqu'à cinq de plus
en arrière-plan — et il l'installait PAR-DESSUS celle que le serveur venait de
rendre, qui était la bonne. `public` autorisait en prime le CDN à la garder
pour tout le monde.

Reproduit : la base contenait 3,09, un `curl` direct rendait 3,09, et la même
requête depuis la page rendait 7.

**Et un test EXIGEAIT ce cache.** « laisse le navigateur garder la réponse une
minute » — il avait figé le défaut comme une garantie, et toute correction le
faisait échouer. C'est la forme la plus coûteuse d'un mauvais test : il ne se
contente pas de ne rien attraper, il défend ce qu'il faudrait corriger. Il dit
maintenant l'inverse, avec la raison écrite, et il refuse nommément `public`,
`max-age` non nul et `stale-while-revalidate`.

**Un second écart restait, plus petit et de la même famille.** La pastille
arrondit au pas de l'exercice — cinq secondes pour la boxe — tandis que
`dureeSec` est à la seconde près : « 1 min 15 » écrit juste au-dessus d'un
chrono qui démarre à 1:17. `secondesAnnoncees` fait décompter ce qui a été
ANNONCÉ. Le reliquat n'est pas perdu : un décompte mené à zéro solde la dette
entière, un décompte interrompu n'acquitte que les secondes faites.

**Ce que le parcours navigateur prouve, et ce qu'il ne prouve pas.** Il compare
les deux nombres à l'écran, ce qu'aucun test unitaire ne peut faire — la
divergence naît de ce que les deux côtés ne partagent pas. Mais depuis la
correction, pastille et décompte partent tous deux de la conversion
navigateur : ils s'accordent donc même quand le navigateur a un ratio périmé.
Le sabotage de l'en-tête ne le fait pas tomber, et c'est attendu. La fraîcheur
est gardée par le test d'en-tête, qui tombe. Écrire l'inverse serait
surestimer ce qu'on tient.

Trois sabotages : l'en-tête remis (le test d'en-tête tombe), le décompte
reparti de `dureeSec` (deux tests tombent), et l'appel à la règle retiré du
composant — celui-là ne compile pas, `noUnusedLocals` nommant les deux imports
devenus inutiles. Ce n'est pas un test qui mord, c'est le compilateur ; noté
comme tel.

**Et le piège des fenêtres d'accueil, pour la huitième fois.** Le nouveau
parcours passait seul et tombait dans la suite complète : le décompte porte
`aria-modal`, la modale d'accueil aussi, et le sélecteur en trouvait deux. Un
fichier qui passe seul et tombe en suite ne dit pas que la suite est instable,
il dit que le compte n'en est pas au même point. `viderLesFenetres` avant de
chercher quoi que ce soit.

### Changer un ratio réécrivait tout l'historique de tout le monde
Signalé par le propriétaire du produit : « j'ai changé le ratio de combien
valait une seconde de boxe par rapport à une pompe, ça change tous les ratios
de l'historique ». C'est un défaut de fond, pas d'affichage : un effort déjà
fourni cessait de correspondre à ce qu'on avait payé.

Reproduit avant d'y toucher, au niveau du module : une partie qui avait coûté
**4 min 25 de boxe en affichait 8 min 50** après un doublement du ratio.

**La cause tient en une phrase, et elle était déjà écrite ailleurs.**
`pompesCalculees` est un coût en POINTS d'effort, qui ne dépend d'aucun
ratio ; le ratio ne sert qu'à dire ce que ça fait en secondes de boxe ou en
squats, et il était lu au moment de l'AFFICHAGE, sur le module. Or le schéma
gelait déjà `exercice` (« l'historique reste fidèle même si la sélection
change plus tard ») et `variante` (« le réglage change, l'historique ne doit
pas changer avec »). La même règle, écrite deux fois pour deux colonnes
voisines, n'avait pas été appliquée à la troisième.

`Game.ratios` porte désormais le barème en vigueur à l'enregistrement, et les
conversions acceptent un jeu de ratios explicite. Sans argument, elles
continuent d'employer celui du jour — c'est ce qu'il faut pour un aperçu, un
compteur, un simulateur, qui parlent du présent.

**Le cumul demandait une seconde correction, moins visible.** Additionner les
points de plusieurs parties puis convertir la somme revient à réévaluer tout
le passé au barème du jour, c'est-à-dire à refaire exactement ce qu'on
corrige. `cumulsParExercice` convertit donc partie par partie, sous le barème
de chacune, puis additionne des répétitions et des secondes. D'où
`formaterQuantite`, qui met en forme une quantité DÉJÀ convertie, là où
`formaterCompact` part de points.

**Le remplissage de la colonne écrit le barème COURANT, pas celui d'origine**,
et c'est contre-intuitif. Les points n'ont jamais dépendu du barème : ce qu'on
gèle est l'affichage, et l'affichage qu'une partie ancienne a aujourd'hui est
celui du barème courant. Y écrire les ratios d'origine changerait le passé au
lieu de l'arrêter. La migration les lit donc dans `SystemConfig` ; sans ligne
de configuration, la colonne reste nulle et la lecture retombe sur les ratios
d'origine, qui sont bien ceux qui étaient affichés.

**Ce qui n'est PAS gelé, et pourquoi.** Le tableau de bord et le bilan de
saison continuent de convertir au barème du jour. Ils agrègent des points au
serveur, sans distinguer les parties, et surtout ils ne répondent pas à la
même question : l'historique est un registre — ce que chaque partie a coûté,
et ça ne se réécrit pas —, tandis que le tableau de bord dit « voilà l'effort
accumulé, dans l'unité que tu emploies en ce moment ». L'objectif et les
paliers, eux, sont en points : ils sont insensibles au barème par
construction.

**Le garde de la correction de résultat était le plus facile à oublier.**
`PATCH /api/games/[id]` rejoue le barème de SCORING ; s'il rouvrait aussi
celui des exercices, une partie corrigée se remettrait à l'heure du jour au
passage — et le chiffre qui change serait précisément celui qu'on venait
corriger. Un test l'interdit, avec son témoin : sans lui, une correction qui
n'écrirait plus rien du tout satisferait le contrôle en ne prouvant rien.

Preuve de bout en bout, `e2e/bareme-gele.spec.ts`, et il faut ses DEUX
moitiés : l'ancienne partie reste à 2 min 55 après le changement, et la
suivante passe à 5 min 45. Ne vérifier que la première laisserait passer un
gel complet, qui rendrait le réglage inutile.

**Le premier jet du parcours dépendait de son état de départ.** Il supprimait
la ligne de configuration puis mesurait — sans pouvoir purger le cache mémoire
du serveur, qui dure soixante secondes et portait encore le barème d'un essai
précédent. La partie était donc chiffrée sous un barème, comparée à lui-même,
et le test échouait en annonçant que le nouveau barème ne s'appliquait pas. Il
pose maintenant un barème connu PAR LA ROUTE avant de mesurer : c'est elle qui
purge le cache, et c'est ce qui rend la mesure indépendante de ce qui
précédait.

Neuf sabotages, neuf échecs — dont celui qui compte le plus, l'historique
remis à reconvertir au barème du jour, qui fait tomber le parcours navigateur.

Et le garde des colonnes a mordu comme prévu : la route envoyait `ratios`,
l'écran ne le lisait pas encore, et `colonnesHistorique` l'a dit avant moi.

### La date d'inscription demandait un clic par compte, et un signalement faisait déborder la page
Deux trouvailles dans le même panneau, dont une seule était demandée.

**La date d'inscription existait, dans le profil déroulant.** Il fallait donc
ouvrir chaque compte pour savoir qui venait d'arriver — c'est-à-dire la
question qu'on se pose le jour où l'on invite du monde, et la seule que la
liste ne répondait pas d'un coup d'œil. Elle est sur la ligne repliée
maintenant, en relatif : « inscrit aujourd'hui », « inscrit il y a 2j ». Le
relatif se lit sans compter, « 31/08 » non. La date exacte reste dans le
profil, elle n'a pas disparu.

**Et la page débordait de 15 348 pixels latéralement.** Trouvé en mesurant le
débordement horizontal après la retouche, par acquit de conscience : le
coupable n'était pas la ligne ajoutée mais un **signalement** dont le texte
n'a aucun espace. `white-space: pre-wrap` conserve les retours à la ligne, ce
qu'on veut pour un rapport de bug tapé à la main, et ne dit rien de ce qu'il
faut faire d'un mot de quinze mille caractères. Le navigateur pousse la ligne,
et c'est la PAGE qui part de côté.

C'est du texte **écrit par quelqu'un d'autre** : une trace d'erreur, une
adresse collée, un clavier martelé. `overflow-wrap: anywhere` — et pas
`break-word`, qui refuse de couper à l'intérieur d'un mot tant qu'il existe
une autre occasion. Mesuré : 15 348 px avant, **0 après**.

`src/texteUtilisateurCoupe.test.ts` garde la classe et non la ligne : tout
endroit qui pose `pre-wrap` porte du texte qu'on n'a pas écrit — sinon on
n'aurait pas besoin de conserver ses retours à la ligne — donc tout endroit
qui pose `pre-wrap` doit dire comment couper. Le motif lit l'objet de style
ENTIER, accolade à accolade, parce qu'un style écrit sur plusieurs lignes
échappe à une recherche ligne à ligne — et c'est justement la forme qu'on
écrit quand le style s'allonge. Deux sabotages, deux échecs.

**Un rappel d'outillage, retombé dedans trois fois de suite.** Le panneau ne
se laisse pas photographier sans traverser d'abord les trois fenêtres d'un
compte neuf, et **la visite guidée NAVIGUE** : « Passer l'introduction »
cliqué depuis `/admin` renvoie sur le tableau de bord et lance la visite, donc
la capture montre le tableau de bord. Les fenêtres se vident depuis la page
d'arrivée, avant d'aller où l'on va. C'est écrit dans `e2e/intro.ts` depuis
des semaines, sous le nom de `viderLesFenetres`.

Et le limiteur d'inscription — cinq par quart d'heure — mord après quelques
essais manuels. La panne se présente comme « le code ne s'affiche pas », ce
qui ne ressemble pas à sa cause. `DELETE FROM "LoginAttempt"` avant chaque
tentative.

### Mille cent trente-deux mots sur la page d'accueil, deux cent quatre-vingt-six restent
Le propriétaire du produit a essayé plusieurs fois de faire venir du monde
depuis Reddit : « tout le monde trouve que ça fait trop IA et ne veulent pas
venir ». C'est le seul retour qu'on ait eu sur l'acquisition, et il ne porte
pas sur une fonctionnalité — il porte sur la façon dont le site parle.

Mesuré avant d'y toucher, sur le HTML servi : **1 132 mots visibles** sur
`/fr`, répartis en dix sections. Après : **286**, dont une bonne moitié n'est
pas de la prose — les vingt-six noms de jeux du bandeau défilant, les libellés
de la démonstration, et les cinquante mots de la mention légale Riot. Il reste
environ **soixante-dix mots** de texte écrit.

Quatre sections entières sont parties : la galerie de captures, la grille des
tarifs et son flux de dettes, la scène de partie avec la pastille, et le bloc
« le problème » avec ses trois citations d'études à comité de lecture. Cette
dernière est celle qui coûtait le plus : trois références scientifiques sous
une page qui promet des pompes, c'est la marque la plus reconnaissable d'un
texte écrit par une machine — personne n'écrit ça pour vendre un logiciel à
des joueurs.

Avec elles : les libellés en petites capitales au-dessus de chaque titre (les
« eyebrows »), qui sont le second signe, et les titres balancés en deux
membres. « Gagne ta game, ou paie en sueur » est un slogan de publicité ; « Tu
perds une game, tu fais des pompes » dit la même chose sans la balance. « Trois
temps, et c'est réglé » devient « Comment ça marche ». « Ta prochaine soirée a
un prix » devient « Commencer ».

**Le slogan vivait à quatre endroits, et trois ne se voient pas depuis la
page.** Le titre de l'onglet et la description (`metadonnees.ts`), c'est-à-dire
ce qu'un moteur affiche ; le texte de la carte partagée (`imageSociale.ts`),
c'est-à-dire ce qui s'affiche quand le lien part sur Discord ou Reddit ; et
l'`alt` de cette carte. Corriger la page sans eux aurait laissé le slogan
exactement là où le retour disait qu'il faisait du mal : **dans l'aperçu du
lien collé sur Reddit**, qui est la seule chose que la plupart des gens
verront. Vérifié en la rendant : la carte allemande, la plus longue, tient dans
son cadre.

**Le poids n'a presque pas bougé, et c'était prévisible.** 185 → 183 ko de
JavaScript, 605 → 571 ko en tout, mesurés sur le même serveur avant et après.
La page est rendue au serveur depuis V300 : ses dictionnaires ne partaient déjà
plus au navigateur, donc en retirer 276 clés n'allège pas le paquet. Les 34 ko
gagnés sont les composants et les images des sections supprimées. Annoncer ce
chantier comme un gain de performance serait faux — c'est un chantier de texte.

Trois composants sont partis avec leurs sections (`DebtFeed`,
`PastilleOverlay`, `ScenePartie`), 276 entrées de dictionnaire dans les six
langues, et une cinquantaine de règles CSS devenues orphelines.

**Deux témoins de garde ont dû être recalibrés, et c'est le prix normal.**
`pagesOrphelines` comptait plus de cinquante cibles de navigation ; les liens
retirés le font tomber à quarante-cinq. `seo.spec.ts` comptait plus de cinq
sections révélables ; il n'en reste que trois. Dans les deux cas l'assertion de
FOND passe toujours — aucune page orpheline, aucune section invisible sans
script — et seul le compte qui prouve qu'on a lu quelque chose a bougé. Un
témoin calibré sur la taille du produit se recalibre quand le produit maigrit ;
ce qu'il ne doit jamais faire, c'est descendre à zéro.

**Le piège de l'outil de suppression, à retenir.** Le recensement des clés
mortes cherche un nom de clé dans TOUT le code, pas fichier par fichier :
retirer `t.jeuxTitre` de l'accueil a fait passer `jeuxTitre` pour morte dans
`detection.ts` et `overlay.ts` aussi, et le script l'a supprimée des trois.
Vérifié après coup qu'elle n'était lue nulle part — rien de vivant n'est parti
— mais la prochaine fois ce sera peut-être une clé homonyme bien vivante
ailleurs.

Et un piège d'environnement qui a coûté une exécution complète : les 186
parcours navigateur sont tombés à quatorze échecs, tous sur « ouvrir un
compte », avec « Erreur serveur » sur `/api/beta-access`. Le PostgreSQL local
n'était pas démarré. Le symptôme — un compte qui ne s'ouvre pas — ne ressemble
pas à sa cause, et c'est le troisième déguisement de cette panne-là recensé
ici. `pg_isready` avant de lancer la suite coûte une seconde.

### Quatre gardes sur vingt-six pouvaient passer au vert en ne lisant rien
Suite du défaut précédent, où le test d'une route vérifiait la FORME du jour
stocké avec le motif même que le code employait. La question générale est :
**quels tests ne peuvent pas échouer ?**

Le recensement par motifs partagés entre un test et son code ne rend que
quatre rapprochements, dont trois anodins — des sélecteurs d'ouverture de
compte partagés entre parcours. La famille est ailleurs.

**Elle est dans les gardes structurels.** Ils regardent un DOSSIER plutôt
qu'une liste écrite à la main, ce qui est leur qualité : ils voient le fichier
qu'on ajoutera demain. Le prix, c'est qu'un dossier renommé, un motif devenu
aveugle ou une extension qui change les rend muets sans rien casser —
`expect(fautifs).toEqual([])` est vrai sur une liste vide, et rien ne
distingue « rien à signaler » de « rien regardé ».

Vingt-deux sur vingt-six portaient déjà leur témoin. Les quatre autres :

- **`codeMort.test.ts`**, et c'est le plus gênant : il SUPPRIME du code sur la
  foi de ce qu'il lit ;
- **`langueEnDur.test.ts`**, qui interdit un raccourci à l'étage au-dessus et
  l'aurait laissé passer ;
- **`pagesOrphelines.test.ts`**, à moitié : il prouve que la RECHERCHE cherche
  — une page inventée doit ressortir orpheline — et ne dit rien du
  recensement des pages, qui pouvait être vide ;
- **`logosJeux.test.ts`**, qui est un faux positif : il DOUBLE `readdirSync`
  au lieu de lire le disque, donc un témoin n'y aurait rien à mesurer. Exempté
  avec sa raison.

`src/gardesNonVides.test.ts` porte la règle pour la classe : tout test qui
parcourt le disque doit contenir une assertion qui refuse d'avoir lu zéro
chose. Il a le même angle mort que ceux qu'il surveille, d'où son propre
témoin — au moins vingt gardes recensés.

Et le test faible de `/api/dette` a été renforcé au passage : il vérifiait que
le repli produit un jour de la bonne FORME, alors que le repli est
`jourLocal()`, qui en produit toujours une juste. Il attend maintenant le jour
LOCAL, ce qui distingue le repli d'un jour inventé.

Quatre sabotages, quatre échecs : un témoin retiré, une exemption vidée, le
recensement rendu aveugle, et le témoin partiel de `pagesOrphelines` remplacé
par un `toBeDefined`.

### Une date qui n'existe pas s'écrivait en base, pour toujours
Recensement systématique des règles écrites deux fois — c'était le septième cas
ce matin, et ça méritait d'être cherché plutôt qu'attendu. Le recensement par
LIGNES identiques ne rend que du bruit : en-têtes HTTP, littéraux de style,
gardes de session. Ce qui parle, ce sont les **motifs** et les **constantes
nommées** répétés d'un fichier à l'autre.

Deux trouvailles, et la première coûte cher.

**`/^\d{4}-\d{2}-\d{2}$/`, écrit dans trois fichiers.** `serie.ts` le porte à
l'intérieur d'`estJourValide`, qui ajoute l'ALLER-RETOUR — la correction déjà
faite deux fois, sur `/api/dashboard/daily` qui tombait en 500, puis sur
`/api/progression` qui rendait une série de zéro. `/api/serie` et `/api/dette`
s'en tenaient au motif.

Pour `/api/serie`, c'est le défaut de `/api/progression` à l'identique : la
série se compte depuis un jour qui n'existe pas, en court-circuitant le repli
prévu pour ce cas.

**Pour `/api/dette`, c'est pire : le jour est ÉCRIT tel quel dans
`Paiement.jour`.** « 2026-02-30 » et « 9999-99-99 » passent le motif et se
gravent en base. La série se compte en remontant jour par jour depuis
aujourd'hui : un paiement posé sur une date qu'aucun calendrier ne contient ne
compte jamais. L'effort est fait, il est enregistré, et il ne compte pas — pour
toujours, sur une ligne que rien ne viendra corriger.

**Le test de cette route ne pouvait pas l'attraper**, et c'est ce qu'il y a à
en retenir :

```ts
expect(paiement.create.mock.calls[0][0].data.jour).toMatch(/^\d{4}-\d{2}-\d{2}$/);
```

Il vérifiait la FORME du jour stocké. « 2026-02-30 » l'a. Un test écrit contre
le même motif que le code éprouve le motif, pas la règle — c'est le pendant du
« test qui compare une chose à elle-même » déjà écrit ici pour le focus.

**La seconde trouvaille est petite et de la même famille** : `CONTACT` et
`DATE` étaient écrites une fois dans les CGU et une fois dans la politique de
confidentialité. Changer l'une sans l'autre fait dire aux deux textes qu'ils
ont pris effet à des dates différentes, ou donne deux adresses pour exercer ses
droits — sur les deux documents qui engagent l'éditeur du site.
`src/lib/mentionsLegales.ts` les porte.

`src/regleDate.test.ts` refuse le motif de forme partout sauf dans `serie.ts`,
et exige que `serie.ts` l'écrive encore — sans quoi il pourrait disparaître de
partout, y compris de là où il doit être, et le test resterait vert en ne
gardant plus rien. Quatre sabotages, quatre échecs.

Ce que le recensement n'a PAS trouvé, et qui vaut d'être dit : aucune autre
constante de même nom et même valeur dans deux fichiers ne porte de règle.
`TTL_MS`, `JOUR_MS`, `MARGE`, `PERIODE_MS` désignent des choses différentes qui
partagent un nom — les fusionner créerait un couplage là où il n'y en a pas.

### Créer son compte pouvait changer la langue du site
Trouvé en cherchant ce qui reste d'extractible dans les gros composants, et
c'est mieux qu'une extraction : sept navigations partaient sans préfixe de
langue.

```ts
window.location.assign("/dashboard?li=1");
```

Le middleware rattrape l'adresse nue et NÉGOCIE : le cookie d'abord, puis
l'en-tête du navigateur, puis l'anglais. Or **ce cookie n'est écrit que par le
sélecteur de langue**. Quelqu'un qui arrive sur `/fr/login` par un lien
partagé, un signet ou une recherche, et qui n'y touche jamais, n'en a pas.

Vérifié sur le serveur plutôt que raisonné : sans cookie, `/dashboard` répond
308 vers `/de/dashboard` avec un navigateur allemand, vers `/ja/dashboard` avec
un japonais. Autrement dit **on lit le site en français, on crée son compte, et
on atterrit en allemand** — à la seconde où l'on vient d'accepter les CGU
françaises.

C'est le défaut déjà corrigé sur le lien de récupération, déplacé au moment de
la connexion. Trois sites dans `LoginButtons`, un dans l'administration, un
dans les réglages avancés, un dans le tableau de bord. `SessionGuard` faisait
déjà les choses correctement, ce qui rendait l'incohérence invisible : le
même geste, deux comportements.

**Une exception reste, et elle est écrite.** `DesktopAuthHandler` navigue vers
`/login` NU. La fenêtre d'authentification de l'application installée décide
« la connexion est finie » en demandant « ce n'est plus /login ? » : une
adresse préfixée y répondrait oui à la toute première page, et la fenêtre se
refermerait avant qu'on ait tapé quoi que ce soit. C'est la même exception que
celle du middleware, avec la même date de péremption — quand plus personne ne
fait tourner une version antérieure à 0.9.9.

`src/liensLocalises.test.ts` refuse désormais une navigation en dur vers une
adresse nue, et vérifie que l'exemption désigne encore quelque chose de vivant.
Deux sabotages, deux échecs.

**Un piège d'écriture qui aurait rendu le garde muet** : `fichiersSource` rend
des chemins ABSOLUS. Les rejoindre à `SRC` les double, et le contrôle tombe sur
un ENOENT — ce qui est le bon bruit, mais rattrapé par un `try` il serait passé
au vert en n'examinant aucun fichier.

**Et deux extractions au passage**, dans la même veine que les précédentes :
les deux formateurs et la règle de seuil de `CompteurDette` (quatre cent vingt
lignes) vivent dans `src/lib/compteurDette.ts`. Ce qu'ils portent :
l'arrondi de l'horloge va vers le HAUT quand celui de la durée va au plus
proche — un décompte qui affiche « 0:00 » alors qu'il reste une demi-seconde
ment à la seconde où l'on relâche l'effort ; « 45 s » et non « 0 min 45 » ; les
secondes sur deux chiffres, sans quoi « 5 min 7 » se lit comme cinq minutes et
sept minutes ; et un seuil à zéro qui veut dire « pas de seuil » et non
« préviens tout de suite ». Trois sabotages, trois échecs.

### Cinq logos officiels, et deux fichiers qui en masquaient deux en silence
Le propriétaire du site a déposé cinq logos officiels par l'interface web de
GitHub : `league`, `apex`, `rocket-league`, `minecraft`, `wow`. La bande de
l'accueil en montre donc neuf sur treize au lieu de six.

**Deux d'entre eux ne se seraient jamais affichés.** L'ordre de préférence de
`logosDisponibles()` va du SVG au PNG, et `league.svg` comme `apex.svg`
existaient déjà : un `league.png` déposé à côté est ignoré, sans erreur, sans
image cassée, sans rien qui le signale — la bande continue simplement de
montrer l'ancien glyphe. Les deux SVG sont supprimés.

Ce n'est pas une subtilité d'implémentation, c'est la forme la plus courante de
défaut sur ce projet : **un fichier qui reste sans être servi n'est pas
inoffensif, il masque celui qu'on vient d'ajouter.** Le commentaire de
`logosJeux.ts` disait déjà « un SVG ne doit pas se faire doubler par un PNG
homonyme » — la règle était juste, et personne n'avait écrit ce qu'elle
implique le jour où l'on REMPLACE.

Vérifié en poussant : les neuf adresses répondent 200 avec le bon type, et les
deux SVG retirés rendent 404. Aucun filtre n'est appliqué aux images —
`.jeu-logo` ne pose que `width`, `height` et `object-fit: contain`. Elles sont
servies telles quelles, ce qui était la consigne.

Restent quatre glyphes dessinés pour le site : `warzone`, `tft`, `gta5`,
`elden-ring`.

### Deux règles de la visite guidée y étaient écrites deux fois
`VisiteGuidee.tsx` fait quatre cent soixante lignes, et c'est la première chose
qu'un compte neuf rencontre. Deux de ses règles y figuraient en double, et
c'est le motif déjà trouvé six fois sur ce projet : ce n'est pas la copie qu'on
remarque, c'est qu'une correction n'en répare qu'une moitié.

- **La liste des ancres d'une étape** — l'ancre étroite d'abord sur petit
  écran, puis l'ancre principale, puis le repli — écrite une fois pour trouver
  l'élément et une fois pour le resuivre au défilement. Une divergence ferait
  éclairer le rail replié, c'est-à-dire le vide, dès qu'on fait défiler.
- **La part d'écran qu'un cadre peut occuper**, `0.62`, écrite une fois dans la
  mesure et une fois dans le contrôle de taille. Divergentes, elles donneraient
  un cadre rogné qu'on ne déclare pas trop grand : la visite ne ferait alors
  pas défiler jusqu'à l'ancre, et désignerait quelque chose qui n'est pas à
  l'écran.

`src/lib/visiteGuidee.ts` les porte, avec les cas qui les distinguent : le
seuil de 900 px éprouvé des deux côtés, l'ordre des trois ancres, l'élément
sans surface qui ne se cadre pas (un rail replié n'occupe aucun pixel), et le
tableau d'historique de quatre mille pixels borné sans que son haut ne bouge.
Un test vérifie que la borne et le contrôle emploient le MÊME seuil — c'est
exactement ce que la duplication rendait invérifiable.

Cinq sabotages, cinq échecs, dont les deux seuils rendus divergents.

### L'historique sautait d'un quart d'écran, et toutes les campagnes disaient zéro
Campagne de mesure après les cinq versions du matin. **Accessibilité : 0 constat
sur 90 passes** — quinze pages, six langues, aucune page laissée de côté. Les
douze pages tiennent sous les 2500 ms, sur poste comme sur téléphone bridé.

Et un défaut, sur une métrique qui rendait zéro depuis toujours : **CLS 0,252
sur `/fr/history`**, pour un seuil de 0,1.

La page affichait un « Chargement… » d'une ligne, le pied de page se posait
juste dessous, et tout ce qui était visible sautait de plusieurs centaines de
pixels quand la liste arrivait. C'est **mot pour mot le défaut déjà corrigé
sur le tableau de bord**, mesuré à 0,148 à l'époque, et dont la correction — un
squelette qui réserve la place — est en place depuis.

**Pourquoi personne ne l'avait vu** : toutes les campagnes précédentes
tournaient sur un compte VIDE. Une liste sans ligne ne pousse rien, et la
mesure rendait 0,000 en toute honnêteté sans rien dire. C'est le piège déjà
écrit pour `routes.mjs` — « avec un compte frais, `/api/games` rend deux
octets » — sur une autre métrique, et il a fallu semer soixante parties pour
qu'il se voie.

Sabotage fait dans le bon ordre, ce qui a demandé trois essais : retirer
`<Squelette />` ne compile pas (`noUnusedLocals` attrape l'import devenu
inutile), et la première tentative a mesuré un serveur qui n'avait pas
redémarré — le port était encore pris, `next start` est sorti en 1, et le
chiffre rendu ne valait rien. Le squelette vidé de son contenu, qui lui
compile : **0,268**. Avec : **0,041**.

**Le garde ne mesure pas le déplacement, il mesure la cause.** Le déplacement
dépend des polices et de l'ordre des ressources ; la RÉSERVE, elle, est
déterministe. `e2e/historique.spec.ts` retient la réponse de `/api/games` deux
secondes et demie, relève la hauteur de la page pendant l'attente, puis une
fois remplie, et refuse que la première fasse moins de soixante pour cent de la
seconde.

Deux pièges d'écriture, tous deux déjà dans ce fichier : `-g` écarte le test
qui ouvre le compte, donc la sonde mesurait la page de connexion ; et à 1280 px
les cartes existent dans le DOM mais la feuille de style les cache — chercher
un nom de champion tombe sur un élément invisible. C'est l'effacement du
squelette qui sert de marqueur, parce qu'il vaut des deux côtés.

**Une observation qu'il faut dire sans la surinterpréter** : « une correction
refusée ne change rien à l'écran » a échoué deux fois pendant cette passe, et
douze fois sur douze une fois la machine tranquille. Les deux échecs sont
tombés pendant qu'une construction, un serveur, Playwright et un Chromium de
mesure tournaient ensemble. Ce n'est pas diagnostiqué, et je ne touche pas à ce
test sans l'avoir été : allonger un délai sans savoir ce qu'on attend est la
façon la plus sûre de rendre un test muet.

### Soixante et onze composants sur soixante-douze n'ont aucun test, et ce n'est pas la question
Recensement fait : un seul composant de `src/components` est importé par un
test. Le chiffre a l'air terrible et il ne veut presque rien dire — la suite
unitaire tourne en environnement Node, sans DOM, et les composants sont
éprouvés par les 185 parcours navigateur. Monter jsdom pour rendre du React
dans jest est un changement de stratégie de test, pas un rattrapage ; il
figure dans les questions, pas dans le code.

Ce qui se fait sans arbitrage, c'est ce que le projet fait déjà depuis
`SessionContext` → `chronoSession.ts` : **sortir les DÉCISIONS des composants**,
là où leur erreur se paie.

`AjoutActivite.tsx` fait huit cent soixante-onze lignes et trente états de
React. Au milieu, la règle qui décide si le bouton d'enregistrement s'allume —
c'est-à-dire la porte de l'action la plus employée du produit, et la SEULE
façon d'enregistrer quoi que ce soit tant que la clé Riot n'est pas arrivée.
Elle ne dépend d'aucun de ces états, et rien ne pouvait l'atteindre.

Elle se trompe dans les deux sens, et les deux coûtent : trop sévère, le bouton
reste éteint et rien n'entre ; trop permissive, une partie incomplète part au
serveur, qui la refuse — et le message accuse alors la saisie de quelqu'un qui
avait rempli ce qu'on lui demandait.

`src/lib/saisiePartie.ts` la porte, avec les cas qui la distinguent : une
séance au temps ne demande ni score ni champion, un champion vide est permis
mais un champion inconnu non, zéro mort est une valeur et pas une absence, et
un classement de battle royale commence à un.

**Un durcissement au passage, à ne pas confondre avec un défaut qui aurait
mordu.** La durée se lisait `Number(dureeH) || 0`, qui laisse passer l'infini :
`Number("1e999")` vaut `Infinity`, et `Infinity || 0` le garde. La valeur
partait telle quelle vers l'aperçu. Le serveur la refuse déjà par
`bornesSaisie`, donc rien n'entrait en base ; ce qu'on évite ici, c'est un
aperçu absurde sous un bouton allumé. `Number.isFinite` remplace le `|| 0`.

Quatre sabotages, quatre échecs. Et les 185 parcours navigateur repassés : le
remaniement ne change rien à ce que l'écran fait.

### Soixante et une clés de dictionnaire que plus personne ne lisait
`dictionaries.test.ts` refuse un FICHIER de dictionnaire que rien n'importe —
deux avaient survécu six semaines à la suppression de leurs écrans. Il ne dit
rien des clés à l'intérieur d'un fichier bien vivant, et c'est là que la même
chose se produit en plus discret : un écran qu'on remanie laisse ses anciens
libellés derrière lui, dans les six langues.

**Soixante et une clés sur onze cent trente**, dans douze fichiers, soit
**trois cent soixante-six entrées** et cinq cent cinquante lignes. Le plus gros
lot vient de `landing.ts` — dix-sept clés, laissées par la conversion de la
page d'accueil au rendu serveur — puis `history.ts` (dix), `exercices.ts`
(treize), `dashboard.ts` (huit).

Le coût est humain, pas technique : TypeScript ne se plaint pas d'une clé que
personne ne lit, et le paquet livré ne s'en allège pas — elle part au
navigateur avec les autres. On la traduit, on la relit, on la corrige.
L'inverse, une clé EMPLOYÉE que personne ne déclare, est attrapé ici par le
compilateur ; il avait fallu un test pour ça dans la coquille Electron, où
« undefined » s'écrivait en travers de la pastille.

**Le recensement s'est trompé deux fois, et les deux erreurs sont
instructives.**

La première version prenait des morceaux de phrases pour des clés :
« Actuellement », « scientifiquement », « Duty ». Un texte français contient
« Actuellement : », et un motif naïf en fait une clé — elle annonçait alors
une trentaine de clés mortes qui n'existaient pas. Il faut SAUTER les chaînes
et les commentaires, ce que fait la version retenue. Une clé inventée envoie
supprimer du texte vivant.

La seconde a failli le faire pour de bon. Huit clés sont CONSTRUITES au vol :
`nomsExercices` lit `${id}Nom` et `${id}Desc` pour chaque exercice du
catalogue. Un recensement par le nom les déclare mortes. **C'est
`nomsExercices.test.ts` qui a arrêté le geste**, en exigeant un nom et une
description pour chaque exercice — un garde écrit pour une autre raison, qui a
attrapé la suppression au moment où elle passait. Le nouveau garde connaît
cette famille maintenant, et lit la liste des identifiants dans le CATALOGUE
plutôt que dans une copie.

Un piège d'écriture dans le script de suppression, qui mérite sa ligne : deux
entrées mortes voisines séparées par un commentaire réclament **toutes les
deux** ce commentaire. Leurs plages se recouvrent, et les supprimer l'une
après l'autre coupe au milieu de la ligne d'après — `tsc` a rendu « chaîne non
terminée » sur un fichier que je venais de réécrire. Les plages se fusionnent
avant d'être retirées.

`src/lib/i18n/clesMortes.test.ts` garde l'ensemble, avec deux témoins : au
moins vingt fichiers et huit cents clés examinés, et la règle des clés
construites doit désigner au moins autant de clés qu'il y a d'exercices. Sans
eux, un extracteur cassé rendrait le fichier vert en n'examinant rien.

Trois sabotages, trois échecs : une clé morte ajoutée, l'extracteur rendu
aveugle, la règle des clés construites vidée.

### Un canal muet brûlait la relance des absents pour quatre-vingt-dix jours
Recherche d'autres cas de « répond juste, ne fait rien », la famille de la
sauvegarde muette et des envois qui cherchaient une heure exacte. Deux
trouvés, dans les deux routes d'envoi programmé, et le second se paie cher.

`notifier` rend zéro sans rien tenter quand les clés VAPID manquent ;
`envoyerBilanHebdo` rend `false` quand la clé Resend manque. C'est écrit dans
les deux modules, c'est délibéré, et `pushConfigure()` comme
`courrielConfigure()` existent pour le demander. **Les deux routes programmées
ne les appelaient pas.**

Elles parcouraient donc toute la base, posaient `rappelLe`, `relanceLe` et
`bilanLe` sur chaque compte, et rendaient `{ examines: N, envoyes: 0 }` — soit
exactement la réponse d'une matinée normale où il n'y a personne à prévenir.

**Ce n'est pas qu'une affaire de journal, et c'est ce qui distingue ce cas des
précédents : les marques sont CONSOMMÉES.** Une clé posée à dix heures ne
rattrape pas un rappel déjà marqué à neuf. Et la relance des absents ne se
rejoue qu'au bout de quatre-vingt-dix jours (`JOURS_ENTRE_RELANCES`) : le seul
message que le produit adresse à quelqu'un qui a cessé de jouer était donc
brûlé, pour un trimestre, par un déploiement incapable de l'envoyer. En
silence, en répondant 200.

C'est mot pour mot le défaut corrigé en août sur la récupération de mot de
passe — « la seule porte de secours promettait un courriel qui ne partait
pas ». La fonction écrite ce jour-là pour le dire n'a jamais été appelée
ailleurs.

Les deux routes s'arrêtent maintenant AVANT toute lecture et toute écriture,
et leur réponse porte `push` ou `courriel` : `"absent"` ou `"configuré"`. Le
workflow lit ce champ et le note en avertissement — sans cette lecture, la
distinction ne servirait à personne. Un zéro redevient lisible.

**Un garde pour la classe, pas pour la ligne.** `src/envoisProgrammes.test.ts`
lit déjà les workflows pour savoir quelles routes un travail PROGRAMMÉ appelle.
Il exige en plus, dans celles-là, que ce qui envoie demande d'abord à son canal
s'il peut envoyer — **et que la question précède la première écriture**, sinon
elle ne protège rien : un contrôle posé après la boucle constate les dégâts au
lieu de les empêcher. Avec le témoin habituel : un renommage de `notifier`
rendrait sinon le test vert en n'examinant aucun canal.

Quatre sabotages, quatre échecs — dont l'écriture glissée avant la question,
qui fait tomber le contrôle d'ordre et lui seul.

Et le piège d'écriture déjà connu, retombé dedans : `jest.mock` remplace le
MODULE ENTIER. Les deux fonctions ajoutées n'y figuraient pas, donc l'appel
rendait `undefined`, et **trente et un tests sans rapport sont tombés d'un
coup**. C'est le bon bruit — mais la cause ne ressemble jamais au symptôme.

**Ce que ça ne dit pas** : si les deux clés sont réellement posées en
production. Ça ne se lit pas d'ici. Ce qui change, c'est qu'à partir de
maintenant le journal du travail programmé le dira, au lieu de rendre le même
zéro dans les deux cas.

Vérifié en passant, et sain : la construction de l'application de bureau a
publié `desktop-v0.9.9` le 1er septembre, quarante-sept exécutions dont une
seule en échec, remontant à V185. Le bouton de téléchargement a bien une
release à désigner.

### Les neuf versions ne changent rien à l'écran, et l'outil a dû être réparé pour le dire
Comparaison de rendu entre V321 et la tête — neuf versions, dont le
resserrement des colonnes de `/api/games`, qui est le seul changement capable
de vider une colonne de l'historique sans que rien ne se plaigne.

**Sur un compte vide : vingt-quatre captures identiques.** Et cette passe ne
prouve presque rien — c'est le piège déjà écrit pour `routes.mjs` : avec un
compte frais, `/api/games` rend deux octets, l'historique n'a rien à montrer,
et la mesure est parfaitement juste sans rien dire. Refaite sur soixante
parties semées.

**Une différence, sur `360_fr_history`, et elle ne venait d'aucune ligne de
code.** Huit mille neuf cent soixante pixels, dans une bande de trente pixels
de large répétée sur toute la hauteur de la liste : la vignette du champion.
D'un côté la lettre de repli, de l'autre un carré vide.

Ce n'est ni l'un ni l'autre des deux états attendus. L'icône vient d'un CDN
tiers, l'historique en demande une PAR PARTIE — soixante — et au moment de la
capture chacune est dans l'un de trois états : arrivée, échouée (le composant
montre alors la première lettre), ou encore en vol (un carré vide). Lequel
dépend du CDN, du proxy et de l'ordre des connexions. L'attente d'image du
script borne chaque requête à quatre secondes, ce qui DÉPLACE la course sans la
supprimer.

Deux vérifications avant de conclure, parce qu'une différence sur la seule page
que le changement pouvait toucher est exactement ce qu'on redoute :

- `ChampionIcon.tsx` et la page d'historique sont **identiques** entre les deux
  versions ; le seul fichier modifié du lot est la route ;
- Data Dragon **répond** depuis cet environnement, 200 en six cent
  trente-cinq millisecondes. Aucune des deux séries ne montrait donc l'état
  normal : les deux montraient un chargement en cours, à deux instants
  différents.

Chaque version comparée à elle-même rendait pourtant zéro différence. C'est ce
qui rend ce bruit-là traître : il est stable dans une série et change d'une
série à l'autre, donc il ressemble à une régression.

**Le CDN est coupé dans la capture.** Chaque icône tombe alors sur son repli,
tout de suite et de la même façon des deux côtés. On ne compare plus l'icône —
on ne la comparait déjà pas, on comparait une course — et le reste de la mise
en page redevient stable. Vérifié : la lettre de repli est bien là, et
`360_fr_history` passe à **zéro pixel de différence**.

Le script connaissait déjà cette leçon pour `/telechargement`, qui lit les
releases GitHub au SERVEUR. Il ne la connaissait pas pour ce que le NAVIGATEUR
va chercher ailleurs, et c'est la moitié qui compte sur une page de liste.

Reste une différence après correction : **cinq pixels** sur `360_fr_cgu`, dans
une bande de deux pixels de large au bord d'un élément arrondi de l'en-tête.
Regardée agrandie, elle ne se voit pas. C'est de l'anticrénelage, comme lors de
la campagne précédente — et c'est la raison pour laquelle on compte les pixels
au lieu de comparer deux empreintes et de conclure.

Conclusion : **les neuf versions ne changent rien à l'écran.**

### Un test du mode placement passait pour la mauvaise raison
`overlay.js` fait six cent onze lignes et n'avait qu'un test : le placement,
écrit parce que c'est la seule partie qui puisse rendre la pastille INVISIBLE.
Le reste se joue pendant qu'on joue, c'est-à-dire là où personne ne regarde.

Quatre règles couvertes, choisies sur ce que leur erreur coûte :

- **le temps de soirée**, compté de deux façons selon que le jeu se raconte ou
  non. League publie son horloge ; Apex n'expose rien, et son temps se lit sur
  celle du poste. Le recalcul dans `envoyerEtat` existe pour un défaut écrit
  dans son commentaire — sans lui, `sessionSec` n'était mis à jour que par un
  relevé qui n'arrive jamais, et le moindre envoi (une dette qui bouge, une
  capture) renvoyait le chrono à « --:-- ». Rien ne le tenait ;
- **la surveillance**, qui retire une pastille restée seule à l'écran. C'est le
  défaut déjà corrigé sur la boucle de détection, à l'autre bout de la chaîne :
  un seul événement de fin manqué la laissait au premier plan pour le reste de
  la soirée ;
- **le message de capture**, qui la montre SANS la vouloir. S'il posait `voulu`,
  la surveillance croirait à un affichage demandé et la maintiendrait ;
- **la chaîne de repli des raccourcis**, sans laquelle il n'y en a aucun —
  Discord, GeForce et Steam tiennent couramment les combinaisons évidentes, et
  un raccourci global échoue en silence.

**Cinq sabotages, quatre échecs au premier essai**, et le cinquième est la
trouvaille. « Ne retire pas la pastille pendant qu'on la déplace » restait vert
avec `!enPlacement` retiré de la condition : le mode placement passe par
`afficher({ parLUtilisateur: true })`, donc il était déjà protégé par `manuel`.
Le test éprouvait `manuel` en croyant éprouver `enPlacement`.

Le cas qui les distingue demande de PERDRE `manuel`, ce que fait une partie qui
démarre. Quand elle s'achève, la pastille est encore attrapée à la souris et
seul `enPlacement` la retient. Sabotage refait sur ce cas : il tombe.

C'est la même leçon que les deux tests de champions de l'avant-veille, sous une
autre forme : **une condition redondante sur le chemin qu'on emprunte n'est pas
éprouvée, elle est seulement masquée par la précédente.**

Et une annotation qui manquait : `definirEnPartie(valeur, jeu = null)` faisait
déduire à TypeScript le type de sa valeur par défaut, donc `null` — le seul
argument que cette fonction reçoive jamais était refusé. Le JSDoc le dit.

### Le pont de la pastille, et huit fichiers de test qui n'étaient pas des modules
`overlay-preload.js` fait vingt-quatre lignes et c'est le seul chemin par
lequel la pastille en jeu apprend quoi que ce soit. Trois abonnements
identiques sur trois canaux distincts : un canal recopié d'un abonnement à
l'autre enverrait l'état à celui qui attend des mots, et la pastille
afficherait « undefined » par-dessus le jeu. Huit tests, trois sabotages, trois
échecs.

**Et il a mis au jour une fragilité qui dormait.** `tsc` s'est mis à refuser
« Cannot redeclare block-scoped variable 'pont' » — sur `preload.test.ts`, que
je n'avais pas touché. La cause : un fichier de test sans `import` ni `export`
au premier niveau n'est pas un MODULE pour TypeScript, c'est un script, et ses
noms entrent dans la portée globale. Les huit fichiers de test de `desktop/`
étaient dans ce cas ; ça n'a jamais gêné parce qu'aucun ne partageait un nom
avec un autre, jusqu'à ce que deux ponts se ressemblent.

Jest ne s'en aperçoit jamais — chaque fichier y a sa propre portée à
l'exécution. C'est `tsc` qui le dit, et il a raison : ce n'est pas une plainte
de typage, c'est une collision réelle dans un espace de noms partagé. Les huit
portent `export {}` maintenant.

Ce que ça apprend : **une contrainte qui ne gêne pas encore n'est pas
respectée, elle est seulement non encore violée.** Le fichier qui la révèle
n'est pas celui qui la casse.

### Le menu de la zone de notification, éprouvé enfin
C'est le seul écran qui subsiste quand la fenêtre est fermée — et la fenêtre
est fermée pendant toute une soirée de jeu, puisque c'est le but. Deux choses
s'y jouent, et aucune n'était tenue :

- **la langue.** L'icône est posée AU DÉMARRAGE, avant que la fenêtre ait
  chargé la moindre page, donc avant qu'on sache quoi que ce soit de la langue
  choisie. D'où la langue passée en fonction et le menu reconstruit ensuite. Le
  commentaire l'a promis avant que le code le fasse — c'est écrit plus bas dans
  ce journal — et rien n'aurait redit si ça se défaisait ;
- **l'avertissement de mise en veille.** Une fois par session : jamais, et on
  croit avoir quitté en fermant la fenêtre ; à chaque fois, et c'est un
  harcèlement qu'on coupe — en coupant tout le reste avec.

Neuf tests, trois sabotages, trois échecs : la langue lue une seule fois,
l'avertissement qui se répète, et le rafraîchissement qui agit sur une icône
détruite.

Rien de cassé trouvé. C'est un test de non-régression sur du code correct, ce
qui est le bon moment pour l'écrire — la même raison que pour le placement de
la pastille.

### Un script d'un soir dormait à la racine depuis dix jours
`diag.mjs` y vivait depuis la nuit où l'image du bilan de saison partait quatre
étapes trop tard. Il avait servi, il avait été commis avec la correction, et il
n'a plus rien fait depuis — chemins codés en dur, cookie nommé à la main,
aucune référence nulle part.

`codeMort.test.ts` ne pouvait pas le voir : il ne regarde que `src/`. Or c'est
justement DEHORS que ce genre de fichier atterrit — on le pose à la racine pour
l'exécuter vite, et il y reste. Le coût est le même que celui du code mort
ordinaire, et il est humain : on le lit en cherchant autre chose, on se demande
s'il sert encore, on n'ose pas le supprimer.

`src/scriptsRacine.test.ts` refuse tout script suivi par git à la racine qui ne
soit pas chargé PAR SON NOM par un outil. Sept exemptions, toutes réelles et
vérifiées à l'écriture — `middleware.ts` en fait partie sans être une
configuration : Next.js le trouve par son nom, et personne ne l'importe.

**Le premier sabotage était faux, pas le garde.** J'ai posé un fichier de
brouillon à la racine et le test est resté vert : `git ls-files` ne liste que
ce qui est SUIVI, et je ne l'avais pas ajouté. C'est le bon comportement — un
brouillon non commis n'est pas dans le dépôt — mais il a fallu une seconde
lecture pour ne pas conclure que le contrôle ne mordait pas. Reproduit
correctement : il tombe. Trois sabotages au total, trois échecs.

### La source de diffusion marche, et maintenant on le sait
Elle n'avait aucun parcours à elle. `refus-silencieux.spec.ts` éprouve le refus
de régénérer le jeton — pas la page. Or c'est **la seule surface du produit que
des inconnus regardent** : elle s'affiche par-dessus un stream, devant le public
de quelqu'un d'autre, et une régression y serait invisible depuis l'application.

Poussée de bout en bout, elle tient : le jeton n'existe pas avant qu'on le
demande, la page se lit sans session, elle montre le temps d'effort dû, un
jeton faux ne montre que trois mots, et régénérer coupe l'ancien lien — ce qui
est la seule façon de révoquer une adresse déjà collée dans un logiciel de
diffusion.

Une fausse alerte en passant, et elle valait la vérification : la page affiche
« À FAIRE » en français sous un `<html lang="en">`. Ce n'est pas un défaut,
c'est la règle écrite : la page n'a pas de langue dans son adresse, donc les
mots viennent du COMPTE. Le compte de la sonde était français, l'anglais du
`lang` vient de la coquille de diffusion, qui n'en a pas. Vérifier avant de
« corriger » aura évité de casser une décision documentée.

**Deux sabotages, deux échecs — au deuxième essai.** Les premiers sont passés
au vert parce que j'avais modifié la source sans reconstruire : `next start`
sert le `.next` qu'on lui a donné, et un sabotage qui ne change pas le binaire
ne sabote rien. C'est le piège déjà écrit ici sous sa forme inverse (« ne
jamais reconstruire pendant qu'un test tourne ») ; celle-ci est plus sournoise,
parce qu'elle ne casse rien — elle rend simplement le contrôle muet.

### Ce que la sauvegarde va bien, et l'avertissement qu'elle traîne
Vérifiée par son journal et non par sa pastille, comme il se doit depuis
qu'elle a pu ne rien produire pendant des semaines sans que rien ne le dise :
sept exécutions vertes d'affilée depuis le 26 août, la dernière le 1er
septembre, et **les treize étapes ont réellement tourné** — export, restauration
dans un PostgreSQL neuf, comparaison table par table, chiffrement, dépôt de
l'archive. Ce n'est pas une exécution qui saute tout faute de secrets.

Le rythme, lui, est irrégulier comme celui des envois — entre 04 h et 15 h UTC
selon les jours — mais une sauvegarde QUOTIDIENNE ne vise aucune fenêtre : le
décalage ne lui coûte rien. C'est ce qui distingue son cas de celui du rappel du
matin, et ça vaut d'être écrit : le même déclencheur irrégulier est sans effet
ici et fatal là-bas.

**Un avertissement traîne dans le journal, et il n'est pas traité :**

> Node.js 20 is deprecated. The following actions target Node.js 20 but are
> being forced to run on Node.js 24: actions/checkout@v4, actions/upload-artifact@v4

Treize emplois d'actions en v4 dans les quatre travaux — `checkout`,
`setup-node`, `upload-artifact`, `cache`. GitHub compense pour l'instant ; le
jour où il cessera, les quatre travaux tombent d'un coup, sauvegarde et
supervision comprises.

Les majeures disponibles, lues par `git ls-remote --tags` faute d'API
joignable : `checkout`, `setup-node` et `upload-artifact` sont en **v7**,
`cache` en **v6**. On sait donc quoi installer ; on ne sait pas ce que chaque
majeure a changé, et c'est ce qui manque. Trois majeures d'écart sur
`upload-artifact` ne se prennent pas à l'aveugle.

Ça n'a donc **pas** été corrigé cette nuit, et la raison mérite d'être notée :
se tromper casse les quatre travaux — y compris la sauvegarde, qui ne tourne
qu'une fois par jour et dont l'échec ne se verrait pas avant le lendemain.
C'est précisément le travail dont on veut le moins qu'il tombe en silence. Un
avertissement que GitHub compense encore ne justifie pas ce risque-là. À faire
depuis une machine qui peut LIRE les notes de version, pas seulement lister les
étiquettes.

### La mécanique de rétention n'a jamais tourné, et répondait 200
Le rappel du matin, la relance des absents et le bilan hebdomadaire cherchaient
tous les trois l'heure EXACTE : `heureLocale(...) === 9`. C'est juste si le
déclencheur passe toutes les heures. **Il ne le fait pas.**

Relevé sur les trente dernières exécutions du travail, huit jours :

| jour | exécutions | heures UTC |
|---|---|---|
| 1ᵉʳ sept | 5 | 05 10 14 18 21 |
| 31 août | 4 | 05 13 20 23 |
| 30 août | 6 | 00 06 12 17 21 23 |
| 29 août | 5 | 02 09 14 18 21 |
| 28 août | 2 | 05 18 |
| 27 août | 2 | 09 20 |

Vingt-quatre attendues par jour, trois à six en vrai — le `schedule` de GitHub
Actions est au mieux disant, il décale et il saute. Et sur ces huit jours,
**aucune exécution à sept heures UTC**, c'est-à-dire neuf heures en France.

Donc : le rappel du matin, le bilan et la relance ne sont **jamais partis**
pour un compte français. Les deux routes répondent 200 à chaque passage avec
zéro envoi, ce qui est le résultat exact et normal quand on regarde à la
mauvaise heure. Rien ne pouvait le signaler — c'est le même piège que la
sauvegarde muette, sous une autre forme : **une réponse juste à une question
qu'on ne pose jamais au bon moment.**

C'est la deuxième fois que ces trois envois se révèlent n'avoir jamais tourné.
La première, c'était les quatre routes qui partaient en 307 vers `/login` ; on
a corrigé la porte, vérifié que la route répondait 200, et conclu. La
vérification était juste et incomplète : « la route répond » ne dit pas
« quelqu'un l'appelle à l'heure ».

**Ce qui change.** On ne cherche plus une heure, on cherche une FENÊTRE — neuf
heures à midi local — et on retient ce qui est déjà parti. Les deux moitiés
sont nécessaires : sans fenêtre le déclencheur rate la cible, sans marque il
enverrait trois fois dans la matinée. Le bilan et la relance avaient déjà leur
marque (`bilanLe`, `relanceLe`) ; le rappel du matin n'en avait pas, d'où
`User.rappelLe`.

La fenêtre s'arrête à midi : c'est encore le matin, le rappel garde son sens,
et ça fait trois occasions au lieu d'une. L'élargir davantage ferait un rappel
« de la journée », ce qui n'est pas la même promesse — et ce serait un
arbitrage de produit, pas une tolérance d'implémentation.

**La marque se compare par JOUR LOCAL, pas en heures écoulées.** « Au moins
vingt-quatre heures depuis le dernier » ferait dériver la marque : envoyé à
11 h 30 lundi, le suivant ne pourrait pas partir avant 11 h 30 mardi, donc
sortirait de la fenêtre au bout de quelques jours et l'envoi sauterait un jour
sur deux. Un test tient ce cas précis.

Cinq sabotages, cinq échecs — dont un qui est passé au vert au premier essai :
remettre l'heure exacte dans le bilan hebdomadaire ne faisait tomber aucun
test, parce que son fichier ne l'éprouvait qu'à neuf heures pile. Un test
écrit autour d'une constante n'éprouve que cette constante.

**Ce qui n'est pas réglé, et qui ne se décide pas seul** : la fenêtre rend le
système tolérant à un déclencheur irrégulier, elle ne le rend pas ponctuel.
Trois à six passages par jour, ça reste une loterie à trois cases sur
vingt-quatre. Un déclencheur fiable — les tâches planifiées de Vercel, par
exemple — est une décision d'infrastructure ; elle figure dans les questions.

**Et deux gardes ont mordu sur la colonne ajoutée**, ce qui est exactement leur
raison d'être : `compte.test.ts` a exigé qu'on range `rappelLe` d'un côté ou de
l'autre de ce qui sort du compte, et `politiqueComplete.test.ts` qu'on la
décrive dans la politique de confidentialité ou qu'on dise pourquoi elle en est
absente. Aucune des deux ne se serait posée toute seule.

**Un garde pour la classe, pas pour la ligne.** `src/envoisProgrammes.test.ts`
lit les workflows — la source de vérité — pour savoir quelles routes un travail
PROGRAMMÉ appelle, et refuse dans celles-là toute comparaison de `heureLocale`
à une valeur exacte. Comparer une heure exacte reste parfaitement légitime
ailleurs ; c'est la répétition automatique qui rend l'hypothèse coûteuse. Il
exige aussi que la fenêtre fasse au moins trois heures : une heure est
exactement le cas qu'on vient de corriger. Trois sabotages, trois échecs — dont
le renommage des adresses dans le workflow, qui doit faire tomber le contrôle
de non-vacuité plutôt que de le rendre vert sur zéro route.

Il lit le CODE et non les commentaires, ce qui n'allait pas de soi : les
commentaires de ces routes citent le motif fautif pour expliquer pourquoi il a
disparu, et un garde naïf se serait déclenché sur sa propre explication.

**Un piège d'outillage, nouveau celui-là.** La suite navigateur est tombée en
entier après l'ajout de la colonne : quatre-vingt-dix tests non joués, et le
symptôme était « l'ouverture de compte expire ». La cause n'a rien à voir —
la base locale n'avait pas la migration, donc TOUTE requête authentifiée
échouait, `getCurrentUser` nommant la colonne dans son SQL. `npx prisma migrate
deploy` après avoir touché au schéma, avant de lancer quoi que ce soit. La CI,
elle, monte sa base par les migrations : elle n'aurait pas eu le problème.

### Le poids par route, mesuré avant/après plutôt qu'annoncé
`charge.mjs` monte en charge sur le DOCUMENT : il ne dit rien du poids d'une
réponse d'API, qui est justement ce que le resserrement des colonnes vient de
changer. `scripts/routes.mjs` le mesure — corps pesé, vingt appels chronométrés
— et `scripts/semer-parties.mjs` lui donne de quoi mesurer.

Sur soixante parties, serveur local :

| route | avant | après |
|---|---|---|
| `/api/games` | 35 634 octets | **24 834** |
| `/api/dashboard` | 5 405 octets | 5 405 |

**Et il faut dire pourquoi le tableau de bord ne bouge pas.** Sa réponse est
faite d'agrégats, pas de lignes : son `select` réduit ce qui sort de la BASE,
pas ce qui part vers le navigateur. Le gain est sur l'autre moitié du chemin —
en production, chaque requête est un appel HTTPS indépendant vers Neon, et ce
sont quinze colonnes sur trente et une qui traversent au lieu de toutes. Ça ne
se mesure pas d'ici ; l'annoncer comme un gain de réponse serait faux.

Les temps ne bougent pas non plus, et c'est attendu : la base est sur la même
machine, treize millisecondes de médiane des deux côtés. Ce qu'on a retiré,
c'est du volume, pas du travail.

**Deux pièges retombés en écrivant l'outil, tous deux déjà dans ce fichier.**
Le premier rapport donnait 31 143 octets pour les SEPT routes — c'est-à-dire la
page de connexion sept fois : j'envoyais le jeton nu en guise d'en-tête
`cookie`, alors qu'Auth.js le découpe en deux au-delà de 3 500 caractères. Sept
chiffres identiques auraient dû me sauter aux yeux ; c'est le contrôle
d'atterrissage qui l'a dit, et il n'existait que parce que je l'ai ajouté après
coup. Le second : avec un compte frais, `/api/games` rend deux octets. La
mesure est juste et ne dit rien. D'où le semis, et d'où la phrase en tête de
l'outil.

### `networkidle` attendait un silence qui ne vient jamais
Deux fichiers de parcours ont échoué en cinq exécutions complètes, chacun une
fois, chacun sur un `page.goto(..., { waitUntil: "networkidle" })` qui expire.
Rejoués seuls, les deux passent. La tentation, à ce moment-là, est de relancer.

`networkidle` attend cinq cents millisecondes sans une seule requête. Sur une
page qui continue de parler — un sondage, un rafraîchissement au retour sur
l'onglet, et depuis cette nuit une reprise deux secondes après une lecture
vide — ce silence n'arrive jamais franchement. Le test n'attend donc pas ce
qu'il croit : il attend que la page se taise, ce qui n'est ni nécessaire ni
suffisant pour qu'elle soit prête.

Le test qui a fini par déborder est celui qui ouvre TROIS contextes de suite
dans le même budget de soixante secondes. Ce n'est pas un hasard : c'est celui
qui payait trois fois l'attente.

Les dix-sept `networkidle` de la suite sont remplacés par ce que chaque test
vient réellement chercher — la liste de l'historique, la rubrique des réglages,
le bouton du rail, l'en-tête du bilan. C'est plus juste ET c'est bien plus
rapide, parce qu'un marqueur paraît dès qu'il est vrai :

| fichier | avant | après |
|---|---|---|
| `historique.spec.ts` | 3 min 24 | 14 s |
| `reglages.spec.ts` | 40 s | 9 s |
| `hors-ligne.spec.ts` | 47 s | 11 s |
| **la suite entière** | **14 min 30** | **9 min 20 à 9 min 50** |

Cinq minutes d'attente pure en moins, sur chaque exécution, en local comme en
intégration continue. La fourchette est celle de cinq exécutions complètes :
un chiffre unique aurait été le meilleur des cinq, ce qui n'est pas une mesure.

**Un marqueur mal choisi, attrapé du premier coup.** J'avais pris la pastille
de dette pour dire « le tableau de bord est prêt » dans `hors-ligne.spec.ts`.
Elle n'existe pas tant qu'il n'y a rien à devoir, et ce fichier ouvre le
tableau de bord AVANT d'enregistrer la partie qui crée la dette. Un marqueur
qui n'est pas toujours là ne dit pas « la page est prête », il dit « ce cas-ci
est arrivé ». Le rail, lui, est toujours rendu.

C'est la deuxième fois cette nuit que je prends la pastille de dette pour un
élément permanent. La première, c'était le parcours de reprise, sur un compte
qui n'a que les pompes.

### Un commentaire promettait ce que l'échantillonnage ne fait pas
`estNoir` décide si la capture d'écran est noire — c'est ce qui distingue « le
jeu tourne en plein écran exclusif » de « voilà l'écran de fin ». Elle
échantillonne un pixel sur cent un, et le commentaire annonçait que c'était
« assez serré pour qu'un petit élément lumineux sur fond noir — un écran de
chargement — ne passe pas pour un écran vide ».

Mesuré : sur un écran 1920×1080, une zone lumineuse de 100×20 pixels est vue,
une de 50×10 ne l'est pas. La promesse est fausse en dessous d'une centaine de
pixels de large.

**Et le code a raison quand même**, ce qui est le point intéressant. La
question posée n'est pas « y a-t-il un pixel allumé ? » mais « y a-t-il de quoi
lire des chiffres ? ». Un écran où seule une pastille de cinquante pixels
brille n'a rien à lire, et le refuser est le bon résultat ; le tableau de fin
d'Apex, lui, occupe la moitié de l'écran. C'est le commentaire qui était faux,
pas la fonction — et un commentaire faux se relit comme une garantie, ce qui
est le défaut le plus souvent trouvé sur ce projet. Il dit le seuil réel
maintenant, avec la raison pour laquelle il convient, et un test le pin.

**Le test a trouvé autre chose au passage, et un vrai.** `raccourciActif`
survivait à l'appel : une seconde pose où tous les candidats sont pris rendait
quand même le raccourci de la première, et `lireRaccourciCapture` l'annonçait à
l'écran alors qu'il n'appelait plus personne. L'ancien restait enregistré avec
son rappel. Personne ne peut l'atteindre aujourd'hui — `main.js` appelle une
seule fois au démarrage — et c'est corrigé quand même : une fonction qui
annonce « le raccourci actif » doit annoncer celui de CET appel, et reposer les
raccourcis après un changement de réglages est exactement le genre de chose
qu'on ajoute sans relire ce fichier.

La chaîne de repli des raccourcis est éprouvée avec : Discord, GeForce et Steam
tiennent couramment `Control+Shift+S`, et si le repli casse il n'y a plus aucun
raccourci de capture — on appuie, il ne se passe rien, et rien ne le dit.

Quatre sabotages, quatre échecs.

### Le contrat du pont Electron n'était tenu par personne
`preload.js` expose des méthodes à la page ; `src/types/electron.d.ts` déclare
celles sur lesquelles le site compte. Les deux moitiés vivaient chacune de son
côté, et le défaut que ça laisse passer est le pire de sa famille : une méthode
ajoutée au type et appelée par une page, oubliée dans le pont, donne
« undefined is not a function » **dans l'application installée seulement**.

Rien ne peut le dire ici. TypeScript se tait — le type promet qu'elle existe.
Les parcours navigateur se taisent — ils posent un FAUX pont, dont la forme est
justement ce qu'on voudrait vérifier. Et l'appel tombe dans un `catch`. C'est
la leçon déjà écrite pour l'adresse `/login` : la seule machine capable de voir
le défaut est celle de quelqu'un d'autre.

Comparé : **rien ne manque**. Trente méthodes déclarées, toutes exposées. Une
seule en surplus, `retourConnexion`, et elle a sa raison — c'est l'écran
d'attente de la COQUILLE qui l'appelle, une page `data:` qui n'est pas le site.
Le test l'exempte nommément et vérifie en plus qu'elle sert vraiment : une
exemption qui ne désigne plus rien de vivant est du code mort qu'on a fini par
admettre.

**Le premier résultat de ce contrôle était faux**, et c'est ce qu'il y a à en
retenir. Il annonçait dix méthodes déclarées et non exposées — `score`,
`contexte`, `classement`… — qui sont en réalité les CHAMPS des objets
imbriqués dans les signatures. Un motif ligne à ligne ne distingue pas un
membre d'un niveau d'un membre d'un autre ; il faut suivre la profondeur des
accolades. Dix faux positifs auraient envoyé corriger un pont qui n'avait rien.

Trois sabotages, trois échecs — dont le troisième par ENOENT plutôt que par
assertion, ce qui est le bon bruit : un garde qui ne trouve plus ses fichiers
doit tomber, pas passer au vert sur deux listes vides.

**Et le pont a reçu ses premiers tests de comportement**, distincts du contrat
de forme. Deux choses seulement, parce que ce sont les deux qui peuvent mal
tourner sans bruit :

- **le filtrage par type.** Un seul canal, `lol:event`, porte le début ET la
  fin de partie. Si le filtre saute, `onGameStarted` se déclenche à la fin :
  la page ouvre une session de jeu au moment où elle devrait la fermer, et
  personne ne fait le lien ;
- **le désabonnement.** La page monte et démonte ces écouteurs au fil de la
  navigation. Une fonction de retrait qui ne retire rien laisse s'empiler des
  rappels sur des composants démontés, et le symptôme — une partie enregistrée
  plusieurs fois — ne ressemble pas à sa cause.

Le recollage du contexte à la partie est éprouvé aussi : c'est lui qui porte le
rôle et la file lus sur le lanceur, et sa perte est le défaut déjà corrigé où
un support payait ses morts au tarif d'un jungler.

Quatre sabotages, quatre échecs, chacun précédé d'un contrôle que le fichier a
bien changé — la parade au « sabotage qui ne sabote pas », retombé dedans
l'heure d'avant.

### Revue des deux routes nées cette nuit
`/api/contexte` et `/api/progression` regroupent ce que cinq routes rendaient.
Une route neuve qui remplace cinq routes éprouvées mérite qu'on la pousse plutôt
qu'on la relise. **Aucune faille**, et deux corrections d'hygiène, chacune avec
sa raison.

**Une règle écrite deux fois, et la seconde copie était déjà fausse.**
`/api/dashboard/daily` contrôle une date par son ALLER-RETOUR depuis que
« 9999-99-99 » l'a fait tomber en 500 et que « 2026-02-30 » y montrait le
2 mars. `/api/progression` s'en tenait au motif. La même chaîne y passait donc,
était employée telle quelle, et rendait une série de zéro — en
court-circuitant le repli prévu pour ce cas exact. Ce n'est ni une injection ni
une fuite : c'est un chiffre faux affiché à quelqu'un, sur l'écran qui existe
pour le lui dire. `estJourValide` vit dans `serie.ts` et les deux routes la
lisent. C'est le sixième cas de règle dupliquée trouvé sur ce projet.

**Une route qui agit avant de savoir à qui elle parle.** `/api/contexte`
semait le barème et chargeait les ratios AVANT de lire la session : une requête
sans session faisait travailler la base avant de se faire éconduire. Le
middleware n'ouvre pas cette adresse aux anonymes, donc ce n'était pas une
porte — mais c'est une mauvaise habitude, et le contrôle du code de réponse ne
dit rien de ce qu'une route a fait en chemin. Le test le dit maintenant, avec
son témoin : sans lui, cesser d'appeler les deux modules des deux côtés rendrait
le contrôle vrai en ne prouvant plus rien.

Le reste tient : session exigée sur les deux, filtrage par `userId` sur les
trois requêtes, `comptePublic` plutôt qu'un `{ ...user }`, et le jour reçu du
navigateur ne touche jamais une requête SQL.

**Deux sabotages sur cinq ne sabotaient rien**, et c'est la leçon de la passe.
Le premier était un `sed` dont l'échappement avait mangé le motif : le fichier
n'avait pas changé, les tests passaient, et j'ai failli conclure que le contrôle
ne mordait pas. C'est le piège déjà écrit ici — « un sabotage qui ne sabote
pas » — et la parade est la même : vérifier que le fichier a bougé avant de
lancer les tests. Le second sabotait bien, et c'est le TEST qui manquait :
vérifier un code 401 ne dit rien du travail fait avant de le rendre.

**Dépendances, au 2 septembre.** Rien à mettre à jour : sur le site comme sur
l'application de bureau, tout ce qui est en retard l'est d'une version MAJEURE
— `typescript` 5 → 7, `eslint` 9 → 10, `@types/node` 20 → 26, `electron` 43 →
44 — ou d'une préversion, `prisma` 8.0.0-rc. Un saut majeur se relit, il ne se
prend pas de nuit. `npm audit` rend zéro vulnérabilité sur l'application de
bureau, et les deux « hautes » du site restent celles de `mysql2`, hors
d'atteinte et gardées par `src/dependanceMysql.test.ts`.

### Le recensement de `src/lib`, et le seul module laissé de côté
Refait après les extractions de la nuit. Il ne se fait pas au nom du fichier :
un module est couvert quand un test l'IMPORTE, ce qui se cherche dans le texte
des tests, alias `@/lib/` compris. Les dictionnaires de langue sortent du
compte — `dictionaries.test.ts` lit le dossier entier, pas les fichiers un par
un.

Neuf modules sans test au départ, tous couverts sauf un :

- **`useChampions`** et **`notifier`**, décrits plus haut : les deux portaient
  une règle et l'un cachait un défaut ;
- **`chargerContexte`** et **`chargerProgression`**, écrits cette nuit et
  couverts dans la foulée du défaut de mémoire ;
- **`release`** — le bouton principal de l'accueil et toute la page de
  téléchargement, alimentés par un service tiers dont la FORME n'est jamais
  garantie. Huit cas : release sans exécutable, champ renommé, panne d'API, tag
  illisible. Tous doivent rendre `null` plutôt qu'un bouton qui télécharge
  « undefined » ;
- **`logosJeux`** — l'ordre de préférence des formats. Un jeu dont on a récupéré
  un SVG propre ET un PNG hérité s'affichait flou si le PNG l'emportait, sans
  que rien ne le signale : les deux fichiers sont là, l'image se charge ;
- **`videoBoucle`** — la vidéo n'existe pas encore, et c'est précisément
  pourquoi le test compte. Le jour où le fichier arrive, personne ne relira ce
  module, et une inversion des deux formats ferait télécharger le MP4 à des
  navigateurs qui savent lire le WebM ;
- **`graphiques`** — que des constantes, sauf une propriété : « une couleur par
  nature de donnée, jamais deux pour la même ». Le test éprouve la propriété,
  pas les valeurs, et compte les entrées — une table vidée n'a pas de doublon
  non plus.

**`valeurClient` reste dehors, avec sa raison.** Il n'expose que des crochets
React bâtis sur `useSyncExternalStore` : les éprouver demande un rendu, donc un
DOM, et la suite tourne en environnement Node. Monter jsdom pour un module ne
paie pas ; ce qu'il fait se voit dans les parcours navigateur, qui ouvrent les
pages où il sert.

Treize sabotages sur les cinq modules, treize échecs.

**Trois modules ne sont pas passés au recensement**, et il faut le dire :
`actions` et `auth-actions` sont des enveloppes de trois lignes autour
d'Auth.js — les éprouver, c'est éprouver la doublure — et `seed-defaults` et
`exercicesConfig` étaient déjà couverts par sept et huit tests de route.

### Campagne de clôture du 2 septembre — douze pages, toutes dans le seuil
Refaite après le regroupement des appels d'API, le cache de barème, les six
conversions au serveur et le resserrement des colonnes lues en base. C'est la
première campagne de ce projet où **aucune page ne dépasse**, ni sur poste ni
sur téléphone bridé.

| écran | LCP poste | LCP téléphone bridé | plus grand élément |
|---|---|---|---|
| `/fr/settings` | 148 ms | 940 ms | la mention Riot, en pied |
| `/fr/bilan` | 148 ms | 912 ms | la mention Riot, en pied |
| `/fr/history` | 152 ms | 912 ms | la mention Riot, en pied |
| `/fr/dashboard` | 312 ms | 1128 ms | le bandeau d'attente Riot |
| `/fr/login` | 468 ms | 1140 ms | la mention des CGU |
| `/fr/cgu` | 500 ms | 1124 ms | le premier paragraphe |
| `/fr/telechargement` | 512 ms | 1144 ms | le paragraphe SmartScreen |
| `/fr/calculateur` | 524 ms | 1124 ms | le titre |
| `/fr/calculateur/league-of-legends` | 524 ms | 1136 ms | le titre |
| `/fr/confidentialite` | 540 ms | 1140 ms | le titre |
| `/fr/beta` | 552 ms | 1648 ms | « Un pseudo suffit » |
| `/fr` | 680 ms | 1400 ms | l'image de l'application |

CLS de 0,000 partout, sauf 0,001 sur le tableau de bord.

Ce que les trois écrans connectés apprennent : leur plus grand élément est la
**mention Riot du pied de page**, à 150 ms. Autrement dit ils peignent quelque
chose de définitif tout de suite, et rien de plus grand n'arrive ensuite — la
page ne se réorganise plus quand les données reviennent. C'était le contraire
il y a deux semaines, où le tableau de bord n'avait rien à montrer avant
3456 ms.

Le poids du JavaScript par page, qui est l'autre moitié du sujet : 173 ko sur
les pages publiques (elles ne montent plus les vingt composants du fournisseur
connecté), 362 ko sur le tableau de bord, qui porte recharts.

**Accessibilité : 0 constat sur 90 passes** — quinze pages, six langues, aucune
page laissée de côté. Et l'outil sait toujours échouer, ce qui se vérifie plutôt
que se suppose : un contraste de 1,43 posé volontairement sur le titre des CGU
remonte avec son ratio, sa taille et son texte, dans les six langues.

### Trois mémoires de module retenaient l'échec comme une réponse
Le défaut des champions n'était pas isolé : c'est une famille, et les trois
membres ont été écrits pour la même bonne raison. Plusieurs composants d'un
écran ont besoin de la même réponse, donc on mémorise l'appel au niveau du
module pour qu'un seul parte. C'est juste, c'est mesuré, et ça ne dit rien de
ce qu'il faut faire quand la réponse ne vient pas.

```ts
if (!enCours) enCours = demander();   // l'échec aussi devient définitif
```

- **`useChampions`** : liste codée en dur figée, et comme elle sert à VALIDER,
  un champion ajouté par l'administrateur devenait « non reconnu ».
- **`chargerContexte`** : `null` rendu à tous les composants pour toute la
  durée de la page. Compteur de dette vide, lien d'administration absent,
  consentement redemandé. Aucun ne se plaint, aucun ne redirige : l'écran est
  simplement moins vrai qu'il ne le dit.
- **`chargerProgression`** : paliers et série effacés, dans les mêmes
  conditions.

Une mémoire retient maintenant l'appel EN VOL, pas son résultat quand il est
vide. Le prochain composant qui se monte retente ; comme les montages d'un
écran ont lieu dans le même tour de boucle, il n'y a pas de tempête à craindre.
La règle vaut aussi pour `rafraichir` : un rafraîchissement raté ne doit pas
effacer ce qu'on avait, sinon un paiement fait dans le métro vide l'écran.

**Et `chargerProgression` en cachait un second, sans rapport avec l'échec** :
le jour demandé était ignoré après le premier appel (`if (!enCours)` ne regarde
pas l'argument). Un onglet laissé ouvert pendant la nuit gardait la série de la
veille, avec son état de retard — c'est-à-dire exactement l'information qu'on
vient regarder le matin. La mémoire porte le jour maintenant.

Aucune des trois n'avait de test. Six sabotages, six échecs.

**Et ça ne suffisait pas à réparer le premier chargement**, ce qu'il faut dire
plutôt que de laisser croire le contraire. Effacer la mémoire permet à un
composant qui se monte PLUS TARD de retenter ; ceux d'un même écran se montent
dans le même tour de boucle et partagent l'appel en vol. Le gain réel était donc
« changer de page répare » au lieu de « rien ne répare ». C'est mieux, ce n'est
pas la panne qu'on croyait corriger.

Le fournisseur reprend donc une fois, après deux secondes, quand la première
lecture revient vide. Sabotage fait, la reprise retirée : le parcours tombe.

**Et le premier jet de ce parcours accusait la correction qu'il éprouvait.** Il
attendait la pastille de dette sur un compte qui n'en a jamais eu : le compteur
ne suit que ce qui se compte en MINUTES, et un compte neuf n'a que les pompes,
qui se font dans la foulée. La pastille était absente pour une raison
parfaitement normale. C'est écrit depuis longtemps dans l'étape 2 du parcours
complet — « choisir la boxe, pour que la dette s'accumule » — et je ne l'avais
pas lu. Un test qui échoue n'a pas forcément trouvé un défaut du produit. Une seule reprise, et après un délai : une boucle de
reprises sur un serveur qui ne répond pas est le remède qui aggrave la panne.
Le raisonnement qui l'autorise est que sur une page connectée, `null` ne veut
pas dire « pas de compte » — le middleware a déjà exigé une session pour servir
la page. C'est une anomalie, et une anomalie se retente.

Ce que ça apprend : **mémoriser un appel et mémoriser sa réponse ne sont pas la
même chose**, et le raccourci qui confond les deux se relit comme une
optimisation. C'est la même forme d'erreur que le `catch` qui décrit ce qu'il
ne fait pas — le code a l'air de garantir quelque chose, alors qu'il fige un
accident.

### Une coupure d'une seconde refusait un champion pour toute la session
Trouvé en couvrant `useChampions`, et c'est le genre de défaut qu'on ne voit
qu'en écrivant le test qui l'entoure. La liste des champions est mémorisée au
niveau du module — une seule demande par page, ce qui est juste. Mais l'ÉCHEC
l'était aussi :

```ts
enCours = fetch("/api/champions").then(…).catch(() => CHAMPIONS);
```

`enCours` retenait la promesse quoi qu'il arrive. Une coupure au premier
montage figeait donc la liste codée en dur jusqu'au prochain rechargement de
page, sans jamais retenter.

Ce serait un repli acceptable si la liste ne servait qu'à proposer. Elle sert
aussi à **valider** : `championConnu` refuse ce qui n'y figure pas, et
`AjoutActivite` en fait une condition du bouton d'enregistrement. Un champion
ajouté par l'administrateur devenait donc « non reconnu », le bouton restait
éteint, et le message accusait la frappe de la personne alors que la faute est
chez nous. C'est le défaut de la clé Riot refusée — « l'application accusait le
pseudo du joueur » — en plus petit et en plus silencieux.

L'échec ne se mémorise plus : `enCours` est effacée dans le `catch`, et le
prochain montage du champ retente. Pas de tempête à craindre, `charger` n'étant
appelé qu'au montage d'un composant.

Deux sabotages, deux échecs : la mémorisation de l'échec remise, et le contrôle
de forme retiré — sans lui, un `{ error: "Non authentifié" }` deviendrait la
liste des champions.

### Deux de mes propres tests ne prouvaient rien, et le sabotage l'a dit
L'autocomplétion des champions n'était couverte par rien : ni test à elle, ni
par ceux de `ChampionInput`, qui doublent le module entier. Or elle porte une
promesse écrite en commentaire depuis le premier jour — « taper « r » doit
d'abord donner Rakan et Renekton, pas Aatrox » — et une promesse qu'aucun test
ne tient n'est qu'une intention.

Les onze tests écrits sont passés du premier coup, ce qui est le bon moment
pour les figer. Puis le sabotage : **deux sur trois sont repassés au vert.**

- **Le classement, éprouvé sur la vraie liste.** « r » y rend bien Rakan en
  tête et pas Aatrox. Sauf que ça reste vrai sans le rang 0 : une centaine de
  champions commencent par « r », ils tombent tous au rang 1, et les huit
  places sont prises bien avant qu'un Aatrox de rang 2 arrive. **C'était la
  limite qui faisait le travail du classement.** La deuxième version, sur une
  liste fabriquée, a laissé passer le même sabotage pour une autre raison : le
  membre de rang 1 se rangeait de toute façon après celui de rang 0. Il a fallu
  une liste dont l'ordre alphabétique est l'INVERSE du classement attendu.
- **L'ordre alphabétique à rang égal.** Le test lisait la vraie liste, qui est
  déjà triée ; le tri de V8 étant stable, retirer la comparaison ne déplaçait
  rien. Il éprouvait l'ordre du fichier `champions.ts`, pas le comparateur.

Cinq sabotages sur la version finale, cinq échecs — les deux rangs, l'ordre
alphabétique, l'aplatissement de l'apostrophe et le filtre de non-pertinence.

Ce que ça apprend, et c'est la troisième fois que ça s'écrit ici sous une forme
ou une autre : **un test qui lit les vraies données éprouve souvent les vraies
données.** Une propriété ne se prouve que sur un cas construit pour que son
absence déplace quelque chose. La leçon vaut aussi contre moi : ces deux tests
étaient les miens, écrits l'heure d'avant, et je les croyais bons.

`notifierSysteme` a reçu le même traitement, pour une raison plus dure : dans
l'application de bureau, le push web ne PEUT PAS marcher — il exige un
abonnement auprès du service de notification du navigateur, dont Electron n'a
pas les identifiants. L'ordre des deux chemins n'est donc pas une préférence,
c'est la correction d'un défaut, et rien ne la tenait. Trois sabotages, trois
échecs. Piège évité au passage : le module lit `window.electronLOL`, pas
`globalThis` — une doublure posée à côté n'aurait jamais été lue, exactement
comme sur le stockage.

### Les deux plus grosses réponses de l'application publiaient tout
`NextResponse.json(games)` rend la ligne de base telle qu'elle vient. C'est le
défaut déjà corrigé sur le compte par `comptePublic` — « un `{ ...user }`
publie tout ce qu'on lui remet » — un modèle plus bas, et personne n'était allé
voir si `Game` avait la même forme de problème. Il l'avait.

Deux routes, le même geste :

- **`/api/dashboard`** charge TOUTES les parties du compte pour les agréger, et
  les chargeait entières : trente et une colonnes pour quinze lues. Ici le
  `select` se vérifie à la compilation — les lectures sont dans le même
  fichier, et retirer `dureeSec` fait nommer ses trois usages par `tsc`.
- **`/api/games`**, la plus grosse réponse de l'application, publiait `userId`,
  `createdAt`, `gainageSec`, `partiesAvantCalcule`, `arrets`, `file`,
  `fileClassee` et `riotMatchId`, qu'aucun écran ne lit. Rien de secret — ce
  sont les données de la personne qui les demande — mais un tiers de la
  réponse pour rien, sur l'écran qui la charge en entier.

**Et la seconde ne se vérifie pas à la compilation**, ce qui est toute la
différence. L'historique déclare son propre type `Game` de son côté, la réponse
arrive en JSON, et une colonne retirée du `select` s'y traduit par une case
vide : pas d'erreur, pas de test rouge, juste une colonne qui cesse de
s'afficher. Le KDA d'une partie ne se recalcule pas de mémoire.

`src/colonnesHistorique.test.ts` lit les deux listes à la source et les compare
**dans les deux sens** : une colonne déclarée que la route n'envoie pas est une
case vide, une colonne envoyée que personne ne lit est le gaspillage qu'on
vient de retirer, et elle reviendrait sans bruit. Avec le contrôle de
non-vacuité habituel — sans lui, un motif qui ne trouve plus rien rendrait le
test vert en comparant deux listes vides, ce qui est exactement la forme
d'erreur que ce fichier existe pour empêcher.

Trois sabotages, trois échecs : `variante` retirée du `select`, `gainageSec`
ajouté sans lecteur, et le motif rendu aveugle par un `as const` posé dans
l'`orderBy`. Ce troisième cas mérite d'être noté : une retouche parfaitement
légitime de la route fait tomber le test. C'est le bon sens de l'échec — il dit
« viens mettre le motif à jour » au lieu de passer au vert sur rien.

Ce qui n'a **pas** été fait, et pourquoi : agréger en SQL plutôt que de
rapatrier les parties. Ce serait mieux, et ce serait optimiser pour une charge
qui n'existe pas — quatre comptes, soixante-quinze parties. Le `select`, lui,
ne coûte rien.

### Les six conversions au serveur ne changent rien à l'écran, prouvé
Six composants sont passés du navigateur au serveur cette nuit — CGU,
confidentialité, connexion, téléchargement, en-tête d'administration, page
d'accueil. C'est un remaniement qui ne doit RIEN changer à l'écran, et ce genre
de chose se prouve, il ne se relit pas.

`scripts/comparer-rendu.mjs`, captures prises sur V315 puis sur l'état actuel :
vingt-quatre captures, huit pages à trois largeurs. **Deux différences**, et
aucune n'en est une :

- `360_fr_telechargement` dépend des releases GitHub, et le script la range
  déjà à part sous « à vérifier à la main » ;
- `360_fr_history` diffère d'**un pixel sur deux lignes**, à la même position.
  Compté en défiltrant les deux PNG et en comparant pixel à pixel : c'est de
  l'anticrénelage, pas un déplacement.

L'ordre compte, et je m'y suis pris à l'envers la première fois : le script
prend d'abord la référence (`avant`), puis compare (`apres`). Lancé dans
l'autre sens, il cherche un fichier d'empreintes qui n'existe pas et tombe sur
une pile d'appels qui ne dit pas laquelle des deux passes manque.

### Deux règles de l'application de bureau sortent de main.js
`desktop/src/main.js` fait mille cinq cents lignes et n'avait aucun test :
l'essentiel tient à Electron et ne s'éprouve qu'avec une fenêtre. Deux règles
n'en dépendaient par aucun bout, et toutes deux se paient cher quand elles se
trompent.

**L'aléa qui garde le canal de connexion.** L'application ouvre le navigateur
du système et attend un retour sur un port local ; sans cet aléa, n'importe
quoi tournant sur la machine pourrait pousser une session dans l'application.
Un cas mérite d'être nommé : `timingSafeEqual` **lève** sur deux tampons de
longueurs différentes. Sans le contrôle de longueur qui le précède, un aléa
trop court ne rendrait pas « faux » — il ferait tomber le serveur local. Le
test l'éprouve sur quatre longueurs, dont la chaîne vide.

**La table des réglages de pastille**, et surtout la reprise de l'ANCIEN
format. Les versions antérieures rangeaient `overlay`, `overlayCoin` et
`overlayPosition` à plat, pour un seul jeu. Les ignorer remettrait tout le
monde au coin par défaut sans prévenir — et le placement est la seule chose qui
puisse rendre la pastille invisible. Onze cas, dont le coin inventé qui poserait
la pastille hors de tout écran, et `!== false` plutôt que `=== true` : quelqu'un
qui n'a jamais rien réglé doit voir la pastille, sinon la fonction principale du
produit n'apparaît pas.

Quatre sabotages, quatre échecs. Et un commentaire qui a déménagé avec son
code : « le `crypto` global d'Electron est celui du navigateur, ni randomBytes
ni timingSafeEqual ». Il expliquait un import devenu inutile dans `main.js` ; le
laisser là aurait fait perdre la raison en même temps que la ligne.

### Le barème était relu à chaque partie enregistrée
Trois tables décrivent comment une partie devient des points : pondérations par
rôle, paliers de niveau, maîtrise. Elles sont GLOBALES — la même réponse pour
tout le monde — et elles changent quand un administrateur y touche, c'est-à-dire
à peu près jamais.

Elles étaient relues à chaque enregistrement de partie, à chaque aperçu de
score, à chaque correction de résultat et à chaque ouverture des réglages :
**trois allers-retours vers la base à chaque fois**, sur les chemins les plus
chauds du produit — ceux qu'on emprunte pendant une soirée de jeu.

`src/lib/baremeConfig.ts` les met en cache une minute, exactement comme
`chargerRatios` le fait depuis août pour les ratios d'exercices. Mesuré sur
`/api/settings`, avant et après, en revenant au commit précédent pour avoir un
vrai point de comparaison : **105 → 122 requêtes par seconde**, et le p95 passe
de **498 à 369 ms**. Le gain réel est ailleurs — sur l'enregistrement d'une
partie, qu'on ne sait pas mettre en charge avec cet outil — mais il est de la
même nature et de la même taille.

Trois décisions, chacune avec sa raison :

- **un barème VIDE ne se met pas en cache.** Sur une base neuve, l'amorçage n'a
  pas encore eu lieu au premier appel : retenir ce vide une minute ferait
  échouer tout ce qui calcule un score, avec « Config manquante » sur une base
  semée quelques millisecondes plus tard. C'est mot pour mot un défaut déjà
  rencontré ici ;
- **le cache se vide APRÈS l'écriture**, pas avant. Sans ça, l'administrateur
  qui vient de changer un multiplicateur continue de voir l'ancien pendant une
  minute, sur l'écran même où il l'a modifié ;
- **l'écran d'administration lit sans le cache**, volontairement. Il sert à
  REGARDER la configuration avant de la changer ; y servir une valeur vieille
  d'une minute ferait douter de ce qu'on vient d'enregistrer. Le cache est pour
  les chemins chauds, pas pour celui-là.

Et un tri qu'il ne fallait pas supposer : les routes de partie trient les
paliers par seuil de gainage, les réglages par niveau. Les deux coïncident
aujourd'hui et rien ne l'écrit. Le tri reste donc explicite chez l'appelant.

**Les deux derniers lecteurs sont passés au cache dans la foulée** :
`/api/dashboard` et la page du tableau de bord, qui rend le premier écran au
serveur — donc dont les paliers sont sur le chemin critique de l'affichage.

Un effet de bord à connaître : un consommateur qui n'a besoin QUE des paliers
charge quand même le barème entier, trois tables en parallèle. En régime établi
c'est gratuit, le cache étant chaud ; au tout premier appel après un démarrage à
froid, c'est trois requêtes au lieu d'une. L'échange se fait dans le bon sens
sur un écran qu'on ouvre plusieurs fois par soirée, et les tests le disent
clairement : la doublure de base doit désormais porter les trois tables, pas
seulement celle dont la route se sert. Une doublure reflète ce que le code
APPELLE, pas ce dont il a besoin.

**Ce que le cache a cassé, et qui vaut d'être noté :** trois tests de route
sont tombés d'un coup. Un cache au niveau du module est un état PARTAGÉ entre
les cas d'un même fichier — une valeur retenue par un cas précédent survivait
au cas « configuration absente », qui passait alors sur les paliers d'un autre
test. Il se réinitialise comme les doublures, et les trois fichiers appellent
maintenant `oublierBareme()` dans leur `beforeEach`. Introduire un cache, c'est
introduire de l'état ; les tests le voient avant la production.

Trois sabotages, trois échecs. Et un piège d'écriture : `jest.resetModules()`
recrée aussi la doublure de base, donc les compteurs qu'on interroge ne sont
plus ceux que le module sous test appelle. Les doublures vivent hors de la
fabrique, avec un nom qui commence par `mock` — le seul que jest laisse
traverser le hissage.

### Trente-sept kilo-octets partaient au navigateur pour du texte fixe
Le tableau de bord transférait 537 ko, dont 375 de JavaScript, là où l'accueil
en fait 210. Les graphiques étaient déjà chargés à la demande depuis V169 ; le
reste s'est trouvé en deux temps.

**D'abord le formulaire d'ajout**, huit cent soixante-dix lignes qui ne
s'affichent que dans une fenêtre ouverte à la demande, et qui traînent avec
elles la saisie de champion, la liste des parties Riot et deux dictionnaires.
Chargé à la demande comme les graphiques : **13 ko**.

**Ensuite le vrai gisement, trouvé en le mesurant.** Une expérience — retirer
quatre des six langues de tous les dictionnaires, construire, peser les
fragments — donne **140 ko compressés, 21 % de tout le JavaScript du site**.
Le chantier « une langue par paquet » vaut donc la peine, mais il suppose que
chaque composant reçoive son texte au lieu d'importer son dictionnaire : c'est
une refonte, pas une retouche, et elle n'a pas été faite de nuit.

**Ce qui a été fait, c'est le sous-ensemble à risque nul.** Un recensement des
composants marqués `"use client"` dont le SEUL besoin est `useT` — aucun état,
aucun gestionnaire, aucune lecture du navigateur — en rend cinq : CGU,
confidentialité, connexion, téléchargement, en-tête d'administration. Rendus au
serveur avec `textes(dict, locale)`, leurs dictionnaires ne partent plus du
tout. Le paquet passe de **655 à 618 ko compressés**, soit **37 ko, 5,6 %**.

Ce n'était possible qu'une fois la langue dans l'adresse : le composant a
besoin de connaître sa langue au serveur, et jusqu'à V301 elle vivait dans le
stockage du navigateur. C'est le bénéfice différé de ce chantier-là, et il ne
s'est pas encaissé tout seul — il a fallu venir le chercher trois semaines plus
tard.

`src/clientInutile.test.ts` refuse qu'un composant redevienne client pour le
seul `useT`. Deux sabotages, deux échecs — dont le motif vidé, parce qu'un
recensement qui ne trouve rien passe au vert.

**Puis la page d'accueil, qui était le plus gros morceau.** Six cents lignes et
un dictionnaire de mille cinq cents, cliente en entier pour deux raisons
seulement : un observateur de défilement, et un compteur animé. Or ni l'un ni
l'autre n'a besoin des textes — l'observateur parcourt le DOM déjà rendu et pose
une classe, le compteur recevait déjà les siens en propriétés.

Les deux sont sortis (`RevelationAuDefilement`, `accueil/DebtFeed`), la page est
redevenue du HTML rendu au serveur, et le paquet passe de **618 à 591 ko** :
**27 ko de plus**. Depuis le début : **655 → 591, soit 64 ko, près de 10 %.**

Vérifié que rien n'a bougé : les dix-neuf sections révélables sont dans le HTML
servi, dans les six langues, et `/de` mesure 628 ms sur poste contre 604 avant,
1380 ms sur téléphone bridé contre 1404 — du bruit dans les deux sens. Le plus
grand élément change sur poste, ce qui est attendu : davantage de contenu arrive
avec le document, donc le candidat n'est plus le même.

**Ce que ça n'améliore pas** : le temps d'affichage ne bouge pas, 264 ms sur
poste comme avant. Ces pages étaient déjà rapides ; ce qui change est ce qu'on
fait télécharger, et sur un forfait mobile ça se compte autrement qu'en
millisecondes.

### Le mode session avait cinq cents lignes et aucun test
`SessionContext.tsx` porte le mode session : la boucle de sondage, la dette qui
s'accumule pendant une soirée, le chrono des exercices au temps. C'est un
composant, donc ce qui s'y éprouve n'est pas le rendu mais les DÉCISIONS — et
elles étaient écrites au milieu des effets, où rien ne pouvait les atteindre.

Trois règles sont sorties dans `src/lib/chronoSession.ts`, choisies sur ce que
leur erreur coûte :

- **reprendre un chrono après un rechargement.** Une reprise ratée fait
  disparaître deux heures de Minecraft sur un F5 malheureux ; une reprise
  abusive fait payer la soirée d'avant-hier. Quatorze cas l'éprouvent, dont
  cinq formes de sauvegarde illisible — le stockage du navigateur n'est pas un
  format, n'importe qui peut y écrire et une version antérieure y a peut-être
  écrit autre chose ;
- **ce que le temps coûte**, au prorata de l'heure et arrondi à l'entier :
  « 12,4 pompes » n'existe pas ;
- **ce qui reste à faire**, borné à zéro — avoir fait plus que ce qu'on devait
  est un cas légitime, pas une erreur.

Deux protections ajoutées au passage, et il faut dire ce qu'elles sont : des
durcissements, pas des défauts qui auraient mordu. Un chrono dont la date de
début est dans le FUTUR — une horloge changée entre deux ouvertures — donnait
une durée négative ; elle était rattrapée plus loin par un plancher à zéro, donc
l'effet restait borné. Et une sauvegarde sans nom de jeu était reprise avec un
jeu `undefined`. Les deux sont refusées maintenant, à la source.

Quatre sabotages, quatre échecs. Et la règle du projet, une fois de plus : le
module ne vaut que s'il est LU — `SessionContext` l'emploie, sinon j'aurais
écrit quatorze tests sur du code que personne n'exécute.

### La mesure de charge ne voyait pas le regroupement, et c'est elle qui avait tort
Refaite après les deux regroupements, sur le tableau de bord avec session :
**71 requêtes par seconde**, rupture à 200 simultanés. Puis refaite sur V309,
c'est-à-dire AVANT tout regroupement, en revenant à ce commit et en
reconstruisant : **75 requêtes par seconde**, même rupture, mêmes latences.

Rien n'avait bougé. La tentation, à ce moment-là, est de conclure que le
chantier ne servait à rien.

**C'est la mesure qui regarde ailleurs.** `charge.mjs` demande une ADRESSE en
boucle : sur une page, il reçoit le document et s'arrête là. Les appels d'API
que le navigateur fait ensuite ne partent jamais. Le script mesure donc
exactement la partie que le regroupement ne touche pas.

Mesuré comme il fallait — chaque route séparément, à quarante simultanés :

| route | débit |
|---|---|
| `/api/user` | 148 req/s |
| `/api/dette` | 153 req/s |
| `/api/consentement` | 163 req/s |
| **`/api/contexte`** | **127 req/s** |
| `/api/badges` | 160 req/s |
| `/api/serie` | 169 req/s |
| **`/api/progression`** | **147 req/s** |

Une page a besoin d'UN appel de chacune : les coûts s'additionnent. Trois
routes à 148, 153 et 163 coûtent ensemble 19,5 ms de serveur, soit **51 pages
par seconde**. La route fusionnée en coûte 7,9, soit **127**. Les deux
regroupements ensemble font passer la capacité de **32 à 68 pages par
seconde** : **elle double.**

Deux choses valent d'être retenues :

- **un débit par route ne se lit pas seul.** `/api/contexte` est la route la
  plus LENTE du tableau, et c'est la bonne nouvelle : elle fait à elle seule le
  travail de trois. Comparer les lignes entre elles n'a aucun sens ; ce qui
  compte est ce qu'une page consomme ;
- **c'est un modèle de capacité, pas un débit de page observé.** Il suppose que
  les appels ne se recouvrent pas. La note est écrite en tête de `charge.mjs`,
  pour que le prochain qui l'ouvre ne conclue pas d'un chiffre stable que rien
  n'a changé.

Et une friction d'outillage, rencontrée trois fois cette nuit : le compte de
mesure porte une adresse `@example.test`, et la préparation de la suite
navigateur purge ces comptes-là. Toute mesure lancée après une suite tombe donc
sur une session morte. Le garde d'atterrissage l'a dit les trois fois — c'est
son travail — mais l'ordre est à retenir : **la suite d'abord, le compte
ensuite, la mesure enfin.**

### Les paliers et la série lisaient deux fois la même requête
Suite du regroupement. Après `/api/contexte`, le tableau de bord faisait encore
cinq appels, dont `/api/badges` et `/api/serie` — et les deux exécutaient
**exactement la même requête** : les huit cents derniers jours payés du compte,
triés du plus récent au plus ancien. Deux allers-retours pour deux réponses qui
se déduisent des mêmes lignes.

Pire : les deux composants qui les portent écoutent tous deux
`wow-dette-changee`. Après chaque paiement, deux lectures identiques
repartaient. Sur une soirée où l'on paie sa dette, quatre lectures pour rien.

`/api/progression` les rend d'un coup, et la mise en forme vit dans
`src/lib/progression.ts`, lue par la route fusionnée comme par les deux
d'origine. Un test vérifie que les deux réponses sont identiques champ par
champ, et un autre que les paiements ne sont lus **qu'une fois** — c'est la
raison d'être de la route, et sans ce contrôle on n'aurait mesuré que le
nombre d'appels HTTP, pas le nombre de requêtes.

| écran | au départ | après `/api/contexte` | après `/api/progression` |
|---|---|---|---|
| tableau de bord, premier chargement | 9 | 6 | **5** |
| tableau de bord, navigation suivante | 8 | 5 | **4** |
| historique | 6 | 3 | 3 |
| réglages | 7 | 3 | 3 |

Comme pour le contexte, ce n'est pas la route fusionnée qui économise l'appel :
c'est le fait qu'un seul appelant le fasse. `chargerProgression` porte la
mémoire de module, et les deux composants la partagent.

Quatre sabotages, quatre échecs — dont la mise en forme refaite dans la route
fusionnée, et le filtre par compte retiré de la lecture des paiements, attrapé
par le garde structurel autant que par le test de la route.

### La 404 localisée ne l'était que pour ceux qui exécutent le JavaScript
Suite immédiate du chantier précédent, et correction d'un défaut que j'avais
publié en croyant l'avoir réglé. `/de/nimportequoi` répondait bien 404 — mais
le HTML SERVI était la 404 intégrée de Next : `<html>` sans langue, « 404: This
page could not be found. » en anglais, pour les six langues.

**Le test passait, et c'est ce qui est instructif.** Il lisait le DOM vivant :
après hydratation, React rendait bien notre page et posait `lang`. Un moteur de
recherche, lui, ne va jamais jusque-là — et c'est précisément pour un moteur
qu'on a fait ce chantier. Le piège est écrit dans ce journal depuis le premier
écran du tableau de bord, mot pour mot : **sur ce qui doit exister DANS la
réponse, on lit la réponse.** Les tests d'`introuvable.spec.ts` lisent
maintenant `response.text()`.

**La cause tient à une conséquence du passage de la langue dans l'adresse.**
`app/layout.tsx` a disparu au profit de deux mises en page racines, une par
coquille. Or sans mise en page racine, Next ne consulte AUCUNE frontière
`not-found` posée sous `[locale]` : il remonte à la racine, où il n'y avait
rien, et sert la sienne. Trois tentatives avant de le comprendre — une
frontière sous `[locale]`, une dans le segment attrape-tout, la même rendue
sans `useLocale` — toutes ignorées.

`src/app/not-found.tsx` porte donc son propre `<html>`, comme le veut une 404
racine sans mise en page racine. Elle n'a plus de paramètre de route à lire :
la langue lui arrive par un en-tête que le middleware pose sur chaque requête
de page, `x-wow-langue`. Deux sabotages, deux échecs : sans l'en-tête posé, ou
sans sa lecture, la langue disparaît de la réponse.

**Et l'ordre des questions du middleware a changé.** « L'adresse existe-t-elle »
passe maintenant AVANT « est-elle publique », parce qu'une page publique couvre
ses enfants : `/calculateur` couvre `/calculateur/<jeu>`, donc un jeu inventé
sortait par la porte publique avant qu'on ait pu constater qu'il n'existe pas.
L'inversion ne relâche rien — une adresse qui n'existe pas n'a pas de contenu à
protéger — et le contrôle de session reste dernier, ce qu'un test fixe.
`PAGES_CONNUES` développe le catalogue des jeux en clair, depuis `tousLesSlugs`
plutôt qu'une seconde liste.

**Ce qui résiste, et qui est assumé.** Un jeu de calculateur inventé rend 404
avec la page anglaise de Next. Le refus vient du ROUTEUR — le catalogue est
fermé — et un refus du routeur ne passe pas par la 404 racine. Trois
contournements essayés et mesurés : ouvrir le catalogue pour que la page appelle
`notFound()` (même résultat, `notFound()` levé depuis une page ne consulte pas
davantage la racine), poser la frontière ailleurs (jamais consultée), réécrire
l'adresse dans le middleware (casse en plus les cas qui marchaient). Le code de
réponse, lui, est juste, et c'est lui qui fait sortir une adresse d'un index. Le
test fixe l'état réel plutôt que de laisser croire que le cas est traité.

Ce que ça apprend, au-delà du cas : **publier une correction et vérifier une
correction sont deux gestes différents.** Celle-ci a été publiée dans V308,
vérifiée dans la foulée par un test vert, et elle ne faisait que la moitié de ce
qu'elle annonçait. Ce sont les sondes sur la PRODUCTION, faites par acquit de
conscience après la publication, qui l'ont montré.

### Campagne de clôture du 2 septembre
Passée après six chantiers de la nuit, sur un compte neuf ouvert par
`scripts/compte-mesure.mjs`. En allemand : c'est la langue où les mots sont les
plus longs, donc celle qui déborde en premier.

**Accessibilité : 0 constat sur 90 passes** — quinze pages, six langues,
**aucune page laissée de côté**.

| écran | LCP poste | LCP téléphone bridé | plus grand élément |
|---|---|---|---|
| `/de` | 604 ms | 1404 ms | l'image de l'application |
| `/de/beta` | 492 ms | 1676 ms | le titre |
| `/de/history` | 120 ms | 1296 ms | la mention Riot, en pied |
| `/de/confidentialite` | 480 ms | 1144 ms | le titre |
| `/de/dashboard` | 280 ms | 1136 ms | le rappel du test de force |
| `/de/calculateur/league-of-legends` | 528 ms | 1128 ms | le titre |
| `/de/telechargement` | 476 ms | 1128 ms | le paragraphe SmartScreen |
| `/de/cgu` | 496 ms | 1124 ms | le premier paragraphe |
| `/de/calculateur` | 480 ms | 1124 ms | le titre |
| `/de/settings` | 136 ms | 928 ms | la mention Riot, en pied |
| `/de/bilan` | 128 ms | 920 ms | la mention Riot, en pied |

Aucune page au-dessus du seuil de 2500 ms, CLS négligeable partout. Le tableau
de bord, longtemps le seul écran au-dessus, tient à 1136 ms depuis que son
premier écran est rendu au serveur.

**Deux gardes ont mordu pendant cette campagne, et c'est le plus intéressant.**

- L'audit d'accessibilité a d'abord rendu « 0 constat, 15 pages NON MESURÉES »
  six fois de suite. Ce n'était pas le produit : `accessibilite.mjs` prenait
  alors la langue en argument NU quand les trois autres la prenaient en option,
  et mon `--langue=de` était devenu un chemin. Sans le décompte séparé des pages
  non mesurées — posé le 23 août précisément pour ça — j'aurais publié « zéro
  constat sur six langues » en n'ayant rien regardé du tout. *(La divergence est
  fermée depuis le 4 septembre : les quatre outils prennent le même drapeau, et
  `src/scriptsMesure.test.ts` refuse qu'elle revienne.)*
- Le contrôle d'atterrissage de `performance.mjs` a refusé de chronométrer
  `/fr/dashboard` en annonçant qu'il avait abouti sur `/fr/login`. Le compte de
  mesure venait d'être effacé par la préparation de la suite navigateur, qui
  purge les comptes `@example.test` — et le compte de mesure en est un. C'est
  la troisième fois que ce garde évite un rapport flatteur sur la page de
  connexion.

Les deux fois, l'outil a dit « je n'ai pas mesuré » au lieu de dire « tout va
bien ». C'est toute la différence entre un audit et un satisfecit.

### Neuf appels d'API pour ouvrir le tableau de bord, six désormais
Le chiffre était écrit dans le journal depuis la mesure de charge, sans avoir
jamais été attaqué. Compté à nouveau sur le serveur local, navigateur en main,
et l'essentiel n'était pas le total : **la dette partait DEUX fois par page.**
Le compteur du rail et le compteur du titre de l'onglet la demandaient chacun
de son côté, sans savoir que l'autre existait — et tous deux écoutaient
`wow-dette-changee`, donc deux fois encore après chaque paiement.

En production, chaque requête SQL est un appel HTTPS indépendant vers Neon : le
client passe par `PrismaNeonHttp`, pas par un pool TCP. Trois lectures du même
enregistrement coûtent trois allers-retours, pas trois fois rien.

`/api/contexte` rend d'un coup ce que `/api/user`, `/api/dette` et
`/api/consentement` rendaient en trois fois — les trois commençaient de toute
façon par lire la même session et le même compte. Les trois routes restent :
elles portent les écritures, et les tests comme l'application de bureau les
appellent. Ce qui ne se dédouble pas, c'est la MISE EN FORME, sortie dans
`src/lib/contexteConnecte.ts` et lue par les deux chemins. Un test compare les
deux réponses champ par champ : sans lui, on n'aurait pas économisé deux
allers-retours, on aurait créé une quatrième vérité.

**Ce test ne peut pas tout voir, et c'est voulu.** Saboté en changeant le
constructeur commun, il reste vert — les deux chemins le lisent, donc les deux
changent ensemble, ce qui est exactement la propriété qu'on veut. Ce qu'il
attrape, c'est la DIVERGENCE : refaire la mise en forme dans la route fusionnée
le fait tomber aussitôt. Le contenu de la réponse, lui, est gardé par les tests
de la route d'origine. Il fallait le sabotage pour s'en apercevoir : j'aurais
sinon écrit que ce test garde le contenu, ce qui est faux.

| écran | avant | après |
|---|---|---|
| tableau de bord, premier chargement | 9 | 6 |
| tableau de bord, navigation suivante | 8 | 5 |
| historique | 6 | 3 |
| réglages | 7 | 3 |

**Deux mémoires valaient mieux qu'une, et c'était le piège.** `useIdCompte`
mémorisait déjà `/api/user` au niveau du module — une correction antérieure du
même problème. Poser le fournisseur de contexte à côté aurait fait DEUX appels
là où il en fallait un : le fournisseur et la mémoire, chacun demandant sa
version. La mémoire vit maintenant dans `chargerContexte`, un cran plus haut,
et les deux la partagent. C'est le genre de régression qu'on n'aurait pas vue
sans recompter après coup.

**Ce que ça n'améliore pas, et il faut le dire.** Le temps d'affichage ne bouge
pas : le premier écran du tableau de bord est rendu au serveur depuis V236, et
son LCP est de 272 ms sur poste. Ces appels partent APRÈS le rendu, ils ne
retardent rien de ce qu'on regarde. Le gain est en requêtes et en lectures de
base — c'est-à-dire en coût et en marge sous la charge, pas en vitesse
ressentie. Se raconter le contraire serait exactement l'erreur déjà commise ici
avec l'écriture de contexte : « une requête de moins, pas une page plus
rapide ».

**Une piste écartée en la mesurant.** Le premier relevé montrait un
`PUT /api/settings` à chaque page, alors que le journal affirme cette écriture
corrigée depuis août. C'était un artefact de ma mesure : j'ouvrais un onglet
par page, donc un `sessionStorage` neuf à chaque fois, et c'est lui qui porte
le garde. Refait dans un seul onglet, l'écriture ne part qu'une fois par
ouverture de l'application. Le journal disait vrai ; j'ai failli publier le
contraire.

Et un outil de plus, qui aurait dû exister depuis longtemps :
`scripts/compte-mesure.mjs` ouvre un compte neuf et dépose son jeton et son
identifiant. Deux campagnes ont déjà été faussées faute de l'avoir fait à la
main — un cookie périmé fait mesurer la page de connexion, un identifiant
absent fait mesurer la modale d'accueil. Les deux pièges étaient écrits ; il
manquait la commande qui les évite.

### Quatre refus qu'aucun test navigateur ne poussait dans le mur
`e2e/panne-serveur.spec.ts` couvre l'ajout d'une partie, l'ajout depuis la
liste Riot, le consentement, les réglages de jeu, le paiement de dette et
l'historique. Restaient quatre routes d'écriture atteintes depuis un écran et
jamais mises en échec : suppression de compte, signalement, mise de côté d'un
exercice, régénération du jeton de diffusion.

Les quatre traitaient DÉJÀ leur échec correctement — ce sont des tests de non
régression sur du code juste, ce qui est le bon moment pour les écrire. Chacun
vérifie deux choses et jamais une seule : que l'échec se DIT, et que rien n'a
bougé. Sans le second contrôle, un écran qui annonce l'échec tout en gardant la
nouvelle valeur chez lui passerait.

Celui qui compte le plus est le jeton de diffusion. Le régénérer est la SEULE
façon de révoquer une adresse déjà collée dans un logiciel de streaming : un
échec silencieux ferait croire que le lien d'avant ne vaut plus rien, alors
qu'il ouvre toujours la dette en direct. Une révocation imaginaire est pire
que pas de bouton du tout.

**Et l'écriture des tests a trouvé deux vrais défauts.** Les messages d'échec
du signalement et de la mise de côté n'étaient annoncés à personne : un simple
paragraphe, sans `role`. Ils paraissent à l'écran et n'existent pas pour un
lecteur d'écran — sous un bouton redevenu cliquable, ce qui est exactement
l'expérience du refus silencieux qu'on croyait avoir corrigée. La suppression
de compte, elle, portait `role="status"`, qui est poli : un échec sur l'action
la plus irréversible du produit se dit tout de suite, il n'attend pas.

**Trois pièges, tous déjà écrits ici, tous retombés dedans dans la même
heure :**

- **`getByRole("alert")` ne prouve rien tout seul.** Next pose son annonceur de
  route avec ce rôle, vide, sur chaque page. TROIS de ces quatre tests sont
  passés au vert en le lisant — c'est-à-dire en ne mesurant rien. Le message se
  cherche par son TEXTE, dans un élément qui l'annonce.
- **Une boucle d'attente qui lit un fichier périmé.** Le fichier de sortie
  était effacé par le travail de fond, pas avant lui : ma boucle a vu la ligne
  de fin de l'exécution PRÉCÉDENTE et rendu ses résultats. Deux minutes passées
  à relire des chiffres qui n'avaient rien à voir.
- **Un sabotage qui ne compile pas.** Retirer la chute dans le 404 rendait
  `estPageConnue` inutilisée : la construction échouait avant le test, ce qui
  n'est pas un test qui mord. Réécrit en `if (false && …)`.

Et un défaut de test qui ressemblait à une panne : `PSEUDO_MAX` vaut 24, et un
préfixe de compte trop long faisait refuser l'inscription. L'échec se
présentait comme un délai de trente secondes sur la navigation, ce qui ne
ressemble en rien à « ce pseudo fait deux caractères de trop ».

### Deux vulnérabilités hautes qu'on garde, et pourquoi
`npm audit` en signale deux là où le 23 août n'en trouvait aucune. Les deux
sont la même : `mysql2 < 3.22.0`, « Auth Plugin Downgrade to
mysql_clear_password Leaks Plaintext Credentials ». Elle décrit un CLIENT MySQL
qu'un serveur MySQL malveillant convainc de repasser au mot de passe en clair.

**Elle est inatteignable ici.** Ce projet parle à PostgreSQL ; `mysql2` n'arrive
que comme dépendance de la ligne de commande `prisma`, qui embarque un pilote
par base gérée, et aucune ligne du dépôt ne l'appelle. Il faudrait ouvrir une
connexion MySQL pour l'atteindre, et il n'y en a pas.

**Et elle ne se corrige pas.** `prisma@7.10.0`, la dernière de la branche,
épingle toujours `mysql2@3.15.3`. Le seul « correctif » que propose npm est de
REVENIR à `prisma@6.19.3` : un retour de version majeure, sur le client d'accès
aux données, pour une faille qu'on ne peut pas atteindre. Le remède serait plus
dangereux que le mal.

`src/dependanceMysql.test.ts` garde le raisonnement plutôt que la conclusion. Il
tient à deux conditions — la base est PostgreSQL, aucun code ne charge un pilote
MySQL — et le jour où l'une tombe, l'exemption tombe avec elle. C'est la
différence entre une dispense écrite et une dispense vérifiée : la première
vieillit en silence, ce qui est exactement ce qui vient d'arriver à la liste
d'avant lancement.

Mises à jour appliquées, toutes mineures ou correctives : `prisma` et ses trois
adaptateurs 7.9.1 → 7.10.0, `next` et `eslint-config-next` 16.3.2 → 16.3.4,
`jest` 30.4.2 → 30.5.1, `lucide-react` 1.34 → 1.39, `resend` 6.22 → 6.25, et
`electron` 43.4.1 → 43.5.1 côté application de bureau. Types, 1403 tests
unitaires, construction et **179 parcours navigateur** repassés après : tout
vert.

Les majeures écartées le 23 août le restent — `typescript` 7, `eslint` 10,
`@types/node` 26 — et `prisma` 8 les rejoint, puisqu'elle n'existe qu'en
version candidate. `next-auth` continue de s'afficher « en retard » sur
4.24.15 : c'est l'ancienne branche stable, le projet est sur la 5 en
préversion. Cette ligne revient à chaque audit ; elle est fausse à chaque
fois.

### Vingt-quatre modules n'avaient aucun test, quatre en ont maintenant
Le recensement résout les imports des tests jusqu'aux fichiers, comme
`codeMort.test.ts` : chercher un nom de fichier dans le texte des tests donne
des faux positifs. Sur 136 modules de `src/lib` et `desktop/src`, 67 n'étaient
importés par aucun test — dont 43 dictionnaires de langue, couverts
collectivement par `dictionaries.test.ts` qui parcourt le dossier au lieu de
les importer. Restaient vingt-quatre vrais.

Tous ne se valent pas, et couvrir pour couvrir n'apprend rien : `graphiques.ts`
n'est qu'une table de couleurs, l'éprouver reviendrait à recopier ses valeurs
dans un test. Quatre ont été retenus sur un seul critère — qu'un défaut s'y
paie :

- **`riot-role.ts`** décide du rôle, donc du barème, donc de la dette. Un
  support compté comme jungler paie ses morts trois points au lieu de deux et
  deux dixièmes. Le module porte un repli — une position inconnue devient
  « Mid » — qui a exactement la forme du défaut déjà corrigé côté détection
  locale. Il est **figé par un test plutôt que changé** : refuser ferait perdre
  une partie entière importée de Riot pour un détail de pondération, alors que
  ce qu'on refusait de l'autre côté était une ISSUE inventée, qui crée une
  dette qu'on ne doit pas. Les deux ne se valent pas, et l'arbitrage figure
  dans les questions.
- **`recuperation.ts`**, la seule porte de secours du produit : le jeton ne se
  stocke jamais en clair, un lien vaut une heure, le préfixe ne se mêle pas aux
  jetons d'Auth.js.
- **`premiereVisite.ts`**, dont un défaut prive un compte neuf de tout accueil
  sur un poste déjà utilisé — c'est-à-dire au moment où il en a le plus besoin.
- **`textes.ts`**, qui porte la règle « ce qui n'est pas traduit retombe sur
  l'ANGLAIS ». Le repli français est le réflexe de celui qui écrit
  l'application, et il ne le voit jamais.

Cinq sabotages, cinq échecs. Et un piège d'écriture : `oublierPremiereVisite`
commence par un garde de rendu serveur, or les tests tournent sans `window` —
les trois premières épreuves passaient donc sur zéro appel, c'est-à-dire sur
rien. Le garde est posé exprès maintenant, et son absence a son propre test.

### Une adresse qui n'existe pas était traitée comme une adresse protégée
`/fr/nimportequoi` répondait **307 vers `/fr/login`**. Vérifié en production
avant d'y toucher, ainsi que `/xx/cgu`, qui faisait 308 vers `/en/xx/cgu` puis
307 vers la connexion.

Ce n'est pas un défaut du contrôle d'accès, qui est juste : tout ce qui n'est
pas public exige une session. C'est son effet de bord, que personne n'avait
regardé — le middleware ne sait pas distinguer « protégé » de « inexistant »,
alors il traite les deux pareil. Trois conséquences :

- une faute de frappe ou un lien mort mènent à un écran de connexion, qui ne
  dit rien de ce qui s'est passé ;
- **la page 404 localisée, écrite exprès et traduite en six langues, était
  inatteignable** pour qui n'a pas de session. Elle existait depuis le passage
  de la langue dans l'adresse et n'avait jamais pu s'afficher ;
- un moteur qui suit un lien mort reçoit 307 puis 200 sur la connexion, jamais
  404. Une adresse supprimée ne sort donc **jamais** de l'index — et c'est
  précisément la famille de défaut déjà rencontrée avec `/waitlist` :
  « interdire l'exploration n'empêche pas l'indexation ».

`src/lib/pagesConnues.ts` porte la liste des pages qui existent. Hors liste,
l'adresse n'est pas protégée : elle n'existe pas, et Next rend son 404 dans la
langue de l'adresse.

**Le sens de l'erreur a décidé de la forme.** On aurait pu lister les pages
PRIVÉES et laisser passer le reste — c'est plus court, et c'est un piège :
une page privée ajoutée sans être inscrite deviendrait publique. Ici, une page
oubliée répond 404 au lieu d'emmener à la connexion : visible, et sans fuite.
`src/pagesConnues.test.ts` compare de toute façon la liste au dossier.

**Le garde qui compte n'est pas celui-là**, c'est la condition
`!echappeAuPrefixe(pathname)` qui borne la chute aux PAGES. Sans elle, toute
adresse d'API — aucune ne figure dans une liste de pages — traverserait le
contrôle de session, et le reste du fichier ne vaudrait plus rien. Un test la
tient, ainsi que l'ORDRE des trois branches : public, puis inexistant, puis
session. Inverser les deux dernières rendrait toute page connue publique.

### Quatre fenêtres s'annonçaient modales sans rien retenir au clavier
`src/modalesAnnoncees.test.ts` a été écrit en août pour refuser un recouvrement
plein écran qui ne se déclare pas. Il a fait son travail : les cinq fenêtres
portent `role="dialog"` et `aria-modal`. Il ne dit rien de ce qui vient APRÈS
l'annonce — et `aria-modal="true"` est une promesse, celle que le reste de la
page n'existe plus tant que la fenêtre est ouverte.

Quatre ne la tenaient pas : accueil, décompte de dette, suppression de compte,
visite guidée. À la souris ça ne se voit pas — le fond est opaque, le clic
dessus ferme. Au clavier, la tabulation continuait dans la page derrière, sur
des commandes qu'on ne voit pas, sans rien qui dise qu'on en est sorti. La
modale d'accueil est la toute première chose qu'un compte neuf rencontre.

Le comportement existait pourtant, complet et juste, dans `Modale.tsx` : entrer,
tourner, revenir, geler le défilement. Il y était écrit **une fois et pour elle
seule**. C'est le septième cas de règle qui ne vaut que pour un de ses lieux
d'emploi. Il vit maintenant dans `src/lib/usePiegeFocus.ts`, et `Modale`
l'emploie comme les autres.

**Une fenêtre n'est pas l'autre, et la distinction est le cœur du sujet.**
`InvitationInstallation` porte `role="dialog"` SANS `aria-modal` : c'est une
bannière en bas d'écran qui ne recouvre rien. Y piéger le focus empêcherait
d'atteindre la page qu'on est en train de lire — ce serait un défaut, pas une
correction. Le recensement porte donc sur `aria-modal`, jamais sur
`role="dialog"`, et un test fixe ce choix pour qu'on ne le « corrige » pas.

**Deux façons d'appeler le hook, et il faut les deux.** Un composant qui ne se
monte que lorsque la fenêtre s'ouvre n'a rien à dire : le montage est le signal.
Un composant qui reste monté et rend sa fenêtre sous condition doit passer
`actif`. J'avais prévu l'option et oublié de la passer à `OnboardingModal`, qui
est dans le second cas : le piège se posait au chargement de la page, sur une
fenêtre qui n'existait pas encore, et ne se reposait jamais. **Le test au
navigateur l'a dit ; la relecture ne l'avait pas vu.**

**Le défaut le plus intéressant, trouvé en instrumentant.** La restitution du
focus échouait sur la suppression de compte, et le code avait l'air juste :
`const rendreA = document.activeElement` à l'ouverture, `rendreA.focus()` à la
fermeture. Ce qui était faux, c'est l'INSTANT. Le champ « tapez SUPPRIMER »
porte `autoFocus`, donc React le focalise pendant la validation du rendu,
c'est-à-dire **avant** que l'effet ne s'exécute. On capturait ce champ comme
« l'endroit d'où l'on vient » — et comme il disparaît avec la fenêtre, lui
rendre le focus ne rendait rien : on repartait du haut du document.

Un écouteur `focusin` retient donc en continu le dernier élément focalisé hors
de toute fenêtre, et la capture s'y rabat quand l'élément courant est déjà
dedans. Le rendu vérifie en plus `isConnected` : un nœud démonté ne reprend pas
le focus, il renvoie sur `body`.

Ça n'a pas été trouvé en relisant, et ça ne pouvait pas l'être : trois
diagnostics au navigateur ont été nécessaires, dont un qui a demandé
d'instrumenter le hook lui-même pour voir ce qu'il capturait vraiment. La leçon
déjà écrite pour les scripts de mesure vaut ici : **un chiffre — ou un nom —
qu'on ne relève pas ne se diagnostique pas.**

**Et un texte en dur, trouvé en passant.** `aria-label="Fermer"` dans
`Modale.tsx`, en français dans les six langues. Le garde des textes en dur ne
l'attrape pas : il cherche des chaînes dans le JSX rendu, et celle-ci vivait
dans un attribut — c'est-à-dire à l'endroit précis où le texte ne se voit pas
et ne s'entend que pour ceux qui n'ont que lui.

Sept sabotages, sept échecs. Le premier est passé au vert et c'est celui qui a
appris quelque chose : mon garde cherchait `usePiegeFocus` n'importe où dans le
fichier, donc **la ligne d'import suffisait**. Retirer l'appel laissait le test
vert. Un garde qui reconnaît un import reconnaît une intention, pas un
comportement — et c'est le comportement qui manquait aux quatre fenêtres. Il
exige un appel maintenant.

**Un défaut de rendu trouvé chemin faisant, sans rapport avec le clavier.**
`ModaleChrono`, dans `CompteurDette`, était une fonction redéfinie à chaque
rendu, donc un type de composant différent à chaque fois : React démontait et
remontait la fenêtre ENTIÈRE une fois par seconde, puisque le décompte fait
rendre le parent à chaque tic. Aucun piège de focus n'y aurait survécu. Elle
est appelée comme une fonction maintenant, ce qui la fait entrer dans l'arbre
du parent au lieu d'en créer un nouveau.

**Trois pièges d'outillage, tous déjà écrits ici, tous retombés dedans.**
Le serveur qui sert un `.next` d'avant la modification — deux fois. La rubrique
des réglages qui ne s'ouvre pas par son paramètre d'adresse. Et un nouveau,
qui mérite sa ligne : **la visite guidée navigue d'une page à l'autre au fil de
ses douze étapes**, donc la traverser depuis les réglages laissait le test sur
le tableau de bord, où le bouton cherché n'existe pas. L'échec ne ressemblait
pas à sa cause — un délai dépassé sur une page parfaitement normale. Les
fenêtres d'accueil se traversent avant d'aller où l'on va.

Enfin, un sabotage qui ne compilait pas : retirer le repli rendait
`dernierHorsFenetre` inutilisée, et `noUnusedLocals` faisait échouer la
construction avant le test. Un échec de compilation n'est pas un test qui mord ;
le sabotage a été réécrit pour compiler.

### Le plan du site n'avait pas de x-default, et une page publique n'était nulle part
Deux trous ouverts par le passage de la langue dans l'adresse, tous deux
invisibles à l'écran, tous deux sur le seul canal d'acquisition qui travaille
sans qu'on s'en occupe.

**Aucune des 126 entrées du plan ne portait `x-default`.** Les six langues
étaient bien déclarées, et elles sont bien ce qu'il faut pour un lecteur
français, anglais, espagnol, allemand, chinois ou japonais. `x-default` répond
à l'autre question, celle que personne ne se pose en écrivant : que servir à
quelqu'un dont la langue n'est dans aucune des six. Sans lui, le moteur choisit
seul, et il choisit la version la plus anciennement connue — la française, y
compris pour une recherche faite en portugais ou en russe. Il pointe vers
l'adresse SANS préfixe, qui est exactement ce qu'attend `x-default` : pas une
septième traduction, mais celle qui négocie. Vérifié sur le serveur, les sept
chemins du plan : `/cgu` avec un en-tête allemand rend bien 308 vers
`/de/cgu`. Une adresse d'alternative qui ne mène nulle part serait pire que
son absence.

**Et la table était écrite en trois exemplaires** — métadonnées d'une page
publique, métadonnées d'une page par jeu, plan du site — donc les trois
avaient le même trou. C'est le sixième cas de règle dupliquée trouvé sur ce
projet, et il prend toujours la même forme : ce n'est pas la duplication qu'on
remarque, c'est qu'une correction n'en répare qu'un tiers.
`languesAlternatives` vit dans `cheminLocalise.ts`, avec les autres règles
d'adresse.

**`/connexion-app` était publique, explorable, hors du plan, et sans refus
d'indexation.** C'est-à-dire dans le seul état qui n'est pas une décision :
elle s'indexe depuis n'importe quel lien et paraît alors sans titre ni
description. C'est mot pour mot la leçon écrite dans `robots.ts` au départ de
`/waitlist` — « interdire l'exploration n'empêche pas l'indexation » — et elle
n'avait jamais été appliquée à cette page-là. Les deux autres du même genre,
connexion et récupération, portaient déjà leur `noindex`.

`src/planDuSite.test.ts` regarde le DOSSIER des pages plutôt qu'une liste. Trois
états sont permis, et un seul manquait : être dans le plan, refuser
l'indexation, ou être derrière la porte. Le refus se cherche aussi chez les
ancêtres — `/recuperation/valider` ne le porte pas, elle l'hérite de la mise en
page au-dessus, et ne regarder que le fichier de la page rendrait le test faux
sur le cas le plus légitime.

Quatre sabotages, quatre échecs : `x-default` retiré, le `noindex` retiré, les
CGU sorties du plan, et le dossier renommé — ce dernier parce qu'un test qui ne
lit rien passe au vert.

**Un piège d'outillage, et il a coûté une passe entière.** Mon harnais de
sabotage remettait le fichier par `git checkout -- <fichier>`, qui restaure
depuis l'INDEX. Les corrections n'étaient pas encore indexées : chaque
« remise en état » effaçait donc la correction elle-même, et les sabotages
suivants tournaient sur un arbre déjà amputé. Les trois derniers ont rendu
« 4 échecs sur 4 », ce qui ressemble à un test très mordant et n'est que du
bruit. Un sabotage se fait contre une base connue ; sans indexation préalable,
il n'y a pas de base.

### La liste d'avant lancement réclamait deux choses déjà faites
`docs/lancement.md` est le document qu'on relit juste avant d'inviter cent
personnes, c'est-à-dire au moment où l'on a le moins envie de vérifier ce qu'il
raconte. Il annonçait deux blocages qui n'en sont plus :

- **les deux secrets de sauvegarde**, posés depuis le 25 août. La sauvegarde
  tourne tous les matins et fait ses treize étapes — export, restauration dans
  un PostgreSQL neuf, comparaison table par table, chiffrement, dépôt de
  l'archive. Huit exécutions vertes d'affilée. Vérifié dans le journal du
  travail, pas sur sa pastille : c'est la seule façon de le savoir, et c'est
  écrit plus bas depuis qu'une sauvegarde a pu ne rien produire pendant des
  semaines sans que rien ne le signale ;
- **la source OBS**, qui « n'existait pas » et qui vit dans
  `src/app/(diffusion)/obs/[jeton]`. Le message destiné aux streamers était
  donc retenu par une fonctionnalité livrée.

Le blocage réel a pris leur place, et il n'y figurait pas : la chaîne de
connexion Neon qui a circulé en clair. Elle donne un accès direct à la base,
sans passer par l'application ni par une session — tant qu'elle est valable,
elle contourne les quarante-huit routes filtrées par compte, le garde des
routes d'administration et le recensement des colonnes qui sortent. C'est le
seul geste de la liste qui répare au lieu d'ajouter.

Ce que ça apprend, et c'est la deuxième fois que ça s'écrit ici : une phrase
juste le jour où on l'écrit devient fausse quand le produit avance, et elle
vieillit d'autant plus vite qu'elle décrit ce qui manque — parce que c'est
précisément ce sur quoi on travaille. Une liste de blocages est le pire endroit
où laisser vieillir une phrase : elle ne se lit qu'une fois, et on lui obéit.

### Réussir l'objectif de la première semaine ne se voyait pas
Le premier chantier de rétention, et il commence par un constat qui n'était pas
celui attendu : **la machinerie existe déjà et elle est complète.** Objectif de
première semaine, série de jours avec son état de retard, dix-huit paliers avec
le prochain montré, bilan hebdomadaire par courriel, rappel du matin, relance
après deux semaines d'absence. Chercher quoi ajouter était la mauvaise
question ; il fallait chercher ce qui, là-dedans, ne fait pas ce qu'il annonce.

Trouvé en lisant une seule ligne :

```ts
visible: dansLaFenetre && !atteint,
```

**L'objectif s'efface à la seconde où on l'atteint.** Quelqu'un qui enregistre
ses cinq parties le premier soir voit sa récompense s'évanouir sans un mot :
réussir et ignorer produisent exactement le même écran, c'est-à-dire rien. Le
commentaire au-dessus disait « un objectif raté qui reste affiché n'est plus un
objectif, c'est un reproche », ce qui est juste — et la règle avait été
appliquée aux deux cas alors qu'elle n'en concerne qu'un.

Il reste maintenant jusqu'à la fin de la fenêtre, en vert, avec sa barre
pleine, sans décompte de jours restants — il ne reste rien à faire — et il
pointe vers ce qui suit : les paliers, juste en dessous, qui montrent déjà le
prochain seuil. La suite existait, personne ne la désignait.

Sabotage fait, la ligne remise : le parcours navigateur tombe.

**Ce que ça ne règle pas, et qu'il faut dire.** Le produit n'a eu aucune
activité en une semaine, sur quatre comptes. Ajouter de la rétention à un
produit que personne n'ouvre revient à réparer une porte dans un mur sans
maison. C'est le même raisonnement qui a fait lever le plafond de cent : une
porte qu'on garde contre une foule absente ne garde rien. Ce qui se décide
maintenant est un arbitrage d'acquisition, pas de code, et il figure dans les
questions.

### La campagne de mesure a trouvé ce que la relecture n'avait pas vu
Trois défauts, tous introduits par le passage de la langue dans l'adresse,
tous invisibles à la lecture du code — et le pire tournait **en production**
depuis une heure.

**La carte partagée et l'icône d'onglet répondaient 307 vers la connexion.**
`opengraph-image`, `icon` et `apple-icon` ont déménagé sous `[locale]` avec les
pages ; or le motif du middleware ne regarde que le PREMIER segment. Il
excluait `/opengraph-image`, pas `/fr/opengraph-image`. Depuis V301, tout lien
posé sur Discord ou Reddit partait sans vignette, et l'onglet du navigateur
sans icône. Rien ne pouvait le dire : personne ne regarde le code de réponse
d'une image, et la page, elle, s'affichait parfaitement.

**Les deux pages du calculateur affichaient leur titre en français**, dans les
six langues. Les traductions existaient dans le dictionnaire depuis le premier
jour — `indexTitre`, `titre(jeu)`, `autresJeux` — et personne ne les lisait.
Ce sont les quinze pages qui existent pour être trouvées par une recherche : le
titre TRADUIT partait dans les métadonnées, et le titre FRANÇAIS s'affichait
dans la page. Un moteur promettait une chose, la page en montrait une autre.

**Et la carte partagée elle-même était en français** dans les six langues, tout
comme la description des données structurées et le titre de l'écran de
récupération.

**Comment ça a été trouvé, et pourquoi ça compte.** `performance.mjs` nomme le
plus grand élément de la page. Sur `/de/calculateur/league-of-legends`, il a
nommé « Combien de pompes pour une défaite sur League of ». Un chiffre seul
n'aurait rien dit ; c'est le NOM qui a parlé. La leçon écrite ici il y a une
semaine — « un chiffre sans nom ne se diagnostique pas » — vient de servir une
seconde fois, sur un défaut qui n'a rien à voir avec la performance.

**Pourquoi aucun garde ne l'attrapait**, et ce que ça change :

- `texteEnDurComposants.test.ts` ne lisait que `src/components`. `src/app` en
  était dispensé sans que rien ne le dise — et c'est là que le défaut vivait.
  Une page est un composant comme un autre ; ce qui la distingue, c'est qu'elle
  est rendue au serveur, donc qu'elle ne peut pas employer `useT`. C'est
  précisément ce qui pousse à écrire le texte en dur.
- Le motif ne cherchait que des chaînes ENTRE GUILLEMETS. Les deux titres du
  calculateur étaient du texte JSX nu, sans guillemets d'aucune sorte : le
  garde, même étendu au bon dossier, serait resté vert. Éprouvé — le premier
  sabotage est passé, et c'est ce qui a fait chercher plus loin.

`textes(dict, locale)` rend au serveur ce que `useT` rend au navigateur. Deux
sabotages, deux échecs : le texte JSX nu et la chaîne littérale.

**Ce qui reste en anglais, et pourquoi c'est un choix.** La carte partagée
retombe sur l'anglais en chinois et en japonais : elle est dessinée par le
moteur de `next/og`, qui n'a que les polices qu'on lui donne. Sans police à
idéogrammes embarquée — plusieurs méga-octets à chaque rendu — les caractères
sortent en carrés vides. Une carte anglaise se lit ; une carte de carrés ne se
lit pas, et c'est celle-là qu'on partage.

**Et la source de diffusion parlait français à un public entier.** Trois mots
(« À faire », « j », « Lien invalide ») superposés à un stream, la seule
surface du produit que des inconnus regardent. Elle n'a pas de langue dans son
adresse, et pour cause : elle est ouverte par un logiciel de diffusion, avec un
jeton pour toute identité. C'est donc la ROUTE qui rend les mots — pas la
langue. Rendre `langue` ferait sortir une donnée du compte sur une adresse
publique, et la politique de confidentialité promet que ce lien ne révèle ni le
nom ni les parties ; les libellés, eux, allaient de toute façon s'afficher.

**Le reste des mesures**, une fois ces trois corrections faites :

| écran | LCP poste | LCP téléphone bridé | plus grand élément |
|---|---|---|---|
| `/de` | 604 ms | 1364 ms | l'image de l'application |
| `/de/cgu` | 476 ms | 1120 ms | le premier paragraphe |
| `/de/confidentialite` | 500 ms | 1152 ms | le titre |
| `/de/calculateur/league-of-legends` | 500 ms | 1136 ms | le titre |

CLS de 0,000 partout, et les dix pages restent très en dessous du seuil de
2500 ms malgré 228 pages statiques au lieu de 78.

**Accessibilité : 0 constat sur 90 passes** — quinze pages, six langues,
**aucune page laissée de côté**. Ce dernier point a demandé du travail : la
première exécution en annonçait douze non mesurées, parce que le jeton de
session déposé dans `/tmp` datait d'une autre semaine. Les écrans connectés
partaient alors vers la connexion, et le rapport le disait — c'est le garde
posé il y a une semaine qui a fait son travail. Un compte neuf, et les quinze
pages sont mesurées pour de bon.

### Les documents juridiques dans les six langues, et la clause qui va avec
Ils n'existaient qu'en français et en anglais, avec un bandeau qui l'annonçait
aux quatre autres. Le commentaire de ce bandeau disait pourquoi, et il avait
raison : « un texte juridique traduit sans relecture engage autant que
l'original ».

Traduire ne fait pas disparaître ce risque, ça le déplace : on passe de « on
vous prévient que c'est en anglais » à « voici un texte allemand qui vous
engage et que personne n'a relu ». Ce que font tous les services multilingues,
et qui manquait ici, c'est la **clause de langue** : les six versions existent,
la française fait foi. Elle est posée dans l'article du droit applicable des
CGU et dans l'article des modifications de la politique — dans les six langues,
y compris le français et l'anglais, où elle n'existait pas non plus.

Le commentaire du bandeau l'avait d'ailleurs anticipé : « Le bandeau ne dit pas
quelle version fait foi — c'est une clause juridique, pas une constatation, et
elle appartient au texte lui-même. » Elle y est maintenant.

`LangueDocument` est supprimé, et son exemption dans le recensement des textes
en dur avec lui. Il en reste une seule, celle des noms de langue du sélecteur.
Une exemption qu'on peut retirer est le signe que le produit a rattrapé son
retard.

**Et il a mordu dès la traduction posée.** Deux débordements en allemand, à
320 px, tous deux invisibles dans les cinq autres langues :

- le titre `ALLGEMEINE NUTZUNGSBEDINGUNGEN` mesurait 360 px sur un écran de
  320. Il se coupe maintenant — et il se coupe BIEN, parce que `<html lang>`
  porte enfin la vraie langue : le navigateur applique les motifs de césure
  allemands. C'est un effet de bord inattendu du passage de la langue dans
  l'adresse ;
- une cellule du tableau des données mesurait 383 px et emportait la page.

Les deux corrections tiennent au même oubli, et c'est le plus intéressant :
**`hyphens` et `overflow-x` ne servent à rien sur une boîte qui n'est pas
bornée.** Le titre est en `inline-block`, donc il s'ajuste à son contenu et
grandit avec le mot au lieu de le couper. Le conteneur du tableau n'avait rien
à faire défiler tant qu'il pouvait grandir. `max-width: 100%` sur les deux, et
les deux règles se mettent enfin à faire ce qu'on croyait qu'elles faisaient
déjà. C'est la borne qui déclenche la césure, pas la césure qui borne.

### Revue de la porte, après le passage de la langue dans l'adresse
Le middleware est la seule chose que TOUTE requête traverse, et il vient de
gagner une branche de langue et une réécriture. Passé en revue, poussé plutôt
que relu : dix-sept adresses fabriquées pour essayer de faire entrer quelqu'un.

**Aucune faille trouvée.** Ce qui a été essayé, et ce que ça rend :

| adresse | réponse |
|---|---|
| `/fr/dashboard`, `/fr/fr/dashboard` | 307 vers la connexion |
| `/FR/dashboard`, `/Fr/dashboard` | 308 vers une adresse qui n'existe pas |
| `/dashboard.`, `/dashboard.x`, `/api.x` | 307 vers la connexion |
| `/fr%2Fdashboard`, `/fr/../dashboard` | 308, puis 307 vers la connexion |
| `/obsolete`, `/betamachin` | 308 vers une adresse qui n'existe pas |
| `/api/dashboard`, `/api/user`, `/api/obs`, `/api/admin/users` | 307 vers la connexion |
| `/api/sante`, `/api/champions`, `/api/exercices/ratios` | 200, leur handler |
| `/api/init` | 401, son propre secret |

La raison tient en une ligne : **le contrôle d'accès ne voit jamais le
préfixe.** `sansLocale` le retire d'abord, et `estCheminPublic` continue de
comparer par segments sur le chemin qu'il a toujours connu. Une règle qu'on
n'a pas eu à réécrire est une règle qui n'a pas pu diverger.

Le contrôle de la casse compte aussi : `estLocale("FR")` est faux, donc le
segment n'est pas une langue, donc l'adresse est réécrite au lieu d'être
acceptée. Sans ça, `/FR/dashboard` aurait sauté le préfixe ET le contrôle.

**Les chaînes de requête survivent**, ce qui n'allait pas de soi : un lien de
récupération envoyé avant la mise en production part sur
`/recuperation/valider?t=…` sans langue, et arrive sur
`/en/recuperation/valider?t=…` avec son jeton. Les anciens courriels marchent
encore.

Deux corrections d'hygiène, aucune exploitable :
- le cookie de langue part maintenant en `secure` dès que la page est en
  HTTPS, et la valeur est refusée si ce n'est pas une des six. Elle vient
  d'une liste fermée aujourd'hui ; mais elle part dans un en-tête que le
  serveur relit, et un point-virgule y ajouterait un attribut ;
- **le sélecteur de langue n'était plus couvert par rien.** Tant que la langue
  vivait dans le stockage, les tests la posaient eux-mêmes et empruntaient le
  même chemin ; depuis qu'elle est dans l'adresse, ils naviguent directement,
  et plus personne ne cliquait ce bouton. Or c'est là que tout se joue
  maintenant. Un parcours l'éprouve : l'adresse, la langue rendue, ET le
  souvenir. Sabotage fait, le cookie retiré : le test tombe.

Le reste est inchangé et tient : deux `dangerouslySetInnerHTML`, tous deux sur
des constantes ; aucun SQL brut hors du client engendré ; aucun secret en dur ;
`PATCH /api/games/[id]` filtre par compte à la lecture comme à l'écriture.

### Un test vert chez moi, rouge en intégration continue, et c'est lui qui avait tort
`corriger une défaite en victoire rejoue le barème` est passé **trois fois** en
local et est tombé du premier coup sur la machine d'intégration continue. La
tentation, à ce moment-là, est de relancer.

Il attendait ceci après avoir cliqué :

```ts
await expect(ligne.getByText(/^victoire$|^victory$/i)).toBeVisible();
```

Le texte « Victoire » était déjà à l'écran : c'est le **libellé du bouton de
choix qu'on venait de cliquer**. L'attente se résolvait donc instantanément,
avant même que la requête soit partie, et la lecture en base qui suit portait
sur l'état d'avant. Sur une machine rapide, la requête gagnait la course une
fois sur deux ; sur une machine chargée, jamais.

Un test qui attend quelque chose de déjà vrai n'attend rien. Et celui-là avait
l'air d'attendre le résultat de l'action : c'est ce qui le rendait crédible.

Il attend maintenant que **l'éditeur se referme**, ce qui n'arrive que si la
base a répondu. Éprouvé dans les deux sens, avec la requête ralentie de trois
secondes pour reproduire la machine lente : l'ancienne assertion tombe, la
nouvelle passe.

Ce que ça apprend sur l'outillage : **une machine lente ne se trompe pas, elle
révèle**. Un échec qui n'arrive qu'en intégration continue est une course, et
une course est un vrai défaut — ici c'était le défaut du test, ça aurait pu
être celui du produit.

Et un piège déjà écrit ici, retombé dedans dans la foulée : **`-g` écarte le
test qui ouvre le compte.** En isolant le test fautif pour le rejouer, la
session n'existait plus et `/api/games` rendait la page de connexion —
« Unexpected token '<' », qui ne ressemble en rien à la cause. Le fichier se
rejoue en entier, jamais un test seul.

### `/login` ne bouge pas, et c'est une dette assumée
Le préfixe de langue aurait cassé l'application Windows **déjà installée**, en
silence et de la pire façon. Sa fenêtre d'authentification s'ouvre sur
`${SITE}/login` et décide « la connexion est finie » en demandant « ce n'est
plus /login ? ». Redirigée vers `/fr/login`, elle répond oui à la toute
première page : elle referme la fenêtre avant qu'on ait tapé quoi que ce soit,
et va chercher un cookie qui n'existe pas encore. La connexion par Google y
devient impossible.

Le code de la coquille est corrigé (`sansLangue` avant toute comparaison), mais
**les copies installées ne se corrigent pas à distance**. Elles continueraient
de casser jusqu'à ce que chacun mette à jour — c'est-à-dire pour certains
jamais.

`/login` se **réécrit** donc au lieu de se rediriger : l'adresse visible ne
change pas, l'ancien contrôle continue de marcher, et la page rendue est bien
celle de la bonne langue. Le prix côté moteurs est nul, `/login` portant
`noindex` : il n'y a aucun crédit d'adresse à reporter.

C'est une exception, elle est écrite comme telle dans le middleware, et elle
porte sa date de péremption : à retirer quand plus personne ne fait tourner une
version antérieure à 0.9.9.

Ce que ça apprend, et qui vaut au-delà de ce cas : **un client déjà distribué
fait partie du contrat.** Une adresse qu'il connaît n'est pas une adresse
interne qu'on peut renommer, même quand le renommage est meilleur. Le défaut
n'aurait été signalé par rien — ni test, ni journal, ni supervision — parce que
la seule machine capable de le voir est celle de quelqu'un d'autre.

### La langue est passée dans l'adresse, et cinq langues sur six ont commencé à exister
Elle vivait dans le stockage du navigateur. Ça marchait, et ça se payait en
silence : le serveur rendait TOUJOURS la même version, donc les métadonnées de
chaque page partaient en français à tout le monde, `<html lang>` annonçait
« fr » à un lecteur d'écran japonais jusqu'à ce que le paquet JavaScript
s'exécute, et un moteur de recherche ne voyait jamais que le français. Les dix
pages publiques et les quinze pages par jeu existent pour être trouvées ; cinq
langues sur six ne l'étaient pas.

Le défaut ne cassait rien et ne se voyait nulle part — la page s'affichait
parfaitement dans la bonne langue une fois le script exécuté. C'est ce qui l'a
laissé vivre si longtemps.

**Ce qui a changé.** `src/app/[locale]/` porte toutes les pages ; le middleware
redirige en 308 toute adresse sans langue vers celle qu'on a de meilleures
raisons de croire bonne (le cookie d'abord, l'en-tête du navigateur ensuite,
l'anglais à défaut). `generateStaticParams` engendre les six versions à la
construction : **78 pages statiques avant, 228 après**, dont 90 pages de
calculateur — quinze jeux fois six langues.

**Deux mises en page racines**, et c'est la seule façon d'y arriver : une page
racine ne peut pas lire un paramètre de route, donc `<html lang>` ne pouvait
pas venir de l'adresse tant qu'un `app/layout.tsx` existait. Il a disparu au
profit de `app/[locale]/layout.tsx` et de `app/(diffusion)/layout.tsx`. La
source OBS y gagne au passage la coquille qu'elle aurait dû avoir depuis le
début : ni navigation, ni pied de page, ni police à télécharger, ni pont vers
l'application de bureau, pour une page qu'OBS superpose au jeu.

**Ce qui ne prend jamais de préfixe**, avec sa raison : les routes d'API (les
préfixer casserait les rappels d'Auth.js, l'application de bureau et les
déclencheurs programmés, pour un gain nul), l'adresse de diffusion
`/obs/<jeton>` (un laissez-passer déjà collé dans des logiciels de streaming),
et les fichiers servis tels quels. La règle vit une seule fois, dans
`src/lib/i18n/cheminLocalise.ts`, et elle compare par SEGMENTS — `startsWith("/api")`
accepte `/apiculture`, faute déjà corrigée deux fois sur ce projet.

**Un seul endroit retire le préfixe.** `useChemin()` rend le chemin sans
langue, et tout le reste de l'application continue de raisonner sur
`/history`, `path === "/"`, `estPagePublique(...)`. Sans ça, ces comparaisons
devenaient fausses d'un coup et en silence : le menu ne soulignait plus rien,
la modale d'accueil s'invitait sur les pages publiques, le rail s'affichait sur
la page d'accueil. `src/liensLocalises.test.ts` refuse `usePathname` ailleurs
que dans `useChemin` et le sélecteur de langue, et `next/link` ailleurs que
dans `Lien`. Deux sabotages, deux échecs.

**Ce qui partait hors du navigateur, et qui changeait de langue en chemin.**
Quatre chemins, tous avec le même défaut : le texte était écrit dans la langue
du COMPTE, et le lien qui l'accompagnait partait sans langue — donc renvoyé
vers celle négociée par le navigateur qui l'ouvre.

- Le **bilan hebdomadaire** : un courriel en japonais dont les deux boutons
  ouvraient l'application en anglais.
- Le **lien de récupération**, qui est le pire des quatre : on arrive sur
  l'écran qui rend l'accès, et c'est le plus mauvais moment pour ne pas
  comprendre ce qu'on lit.
- Les **notifications push**.
- La **déconnexion automatique** et les redirections des pages serveur.

**Et l'application de bureau, qui aurait cassé sans un mot.** Sa fenêtre
d'authentification décide « la connexion est finie » en demandant « ce n'est
plus /login ? ». Avec `/fr/login`, elle répondait oui à la toute première page,
refermait la fenêtre avant qu'on ait tapé quoi que ce soit, et cherchait un
cookie qui n'existait pas encore. `desktop/src/origine.js` retire donc le
préfixe avant toute comparaison. La liste des six langues y est recopiée — le
SEUL endroit du projet où une règle est volontairement écrite deux fois,
puisque la coquille Electron est construite sans le paquet du site. Un test la
compare au fichier du site, pour que la divergence se voie le jour où une
septième langue s'ajoute.

**Vérifié sur le serveur, parce qu'une porte se pousse** : `/` répond 308 vers
`/fr` en français, vers `/ja/cgu` avec un en-tête japonais, vers `/en/cgu` avec
un en-tête portugais (langue inconnue, donc anglais), et vers
`/es/telechargement` quand un cookie dit « es » malgré un navigateur japonais.
`/fr/dashboard` redirige vers `/fr/login` — la langue survit à la porte.
`/obs/<jeton>` et `/api/sante` atteignent leur handler sans préfixe. Et
`/de/cgu` sert `<html lang="de">` avec « Nutzungsbedingungen » dans le titre,
en statique.

**Un piège de construction qui ne se voit qu'en lisant le HTML rendu** : les
avertissements `metadataBase` ne portaient que sur `/_not-found`, et pas sur
les 90 pages de calculateur — vérifié en cherchant « localhost » dans tout le
HTML engendré. Les canoniques et les six `hreflang` s'y résolvent bien sur le
domaine de production. Un avertissement de construction ne dit pas quelle page
il concerne ; le fichier, lui, le dit.

### Une victoire enregistrée en défaite ne se reprenait qu'en la supprimant
La détection locale a inventé l'issue manquante pendant des semaines, et une
victoire sur trois entrait du mauvais côté. Le défaut est corrigé depuis, mais
les parties, elles, sont toujours là, avec la dette qu'elles ont créée. On
avait écrit à l'époque que les reprendre « demande de décider ce qu'on fait de
la dette déjà payée dessus, et ça ne se décide pas seul ». La décision est
prise : on corrige depuis l'historique, partie par partie.

**Corriger un résultat n'est pas modifier un champ, c'est refaire le calcul.**
Réécrire la lettre seule laisserait le coût de la défaite affiché sous une
victoire, c'est-à-dire une dette qu'on ne doit plus, affichée par l'écran qui
vient de dire le contraire. `PATCH /api/games/[id]` rejoue donc le barème avec
tout ce que la partie a gardé d'elle-même, et porte au compteur l'ÉCART entre
les deux coûts.

Trois décisions, chacune avec sa raison :

- **Le niveau est relu sur la partie, pas sur le compte d'aujourd'hui.**
  Quelqu'un qui a refait son test de force entre-temps ne doit pas voir une
  vieille partie changer de coût pour une raison sans rapport avec ce qu'il
  vient de corriger. Même chose pour le nombre de parties jouées avec ce
  champion, figé à l'enregistrement.
- **Les exercices ne se rouvrent pas.** Ils ont été figés à l'enregistrement
  pour que l'historique reste fidèle même si la sélection change plus tard.
  Seul le total qu'on répartit entre eux bouge.
- **Deux gestes pour corriger**, pas une bascule au clic : le résultat s'ouvre,
  puis se choisit. Une frappe malheureuse sur la ligne d'à côté créerait sinon
  une dette qu'on ne doit pas, ce qui est exactement le défaut qu'on répare.

Refusé, et pas proposé : les séances au temps, qui n'ont pas de résultat, et
les battle royale, dont le résultat se déduit du classement. La règle est écrite
des deux côtés — la route refuse, l'écran ne propose pas — parce qu'un geste
offert qui sera repoussé est pire que pas de geste du tout.

**Et une règle qui était écrite deux fois l'est maintenant une seule.**
L'incrément de dette et la pose de sa date de début vivaient dans `/api/games` ;
la correction en avait besoin à l'identique. `ajouterALaDette` rejoint
`retirerDeLaDette` dans `src/lib/dette.ts`. C'est le cinquième cas de règle
dupliquée trouvé sur ce projet, et le précédent portait précisément sur cette
date de début.

Six sabotages, six échecs : le résultat réécrit sans recalcul, la correction
déjà faite qui repasse quand même, le battle royale accepté, la séance au temps
acceptée, le niveau relu sur le gainage plutôt que sur la partie, et la dette
réglée en valeur absolue au lieu de l'écart.

Au navigateur, deux tests : la correction change l'écran ET la base, et une
correction refusée ne change ni l'un ni l'autre. Sans ce second contrôle, un
écran qui se contente de réécrire la lettre chez lui passerait.

**Un défaut d'étiquette trouvé en passant** : le bouton qui renonce à modifier
une date s'annonçait « Voir le détail du calcul ». Le libellé lu à voix haute
n'était pas celui du bouton.

### La dette ne se replie plus
Sous 1180 px, le rail se replie derrière un bouton, et la pastille de dette
partait avec. Voir ce qu'on doit demandait donc une touche de plus — sur la
moitié du produit qui se consulte au téléphone, c'est-à-dire là où la question
se pose le plus. Le point rouge posé sur le bouton ne remplaçait pas le
chiffre : il disait qu'il y avait quelque chose, pas combien.

C'était constaté depuis le passage du parcours complet sur un écran de
téléphone, et laissé en attente parce que déplacer ce bouton est un arbitrage.
Il est tranché.

Le bouton ne replie plus que les ACTIONS de la page. La dette vit à côté, hors
du contenu repliable. Elle ne s'affiche toujours que s'il y a quelque chose à
devoir : ce n'est pas un bandeau permanent, c'est un rappel qui disparaît quand
il n'a rien à dire.

Trois choses sont parties avec, et c'est le bon signe : le point rouge, la
bordure d'alerte du bouton, et le rapport d'état que la pastille faisait
remonter au rail. Un bouton qui n'ouvre plus que des actions n'a pas à savoir
ce qu'on doit. `noUnusedLocals` a attrapé la variable devenue inutile, et
`codeMort.test.ts` la règle CSS orpheline — deux gardes qui ont fait leur
travail sur un remaniement de quinze lignes.

Le test qui avait mis le défaut au jour est celui qui le garde : l'étape 5 du
parcours sur téléphone dépliait le rail avant de chercher la pastille. Elle
exige maintenant `toBeVisible` sans rien déplier. C'est le contrôle qui mord :
l'élément était déjà DANS la page avant la correction, simplement caché, et le
chercher ne prouvait rien.

### Le placement de la pastille, la seule chose qui puisse la rendre invisible
`overlay.js` fait six cents lignes et n'avait aucun test. La plus grande partie
tient à Electron et ne s'éprouve qu'avec une fenêtre ; le placement, lui, est
de l'arithmétique pure — et c'est précisément la partie qui peut poser la
pastille hors de tout affichage, sans moyen de la récupérer autrement qu'en
éditant un fichier de réglages.

Le module `electron` se double par `jest.mock(..., { virtual: true })`, la
taille de l'écran est une variable du test. Huit cas, trois sabotages, trois
échecs : le plancher à zéro retiré, le coin par défaut basculé à gauche, le
retour dans l'écran supprimé en hauteur.

Rien de cassé trouvé : les quatre coins, le repli sur « haut-droite » quand le
réglage manque, et le retour dans l'écran tiennent tous. C'est un test de
non-régression sur du code correct, ce qui est le bon moment pour l'écrire.

### Allonger un texte l'a fait paraître deux secondes et demie plus tard
Le bandeau du tableau de bord vit dans le rendu principal, qui attend la
réponse de `/api/dashboard`. Il ne dépend pourtant d'aucune donnée : c'est du
texte fixe.

Tant qu'il était court, ça ne se voyait pas — le plus grand élément de la page
était le rappel du test de force, rendu au serveur, à 1108 ms. En allongeant le
texte pour dire que l'application Windows détecte déjà les parties, il est
devenu le plus grand élément, et la mesure est passée à **3540 ms**, au-dessus
du seuil.

La mesure a donc attrapé une régression que je venais d'introduire, et pour une
raison qui n'avait rien à voir avec le poids : un élément qui arrive tard
devient un problème le jour où il devient le plus grand.

Déplacé dans le premier écran, il part avec le HTML : **1148 ms**. Et c'est
mieux ainsi de toute façon — ce bandeau explique ce qu'il faut faire en
attendant Riot, et il l'expliquait après tout le reste.

### Toute requête en base part filtrée sur le compte
C'est la règle qui protège vraiment les comptes entre eux, et la seule dont
l'oubli est immédiatement grave : une route qui lit `Game` sans `userId` rend
l'historique de quelqu'un d'autre. Les tests par route la vérifiaient une par
une ; rien ne la tenait pour la route qu'on ajouterait demain.

`src/filtreParCompte.test.ts` regarde le dossier `src/app/api` plutôt que les
fichiers connus. Le contrôle est un motif, donc grossier : il lit les quatre
cents caractères de part et d'autre de chaque appel. Ça attrape le `where` de
l'appel lui-même, et aussi le cas légitime où les identifiants viennent d'une
requête filtrée juste au-dessus — c'est ce que font `games/dates` et `push`,
qui refiltrent une liste venue du navigateur avant d'écrire.

Six dispenses, chacune avec sa raison : l'administration (qui agit sur les
autres comptes par définition), l'inscription et la récupération (qui n'ont
pas encore de session), la source de diffusion (dont le jeton fait office de
filtre), et les deux envois programmés (qui parcourent tous les comptes). Une
septième devrait faire se demander si le garde sert encore.

Deux sabotages, deux échecs : une route fabriquée qui lit toutes les parties,
et le dossier renommé — le second parce qu'un contrôle qui ne lit rien passe
au vert.

Aucun appel nu trouvé sur les quarante-huit routes existantes. Comme pour le
garde des textes en dur, c'est le bon moment pour figer une discipline qui
tient.

### Payer sa dette effaçait la partie qui venait d'arriver
`PATCH /api/dette` lisait la dette, calculait ce qui reste, puis **réécrivait
cette valeur absolue** dans une transaction. Entre la lecture et l'écriture, il
peut se passer quelque chose : l'application de bureau enregistre la partie
qu'on vient de quitter. Sa dette était alors écrasée par un état calculé avant
elle.

Ce n'est pas un cas tordu, c'est le cas normal : on finit sa série au moment où
la partie se termine. Le paiement est simplement plus rapide que l'écriture de
la partie une fois sur deux.

Le retrait passe maintenant par un **décrément atomique** (`src/lib/dette.ts`) :
deux écritures concurrentes s'ajoutent au lieu de s'écraser. Un paiement vaut
un nombre de points, pas un état final.

`decrement` n'a pas de plancher, d'où la remise à zéro juste après si on est
passé sous la ligne — le cas légitime étant « j'ai fait plus que ce que je
devais ». La fenêtre où la valeur est négative dure une requête, et tout ce qui
lit la dette la borne déjà à zéro, précisément parce qu'une valeur négative n'a
aucun sens à l'écran.

Une première version relisait la dette DANS la transaction avant d'écrire une
valeur absolue. Ça couvre le cas courant et pas le cas général : sous
PostgreSQL en lecture validée, un incrément qui s'intercale entre la lecture et
l'écriture se perd quand même. Le décrément, lui, n'a pas ce trou.

**La suppression d'une partie avait exactement le même défaut**, et hors
transaction : elle relisait puis écrivait une valeur bornée, avec le
raisonnement écrit en commentaire (« decrement ne connaît pas de plancher »).
Le raisonnement était juste, la conclusion non : le plancher se pose après, pas
en renonçant à l'atomicité.

Cela vaut aussi pour « j'ai tout fait » : on paie tout ce qu'on avait sous les
yeux, pas tout ce qui existe au moment où la requête arrive. Sinon le bouton
efface une dette qu'on n'a jamais vue.

Sabotage fait, retour à la réécriture absolue : le test tombe.

### Le chemin principal perdait encore une partie en silence
Dernier trou de la série, et le plus mal placé : `if (!res.ok) return;` dans la
détection de partie. L'issue était lue, la partie complète, et le serveur la
refusait — session expirée, valeur hors bornes, configuration absente — sans
que rien ne le dise. La soirée ne comptait pas, et personne ne savait pourquoi.

Le `catch` invoquait « le suivi de session reste le filet de sécurité ». C'est
faux depuis que la clé Riot n'est pas arrivée : ce chemin-ci est le seul. Un
commentaire qui décrit une garantie disparue est pire qu'un commentaire absent,
parce qu'on cesse de vérifier.

Les deux le disent maintenant, avec le motif rendu par la route. Sabotage fait,
le refus remis en silence : le test tombe.

Et une leçon d'outillage, retombée dedans **trois fois cette nuit** : après un
`npx next build`, il faut relancer le serveur. Sans ça, `next start` sert un
`.next` remplacé sous lui, les fragments JavaScript répondent 500, la page ne
s'hydrate pas — et TOUTE la suite échoue sur « l'ouverture de compte », ce qui
ne ressemble en rien à sa cause. Le piège était déjà écrit ici ; il l'était à
l'envers (« ne jamais reconstruire pendant qu'un test tourne »), et c'est
l'autre moitié qui mord.

### Le rôle deviné était une constante, alors que la personne en a un
Sans rôle au contexte, la détection retombait sur « le dernier rôle saisi à la
main », puis sur `"Jungle"`. Or quelqu'un qui ne joue qu'avec la détection
automatique ne saisit jamais rien à la main : il obtenait donc « Jungle » à
chaque partie, quel que soit son rôle.

Ce n'est pas anodin. Un support compté comme jungler paie ses morts trois
points au lieu de deux et deux dixièmes, et ses assists lui rapportent un au
lieu d'un et six dixièmes. C'est la même famille que l'issue inventée, en
moins spectaculaire.

Le lanceur donne le rôle sur les files qui en attribuent un. Il est maintenant
retenu, et sert de repli pour celles où il ne le dira pas. Ça ne coûte rien :
aucune requête de plus, et le repli devient personnel au lieu d'être arbitraire.

Ce qui reste en attente : le tout premier compte, qui n'a encore aucun rôle
connu. Refuser d'enregistrer comme on le fait pour l'issue ferait perdre la
partie pour un détail de pondération ; c'est un arbitrage, il figure dans les
questions.

### La page d'accueil sous-vendait ce qui marche déjà
« Suivi automatique des parties League dès que Riot nous ouvre l'API. » C'était
vrai le jour où la phrase a été écrite, et faux depuis que l'application
Windows détecte les parties par l'API locale du jeu, sans aucune clé. Quelqu'un
qui lit la page d'accueil en conclut que la détection automatique n'existe pas
encore, alors qu'elle est le seul chemin automatique disponible aujourd'hui.

C'est la page qui amène les gens, et la phrase parle de la fonctionnalité qui
vient d'être réparée trois fois cette nuit. Corrigée dans les six langues.

Le bandeau du tableau de bord disait la même chose : « en attente de
l'autorisation de Riot Games pour synchroniser tes parties de League
automatiquement ». Quelqu'un qui le lit ajoute ses parties à la main sans
savoir que l'application le fait déjà. Il distingue maintenant les deux
chemins : la synchronisation depuis le site attend Riot, l'application Windows
n'attend rien.

Ce que ça apprend : une phrase honnête au moment où on l'écrit devient
malhonnête quand le produit avance. Elle vieillit d'autant plus vite qu'elle
décrit ce qui manque, parce que c'est précisément ce sur quoi on travaille.

### Le test de force, refermé sur un échec qu'il n'annonçait pas
`TestPompes.onEnregistre` rendait `void` : le panneau se fermait et la saisie
s'effaçait **quoi qu'il arrive**. Sur le tableau de bord, où l'appelant avalait
l'échec, on tapait son chiffre, le panneau se refermait, et rien n'était
enregistré. C'est ce test qui fixe le niveau, donc le multiplicateur, donc
toute la dette.

La fonction rend maintenant un booléen, et le panneau ne se referme que si le
chiffre est parti. Les deux appelants en profitent : celui des réglages
annonçait déjà l'échec ailleurs sur la page, mais effaçait quand même la
saisie — il fallait refaire le test pour de vrai.

Trois autres appels sans `try` corrigés dans la même passe :
- le **retrait du consentement santé** ignorait la réponse et vidait le
  formulaire : on annonçait l'effacement de données que le serveur avait
  gardées. Sur des données de santé, c'est la promesse qu'on ne peut pas tenir
  à moitié ;
- la **mise de côté d'un exercice** ne produisait rien du tout sans réseau : ni
  changement, ni message ;
- l'**enregistrement d'une partie**, déjà décrit plus haut.

Le recensement se fait par un petit script qui cherche un `await fetch` sans
`try` englobant dans les composants. Il rend dix-huit candidats, dont la moitié
sont de faux positifs — un `.catch()` en bout de chaîne, un assistant commun
qui porte déjà le `try`. Les lire un par un reste plus rapide que de les
chercher à la main.

### L'historique annonçait des suppressions qui n'avaient pas eu lieu
Le pire de la série, parce qu'il touche une action destructrice. `handleDelete`
retirait la ligne de l'écran **quelle que soit** la réponse du serveur, et
prévenait le compteur de dette de se rafraîchir dans la foulée. Une suppression
refusée paraissait donc réussie : la partie revenait au rechargement suivant,
sans que rien ne l'explique, et la dette n'avait pas bougé.

`handleEditDate` faisait la même chose avec la date : l'écran montrait la
nouvelle, la base gardait l'ancienne. C'est précisément le cas que la route a
appris à refuser cette nuit (« 2026-02-30 » ne montre plus le 2 mars) — le
refus était donc invisible.

Ni l'un ni l'autre n'avait de `try` : sans réseau, la ligne restait en
« suppression… » pour toujours.

La ligne ne quitte l'écran que si elle a quitté la base. Sabotage fait, le
contrôle retiré : le test tombe.

### L'action la plus utilisée de l'application n'avait pas de `try`
`handleAddLog` — enregistrer une partie à la main — envoyait son `fetch` sans
rien autour. Sans réseau, la promesse part en erreur, `setAddLogging(false)`
n'est jamais atteint, et « Enregistrement… » reste à l'écran pour toujours.
C'est le chemin que tout le monde emprunte, et le seul qui compte tant que la
clé Riot n'est pas arrivée.

`handleRiotFetch` avait le même défaut, plus un second : `await res.json()` sur
la réponse d'erreur, sans repli. Une page d'erreur en HTML — ce que rend un
serveur qui tombe avant d'atteindre la route — faisait tomber la lecture au
lieu d'afficher le message.

`e2e/panne-serveur.spec.ts` coupe l'envoi seulement, pas le chargement : le
formulaire doit s'ouvrir normalement, puis l'échec doit se dire ET le bouton
revenir. Sabotage fait, le `catch` retiré : le test tombe.

### « Aucun texte dans un composant » : la règle, et le test qui manquait
C'est la règle numéro un du projet, et rien ne la tenait. `langueEnDur.test.ts`
refuse qu'un composant COMPARE `locale` à une langue ; il ne dit rien d'une
phrase française écrite directement dans le JSX, qui est la façon la plus
simple d'arriver au même résultat.

Le même garde, posé la même nuit sur la coquille Electron, y a trouvé cinq
textes vivants. Sur `src/components`, il ne trouve **rien** : la discipline
tient. C'est exactement le moment de la figer, pendant que la liste des
exemptions est courte.

Deux exemptions, chacune avec sa raison : les noms de langue du sélecteur
(« Français » n'est pas du français imposé, c'est le nom du choix qu'on
propose) et le bandeau qui annonce dans quatre langues qu'un document juridique
n'existe qu'en français et en anglais. Une troisième exemption devrait faire
se demander si le garde sert encore.

Ce que le garde ne couvre pas, et pourquoi : les métadonnées SEO des pages
(`title`, `description`) restent en français. Next.js les rend par route, et la
langue de l'application vit dans le stockage du navigateur : une seule version
peut donc partir. Ça se règle en mettant la langue dans l'adresse, ce qui est
une décision de produit déjà en attente.

### Les routes d'administration, gardées par un test plutôt que par la discipline
Les dix routes sous `api/admin` appellent toutes `estAdmin`, et chacune a son
test. C'est bon, et c'est l'angle mort de tous les tests écrits à la main : ils
ne disent rien de la route qu'on ajoutera demain. Or une route d'admin ouverte
à n'importe quel compte connecté est le pire des accidents — elle réinitialise
des mots de passe et lit tous les comptes.

`porteRoutes.test.ts` exige donc `estAdmin` sur toute route du dossier, avec le
contrôle de non-vacuité habituel. Et un second garde refuse une adresse
électronique écrite en dur dans une route : c'est le second endroit à changer
le jour où la liste bouge, et celui qu'on oublie. Deux sabotages, deux échecs.

### Combien de monde ça tient, mesuré plutôt que supposé
`scripts/charge.mjs` monte la concurrence par paliers et s'arrête au premier
qui casse. Sans dépendance : un banc d'essai qui demande d'installer quelque
chose ne se relance pas six mois plus tard. Il vérifie aussi où il atterrit,
comme les trois autres scripts de mesure — avec un cookie périmé, on
chronométrerait l'écran de connexion.

**Mesuré en local**, quatre cœurs, PostgreSQL sur la même machine :

| simultanés | req/s | médiane | p95 | échecs |
|---|---|---|---|---|
| 20 | 142 | 138 ms | 170 ms | 0 |
| 80 | 137 | 585 ms | 654 ms | 0 |
| 200 | 144 | 1421 ms | 1625 ms | 0 |
| 400 | 142 | 2565 ms | 5945 ms | 0 |

Le débit plafonne à **~144 requêtes par seconde** et n'en bouge plus : c'est la
signature d'un serveur saturé en processeur. Au-delà, la concurrence n'ajoute
que de l'attente. **Aucune erreur, à aucun palier** : ça met en file, ça ne
refuse pas. C'est la bonne façon de se dégrader, et c'est plus important que le
chiffre.

**Ce qui se transporte en production, et ce qui ne se transporte pas.** Le mur
processeur mesuré ici n'existe pas sur Vercel, qui répartit horizontalement.
Ce qui se transporte, c'est le coût par page :

- **neuf appels d'API pour un chargement du tableau de bord**, soit environ
  **vingt-neuf requêtes SQL** — chacune étant, en production, un appel HTTPS
  indépendant vers Neon, puisque le client passe par `PrismaNeonHttp` et non
  par un pool TCP. Le mur classique du « serverless épuise les connexions »
  n'existe donc pas ici ;
- quatre de ces appels sont les mêmes sur toutes les pages : `/api/user`,
  `/api/dette`, `/api/exercices/ratios`, `/api/consentement` ;
- `/api/settings` coûte à lui seul neuf requêtes, et le tableau de bord
  l'appelle.

**Le vrai plafond n'est aucun des deux : c'est la clé Riot.** Il est déjà
chiffré dans `riotBudget.ts`, et il est très en dessous de tout le reste. Une
clé de développement autorise cent requêtes par deux minutes, le budget en
réserve quatre-vingt-dix, et le mode session en coûte deux par joueur toutes
les deux minutes : **quarante-cinq joueurs simultanés**. Une seule ouverture de
l'historique en coûte vingt et une, soit autant que dix joueurs qui jouent. La
réponse chiffrée à « est-ce que ça tient à cent » reste donc : pas avec cette
clé, et le mur est de très loin celui-là.

À refaire le jour où la base ne contient plus quatre comptes et soixante-quinze
parties : les requêtes par compte sont indexées (`Game.userId`,
`Paiement.userId, jour`), donc elles ne devraient pas dériver, mais une mesure
sur une base minuscule ne le prouve pas.

### Le plafond de cent est levé, et la liste d'attente supprimée avec lui
Décision du propriétaire du produit, prise sur un fait : une semaine entière
sans une inscription, sans une partie, sans une tentative de connexion. Le
plafond existait pour tenir le rythme des premiers jours ; il a surtout tenu le
produit fermé pendant qu'il n'y avait personne dedans. Une porte qu'on garde
contre une foule absente ne garde rien.

Il vivait en **deux exemplaires**, `beta-access` et `auth/register`, chacun
avec sa constante `BETA_LIMIT = 100`. C'est le quatrième cas de règle écrite
deux fois trouvé sur ce projet. Ici les deux copies étaient d'accord, ce qui
est la seule raison pour laquelle personne n'a rien vu.

`betaRank` reste : il ne garde plus la porte, il dit dans quel ordre les
comptes sont arrivés. La porte par mot de passe reste sur invitation
(`porteMotDePasse`) : c'est un autre mécanisme, et il n'a pas bougé.

**`/waitlist` est supprimée.** Sans plafond, aucun chemin ne peut plus y mener,
et `pagesOrphelines.test.ts` refuse une page vers laquelle rien ne navigue.
Elle part donc en entier : la page, sa mise en page, son dictionnaire dans les
six langues, son entrée dans les chemins publics, dans la navigation, et le
message d'erreur traduit qui l'accompagnait. La leçon qu'elle avait laissée
reste écrite dans `robots.ts`, parce qu'elle vaut pour la prochaine page qu'on
voudra cacher : interdire l'exploration n'empêche pas l'indexation.

**Et le test qui a servi à la lever en a trouvé un autre.** En remplaçant
« refuse la cent-unième personne » par « la laisse entrer », l'inscription a
rendu 500. Rien à voir avec le plafond : la doublure de base n'a pas de
délégué `goal`, la route crée un objectif par défaut après le compte, et le
`.catch()` posé sur la promesse ne rattrape pas une erreur levée AVANT elle.
Aucun test de ce fichier ne vérifiait le code d'une inscription réussie : ils
regardaient tous ce qui avait été écrit, ce qui reste vrai même quand la route
tombe juste après. Un test qui n'affirme rien sur le résultat laisse passer
l'échec du résultat.

### Le recensement des `catch` silencieux, refait une dernière fois
Passage final sur tous les `catch {}` et `.catch(() => {})` du site et de
l'application de bureau. Les dix-neuf qui restent sont **tous des lectures au
montage** : les préférences d'exercices, les paliers, la version de
l'application, l'état des jeux surveillés. Un échec y laisse une valeur par
défaut saine ; rien de ce que la personne a fait n'est perdu, et rien de faux
n'est affiché. C'est l'usage légitime du silence.

Ce qui n'en était pas — un envoi avalé, un réglage affiché sans avoir été
gardé, une partie qui disparaît — a été traité au fil de la nuit et des
précédentes. Le recensement s'arrête donc ici : il ne reste rien à corriger de
cette famille, et le redire à chaque passage ferait perdre de vue les vrais.

Deux exceptions gardées dans `desktop/src/main.js`, toutes deux à la
fermeture : la lecture du cookie de session au démarrage, qui retombe sur
l'écran de connexion, et l'oubli de session demandé, qui ne peut plus rien dire
à personne puisque la fenêtre se ferme.

### Un 429 de Riot faisait dormir la fonction six minutes
Trouvé en relisant la fonction que les deux routes Riot portaient chacune de
son côté, recopiée à l'identique :

```ts
const retryAfter = Number(res.headers.get("Retry-After")) || (attempt + 1);
await sleep(retryAfter * 1000);
```

`Retry-After` vient de Riot et vaut couramment **120 secondes** sur un 429.
Trois reprises : six minutes d'attente, dans un environnement qui coupe une
requête après quelques dizaines de secondes. L'appelant ne reçoit alors ni 429
ni erreur — il reçoit une panne sans message, pour une situation parfaitement
normale que la route sait pourtant expliquer.

`src/lib/riotFetch.ts` garde un budget d'attente total de quatre secondes.
Quand Riot demande plus que ce qu'il en reste, on renonce et on rend SA
réponse : la route la traduit en un refus lisible, ce qui vaut infiniment mieux
qu'un silence de six minutes. Au passage, `Number("bientôt")` vaut `NaN` et
`NaN * 1000` aussi : un en-tête qui n'est pas un nombre donnait une attente
indéfinie.

**Et c'est le troisième cas de la nuit** où la même chose écrite deux fois
porte deux fois le même défaut : les cinq comparaisons d'origine du desktop, les
trois exemplaires de la règle des chemins publics, et maintenant ces deux
`riotFetch`. Elle est écrite une fois.

Trois sabotages, trois échecs.

### Riot refusait notre clé, et l'application accusait le pseudo du joueur
Les trois routes Riot rendaient le code de Riot **tel quel** :

```ts
return NextResponse.json({ … }, { status: idsRes.status });
```

Deux conséquences, et la seconde est la pire.

D'abord, **401 change de sens en chemin**. Partout ailleurs il veut dire « pas
de session » ; ici il pouvait aussi vouloir dire « Riot a refusé notre clé ».
Le journal de synchronisation annonçait donc « clé refusée, rien à faire de ton
côté » à quelqu'un dont la session venait simplement d'expirer, c'est-à-dire
lui disait de ne rien faire alors qu'il lui suffisait de se reconnecter.

Ensuite, `resolve-puuid` répondait **« Joueur introuvable (401) »**. La
personne qui relie son compte lit que SON pseudo est faux, au moment précis où
elle le tape pour la première fois. C'est notre configuration qui est en cause,
et le message accuse la sienne. Une clé de développement Riot expire toutes les
vingt-quatre heures : ce n'est pas un cas de bord, c'est le cas quotidien tant
que la clé de production n'est pas arrivée.

`src/lib/riotStatut.ts` traduit : 403 pour « notre clé est refusée », 404 avec
les mots de la route appelante — une partie absente et un joueur inconnu ne se
corrigent pas pareil —, 429 tel quel, 502 pour tout le reste, parce qu'un 500
laisserait croire que la panne est la nôtre. Et 401 redevient un code à un seul
sens ; le journal distingue désormais « session expirée » de « clé refusée ».

**Et le remaniement a creusé un trou dans le recensement, qui est resté vert.**
`apiErrorsComplets.test.ts` ne lit que `src/app/api` : les six messages sont
sortis de son champ en même temps qu'ils sortaient des routes. Ils seraient
partis en français à tout le monde, exactement le défaut que ce test existe
pour empêcher, et il n'aurait rien dit. Il lit maintenant aussi les modules
déclarés qui écrivent des messages pour des routes, et refuse un producteur
déclaré qui ne rend plus rien — sans quoi la liste vieillit et le test
redevient vert en ne lisant que les routes.

Cinq sabotages, cinq échecs.

### La sauvegarde échouait encore, avec exactement la même ligne d'erreur
Trouvée en lisant le journal d'un travail programmé plutôt que sa pastille —
la même méthode qui a montré, dix minutes plus tôt, que les secrets d'envoi
étaient bien posés. Deux exécutions rouges d'affilée, dont celle de 03h58 ce
matin, sur :

```
pg_dump: error: aborting because of server version mismatch
pg_dump: detail: server version: 18.6 ; pg_dump version: 16.15
```

C'est mot pour mot l'erreur déjà corrigée plus bas. La correction précédente
était pourtant juste : le numéro se demande au serveur (`SHOW
server_version_num` rend 18), et `postgresql-client-18` est bel et bien
installé — le journal le montre.

**Ce n'est pas le paquet, c'est le PATH.** L'image du runner place
`/usr/lib/postgresql/16/bin` devant, donc `pg_dump` reste en 16.15 quoi qu'on
installe. Le répertoire du client demandé passe maintenant en tête par
`$GITHUB_PATH`.

Et surtout : **l'étape imprimait déjà `pg_dump (PostgreSQL) 16.15` sous un
serveur 18, à chaque exécution, depuis le premier jour.** La preuve du défaut
était dans le journal, et le journal ne se lit pas. La ligne compare
maintenant, et sort en erreur quand les deux numéros diffèrent. Un contrôle qui
affiche sans comparer ne contrôle rien : c'est le même défaut que le
`|| true` du contrôle de schéma, sous une autre forme.

À retenir sur le test qui l'accompagnait : `src/sauvegardeVersion.test.ts`
exigeait trois choses, toutes vraies, pendant que la sauvegarde échouait. Un
test peut être entièrement satisfait et complètement à côté — il éprouvait
l'intention (« demander la version au serveur ») et pas le résultat (« l'outil
employé a-t-il cette version »).

Deux sabotages, deux échecs.

**Et une sauvegarde, vraie, vérifiée.** Le travail relancé à la main sur V296
passe toutes ses étapes : export (41 325 octets), restauration dans un
PostgreSQL 18 neuf, comparaison table par table, chiffrement AES256, dépôt de
l'archive pour quatre-vingt-dix jours.

| table | lignes | | table | lignes |
|---|---|---|---|---|
| Account | 4 | | Paiement | 0 |
| BetaApplication | 5 | | PushSubscription | 1 |
| Game | 75 | | RoleWeight | 7 |
| Goal | 4 | | Session | 0 |
| LevelConfig | 5 | | Signalement | 0 |
| LoginAttempt | 18 | | SystemConfig | 2 |
| MasteryConfig | 1 | | User | 4 |
| VerificationToken | 0 | | _prisma_migrations | 33 |

Aucun écart entre la source et la restauration. C'est la première sauvegarde de
ce projet dont on sache qu'elle se restaure.

### Le stockage du navigateur n'était gardé nulle part
`localStorage` n'est pas une propriété qu'on lit : c'est un **accesseur**, et
il lève quand le navigateur est réglé pour bloquer les données de site. Pas
l'écriture — l'accès. Soixante et un appels de l'application le faisaient à nu,
dans dix-neuf fichiers, dont `LoginButtons`, `SessionGuard` et
`OnboardingModal` : une exception y casse l'écran de connexion en entier, pour
quelqu'un qui n'a aucun recours et aucune raison de faire le lien avec un
réglage de son navigateur.

C'est rare — il faut avoir explicitement bloqué les données de site ; la
navigation privée moderne, elle, oublie sans lever. Mais le coût, quand ça
arrive, est total et muet.

`src/lib/stockage.ts` traite le cas une fois : `lire`, `ecrire`, `effacer`,
leurs équivalents de session, et deux variantes JSON. Une valeur absente et un
stockage indisponible s'y traitent pareil — l'application n'a rien à faire de
la distinction, dans les deux cas elle ne sait pas et elle doit continuer.

Trois choses apprises en l'écrivant, toutes par sabotage :

- **Deux de mes gardes ne gardaient rien.** J'avais mis un `try` autour de
  l'accesseur DANS le module, en plus de celui de chaque fonction publique. Le
  retirer laissait la suite verte : le second rattrapait déjà tout. Une ligne
  qui ne fait pas tomber un test quand on l'enlève ne tient rien, et elle se
  relit comme une garantie. Elle est partie ; chacune de celles qui restent
  fait tomber son test.
- **Le garde de rendu serveur, lui, reste sans être prouvé**, et c'est écrit
  dans le commentaire du test : le `catch` rattraperait la `ReferenceError`,
  donc le test ne peut pas les distinguer. Il est là pour ne pas faire du
  chemin normal du serveur une exception levée à chaque rendu, pas pour la
  correction du résultat.
- **Deux suites doublaient `globalThis.localStorage`.** Le module lit
  `window.localStorage` : leur doublure n'était plus lue du tout, et
  `journalSynchro` gardait en prime un `if (typeof localStorage === "undefined")`
  devenu faux. Onze tests sont tombés d'un coup, ce qui est la bonne nouvelle —
  une doublure posée à côté fait éprouver un stockage vide en croyant éprouver
  le sien.

`src/stockageGarde.test.ts` refuse tout accès direct hors du module, et vérifie
que le module, lui, y touche vraiment : sans ce second contrôle, le motif
pourrait disparaître partout, y compris là où il doit être, et le test
resterait vert en ne gardant plus rien.

### Une partie que rien n'avait pu lire disparaissait sans un mot
La correction de l'issue illisible s'arrêtait un cran trop bas.
`PartieDetectee` commence par :

```ts
if (!score) return;
```

Ne rien écrire est le bon choix — inventer une partie à zéro partout serait
pire. Se taire ne l'est pas : la partie a été jouée, elle n'entre pas, et
personne ne l'apprend. C'est mot pour mot le défaut corrigé trois lignes plus
bas pour l'issue.

Et le cas est atteignable, ce que j'ai vérifié avant d'y toucher : la boucle
passe « en partie » dès sa première lecture réussie, et `fusionnerReleve` ne
garde un relevé que s'il porte un score. Un joueur que l'API locale ne sait pas
identifier dans sa propre partie sort donc de la boucle avec `partie: null`.

Deux clés de plus dans les six langues, distinctes de l'issue illisible : les
deux cas ne se ressemblent pas. Pour l'issue, on a les chiffres et on les
donne ; ici on n'a rien, et le message ne peut que demander de saisir la
partie. Réemployer le même texte aurait produit une phrase commençant par un
point, ce qui est le signe qu'on force deux cas dans un moule.

Le pont Electron simulé d'`e2e/detection-partie.spec.ts` a un septième cas.

### Le middleware comparait les chemins par lettres, comme le desktop
Même défaut que les cinq comparaisons d'origine corrigées dans `desktop/`, un
étage plus haut : `PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))`.
`/beta` couvre alors `/betamachin`, `/api/sante` couvre `/api/santeprivee`, et
`/obs` couvre `/obsolete`.

Rien de tel n'existe aujourd'hui, et c'est exactement ce qui rend la faute
gênante : elle est invisible, et elle ne dépend que du nom qu'on donnera à la
prochaine route. `/api/beta` couvrait `/api/beta-access` — ce qui était voulu,
mais par coïncidence de nommage plutôt que par décision ; la route est nommée
en entier maintenant.

La comparaison se fait par segments. Un préfixe terminé par `/` ne couvre que
ses enfants, ce qui distingue `/api/obs/<jeton>`, lu par un logiciel de
diffusion sans cookie, de `/api/obs`, qui rend et régénère le jeton et exige
une session — la distinction existait déjà, portée par un espoir sur
`startsWith`.

**Et la liste a déménagé.** Elle vivait dans `middleware.ts` ;
`src/porteRoutes.test.ts` la relisait au texte et réimplémentait la
comparaison de son côté. Deux exemplaires d'une règle finissent toujours par
diverger, et c'est précisément la divergence entre ces deux listes qui avait
laissé quatre routes dispensées de session partir en 307 vers `/login` pendant
des semaines. `src/lib/routesPubliques.ts` porte la liste ET la règle ; le test
l'importe, donc il éprouve ce qui tourne.

Quatre sabotages, quatre échecs : la comparaison par lettres remise,
`/api/obs` ouvert en entier, un préfixe qui rend tout public, et la route de
diffusion retirée de la liste — attrapée par le test de la porte, pas par
celui de la règle.

Et vérifié qu'il ne change rien à ce qui existe : les deux règles, l'ancienne
et la nouvelle, ont été passées sur **les soixante-six chemins réels** du
dossier `src/app` (pages et routes, segments dynamiques remplacés). Aucune
bascule, dans aucun sens. Le resserrement ne ferme la porte qu'à des noms qui
n'existent pas encore, ce qui est exactement le propos.

Vérifié sur le serveur, parce qu'une porte se pousse : `/dashboard`,
`/settings`, `/history`, `/api/games`, `/api/user` **et `/api/obs`** répondent
307 vers `/login` ; les dix pages publiques répondent 200 ; `/api/obs/<jeton>`,
`/api/sante`, `/api/champions` et `/api/exercices/ratios` atteignent leur
handler. Et les trois adresses qui passaient par coïncidence de lettres —
`/betamachin`, `/api/santeprivee`, `/obsolete` — sont maintenant redirigées.

### Le paiement qui perd la course annonçait une dette déjà payée
Deux renvois du même paiement partis en même temps passent tous les deux le
contrôle de jeton : c'est l'unicité en base qui tranche, et le perdant reçoit
un 200 plutôt qu'une erreur, sinon la file hors ligne réessaierait
indéfiniment sur un paiement pourtant enregistré. Ça, c'était juste.

Ce qui ne l'était pas : la réponse rendait le compte lu au **début** de la
requête, donc la dette d'AVANT le paiement jumeau. L'écran annonçait donc une
dette qu'on venait de solder, ce qui est précisément ce que la file hors ligne
existe pour éviter : celui qui vient de faire sa séance la voit intacte et la
refait.

La dette se relit maintenant sur cette branche. Le test qui couvrait déjà le
croisement ne pouvait pas l'attraper : sa doublure rendait la même valeur des
deux côtés, donc l'assertion passait quelle que soit la source. Un test qui ne
distingue pas les deux réponses possibles n'éprouve pas le choix entre elles.

### Deux amorçages simultanés se heurtaient sur une clé primaire
`seedDefaults` est gardé par une promesse mémorisée au niveau du module, ce
qui suffit pour un processus. Sur une base neuve, plusieurs requêtes arrivent
ensemble : un démarrage à froid en sert souvent une poignée d'un coup, et
chaque instance a sa propre mémoire. Les trois comptages rendaient alors zéro
partout, les trois semis partaient en même temps, et le second tombait sur une
violation de clé primaire — `role` et `niveau` sont des identifiants, pas des
colonnes ordinaires.

Le prix se paie au pire moment : une erreur 500 au premier chargement d'un
environnement qu'on vient de monter, là où l'on ne sait pas encore ce qui est
censé marcher. C'est la même famille que « sur une base neuve, la première
partie enregistrée tombait », plus bas : le chemin de la base vide est celui
qu'on n'emprunte jamais, sauf le jour d'une reprise après sinistre.

`skipDuplicates` fait de la course une non-affaire. L'identifiant de la
maîtrise s'écrit maintenant en clair : `createMany` ne peut ignorer un doublon
que s'il sait sur quoi porte l'unicité.

Trois sabotages, trois échecs — dont l'oubli de l'échec mémorisé, qui n'avait
pas de test et qui condamnerait le processus entier à ne plus jamais semer
après une coupure passagère.

### Le pseudo du bilan hebdomadaire était échappé deux fois
Trouvé en relisant `src/lib/email.ts`, qui n'avait aucun test à lui. Le pseudo
était échappé, puis le titre qui le porte l'était à son tour :

```ts
const nom = echapper(pseudo);
… ${echapper(t.titre(nom))}
```

« A & B » devenait donc « A &amp;amp; B », c'est-à-dire « A &amp; B » à l'écran.
Le jeu de caractères autorisé pour un pseudo — lettres, chiffres, espace,
`_ . -` — n'en contient aucun aujourd'hui, ce qui rendait le défaut invisible.
C'est précisément ce qui le rendait gênant : le commentaire au-dessus
d'`echapper` dit que la fonction existe « pour le jour où un autre chemin
d'écriture oubliera la règle », et ce jour-là elle aurait affiché de la
ferraille au lieu du pseudo. Un filet qu'on ne peut pas éprouver parce que rien
ne l'atteint doit au moins être juste.

`src/lib/email.test.ts` couvre les deux courriels, avec le vrai dictionnaire
plutôt qu'une doublure — une doublure de dictionnaire dérive du jour où une clé
s'ajoute. Un piège à noter : `Resend` s'instancie au chargement du module à
partir de la variable d'environnement, donc la clé doit être posée **avant**
l'import, sinon les deux fonctions rendent la main sans rien envoyer et tous
les tests passent en ne mesurant rien.

Trois sabotages, trois échecs : le double échappement remis, l'échappement du
bilan retiré, celui du lien de récupération retiré.

### Une dette pouvait naître sans jamais pouvoir être en retard
Le pendant du retrait de dette corrigé plus haut, dans l'autre sens. Le montant
s'incrémentait bien de façon atomique — c'est la date de début qui était
décidée d'après une lecture faite juste avant :

```ts
...((avant?.dettePointsDus ?? 0) <= 0 ? { detteDepuis: new Date() } : {}),
```

Entre cette lecture et l'écriture, un paiement peut éteindre la dette et
effacer sa date. La condition lit alors « la dette était positive », donc ne
pose pas de date, et on écrit une **dette positive sans date de début**.
`etatRetard` rend « pas en retard » dès que la date manque, quel que soit le
montant : la dette existe, elle se paie, elle s'affiche, et elle ne devient
jamais en retard. L'état ne se répare qu'une fois la dette soldée puis
recréée, ce qui peut ne jamais arriver.

La condition est posée à la base maintenant, par un `updateMany` conditionnel —
`update` ne prend qu'un identifiant unique, c'est le seul moyen de poser une
condition sur autre chose que la clé. Écrit ainsi, il rattrape aussi les
comptes déjà dans cet état, sans reprise de données.

Son échec ne coûte que lui-même : le décompte est déjà écrit, et la
notification de seuil qui suit ne doit pas se perdre parce qu'une date n'a pas
pu se poser. Trois sabotages, trois échecs — dont celui-là, qui est passé au
rouge parce que le doublure de base ne connaissait pas encore `updateMany` :
la première version de la correction faisait perdre la notification, et le
test l'a dit avant moi.

### Le jeton de la source OBS partait à chaque chargement de page
`comptePublic` retire l'empreinte du mot de passe et rend le reste par
diffusion. Son commentaire annonçait « le seul endroit qui décide de ce qui
part » : c'était une liste de refus d'un seul nom, donc elle ne décidait rien —
toute colonne ajoutée au compte sortait par défaut, sans que personne n'ait eu
à en juger.

`jetonObs` est arrivé ainsi. C'est un laissez-passer : l'adresse `/obs/<jeton>`
montre la dette en direct **sans session**, et régénérer le jeton est la seule
façon de révoquer un lien déjà collé dans un logiciel de diffusion. Il partait
dans la réponse de `/api/user`, que la navigation lit à **chaque chargement de
page** — donc dans le cache du navigateur, dans l'onglet réseau des outils de
développement, et à l'écran de quiconque regarde une diffusion pendant qu'ils
sont ouverts. Sur un produit dont la fonction est de s'afficher en direct, ce
n'est pas une hypothèse d'école. Aucun écran ne le lisait : il se demande par
`/api/obs`, qui existe pour ça.

`sessionEpoch` est parti avec, pour une autre raison : ce n'est pas un secret,
c'est de la mécanique interne que le navigateur ne lit nulle part. Un compte
public qui publie les rouages invite à construire dessus.

La liste reste une liste de refus — énumérer les quarante colonnes que les
réglages affichent ferait diverger les deux listes à la première ajoutée. Ce
qui manquait, c'est le recensement : `src/lib/compte.test.ts` lit le modèle
`User` du schéma et exige que **chaque colonne** soit rangée d'un côté ou de
l'autre, les refus portant leur raison. C'est le motif de `porteRoutes.test.ts`
appliqué aux colonnes — regarder la source plutôt que la liste qu'on tient à la
main. Il compte aussi les colonnes lues : un modèle renommé rendrait le test
vert sur zéro colonne, ce qui est exactement la forme d'erreur qu'on corrige.

Trois sabotages, trois échecs : `jetonObs` remis dans ce qui sort, une colonne
nouvelle ajoutée au schéma sans classement, une classification qui ne désigne
plus rien.

**Et le test a trouvé une troisième colonne pendant que je l'écrivais** :
`sessionEpoch`, que j'avais rangée dans les refus sans vérifier qu'elle en
sortait. Elle n'en sortait pas.

### Le retrait de dette n'avait pas de test à lui
Il est éprouvé par les routes qui l'appellent, ce qui ne dit rien de ce qui
fait sa raison d'être : la **forme** de la requête. `decrement` et une
soustraction rendent le même chiffre tant que personne d'autre n'écrit — c'est
seulement quand une partie s'enregistre pendant le paiement que les deux
divergent, et ce cas ne se joue pas dans un test de route. `src/lib/dette.test.ts`
regarde donc les écritures envoyées à la base, pas le nombre rendu.

Trois sabotages, trois échecs : le décrément remplacé par une écriture en
valeur absolue, la date de début qui survit à une dette soldée, et une dette
négative rendue telle quelle à l'écran.

### `onError` sur une image ne suffit pas
Le bilan de saison montre une image dessinée au serveur. Quand elle ne se
dessine pas, la page affichait l'icône de fichier cassé du navigateur, et le
bouton « ouvrir l'image » emmenait sur une page d'erreur brute. Or ce qui a
échoué n'est pas le bilan : les chiffres sont là, juste à côté. C'est la seule
phrase qui compte.

Le repli a d'abord été posé sur `onError`, et **il ne se déclenchait jamais** —
trouvé par le test, pas par la relecture. L'image part avec le HTML et peut
échouer AVANT l'hydratation ; React n'attache son écouteur qu'après, et
l'erreur passe alors sans témoin. C'est la même famille que le script attrapé
dans le `layout` pour `beforeinstallprompt` : un événement qui ne se répète pas
et qui tombe avant que le paquet JavaScript ne s'exécute.

Une image déjà terminée le dit : `complete` vaut vrai et `naturalWidth` vaut
zéro. On regarde donc à la première occasion, **en plus** d'écouter. Sabotage
fait, le contrôle après montage retiré : le test tombe.

Le bouton disparaît avec l'image, parce qu'il ouvrirait la même erreur, en
pleine page cette fois.

`ChampionIcon` avait exactement le même repli sur `onError` seul, et l'a reçu
aussi : les icônes viennent d'un domaine tiers, une coupure chez eux laissait
un carré vide sans rien pour dire de quel champion il s'agissait. **Mais le
test qui l'accompagne ne prouve que la moitié** : une interception réseau tombe
forcément après l'hydratation, donc le repli ordinaire est éprouvé et le cas
d'avant hydratation ne l'est pas. Sabotage fait, le contrôle au montage retiré :
le test passe quand même. Il est gardé pour ce qu'il couvre — rien ne couvrait
ce repli — et le commentaire dit ce qu'il ne couvre pas. Un test dont on croit
qu'il prouve autre chose que ce qu'il prouve est pire qu'aucun test.

Et, une fois de plus : la modale de consentement santé recouvrait la page.
Septième fichier de parcours à tomber dessus.

### Décocher un jeu en pleine partie laissait la pastille à l'écran
Troisième boucle sans test, et celle-ci cachait un vrai défaut : quand la liste
des jeux surveillés se vide, l'état interne était remis à zéro **sans rien
signaler**. Personne n'apprenait que le jeu s'était arrêté. La pastille restait
donc à l'écran, par-dessus le jeu, jusqu'à ce qu'on recoche la case puis referme
le jeu pour de bon.

Ce n'est pas un cas tordu : décocher un jeu pendant qu'on y joue est exactement
ce qu'on fait quand la pastille gêne.

Elle repart maintenant en annonçant l'arrêt de ce qui tournait. Trois sabotages,
trois échecs — dont le chevauchement, **vingt-trois requêtes en vol** sans
verrou, et la comparaison de noms d'exécutables qui doit rester insensible à la
casse et accepter les deux binaires d'Apex.

Les trois boucles de détection ont désormais le même verrou et le même mode
d'injection. Ce n'est pas une coïncidence : elles ont toutes été écrites sur le
même modèle, donc elles portaient toutes le même défaut.

### La surveillance du lanceur non plus
Même traitement, et le même défaut d'empilement : un tour y fait jusqu'à trois
requêtes de trois secondes d'expiration, sur une période de quatre. **Vingt-
quatre requêtes en vol** sans verrou. C'est la boucle qui porte la seconde
source d'issue, celle qui existe précisément pour que les victoires cessent
d'être enregistrées en défaites : la laisser sans test n'était plus tenable.

Un des trois sabotages est passé au vert, et c'est la trouvaille : mon test
« retente au tour suivant » **comptait** les publications sans regarder ce
qu'elles disaient. Avec le garde retiré, un « inconnu » partait au premier
tour, `issueLue` passait à vrai, et le compte restait à un. Il vérifie
maintenant le contenu. Sabotage refait : il tombe.

C'est la deuxième fois cette nuit qu'un test compte au lieu de regarder — la
première, c'était l'historique du remake, où le champion sert désormais de
signature. Un total inchangé peut cacher une chose écrite et une autre perdue.

### La boucle qui détecte les parties n'avait aucun test
Elle ne s'éprouvait qu'en lançant League, c'est-à-dire jamais ici. Le lecteur
et la période s'injectent maintenant (`options.lire`, `options.periodeMs`), avec
les valeurs de production par défaut : aucun appelant n'a changé, et la boucle
se joue en quarante millisecondes.

Ce que ça a immédiatement trouvé : **le passage de cinq à deux secondes que je
venais de faire créait un chevauchement**. Le délai d'expiration d'une requête
est de trois secondes ; sans verrou, un client qui répond lentement fait
s'empiler les tours, et l'ordre des relevés n'est plus garanti — c'est-à-dire
que le dernier relevé gardé peut ne pas être le dernier vu. Le test le mesure :
**vingt-neuf requêtes en vol** sans le verrou, une seule avec.

Trois sabotages, et le troisième a appris autre chose : retirer le
`clearInterval` de l'arrêt ne fait pas tomber le test, il fait **pendre jest**.
L'assertion échoue bien, mais le minuteur reste ouvert et le processus ne rend
jamais la main. Un test qui prouve son point en pendant est un mauvais signal
en intégration continue : ici il ne pend que sous sabotage, et c'est acceptable,
mais il valait mieux le savoir que de le découvrir un matin sur une branche.

### Le lanceur pouvait répondre avant qu'on ait posé la question
Relecture de la correction de la nuit, comme on relit le travail d'un autre.
`attenteIssue` retient une fin de partie sans issue, le temps que le lanceur
publie son écran de fin. C'est le cas courant : l'API de partie se tait quand
le jeu se ferme, le lanceur bascule peu après.

Rien ne garantit cet ordre. Si le lanceur bascule pendant que le jeu s'attarde,
l'issue arrivait **sans partie à compléter** et se perdait pour de bon : la
partie repartait ensuite sans résultat, donc n'était pas enregistrée, et la
notification annonçait une lecture impossible alors que la réponse était
arrivée trente secondes plus tôt.

Une issue reçue sans rien qui attende est donc gardée une minute. Trois règles,
trois tests, trois sabotages :
- elle s'applique à la première fin de partie qui suit ;
- elle est **consommée** : la resservir prêterait à la partie suivante un
  résultat qui n'est pas le sien, c'est-à-dire le même défaut à l'envers ;
- elle se périme : une réponse d'il y a dix minutes ne parle pas de la partie
  qui vient de finir.

### L'application de bureau parlait français à tout le monde
Le site a six langues et des tests qui les tiennent. La coquille Electron, elle,
n'en avait qu'une, et rien ne le signalait : trente-sept textes écrits en dur en
français, dans les endroits qu'on remarque le moins et qui comptent le plus.

- **La pastille en jeu.** C'est la surface la plus vue de l'application : elle
  est à l'écran pendant qu'on joue. « Si gagné », « Si perdu », « joué ce soir,
  hors menus » y étaient figés.
- **Le menu près de l'horloge.** Le seul écran qui subsiste quand la fenêtre est
  fermée.
- **Les trois écrans de connexion** (`data:text/html`), y compris
  `<html lang="fr">` — la page se déclarait française quoi qu'il arrive.
- **Deux notifications système** et le titre de la fenêtre d'authentification.

`desktop/src/langue.js` choisit parmi les six, `desktop/src/textes.js` les
porte. La langue vient du stockage de la fenêtre (`low_locale`), relue à chaque
page rendue — les écrans de secours sont des pages `data:` sans stockage à
elles, mais la dernière page vue était la nôtre. À défaut, la langue du
système ; à défaut encore, **l'anglais**. Jamais le français : c'est la langue
de celui qui écrit l'application, en faire le repli revient à ne jamais voir le
défaut.

Trois choses apprises en le faisant :

- **Un commentaire qui promet ce que le code ne fait pas.** J'avais écrit que
  la langue du menu était « passée en fonction, donc elle peut changer sans
  redémarrage », alors que `textes()` était appelée une seule fois à
  l'ouverture. Elle l'est maintenant à chaque construction du menu, et
  `initTray` rend `{ arreter, rafraichir }` — l'icône est posée au démarrage,
  avant que la fenêtre ait chargé la moindre page, donc avant qu'on sache quoi
  que ce soit de la langue.
- **Les mots avant l'état.** La pastille reçoit ses textes sur un canal à part,
  poussé avant le premier état : dans l'autre ordre, elle se peint une fois
  avec ses valeurs par défaut puis se réécrit sous les yeux du joueur.
- **Le HTML garde le français comme repli.** Si le canal ne dit jamais rien, la
  pastille reste lisible. Un repli vide serait pire que la mauvaise langue.

**Et le test qui manquait, trouvé par accident.** Une restauration maladroite a
effacé les dix clés de la pastille des six langues — et toute la suite est
restée verte. Le test de clés mortes refuse une clé *déclarée que personne
n'emploie* ; il ne dit rien d'une clé *employée que personne ne déclare*. Or
c'est celle-là qui se voit : « undefined » écrit en travers de la pastille,
pendant une partie. Le contrôle manquant lit maintenant les `T.xxx`, les
`data-texte` et les `textes(...).xxx` de tout le dossier, HTML compris, et
exige que chacun existe. Sabotage refait sur le cas exact : il tombe.

Six sabotages au total, six échecs : `lang="fr"` de retour, un libellé de menu
réécrit en dur, un écran appelé sans langue, une clé manquante en allemand, une
valeur vide, une clé employée sans être déclarée.

### La seule porte de secours promettait un courriel qui ne partait pas
`sendResetLink` commence par `if (!resend) return;` — sans clé configurée,
elle rend la main sans rien envoyer. La route, elle, répondait `{ ok: true }`
dans tous les cas, pour la bonne raison qu'une réponse différente permettrait
d'énumérer les comptes.

Résultat : sur un déploiement où la variable manque, quelqu'un qui a perdu son
code demande un lien, lit « c'est envoyé », et attend indéfiniment. C'est la
**seule** façon de rentrer, et l'attente ressemble exactement à un courriel en
retard.

Le dire ne casse pas la réponse générique : « le courriel n'est pas configuré »
est une propriété du déploiement, pas de l'adresse saisie. Le contrôle passe
donc avant toute lecture en base **et** avant le décompte des tentatives — une
variable oubliée n'a pas à consommer le budget de quelqu'un. Deux tests, deux
sabotages : le contrôle retiré, puis le contrôle déplacé après le décompte.

Un piège au passage, qui vaut pour toutes les doublures de module :
`jest.mock("@/lib/email", …)` **remplace le module entier**. La fonction
ajoutée n'y figurait pas, donc l'appel rendait `undefined`, donc la route
tombait en 500 — et six tests sans rapport se sont mis à échouer d'un coup.

### Les deux corrections de réglages, éprouvées au navigateur
Un message d'erreur qu'on ajoute se vérifie en le faisant paraître, pas en le
relisant. Deux tests, deux sabotages, et trois pièges rencontrés en les
écrivant — dont deux déjà écrits ici, et un nouveau.

- **Le consentement refusé** (`e2e/panne-serveur.spec.ts`) : le `POST` est
  détourné en 500, le message doit paraître ET la fenêtre rester ouverte. Sans
  le second contrôle, un écran qui se ferme sur un échec passerait.
- **Le réglage de jeu refusé** (`e2e/reglages.spec.ts`) : pont Electron simulé,
  `overlayJeuEcrire` qui rejette. Le message doit paraître ET le bouton
  revenir à `aria-pressed="true"`. Sans le second contrôle, un message affiché
  sous un réglage faux passerait, c'est-à-dire exactement l'état d'avant.

Les pièges :
- **`getByRole("alert")` ne prouve rien tout seul.** Le premier sabotage est
  passé au vert : d'autres éléments de la page portent ce rôle. C'est le texte
  qu'il faut chercher, dans un élément qui l'annonce.
- **Un nom accessible contient celui de ses enfants.** L'en-tête dépliable du
  jeu s'appelle « League of Legends Pastille affichée », parce que le libellé
  d'état est dedans. `.first()` renvoyait donc l'en-tête, qui ne porte pas
  `aria-pressed`. Les noms se cherchent ancrés.
- **Le pont simulé doit porter tout ce que la rubrique lit.** Il en manquait
  cinq méthodes : la rubrique ne se rendait pas du tout, le bouton cherché
  n'existait pas, et l'échec ne ressemblait pas à sa cause.
- Et, une fois de plus : **`-g` écarte le test qui ouvre le compte**, donc la
  page mesurée était `/login`. C'est écrit plus haut depuis les tests de
  langue ; ça se retombe dedans.

### Deux écrans de plus qui affichaient ce qui n'avait pas été enregistré
Même défaut que « Ton effort », trouvé en relisant tous les `catch` de
l'interface. Chacun portait sa raison écrite, ce qui est la bonne discipline —
mais deux de ces raisons étaient fausses.

**« Tes jeux ».** Le commentaire annonçait « l'état précédent reste affiché ».
C'était l'inverse : la nouvelle valeur était posée AVANT l'appel, donc c'est
elle qui restait. L'écran montrait un réglage que l'application n'avait pas, et
on s'en apercevait au rechargement suivant sans savoir pourquoi. Retour en
arrière et message, comme ailleurs.

**Le consentement santé.** Un échec d'envoi ne disait rien du tout. Or cette
fenêtre-là ne se ferme pas : la personne clique « J'accepte », le bouton
redevient cliquable, rien ne bouge, et il n'y a aucun autre chemin. Un échec
muet y enferme dans l'application. La question reste posée, mais elle dit
maintenant pourquoi.

Ce que ça apprend sur les commentaires : un `catch` qui décrit ce qu'il fait
est une bonne chose, et une mauvaise dès qu'il décrit ce qu'il ne fait pas. Il
se relit alors comme une garantie, et on cesse de vérifier.

### Cinq comparaisons d'origine par préfixe, dans l'application de bureau
Trouvé en relisant `desktop/`, qui a reçu bien moins d'attention que `src/`.
Cinq endroits demandaient « est-ce bien chez nous ? » ainsi :

```js
url.startsWith(BACKEND_URL)
```

C'est faux, et d'une façon qui ne se voit pas à la lecture :
`"https://winorworkout.com.exemple-mechant.tld/".startsWith("https://winorworkout.com")`
vaut **vrai**. Un domaine qui suffixe le nôtre passait donc pour le nôtre —
dans la fenêtre sans barre d'adresse ni bouton retour, devant le gestionnaire
de fenêtres surgissantes, et devant le filtre de permissions qui accorde les
notifications.

Ce n'est pas exploitable seul : il faut d'abord que l'application navigue vers
une adresse choisie par un tiers. Mais ces cinq lignes sont écrites POUR être
cette frontière, et une frontière qui ne tient que si personne n'essaie n'en
est pas une.

`desktop/src/origine.js` compare les origines entières — protocole, hôte, port
— et refuse ce qui n'a pas d'origine comparable (`about:`, `javascript:`). Au
passage, `startsWith("/api")` acceptait aussi `/apiculture` : les chemins se
comparent par segments.

Un garde structurel refuse le retour du motif dans `desktop/src`, avec un
contrôle de non-vacuité — sans lui, un dossier renommé rendrait le test vert
sur zéro fichier lu. Sabotage fait : une comparaison remise, le test tombe.

### Le script de mesure d'audience n'a jamais été chargé
Trouvé en regardant la console du navigateur pendant le test ci-dessus :
`/_vercel/insights/script.js` partait en 307 vers `/login` comme une page
protégée, et le navigateur refusait alors de l'exécuter (« MIME type text/html
is not executable »). Le matcher du middleware excluait `_next/static` mais pas
`_vercel/`.

Rien ne pouvait le signaler : une page de connexion rendue en 200 ressemble, du
point de vue du serveur, à un script qui s'est bien chargé. Seul le navigateur
sait qu'il a refusé de l'exécuter.

### La correction éprouvée dans un navigateur, pont Electron simulé
Les tests unitaires disent ce que les deux lectures rendent. Ils ne disent rien
de l'assemblage : que le composant appelle bien la route quand l'issue est
lue, qu'il n'appelle rien quand elle ne l'est pas, et qu'il le dise. Un
branchement se vérifie en marchant dessus.

`e2e/detection-partie.spec.ts` pose un faux `window.electronLOL` par
`addInitScript` — ce qui est aussi l'ordre réel, le préchargement passant avant
le rendu — puis déclenche trois fins de partie : une victoire lue, une issue
illisible, un remake. Il regarde ce qui est écrit en base ET ce qui est dit à
l'écran : sans le second, une partie qui disparaît en silence passerait le
test.

Le champion sert de signature. Compter ne suffit pas : un total inchangé peut
cacher une partie écrite et une autre perdue.

Trois sabotages, trois échecs. Et une leçon sur l'outil : **en mode série,
Playwright saute ce qui suit un échec**. Le premier sabotage a fait tomber le
troisième test, donc le quatrième n'a jamais tourné — et j'ai d'abord conclu
qu'il ne mordait pas. Un test « passé » et un test « sauté » se ressemblent
dans un résumé ; il faut lire le compte, pas la couleur. Chaque branche a donc
été sabotée séparément.

Trois pièges rencontrés en l'écrivant, dont deux nouveaux :
- **Un serveur qui sert un `.next` reconstruit sous lui.** Le bouton
  d'inscription restait désactivé, la capture montrait pourtant le champ
  rempli. Sans hydratation, la page garde l'état rendu au serveur — et
  l'hydratation ne se faisait pas parce qu'un fragment JavaScript répondait
  500. C'est le pendant du piège déjà écrit (« ne jamais reconstruire pendant
  qu'un test tourne ») : il faut aussi relancer le serveur APRÈS avoir
  reconstruit.
- **Sonder dans la mauvaise langue.** Le script de diagnostic ouvrait la page
  sans fixer la locale, donc en anglais : `getByPlaceholder(/pseudo/i)` ne
  trouvait rien et j'ai cru la page cassée. La configuration Playwright fixe
  `fr-FR` ; un outil de diagnostic écrit à côté ne l'a pas.
- **La modale de consentement santé**, sixième fichier de parcours à tomber
  dessus. `e2e/compte.ts` porte l'ouverture de compte de ce fichier,
  consentement compris.

Ce que je m'étais raconté, et qui était faux : j'ai d'abord attribué le bouton
désactivé à une saisie arrivée avant l'hydratation, et écrit une reprise de
saisie pour ça. Elle n'a rien changé — normal, il n'y avait aucun JavaScript
du tout. Les huit autres fichiers de parcours n'ont donc PAS été convertis :
la duplication est réelle, mais le défaut qui aurait justifié d'y toucher
n'existait pas. Un remaniement de huit fichiers qui passent, sur une raison
qu'on n'a pas vérifiée, se paie plus cher qu'il ne rapporte.

### L'autre moitié du défaut : la détection locale inventait la défaite
Suite de « Une victoire sur trois s'enregistrait en défaite », plus bas : la
route corrigée n'était que la moitié du chemin. Sans clé Riot de production,
c'est la détection locale qui enregistre les parties, et elle portait le même
défaut, écrit en toutes lettres :

```ts
result: resultat ?? "D",   // « sans événement de fin lisible, on retient la défaite »
```

Cette lecture est une **course** : l'API de partie (port 2999) ne
publie l'événement `GameEnd` que dans les dernières secondes, puis se tait dès
l'écran de fin. Elle était interrogée toutes les cinq secondes. Quand aucun
relevé ne tombait dans cette fenêtre, l'issue manquait — et toutes les courses
perdues tombaient du même côté. Une défaite prise pour une défaite ne se voit
pas ; une victoire prise pour une défaite fait payer une dette qu'on ne doit
pas, sans rien qui l'explique.

Quatre corrections, de la plus profonde à la plus visible :

- **L'issue ne s'invente plus.** Sans lecture, la partie n'est pas enregistrée
  et une notification le dit. Ne rien écrire vaut mieux qu'écrire faux : c'est
  la règle déjà posée pour les saisies aberrantes (« ne pas rattraper une
  saisie fausse »), appliquée à une lecture au lieu d'une frappe.
- **Une issue lue ne se reperd plus.** `dernier = releve` écrasait le relevé
  précédent en entier : un seul relevé sans l'événement suffisait à effacer la
  lecture d'avant. `fusionnerReleve` garde l'issue une fois vue.
- **Deux secondes au lieu de cinq**, ce qui divise la fenêtre manquée par deux
  et demi pour une requête locale qui ne coûte rien.
- **Une seconde source.** Le lanceur publie son écran de fin
  (`/lol-end-of-game/v1/eog-stats-block`) quelques secondes APRÈS que l'API de
  partie s'est tue. `attenteIssue` retient donc trente secondes une fin de
  partie sans issue, le temps qu'il parle.

`issueLocale.js` porte les deux lectures. Elle ne conclut sur l'écran de fin que
si ses deux sources s'accordent (`teams[].isWinningTeam` et `localPlayer.stats.WIN`) :
cette API n'est pas documentée, sa forme change d'une version à l'autre, et deux
sources qui se contredisent sont un signe que la forme a bougé, pas une occasion
de choisir la plus flatteuse. Un remake est lu comme un remake, en premier —
les deux sources s'accordent dessus, donc le contrôle de désaccord ne le
verrait jamais.

Deux pièges qui ont chacun leur test :
- **`Boolean("0")` vaut vrai.** Le lanceur écrit ses drapeaux tantôt en
  booléen, tantôt en 0/1, tantôt en `"0"`. Une conversion à la légère faisait
  passer une défaite pour une victoire.
- **Une attente qui n'échoit pas perd la partie pour de bon.** `attenteIssue`
  garantit deux choses et rien d'autre : la partie part toujours, et jamais
  deux fois. Le contexte de file et de rôle est joint au moment de la fin, pas
  au moment de l'envoi : trente secondes plus tard, une sélection de champion
  entamée entre-temps rattacherait la partie au rôle de la suivante.

Sept sabotages, sept échecs — dont « tout ce qui n'est pas Win redevient une
défaite », qui est exactement le défaut d'origine.

Ce qui n'a **pas** été fait, et pourquoi : les parties déjà enregistrées à tort
en défaites ne sont pas corrigées. Les reprendre demande de décider ce qu'on
fait de la dette déjà payée dessus, et ça ne se décide pas seul.

### Les réglages affichaient ce que le serveur n'avait pas gardé
Les cinq réglages de « Ton effort » — exercices, variante de pompes, bilan
hebdomadaire, plafond quotidien, seuil du compteur — posaient la nouvelle
valeur à l'écran **avant** de l'envoyer, et ne faisaient rien du refus. L'écran
montrait donc un réglage que le serveur n'avait pas ; on s'en apercevait au
rechargement suivant, sans savoir pourquoi. Sur cette page-là, ça compte : un
exercice ou un plafond mal enregistré change ce qu'on doit.

Le `fetch` n'était pas protégé non plus. Sans réseau, la promesse partait en
erreur, `setSavingExo(false)` n'était jamais atteint, et « Enregistrement… »
restait à l'écran pour toujours.

Un seul assistant (`enregistrerReglage`) porte les trois choses qui manquaient :
le `try/catch`, le message d'échec, et le retour à la valeur d'avant. Ce
dernier n'est pas un ornement — sans lui, le message d'erreur et ce qu'on voit
se contredisent.

Le message réemploie `erreurSauvegarde`, déjà traduit dans les six langues :
une clé de plus pour dire la même chose n'aurait rien ajouté.

Le **test de force** est passé par le même chemin, et c'était le plus urgent :
il ne disait rien de son échec, alors que c'est lui qui fixe le niveau, donc
toute la dette. Et l'enregistrement du profil a gagné son `try` : sans lui,
une coupure réseau laissait « Enregistrement… » à l'écran pour toujours,
puisque la ligne qui l'efface n'était jamais atteinte.

`e2e/reglages.spec.ts` détourne le `PUT` en 500, coche la boxe, et vérifie
trois choses : le message paraît, et le serveur n'a rien retenu. Sabotage fait,
le retour en arrière retiré : le test tombe.

Deux pièges retrouvés en l'écrivant, tous deux déjà écrits ici :
- **la modale de consentement santé** recouvre la page et rien ne se clique
  derrière. C'est le quatrième fichier de parcours qui tombe dessus ; il la
  traverse maintenant par l'API à l'ouverture du compte ;
- **la rubrique repliée** : `?rubrique=effort` ne suffit pas à faire paraître
  la liste des exercices, il faut ouvrir « Ton effort ». Le parcours complet le
  savait déjà.

Et une fausse piste, écartée en la mesurant : le premier échec touchait le test
des jeux, pas le mien. Rejoué sans la modification, il passait ; rejoué avec,
sur une base déjà chaude, il passait aussi. C'était un premier appel sur une
base fraîchement montée, pas une régression — la même famille que V246.

### « Config manquante » pour une faute de casse
Trouvé en montant le compte d'audit des scripts de mesure : l'enregistrement
d'une partie rendait **500 « Config manquante »** alors que la base était
parfaitement semée — sept pondérations de rôle, cinq paliers, une maîtrise,
vérifiés à la main.

La cause : `ponderations.find((r) => r.role === body.role)`. J'envoyais
« MID » ; la table contient « Mid ». Un rôle introuvable et une configuration
absente tombaient dans le même message, et il accusait le mauvais coupable —
il m'a fait douter de la base et vérifier son contenu avant de comprendre.

Les deux cas se distinguent maintenant, et c'est la règle de toute la nuit :
**ce qui manque de notre côté est un 500, ce qu'on nous a mal donné est un 400
qui le dit.** « Rôle inconnu », traduit dans les six langues.

Le test avait son propre piège : le double de `RoleWeight` dans le fichier de
test ne connaît que « MID », donc c'est « Mid » qui y joue le rôle inconnu. Un
test écrit sans regarder son double aurait éprouvé le contraire de ce qu'il
annonce.

### Ce qui restait muet quand le serveur refusait
Recensement des `if (res.ok)` sans branche d'échec, à la suite des corrections
précédentes. Trois trouvailles, et deux fausses pistes qu'il valait mieux
vérifier que « corriger ».

- **Les trois commandes du panneau d'administration** — réinitialiser un mot de
  passe, refaire jouer l'intro, supprimer un compte — n'avaient ni `try` ni
  branche d'échec. Un refus ne produisait rien, on recliquait sans savoir ; et
  sans réseau l'indicateur d'attente ne s'effaçait jamais. Un seul assistant
  (`commande`) porte les trois choses qui manquaient.
- **L'enregistrement automatique d'une partie Riot** ne notait rien quand le
  `POST` échouait : le journal restait vide, la partie n'entrait jamais, et la
  relecture suivante recommençait à l'identique. Ça compte davantage depuis que
  la route **refuse** un résultat illisible : ce refus est légitime, et il doit
  se voir. Il passe maintenant par `lireCode`, comme les erreurs de lecture.
- **La suppression de compte** laissait « Suppression… » à l'écran pour
  toujours quand la base ne répondait pas. La personne croit que son compte
  s'efface, et il n'en est rien.

  **Ma première correction ne corrigeait rien**, et c'est la mesure qui l'a
  montré. J'avais posé un `try/catch` autour de `deleteAccount()`, en supposant
  que l'action serveur rejetterait. Éprouvé au navigateur en détournant l'appel
  en 500 : l'action est bien interceptée, mais le client Next **ne rejette pas
  la promesse** — il remonte l'erreur à la page (`PAGEERROR`), le `await` ne
  rend jamais la main, et le bouton affiche toujours « Suppression… ». Ni le
  `catch` ni le `finally` ne sont atteints.

  La suppression est donc devenue une route ordinaire, `DELETE /api/user`, qui
  répond ce qu'elle a fait et que l'écran sait lire. La déconnexion reste une
  action : elle n'écrit rien en base, donc elle ne peut pas échouer pour la
  raison qui nous occupe. `deleteAccount` a quitté `src/lib/actions.ts` —
  laisser le chemin cassé en place, c'est inviter à le reprendre.

  À retenir : **une action serveur n'est pas un `fetch` avec une autre
  syntaxe.** Son échec ne se rattrape pas au point d'appel. Tout ce dont
  l'écran doit pouvoir dire « ça n'a pas marché » passe par une route.

Les fausses pistes, vérifiées et laissées telles quelles : `SessionContext` a
déjà son `try/catch` et sa branche d'échec sur le chrono ; l'export de données
est un `<a href>`, et un 500 y montre la page d'erreur du navigateur, ce qui
est visible ; `CompteRiot` traite déjà ses deux appels, avec `finally`.

Le recensement des `catch` vides s'arrête là. Ceux qui restent sont des appels
au pont Electron, qui remettent l'état précédent avec leur raison écrite : un
réglage qui n'a pas pris n'affiche pas une valeur qu'il n'a pas. Ce n'est pas
le défaut qu'on chasse.

### La sauvegarde n'avait jamais produit de sauvegarde
Les secrets posés, le travail déclenché à la main tombe sur :

```
pg_dump: error: aborting because of server version mismatch
pg_dump: detail: server version: 18.6 ; pg_dump version: 16.15
```

Neon est passé en PostgreSQL 18. Le workflow installait
`postgresql-client-16` et montait un conteneur de vérification en
`postgres:16` — trois numéros écrits à la main, dont deux ont vieilli.
L'intention, elle, était juste, et écrite en commentaire depuis le premier
jour : « les outils client doivent avoir la version du serveur ».

Le numéro se **demande au serveur** maintenant : `SHOW server_version_num`,
divisé par dix mille pour la majeure — un `cut -c1-2` se tromperait le jour
d'une version à trois chiffres. `psql` traverse les versions sans se plaindre,
seul `pg_dump` refuse : celui préinstallé sur le runner suffit à lire la
version avant d'installer le bon client.

Le conteneur de restauration, lui, est figé : un service GitHub se déclare
statiquement. Il est donc comparé à la source, et **refuse bruyamment** en
disant quel nombre changer, plutôt que de produire un dump que la vérification
ne saurait pas restaurer.

**Et le vert ne disait rien.** Une exécution qui saute tout faute de secrets et
une exécution qui sauvegarde puis restaure rendaient exactement la même
pastille. C'est ainsi que la sauvegarde a pu ne rien produire pendant des
semaines sans que personne ne le remarque : il n'y avait rien à remarquer. Un
résumé d'exécution le dit maintenant — « Sauvegarde produite », avec le
comptage table par table, ou « Aucune sauvegarde » et ce qui manque. Sans
courriel : l'absence de secrets reste un avertissement, jamais un échec, parce
qu'un échec quotidien se filtre et ne se lit plus le jour où il compte.

`src/sauvegardeVersion.test.ts` garde les quatre choses qui l'ont rendue
muette. Quatre sabotages, quatre échecs.

### Quatre routes dispensées de session étaient injoignables
Deux listes indépendantes gouvernent l'accès : `SANS_SESSION` dans
`src/porteRoutes.test.ts`, qui dit quelles routes n'exigent pas de session, et
`PUBLIC_PREFIXES` dans `middleware.ts`, qui dit lesquelles traversent le
middleware. **Rien ne les reliait**, et elles ont divergé.

`push/programme`, `mail/hebdo`, `init` et `champions` étaient explicitement
dispensées — chacune avec sa raison écrite, et pour `champions` un commentaire
affirmant que « le middleware la couvre déjà ». Il ne la couvrait pas : les
quatre partaient en **307 vers `/login`** avant d'atteindre leur propre
contrôle.

Le prix a été payé en silence pendant des semaines. Le rappel du matin, le
bilan hebdomadaire et la relance des absents **n'ont jamais été envoyés**, et
le travail programmé rendait du vert : par conception il note un code inattendu
en avertissement plutôt que d'échouer, pour ne pas noyer l'alerte sous
vingt-quatre courriels par jour. C'est le bon choix, et c'est aussi ce qui a
rendu la panne invisible.

Trouvé en déclenchant le workflow à la main après la pose des secrets, et en
lisant son journal au lieu de son pastille verte.

`porteRoutes.test.ts` relie maintenant les deux listes : toute route de
`SANS_SESSION` doit correspondre à un préfixe public. Le test compte aussi les
préfixes trouvés — une liste vide ferait passer le test en ne regardant rien,
ce qui est exactement la forme d'erreur qu'on corrige. Trois sabotages, trois
échecs, chacun nommant la route bloquée.

Vérifié sur le serveur : les quatre atteignent leur handler (405 pour les deux
qui n'acceptent pas POST, **401** pour les deux déclencheurs, c'est-à-dire leur
contrôle de `RAPPEL_SECRET` qui répond), et `/api/dashboard` continue de
rediriger — le témoin.

### Une victoire sur trois s'enregistrait en défaite
Signalé par le propriétaire du produit, et la cause tenait en une ligne de
`/api/games` :

```ts
: (body.result === "V" ? "V" : "D");
```

**Tout ce qui n'est pas exactement `"V"` devient une défaite.** Un champ
absent, une casse différente, un `undefined` remonté par Riot : la partie
s'enregistre du mauvais côté, sans un mot. C'est `Number(x) || 0` à nouveau —
confondre « absent » et « aberrant » — sauf qu'ici la confusion se paie en
dette non méritée, et qu'aucun écran ne la signale.

Le résultat se **refuse** désormais quand il n'est ni `"V"` ni `"D"`.

En amont, les deux routes Riot lisaient `participant.win ? "V" : "D"`, ce qui
cache trois façons de se tromper. `src/lib/riotResultat.ts` les traite :

- **le champ manquant** se rattrape sur `teams[].win`, et réciproquement ;
- **le remake** n'est ni victoire ni défaite. Riot met `win: false` aux dix
  joueurs d'une partie annulée : la compter en défaite crée une dette pour un
  match que personne n'a joué. Il se lit **en premier**, parce que les deux
  sources s'y accordent parfaitement et que le contrôle de désaccord y est
  aveugle ;
- **le désaccord** entre les deux sources ne se tranche pas. Deviner du côté
  « défaite » est précisément le pari coûteux.

Un résultat illisible n'est donc plus une défaite mais un refus : la partie se
présente inajoutable dans la liste, avec son motif (« partie annulée » plutôt
qu'« indisponible », qui ferait chercher une panne inexistante), et
`/api/riot/last-game` rend **422**. Pas 409 : dans cette route le 409 dit déjà
« déjà enregistrée », et deux sens sur un même code rendraient le journal de
synchronisation incapable de les distinguer.

Deux pièges rencontrés en l'éprouvant :
- **un sabotage qui ne sabote pas.** Les trois premières substitutions passaient
  par `perl -0pi -e` avec des motifs pleins de parenthèses et d'accolades : rien
  n'était remplacé, les tests passaient au vert, et j'ai failli conclure que le
  module tenait. Le sabotage vérifie maintenant que l'empreinte du fichier a
  changé avant de lancer les tests. Quatre sabotages, quatre échecs.
- **`as Record<string, string>` sur la table des motifs du journal.** Elle
  acceptait n'importe quelle clé, donc un motif ajouté sans libellé s'affichait
  comme une case vide. `satisfies Record<MotifSynchro, string>` le refuse à la
  compilation — éprouvé en retirant un libellé.

### Un ajout depuis la liste Riot disait son échec à personne
La liste des vingt dernières parties propose un bouton par ligne. Un refus du
serveur ne produisait rien : la ligne redevenait normale, on recliquait sans
savoir ce qui s'était passé. Et l'envoi n'était pas protégé — sans réseau, la
promesse partait en erreur, `setAddingId(null)` n'était jamais atteint, et la
ligne restait en « ajout… » pour toujours.

L'erreur a son propre état. `matchError` **remplace** la liste : le réemployer
ferait disparaître les vingt parties d'un coup, et on ne saurait plus laquelle
on essayait d'ajouter.

`e2e/panne-serveur.spec.ts` fabrique la liste Riot — la clé de production n'est
pas arrivée, et ce qu'on éprouve est la réaction de l'écran, pas Riot — puis
détourne le `POST` en 500. Sabotage fait : « element(s) not found ».

Deux pièges au passage, tous deux déjà écrits ici : la modale de consentement
santé recouvrait le rail (cinquième fichier de parcours à tomber dessus), et le
message affiché est celui que la route rend, traduit — le repli local ne sert
que si la réponse n'en porte aucun.

### Un serveur qui répond mal effaçait la séance qu'on venait de faire
`cloturer()` dans `CompteurDette` enveloppait son envoi dans un `try/catch`, et
le `catch` ne rattrape que l'absence de réseau. Une réponse **500**, ou une
session expirée, traversaient le `if (res.ok)` sans rien faire : la fenêtre se
refermait, la dette restait entière, et l'effort disparaissait sans un mot.

C'est exactement le défaut que la file hors ligne (V240) existe pour empêcher,
laissé ouvert sur le seul chemin où le serveur est joignable — donc le plus
fréquent. Celui qui vient de faire ses pompes en conclut que l'application ne
marche pas.

Mêmes règles que la file : 401 et 5xx repartent en file, le reste non — un 4xx
ne passera jamais, et le garder bloquerait la file derrière lui.

`e2e/hors-ligne.spec.ts` a un cinquième test, et **le réseau y reste branché** :
c'est ce qui le distingue du premier. Seul le `PATCH` est détourné en 500.
Sabotage fait, la correction retirée : « un 500 ne doit pas faire disparaître la
séance — Received length: 0 ».

### La liste d'attente n'était atteignable par aucun chemin
`/waitlist` existe : une page, un dictionnaire dans les six langues, un texte
qui explique que les cent places sont prises et qu'une vague suivante est
prévue. **Rien n'y menait.** Ni lien, ni redirection, ni menu — `grep` sur
`src/` ne la trouve que dans les listes de pages publiques.

Et au moment précis où elle sert, la page d'inscription affichait un cadre
rouge « Beta complète : les 100 places sont prises. » sous un bouton devenu
inutile : rien de ce que la personne tapera ne fera passer ce formulaire. Ça
compte maintenant plus que jamais — le lancement vise cent personnes, donc le
plafond sera atteint.

`/beta` redirige désormais sur le 403, qui est le seul de cette route. Le code
d'état plutôt que le texte : un message se retraduit sans prévenir, un code
d'état non.

Le 403 se simule dans `e2e/panne-serveur.spec.ts` plutôt que de remplir la base
de cent comptes : ce qui a changé est la réaction de l'écran, et c'est elle
qu'on éprouve.

`src/pagesOrphelines.test.ts` refuse désormais une page vers laquelle rien ne
navigue. Rien ne pouvait le signaler avant : TypeScript ne se plaint pas d'une
page que personne n'ouvre, et `codeMort.test.ts` exempte justement les fichiers
que Next.js charge par convention de nom — une page est toujours « importée »,
par le routeur.

**La première version ne prouvait rien.** Elle cherchait le chemin n'importe où
dans le code, et `/waitlist` passait pour joignable parce qu'elle figure dans la
liste des pages publiques et dans celle de la barre de navigation : deux listes
d'appartenance, aucun chemin. Le sabotage — retirer la redirection — laissait le
test au vert. Il ne retient plus que ce qui emmène quelque part : un `href`, un
`router.push`, un `redirect`. Sabotage refait, il tombe.

Quatre exemptions, chacune avec sa raison écrite : la racine, la page de retour
de l'application de bureau, la page atteinte par le lien du courriel de
récupération, et l'adresse OBS qu'on recopie à la main.

La page elle-même a changé de sortie. Son bouton menait à `/login`, ce qui
n'aide personne : on arrive là justement parce qu'on ne peut pas ouvrir de
compte. Elle propose maintenant le **calculateur**, qui est public et répond à
la question qui a amené la personne — ce que coûte une défaite. Une page qui
ferme une porte doit en ouvrir une autre, sinon elle n'est qu'un mur.

### Le contrôle de débordement ne mordait pas là où il sert
`e2e/langues.spec.ts` refuse qu'une page défile horizontalement — c'est ainsi
qu'un mot allemand trop long se signale. Il tournait à 1280 px, la largeur par
défaut du projet Playwright, où tout tient. Le contrôle existait donc partout
et ne pouvait rien attraper.

Il repasse maintenant à **390 et 320 px**, sans recharger la page : c'est la
mise en page qu'on éprouve, pas le rendu serveur. Un seul assistant
(`refuserDebordement`) sert aux pages publiques et aux écrans connectés — le
second n'en avait pas du tout, et c'est là que les graphiques et les cartes de
« Ta saison » ont le plus de raisons de déborder.

Le rapport nomme l'élément fautif, la feuille et non ses ancêtres : « la page
déborde » ne se corrige pas, « ce libellé finit à 412 px » se corrige.

Éprouvé par sabotage : un `min-width: 500px` posé sur `.titre-page`, et le test
rend « h1.titre-page « CONDITIONS GÉNÉRALES D'UTILISATION », finit à 516 px,
fenêtre de 390 ». Au passage, la question s'est posée de savoir si
`body { overflow-x: clip }` ne rendait pas le contrôle sourd : non,
`documentElement.scrollWidth` grandit quand même. Le `clip` empêche de faire
défiler, pas de mesurer.

**Et le sabotage a trouvé autre chose.** Lancé sur un seul test des écrans
connectés, il est passé au vert — parce que la préparation de session est un
`test` à part, écarté par le filtre : la page mesurée était `/login`, qui n'a ni
graphique ni carte. Le premier piège écrit pour les scripts de mesure, « mesurer
la mauvaise page », valait donc aussi ici. Ces tests vérifient maintenant où ils
ont atterri.

### Le parcours complet, joué aussi sur un téléphone
`e2e/parcours.spec.ts` — entrer, enregistrer une défaite, payer sa dette —
tournait sur un écran de poste, et seulement là. Or le rail, d'où partent
l'ajout d'une partie **et** le compteur de dette, se replie derrière un bouton
sous 1180 px. Le fichier prévoyait ce cas depuis le début, dans une ligne
tolérante (`.click().catch(() => {})`) : la branche existait pour rassurer, pas
pour prouver. L'application se pose sur l'écran d'accueil d'un téléphone,
envoie des notifications et affiche une pastille en jeu — le téléphone n'est
pas un cas limite, c'est un des deux cas.

Le parcours se joue maintenant deux fois, sur deux comptes distincts : poste et
390 px tactile. La passe téléphone a échoué du premier coup, à l'étape 5 : la
pastille de dette est « présente mais cachée » tant que le rail n'est pas
déplié, et seule l'étape 3 pensait à le déplier. C'est la preuve que la seconde
passe emprunte bien un autre chemin — sans elle, le test aurait continué de
passer sur une moitié du produit.

Ce que ça dit du produit, en revanche, ne se corrige pas ici : sur téléphone,
voir ce qu'on doit demande une touche de plus. Déplacer ce bouton est un
arbitrage, il figure dans les questions.

### Sans script, la page d'accueil se réduisait au premier écran
Les dix-neuf sections sous le héros — l'historique, la bande des jeux, la foire
aux questions, le pied de page — sont bien dans le HTML rendu par le serveur.
C'est la feuille de style qui les pose à `opacity: 0` via `.reveal`, et seul
l'IntersectionObserver installé après l'hydratation les rend visibles. Coupez le
script, ou laissez une extension le bloquer : la page de vente n'a plus rien
sous le titre, et rien ne le signale. Mesuré avant correction, en descendant
toute la page : **19 sections sur 19 invisibles**.

`@media (scripting: none)` les rend visibles, et rien d'autre. C'est volontaire :
la règle est nette, elle n'introduit aucun scintillement et n'invente pas une
seconde mécanique de révélation. Un paquet JavaScript qui n'arrive pas est un
autre problème — commun à tout ce que l'application fait après montage, pas
propre à cette page.

`e2e/seo.spec.ts` descend la page sans script et compte ce qui est resté caché.
Il compte aussi le total : sans ce garde, la disparition de la classe ferait
passer un test qui ne prouve plus rien. Sabotage fait, la règle vidée : 19.

### Un outil de mesure qui jetait ce qu'il venait de relever
`performance.mjs` relevait le nom du plus grand élément **et** le drapeau « dans
une modale » sur la passe poste, puis n'en gardait que le temps :
`const m = { lcp, cls }`. Deux conséquences. Le rapport annonçait « plus grand
(non relevé) » sur toutes les pages — la moitié du diagnostic, perdue à la
ligne suivante. Et le garde des modales testait `m.modale`, qui valait toujours
`undefined` : il ne pouvait se déclencher que par la passe téléphone.

C'est exactement le piège déjà écrit plus haut — « un contrôle qu'on ajoute se
pose partout où la mesure se fait » — et il s'est reproduit dans le fichier qui
le décrit.

### Campagne du 24 août — les dix pages sous le seuil, et le fondu qui coûtait deux secondes
Dix pages mesurées sur téléphone bridé (4G moyenne, processeur quatre fois plus
lent). Neuf dans le seuil, une au-dessus : la page d'accueil, à 3200 ms.

Ce qui a été confirmé au passage : **le tableau de bord est passé de 3456 ms à
1136 ms** — le premier écran rendu au serveur (V236) a fait ce qu'on en
attendait —, et « Ta saison » tient à 1052 ms (V245).

| écran | LCP téléphone bridé | plus grand élément |
|---|---|---|
| `/history` | 940 ms | mention Riot, en pied |
| `/settings` | 944 ms | mention Riot, en pied |
| `/bilan` | 1052 ms | mention Riot, en pied |
| `/telechargement` | 1128 ms | le paragraphe SmartScreen |
| `/cgu` | 1136 ms | le premier paragraphe |
| `/dashboard` | 1136 ms | le rappel du test de force |
| `/confidentialite` | 1200 ms | le titre |
| `/calculateur` | 1644 ms | le titre |
| `/beta` | 1696 ms | « Un pseudo suffit » |
| `/` | **3200 ms** | le sous-titre du héros |

**La cause n'était ni le poids ni le réseau.** `/calculateur` transfère 454 ko
contre 399 pour l'accueil, et paraît en 1644 ms. C'était le fondu d'entrée :
`.hero-rise` animait `opacity` de 0 à 1, et un élément à `opacity: 0` n'existe
pas pour le navigateur — il ne peut pas être élu plus grand élément affiché. Le
sous-titre, qui l'est, n'était compté qu'une fois le fondu joué.

Mesuré des deux côtés, trois exécutions chacun, sur la même page et la même
construction : **3396 ms avec le fondu, 1416 ms sans** (`prefers-reduced-motion`,
que la feuille traite déjà en supprimant l'animation). Le fondu est parti, le
mouvement est resté — le texte monte à sa place au lieu d'apparaître. Nouvelle
mesure : **1440 ms**, et les dix pages sont dans le seuil.

`src/heroSansFondu.test.ts` refuse le retour de `opacity` dans `heroRise`, et
vérifie deux choses de plus, sans quoi il ne prouverait rien : que l'animation
anime encore quelque chose, et que son découpage par accolades lit bien la
règle demandée — éprouvé sur `fadeIn`, dont on sait qu'elle fond. Sabotage fait :
le fondu remis, le test tombe.

Deux corrections de texte au passage : « les graphiques ci-dessous » et « une
seule partie suffit pour que les graphiques du bas se remplissent » désignaient
des graphiques qui sont **au-dessus** de ces panneaux. Le tableau de bord rend
`GraphiquesGlobaux` avant `PremiersPas`.

### Le tableau de bord renvoyait vers l'historique, qui renvoie au tableau de bord
Deux textes d'un compte vide envoyaient enregistrer sa première partie sur
`/history` : l'étape 3 des « Premiers pas » et le panneau « Aucune game
loggée ». Or `AjoutActivite` n'est monté nulle part ailleurs que dans la
fenêtre du tableau de bord. Depuis que l'historique vide dit à son tour où se
trouve l'ajout, les deux écrans se renvoyaient l'un à l'autre, et le compte
neuf tournait en rond sur la seule action qui compte.

Les deux textes déclenchent maintenant le geste au lieu de nommer une page :
`PremiersPas` reçoit un `onAjouter` du tableau de bord, qui seul possède
`setModale`, et le panneau porte un bouton. Une étape qui décrit un geste doit
l'ouvrir ; indiquer une adresse où il n'existe pas est pire que de se taire.

`e2e/premier-ecran.spec.ts` clique les deux et attend la fenêtre. Redevenus des
liens vers `/history`, ils partent sur l'autre page et ne trouvent rien —
**éprouvé dans les deux sens, séparément pour chacun des deux**. `passerIntro`
a quitté `e2e/parcours.spec.ts` pour `e2e/intro.ts` : deux fichiers de parcours
en ont besoin, et une spécification n'en importe pas une autre.

Le même test tourne une seconde fois en 390 px. C'est là que ça compte : le
bouton du rail ne se présente pas de la même façon sur un petit écran, et sans
clé Riot de production la saisie à la main est le seul moyen d'employer le
produit. Un compte neuf sur téléphone pouvait n'avoir aucune commande d'ajout
sous les yeux.

En passant, le bandeau vert « partie enregistrée » ne s'effaçait jamais en
fenêtre : `openAddForm` le remettait à zéro, et il n'est pas appelé quand le
formulaire s'ouvre déjà déplié. Il restait donc affiché pendant la saisie de la
partie suivante et, si celle-ci échouait, cohabitait avec l'erreur rouge. Il
s'efface maintenant au début de chaque envoi.

### Un historique vide ne disait pas quoi faire
L'ajout d'activité vit dans le rail du tableau de bord, et **nulle part dans
l'historique** — `AjoutActivite` n'y est pas monté. Quelqu'un qui ouvre son
compte neuf et va chercher « où j'enregistre ma partie » à l'endroit le plus
évident ne trouvait que « Aucune game à afficher. »

Ça compte plus qu'il n'y paraît en ce moment : sans la clé Riot de production,
la saisie manuelle est **le seul** moyen d'employer le produit.

Le bouton n'a pas bougé — le déplacer est une décision de produit, elle figure
dans les questions. L'écran vide dit maintenant où il est, avec un lien. C'est
la même règle que pour « Tes jeux » en V233 : une section qui n'offre pas ce
qu'on y cherche doit au moins dire où c'est.

### Sans clé Riot, le journal accusait Riot
La clé de production se demande à Riot et met plusieurs jours à arriver. C'est
donc l'état du lancement, pas un cas de bord. Deux choses s'y disaient mal :

- **Le message.** « Clé API Riot manquante (RIOT_API_KEY dans .env) », en
  français quelle que soit la langue, nommant un fichier que personne ne verra.
  Corrigé plus haut ; il dit maintenant ce qui est vrai et ce qu'on peut faire.
- **Le code de réponse.** La route rendait 500, et le journal de
  synchronisation traduit tout 5xx par « Riot ne répond pas ». C'est faux : ce
  n'est pas Riot qui est muet, c'est nous qui ne sommes pas prêts. Pendant tous
  les jours qui séparent le lancement de l'arrivée de la clé, on aurait imputé
  à Riot une case vide de notre côté. **503**, et le journal a son propre motif.

**Le journal parlait français à tout le monde.** `lireCode` rendait des phrases
écrites en dur dans un module sans React. Elle rend maintenant une **clé**, et
la traduction se fait à l'affichage. Les entrées déjà rangées dans le navigateur
ne portent qu'une phrase française : on la garde à défaut de motif, plutôt que
de leur vider la colonne.

### Une panne serveur ressemblait à une page lente — ou pire, à un compte vide
Trouvé en coupant les réponses à la main, écran par écran. Deux comportements,
et le second est le plus grave de la nuit :

- **Le tableau de bord gardait son squelette pour toujours.** Une panne
  ressemblait exactement à une page qui met du temps : on attend, on recharge,
  on attend encore. Rien ne disait qu'il n'y avait plus rien à attendre.
- **L'historique annonçait « aucune game à afficher ».** Il affirmait quelque
  chose de **faux** sur les données de la personne. Quelqu'un dont la requête
  échoue en conclut que son historique a été effacé — sur une application qui
  n'existe que pour garder cet historique.

Les deux disent maintenant ce qui s'est passé, et disent que **rien n'est
perdu** : c'est la seule phrase qui compte quand on croit avoir perdu ses
données. Un bouton « Réessayer » à côté, qui recharge sans quitter la page.

`e2e/panne-serveur.spec.ts` coupe les trois routes une par une. Le test de
l'historique vérifie les deux choses : que le message d'échec est là, **et**
que celui qui affirme le contraire n'y est pas. Éprouvé en ravalant l'échec :
le test tombe.

#### La suite navigateur butait sur le plafond de la bêta
Cent comptes — c'est le produit, pas un réglage de test — et chaque exécution
en ouvre une dizaine. Au bout d'une douzaine d'exécutions locales, l'ouverture
de compte se met à échouer, et la panne ne ressemble pas à sa cause : c'est le
fichier passé en premier dans l'ordre alphabétique qui tombe, quel qu'il soit.
La préparation globale efface donc les comptes `@example.test` — domaine
réservé aux exemples par la RFC 2606, qu'aucun compte réel ne peut porter. En
intégration continue la base est neuve, ça n'y change rien.

### « 2026-02-30 » montrait la journée du 2 mars
Suite du passage en revue, côté lecture cette fois. Une seule route cédait, et
c'est celle que le **calendrier du tableau de bord appelle lui-même** :
`/api/dashboard/daily`.

Elle vérifiait la forme — `\d{4}-\d{2}-\d{2}` — et pas la date :
- « 9999-99-99 » respecte la forme, donne une date invalide, traversait jusqu'à
  la base et faisait tomber la route avec une **erreur 500** ;
- « 2026-02-30 » n'est même pas rejeté par `Date` selon la plateforme : il
  glisse au 2 mars. La journée montrée n'était alors pas celle demandée, et
  rien ne le disait.

Le contrôle porte maintenant sur **l'aller-retour** : on réécrit la date et on
la compare à celle demandée. Ça attrape les deux cas d'un coup. `toISOString`
lève sur une date invalide : on regarde d'abord qu'elle en est une, sinon le
contrôle devient lui-même la panne.

Tout le reste tient : filtres inconnus, limites négatives ou démesurées,
paramètres injectés — les autres routes de lecture rendent une réponse vide ou
ignorent le paramètre, aucune ne tombe.

### Le compteur de dette s'effaçait sur une durée impossible
Suite du même passage en revue, sur les autres routes qui écrivent. Tout le
reste tient — réglages, compte, suspension, signalement, consentement refusent
proprement ce qui n'a pas de sens. Une seule cédait :

`PATCH /api/dette` avec `secondes: 1e308` rendait **200** et effaçait la dette
entière. La proportion payée est plafonnée à cent pour cent, et
`Number(x) || 0` acceptait la valeur : quarante-sept points effacés par une
durée que personne ne peut avoir faite. Vérifié avant et après, sur une vraie
dette.

Le plafonnement reste : dix minutes faites sur cinq minutes dues, c'est le cas
légitime. Ce qui est refusé, c'est ce qui n'est pas une durée.

Deux comportements ont changé au passage, et c'est voulu :
- une durée négative rendait 200 sans rien créditer. Sûr, mais muet : l'appelant
  ne savait pas que sa valeur n'avait pas été comprise, et **la file hors ligne
  aurait réessayé indéfiniment**. Un 4xx la fait renoncer sur cette entrée-là ;
- un corps illisible passait pour « zéro seconde ». Il ne dit ni « tout est
  fait » ni « voilà combien » : il se refuse.

Zéro seconde reste accepté : c'est un abandon immédiat, pas une erreur.

### Une faute de frappe pouvait créer une dette impossible à payer
Essayé bêtement, en envoyant des valeurs absurdes aux routes de partie. Trois
trouvailles, dont deux sérieuses :

- **`999999999` secondes de Minecraft au lieu de `999` : 5 555 556 points de
  dette, en une requête, acceptés.** Ce n'est pas un abus, c'est un zéro de
  trop dans un champ — et la personne se retrouve avec une dette qu'elle ne
  pourra jamais payer, sur un produit dont c'est précisément le sujet.
- **`deaths: 1e308` : erreur 500.** La valeur traversait jusqu'à la base, qui
  répondait par une pile d'appels sans rien expliquer.
- **Un classement de `-3` en battle royale devenait la première place**, donc
  une partie gratuite : `Math.max(1, …)` **récompensait** la saisie aberrante.

`src/lib/bornesSaisie.ts` porte les bornes, larges à dessein — il s'agit
d'attraper l'impossible, pas de discuter l'exploit. Trente-six heures de jeu
d'affilée passent ; onze jours non. Mille éliminations passent ; un milliard
non.

Deux principes qui valent au-delà de ce cas :
- **« Absent » et « aberrant » sont deux choses différentes.** `Number(x) || 0`
  les confondait : une valeur impossible devenait un zéro, et la partie
  s'enregistrait quand même. Une valeur absente reste zéro ; une valeur
  présente et hors bornes est refusée par un message.
- **Ne pas rattraper une saisie fausse.** Ramener `-3` à `1` semble aimable ; en
  pratique ça invente une partie que personne n'a jouée, et ici ça l'offrait.

`Number([])` vaut zéro et `Number({})` vaut `NaN` : la conversion implicite de
JavaScript accepte des choses qui ne sont pas des nombres et en tire parfois un
chiffre. `entierBorne` ne convertit que ce qui prétend en être un.

### Trois défauts de « Ta saison », vus en la regardant sur un téléphone
Publiée le soir, relue le lendemain matin sur une capture de 390 px. Rien
n'était cassé au sens des tests ; tout se voyait à l'œil.

- **La police à chasse fixe était posée sur toutes les valeurs.** Elle existe
  pour aligner des chiffres entre eux, pas pour faire joli : « League of
  Legends » et « 23 août » avaient l'air d'une machine à écrire, et surtout
  elle les élargit. « Champion le plus joué » n'avait plus la place de
  s'écrire. Elle ne sert plus qu'aux nombres nus.
- **« 40 % » creusait un trou.** L'espace fine insécable que le français impose
  devant le signe occupe une chasse entière en police à chasse fixe. Le
  pourcentage passe maintenant par `Intl` — qui connaît la règle de chaque
  langue, là où un « % » recollé à la main en aurait une seule — et sort de la
  chasse fixe.
- **« 21 + 2 min 20 » passait à la ligne entre « min » et « 20 ».** Une valeur
  longue rétrécit plutôt que de se couper au milieu d'une unité.

Le bouton du rail latéral recouvre encore, selon l'endroit où l'on s'arrête de
défiler, une étiquette de carte ou une croix de suppression dans l'historique.
C'est constaté, capture à l'appui, et **laissé tel quel** : le déplacer est une
décision de produit qui figure dans les questions.

### La langue n'était pas déclarée dans la politique
Elle figurait dans les exemptions de `politiqueComplete.test.ts` comme
« réglage d'affichage ». C'en est un dans le navigateur, où il ne nous regarde
pas. Rangée sur le compte — ce qu'on a fait pour écrire les notifications dans
la bonne langue — elle sert **hors** de l'Application, et elle dit quelque chose
de la personne. Elle se décrit donc, exactement comme le fuseau qui l'avait
précédée sur le même raisonnement.

L'exemption est retirée : le test exige maintenant sa présence dans la
politique. Éprouvé en retirant la ligne.

### L'export de données oubliait la moitié de ce qu'on garde
Le droit à la portabilité couvre tout ce que l'application sait de quelqu'un.
L'export rendait le compte, les préférences et les parties. Il ne rendait pas
**les séances payées** — c'est-à-dire ce que la personne a réellement fait, jour
par jour. Les parties disent ce qu'elle a joué ; les paiements disent ce qu'elle
a fait, et c'est la moitié qu'elle a envie de reprendre.

Manquaient aussi : ce qu'elle nous a écrit par un signalement, la trace de son
consentement aux données de santé — c'est à nous de prouver qu'il a été donné
(article 7.1), il est normal qu'elle reçoive la même preuve —, sa langue, son
fuseau, sa variante d'exécution, ses exercices mis de côté et son abonnement au
bilan hebdomadaire.

Ce qui reste dehors, avec sa raison : le jeton de la source de diffusion. C'est
bien une donnée du compte, mais c'est aussi un laissez-passer, et dans un
fichier qu'on s'envoie par courriel ça devient une clé qui traîne.

La suppression, elle, était déjà complète : toutes les relations vers `User`
sont en `Cascade`, sauf les signalements en `SetNull` — ce qui est le bon choix,
le rapport de bug survit anonyme.

### Les six langues, sur quatre écrans de plus
`e2e/langues.spec.ts` ouvrait cinq pages publiques et trois écrans connectés.
Manquaient le calculateur, une de ses pages par jeu, les CGU, la politique de
confidentialité, et « Ta saison ». Les deux pages juridiques sont celles où un
mot allemand trop long ne casse rien de visible tout en poussant la page hors
de l'écran ; « Ta saison » est le seul écran dont le texte tient dans huit
petites cartes. **80 passes au lieu de 54.**

### Ce que l'application dit pendant qu'on joue
Trois endroits l'écrivaient en français, en dur, dans le composant : la
pastille en jeu après une partie d'Apex, la notification système après une
partie de League, et la notification d'essai des réglages. Ils échappaient à la
règle « aucun texte dans un composant » parce qu'ils ne s'affichent pas dans
une page — mais quelqu'un qui lit l'application en allemand recevait bien du
français en jeu, c'est-à-dire au seul moment où il ne peut pas aller chercher
ailleurs.

`src/lib/i18n/dictionaries/enJeu.ts` les porte, dans les six langues, y compris
les noms d'exercices tels qu'ils se lisent dans une phrase — la boxe se compte
en temps, d'où « 4 min de boxe » là où les autres donnent « 12 pompes ».

### Le tiret cadratin, et le test qui le refuse
Consigne du propriétaire du produit, et elle a sa raison : le tiret cadratin en
incise est la ponctuation par laquelle un texte écrit par une machine se
reconnaît en un coup d'œil. Sur un produit dont la voix est l'argument
principal, ça se paie tout de suite.

Quatre incises avaient survécu dans les dictionnaires — consentement santé (en
cinq langues), remerciement d'un signalement, aide de la détection en allemand,
aide du test de force en allemand. Elles sont devenues des deux-points ou des
virgules.

`src/lib/i18n/tiretsCadratins.test.ts` le tient. Deux usages restent permis, et
ce ne sont pas des incises : le tiret **seul**, qui tient lieu de « pas de
valeur » dans une carte de statistique — c'est une convention typographique,
pas une phrase — et le tiret double chinois « —— », qui est un signe de
ponctuation à part entière du chinois. Le refuser reviendrait à imposer la
typographie française à une langue qui a la sienne.

La consigne ne vaut que pour ce que l'utilisateur lit. Les commentaires de code
s'en servent librement, ce fichier compris : personne ne les lit dans
l'application.

### Quarante-sept messages d'erreur partaient en français
Les routes écrivent leurs messages en dur, et la clé de traduction EST le
message français — c'est un choix assumé, celui qui circule sur le réseau. Le
prix, c'est qu'un message ajouté sans sa traduction ne casse rien, ne fait
échouer aucun test, et sort en français chez quelqu'un qui n'a jamais vu un
écran français.

Recensement : **47 messages distincts sur 69** étaient dans ce cas. Et parmi
eux, celui-ci :

> Clé API Riot manquante (RIOT_API_KEY dans .env)

C'est ce qu'aurait vu **tout le monde** en essayant de relier son compte Riot
tant que la clé de production n'est pas arrivée — en français quelle que soit
la langue de l'écran, nommant un fichier qu'on ne verra jamais, et donnant à un
défaut de configuration de notre côté l'allure d'une panne du sien. Il dit
maintenant ce qui est vrai et ce qu'on peut faire : le suivi Riot est
indisponible, le reste marche, les parties s'enregistrent à la main.

Les quarante-sept sont traduits dans les cinq autres langues.

`src/lib/i18n/apiErrorsComplets.test.ts` garde la table : tout message
`error: "…"` rendu par une route doit y figurer, ou être exempté **avec sa
raison écrite**. Neuf exemptions, toutes des routes qu'aucun écran
d'utilisateur n'atteint — administration, amorçage, source de diffusion.

Deux pièges rencontrés en l'écrivant :
- **Déduire « traduit » du résultat.** Le premier jet regardait si la
  traduction anglaise diffère du français. « Unauthorized » s'écrit pareil dans
  les deux : le message se retrouvait rangé parmi les oubliés. La question se
  pose sur la présence dans la table, d'où `aUneTraduction()`.
- **Exiger que chaque langue diffère du français.** Même cause : une règle qui
  l'imposerait forcerait à inventer une différence. Ce qui est exigé, c'est
  qu'aucune langue ne rende du vide.

Trois sabotages, trois échecs : un message neuf sans traduction, une exemption
qui ne désigne plus rien, et un motif de recensement qui ne trouve plus rien.

### Sur une base neuve, la première partie enregistrée tombait
Trouvé par l'intégration continue, et par accident : `e2e/bilan.spec.ts` passe
avant les autres dans l'ordre alphabétique, et c'est le seul fichier de
parcours dont l'ouverture de compte n'appelle pas `/api/user`. Il a donc été le
premier à enregistrer une partie sur une base fraîchement montée.

```
TypeError: Cannot read properties of undefined (reading 'seuilGainageSec')
```

Deux défauts, tous deux anciens, qu'il fallait juste déclencher dans le bon
ordre :

- **La configuration de barème n'était semée que par `/api/user`.** Sur une base
  neuve — un environnement qu'on monte, une base de test, une reprise après
  sinistre — quelqu'un qui enregistre une partie avant d'avoir ouvert un écran
  qui lit son compte tombait sur une 500. `/api/games` et `/api/games/preview`
  sèment maintenant elles aussi ; l'appel est mémoïsé pour le processus, donc
  après le premier il ne coûte qu'une promesse déjà résolue.
- **Le contrôle « Config manquante » en oubliait un sur trois.** Il vérifiait
  les poids de rôle et la maîtrise, pas les paliers. Or `getLevel` lit le
  dernier élément d'une liste triée : sur une liste vide il rend `undefined`, et
  la lecture du seuil qui suit fait tomber la route avec une pile d'appels au
  lieu d'un message. Un contrôle qui en oublie un sur trois ne protège pas d'un
  tiers moins — il ne protège pas du cas qui arrive.

Vérifié pour de bon : base créée, migrations appliquées, compte ouvert, et la
**toute première requête** du compte est l'enregistrement d'une partie. 200.
Les deux gardes sont éprouvées par sabotage, chacune fait tomber son test.

Ce qui vaut d'être retenu : ce n'est pas le nouveau test qui a créé le défaut,
c'est lui qui l'a rendu atteignable. Un ordre d'exécution est une donnée
d'entrée comme une autre, et l'alphabet en est une.

### Le bilan de saison était le seul écran au-dessus du seuil
Mesuré le lendemain de sa mise en ligne : **3628 ms** sur téléphone bridé, le
plus grand élément étant l'image du bilan. La chaîne était : télécharger le
JavaScript, hydrater, appeler `/api/bilan`, rendre la balise, et seulement là
commencer à charger l'image. Quatre étapes en série pour une ressource qui ne
dépend d'aucune d'elles.

Il suffit de savoir **s'il y a des parties** pour poser la balise : un comptage
sur un index, fait par la page serveur et passé au composant client. La balise
part alors avec le HTML, et React — voyant une image dans le rendu serveur —
émet lui-même l'indication de préchargement. **2100 ms**, c'est-à-dire l'instant
exact où l'image finit d'arriver : le plancher de cette page. Les neuf écrans
sont de nouveau sous le seuil.

Trois choses que cette mesure a apprises, dont deux corrections de ma part :

- **Une indication de préchargement écrite à la main ne servait à rien.** React
  la produisait déjà. Ajoutée, mesurée, retirée — la mesure est identique au
  pixel près avec et sans.
- **`ReactDOM.preload()` appelé dans un composant serveur n'arrive pas dans
  l'en-tête** : il passe par le flux de rendu et n'est appliqué qu'à
  l'hydratation, c'est-à-dire précisément trop tard. Une balise `<link>` dans le
  JSX, elle, part avec le HTML.
- **Une explication qui n'est pas éprouvée n'est pas une explication.** J'ai
  d'abord attribué le retard à React qui recréait la balise entre l'état
  d'attente et l'état chargé, et j'ai écrit un test pour ça. Le sabotage l'a
  démenti : les deux structures mesurent pareil. Le test a été remplacé par
  celui qui discrimine vraiment — la balise et l'indication de préchargement
  sont-elles dans le HTML de la réponse. Sabotage refait en faisant attendre
  l'image : le test tombe **et** la mesure remonte à 3684 ms. Les deux
  ensemble, sinon on ne prouve rien.

### Le mode hors ligne, éprouvé dans un navigateur
La file a ses tests unitaires — ce qu'elle garde, ce qu'elle jette, ce qu'elle
renvoie. Ils ne disent rien de l'assemblage : que le composant appelle la mise
en file quand l'envoi échoue, que la pastille annonce ce qui attend, et que le
retour du réseau déclenche vraiment le renvoi. Trois branchements, et un
branchement se vérifie en marchant dessus.

`e2e/hors-ligne.spec.ts` suit une vraie soirée : une défaite qui crée une dette,
le réseau coupé pendant la séance, le chrono terminé, puis le réseau qui
revient. Plus le cas du tunnel — deux envois du même jeton — qui doit ne rien
retirer la seconde fois.

Deux sabotages, deux échecs : sans la mise en file, la première séance est
perdue ; sans le contrôle du jeton, la dette est payée deux fois.

La demande de consentement santé a encore bloqué le premier essai — elle est
modale et recouvre la pastille de dette. C'est le troisième fichier de parcours
qui tombe dessus. Elle se traverse par l'API dans l'ouverture de compte.

**Le limiteur de la bêta a fini par mordre en local** : cent comptes, et chaque
exécution de la suite en crée huit. En intégration continue la base est neuve à
chaque fois, donc rien à signaler là-bas ; en local, il faut vider les comptes
`@example.test` de temps en temps.

### L'historique défilait encore, dans une bande de trente-deux pixels
Le seuil posé en V232 était celui où le tableau **commence à entrer**, pas
celui où il **tient** : il réclame 760 px et la page lui en retire 32 de
marges. Entre 760 et 792 px de fenêtre, il paraissait donc et se remettait
aussitôt à défiler — exactement le défaut qu'on venait de corriger, dans une
bande assez étroite pour ne jamais tomber dessus en testant à la main. C'est
aussi, précisément, la largeur d'une tablette en portrait. Le seuil passe à
820 px.

**Le test qui aurait dû l'attraper mesurait autre chose.** Le helper écrivait
`largeur < 760 ? IPHONE : { viewport: { width: largeur } }`, et `IPHONE` impose
son propre gabarit de 390 px : demander 768 rendait une page de 390. Les
contrôles ajoutés autour du seuil mesuraient donc une largeur qu'ils n'avaient
jamais demandée, et le premier sabotage est passé au vert. La largeur demandée
est maintenant celle qu'on obtient ; le tactile reste réservé aux vraies
largeurs de téléphone. Sabotage refait après correction : le test tombe.

Trouvé par un balayage de douze pages sur cinq largeurs et deux langues,
cherchant les conteneurs réellement défilants. Les trois autres constats —
« texte coupé » sur le tableau de bord — étaient des **faux positifs** : ce
sont les libellés `lecture-ecran` destinés aux lecteurs d'écran, larges d'un
pixel avec `overflow: hidden`, donc débordants par construction. Il valait
mieux le vérifier que « corriger ».

### Découper les fichiers les plus longs
`settings/page.tsx` faisait 960 lignes. La rubrique « Avancé » — les
coefficients du barème — en occupait 166 sans rien partager avec le reste :
elle ne s'affiche que pour un administrateur, et portait à elle seule cinq
états dont personne d'autre ne se servait. Elle vit dans
`src/app/settings/ReglagesAvances.tsx` ; la page tombe à 780 lignes.

Les poids par rôle et les paramètres de maîtrise sont lus **par le panneau**
plutôt que passés par la page : celle-ci les chargeait pour tout le monde, y
compris pour les comptes qui ne verront jamais ce panneau. Les paliers, eux,
restent partagés — la page les lit pour afficher le niveau du compte, et les
modifier dans le panneau doit continuer de mettre ce niveau à jour. Un état par
côté ferait diverger les deux affichages dès la première correction.

Un remaniement qui ne doit rien changer à l'écran se prouve, il ne se relit
pas : `scripts/comparer-rendu.mjs` capture avant, puis après. Vingt-quatre
captures, une seule différence — `768_history`, c'est-à-dire le seuil corrigé
juste au-dessus. `/settings` est identique au pixel aux trois largeurs.

Les dictionnaires de langue restent longs (1516 lignes pour `landing.ts`) et le
resteront : six langues d'un même écran dans un même fichier, c'est ce qui rend
une clé manquante visible. Les découper par langue rendrait les tests de parité
plus difficiles à écrire pour un gain nul.

### Audit SEO des pages publiques — treize constats, douze corrigés
Le calculateur par jeu est le seul canal d'acquisition qui travaille sans qu'on
s'en occupe. Ce sont exactement les pages où les défauts trouvés se payaient.

Deux vrais, tous deux invisibles à l'écran :

- **Le titre des pages par jeu atteignait 75 caractères.** Le gabarit y
  ajoutait « · Win or Workout », et Google coupait la question au milieu du nom
  du jeu — c'est-à-dire au mot qui prouvait qu'on répondait bien à celle qu'on
  venait de taper. `title: { absolute: … }` retire le suffixe : quatorze pages
  sur quinze tiennent sous soixante caractères.
- **Ces mêmes pages partaient sans vignette.** Next.js **remplace** le bloc
  `openGraph` du parent au lieu de le compléter : déclarer un `title` suffisait
  à effacer l'image et l'adresse héritées de la mise en page racine. Elles sont
  redéclarées, avec la raison écrite au-dessus.

Puis quatre plus petits : `/login` n'avait aucun `h1` — le nom du produit y
tenait lieu de titre dans un `div`, donc rien pour sauter au contenu et rien
qui dise de quoi la page parle ; la description des CGU faisait 53 caractères,
trop court pour que le moteur la préfère à un extrait de son choix ;
`/waitlist` n'avait ni titre ni `noindex`.

**Interdire l'exploration n'empêche pas l'indexation.** `/waitlist` était dans
`robots.txt`, ce qui ne la sortait pas des résultats : une adresse interdite
d'exploration peut être indexée depuis un lien, et paraît alors sans titre ni
description — le pire des deux mondes. Un moteur ne lit « ne m'indexe pas » que
s'il a le droit d'ouvrir la page. L'interdiction a donc été levée en même temps
que la balise a été posée. `/bilan` l'a remplacée dans la liste.

Trois constats étaient **faux**, et il valait mieux le vérifier que « corriger » :
- « douze images sans alt » sur l'accueil — les logos de jeux portent
  `alt=""` volontairement, le nom du jeu étant écrit à côté. Mon contrôle
  lisait `!img.alt`, qui est vrai pour un alt vide comme pour un alt absent ;
- « pas de lien canonique » sur `/login`, `/recuperation`, `/waitlist` — une
  page qui dit « ne m'indexe pas » n'a pas besoin de canonique.

Reste un constat, assumé : « Combien de pompes pour une défaite sur Call of
Duty: Warzone ? » fait 62 caractères. Raccourcir la question la viderait de ce
qui la rend utile.

`e2e/seo.spec.ts` garde l'ensemble — onze contrôles sur les balises rendues,
pas sur le code qui les produit. Éprouvé en retirant la vignette et en
remettant le suffixe du titre : chaque sabotage nomme son test.

### Le bilan de saison (question 105)
L'application ne sait dire que le présent — ce qu'on doit, là, maintenant.
Quatre-vingt-dix jours mis bout à bout disent autre chose, et c'est la seule
chose qu'on ait envie de montrer à quelqu'un.

`/bilan` affiche les chiffres de la période ; `/api/bilan/image` en dessine une
**image**. La distinction n'est pas cosmétique : une image se poste sur
Discord, dans une conversation, sur un réseau. Une page ne se poste pas — elle
demande à celui d'en face de cliquer, et il ne clique pas.

Trois décisions, avec leur raison :

- **Quatre-vingt-dix jours**, et non « la saison ». C'est l'ordre de grandeur
  d'un split classé, et une durée qui a du contenu à montrer sans remonter à
  des parties qu'on ne se rappelle plus. Aller chercher la vraie date de fin de
  saison lierait l'écran au calendrier d'un seul jeu, alors que l'application en
  suit une quinzaine.
- **Rendue au serveur**, pas capturée dans le navigateur. Une capture dépend de
  la taille de la fenêtre, du thème et des polices installées : elle rend une
  image différente à chaque appareil. Ici, le même compte donne toujours la
  même image.
- **Aucune adresse publique.** L'image se lit avec la session de son
  propriétaire, qui l'enregistre et la partage lui-même. Rendre les
  statistiques de quelqu'un lisibles par une adresse est une décision qui se
  prend — elle n'a pas à être un effet de bord du fait qu'on voulait une image.
  Un test de route refuse d'ailleurs que la réponse porte autre chose que les
  chiffres et le pseudo : ce qui traîne dans une réponse d'API finit à l'écran
  de quelqu'un d'autre.

Le calcul vit dans `src/lib/bilanSaison.ts`, hors des routes : la page et
l'image le lisent toutes les deux, et une règle posée dans une seule des deux
finit par ne valoir que pour l'une d'elles — cette divergence-là a déjà coûté
une soirée ici.

**Les mots de l'image ne peuvent pas passer par `useT`** : elle est dessinée au
serveur, sans composant ni stockage local. C'est la situation des notifications
et du courriel hebdomadaire, et la même réponse — `src/lib/i18n/imageBilan.ts`,
avec la langue rangée sur le compte. Sans ça l'image serait partie en français
à tout le monde, et rien ne l'aurait signalé : celui qui écrit l'application la
lit en français. Un test refuse un dictionnaire recopié six fois.

`etiquetteLocale` a déménagé de `LocaleContext` (module client) vers
`langues.ts` : une image rendue au serveur a besoin des formats `Intl` sans
traîner React avec elle. Le premier jet écrivait la période
« 2026-05-25 → 2026-08-23 », ce qui se lit comme une sortie de base de données.

Quatre tests navigateur : la page montre les chiffres, l'image sort en PNG —
vérifié sur la signature du fichier, pas sur sa taille, parce qu'une page
d'erreur rendue en 200 passerait un contrôle de taille — et elle ne sort pas
sans session.

### Dépendances, au 23 août
`npm audit` : **zéro vulnérabilité**, dans l'application comme dans
l'application desktop.

Mises à jour appliquées, toutes correctives ou mineures : `next` 16.3.1 →
16.3.2, `eslint-config-next` 16.2.9 → 16.3.2, `react` et `react-dom` 19.2.4 →
19.2.8, `@types/react-dom` 19.2.4 → 19.2.5. Types, tests unitaires,
construction et les 74 parcours navigateur repassés après.

Trois majeures **écartées volontairement**, chacune pour la même raison — un
saut de version majeure se relit, il ne se prend pas de nuit :
- `typescript` 5.9 → 7.0 ;
- `eslint` 9 → 10 ;
- `@types/node` 20 → 26, qui suivrait la version de Node du déploiement, pas
  l'inverse.

`next-auth` apparaît comme « en retard » sur 4.24.15 : c'est faux, le projet
est sur la 5 en préversion et la 4 est l'ancienne branche stable.

### Les séances faites sans réseau (question 209)
La dette se paie souvent là où le réseau n'est pas : une salle en sous-sol, un
train, une chambre au fond d'un appartement. L'échec était avalé en silence —
un `catch {}` autour de l'envoi, la fenêtre se refermait, la dette restait
entière. C'est la pire façon de se tromper : celui qui vient de faire ses
pompes voit sa dette intacte et conclut que l'application ne marche pas.

Ce qui est mis de côté, c'est le **paiement**, pas la partie. Une partie a
besoin du barème du serveur pour être chiffrée ; un paiement dit une chose
complète et vérifiable : « j'ai fait tant de secondes d'effort, tel jour ».
C'est aussi ce que la question demandait.

`src/lib/fileHorsLigne.ts` garde la file dans le stockage local. Elle se vide
au chargement d'un écran connecté et à l'événement `online` — qui n'est pas
fiable seul, il se déclenche sur une connexion au routeur et pas sur un accès
réel, mais il ne coûte rien et rattrape le cas courant. La pastille de dette
annonce ce qui attend : sans ça, la dette paraît intacte après une séance et on
la refait.

**Le jeton est la pièce maîtresse.** La file réessaie tant qu'elle n'a pas reçu
de réponse, et une réponse perdue en chemin est indiscernable d'une requête
jamais arrivée — c'est le cas normal dans un tunnel. Sans jeton, ce cas paie
deux fois la même séance, c'est-à-dire efface une dette qu'on n'a pas faite.
`Paiement.jeton` est unique en base ; la route regarde avant d'écrire, et
rattrape la violation d'unicité pour les deux renvois qui se croisent — une
erreur ferait réessayer la file indéfiniment sur un paiement pourtant
enregistré.

Ce que la file jette et ce qu'elle garde, écrit une fois pour toutes :
- **échec réseau** : tout est gardé, et on s'arrête là — inutile de brûler la
  file entière quand le réseau est encore coupé ;
- **401** : gardé. La session a expiré ; jeter serait perdre l'effort ;
- **autre 4xx** : jeté. Le serveur n'en voudra jamais, et le garder bloquerait
  toute la file derrière ;
- **5xx** : gardé, c'est peut-être passager.

Les envois partent **en série**. Le serveur calcule chaque paiement sur la
dette du moment : deux envois simultanés liraient la même valeur et l'un des
deux serait perdu.

### Un contrôle d'intégration continue qui n'a jamais rien contrôlé
Le garde posé en V235 — « la base montée par les migrations correspond-elle au
schéma ? » — était écrit :

```sh
ecart=$(npx prisma migrate diff --from-url "$DATABASE_URL" … --script | grep … || true)
```

`--from-url` a été retiré de Prisma 7. La commande sortait donc en erreur sur
la sortie d'erreur, `grep` ne recevait rien, `ecart` était vide, et l'étape
passait au vert. **Quatre versions vertes sans que rien ne soit vérifié**, et
rien ne pouvait le dire : une étape verte ressemble à une étape qui a
travaillé.

Deux corrections, et la seconde est la vraie :
- l'option devient `--from-config-datasource` ;
- `--exit-code` sépare les trois issues — 0 identique, 2 différent, 1 panne —
  et le `|| true` disparaît. Un contrôle qui ne sait pas échouer ne contrôle
  rien.

Éprouvé dans les trois états : base amputée d'une colonne (échec, « diffère »),
base conforme (succès), base injoignable (échec, « n'a pas pu tourner »).

`src/controleSchema.test.ts` garde les trois choses qui l'ont fait mentir :
l'étape existe et appelle bien la comparaison, elle emploie `--exit-code`, elle
n'emploie pas `--from-url`, et elle n'avale pas son échec. Les trois sabotages
sont attrapés.

### La lecture d'Apex, éprouvée sur de vrais pixels
`groupesChiffres.test.ts` dessine des traits aux largeurs relevées à la main.
C'est utile — on y écrit exactement le cas qu'on veut éprouver — mais ça ne
prouve pas que les largeurs relevées soient les bonnes, ni que le seuil d'encre
tienne devant une image réelle, avec son bruit, son anticrénelage et le fond du
jeu qui bouge derrière.

`desktop/src/lecture/capturesReelles.test.ts` lit trois bandes de 342 × 32
pixels découpées dans trois captures 3440 × 1440, à l'endroit exact où la
fonction va lire : cartouche complet, cartouche décalé d'une seconde (tout le
bloc glisse de sept pixels), et cartouche absent. Pas les captures entières —
cinq méga-octets chacune contre vingt kilo-octets pour la bande compressée — et
le reste du cadre reconstitué est noir, puisque la fonction n'y regarde jamais.
Format brut compressé plutôt que PNG : le décoder demanderait une bibliothèque,
or la seule disponible ici l'est par transitivité, alors que `zlib` vient avec
Node.

Éprouvé en sabotant les trois constantes qui gouvernent le tri — seuil d'encre,
largeur maximale d'un chiffre, écart entre deux chiffres d'un même nombre :
chacune fait tomber le test.

#### Une partie Apex avec la boxe
La partie lue à l'écran passe par la même route qu'une saisie à la main, mais
elle est la seule sans rôle, sans champion et sans résultat — tout est déduit
du classement. La pastille en jeu annonce ensuite ce que la partie coûte, dans
l'unité de l'exercice choisi : « 30 s de boxe » et « 30 pompes » ne sont pas la
même chose. Sans répartition dans la réponse, elle retombe sur le total en
points, c'est-à-dire sur un nombre dans la mauvaise unité, sans que rien ne le
signale. Trois tests couvrent ce chemin : boxe seule, partage entre deux
exercices, et alimentation du compteur de dette.

#### « Une victoire coûte moitié moins » ne s'applique jamais en battle royale
La règle est écrite dans `calcScoreBattleRoyale` et elle est inatteignable : à
la première place, `position` vaut zéro, donc les morts équivalentes aussi,
donc le score brut est au mieux nul et le maximum le ramène à zéro. La moitié
de zéro reste zéro. Le barème n'est pas faux — gagner ne coûte rien, c'est ce
qu'on veut — mais le code disait une chose qu'il ne faisait pas.

La ligne reste, avec sa vraie raison : un poids d'élimination négatif, que le
panneau d'administration accepte, rendrait le score brut positif à la première
place. C'est le seul chemin qui l'atteint. Un test pin le comportement pour
qu'on ne croie pas qu'un jour la règle a servi.

### L'audit d'accessibilité regardait neuf pages sur quinze
Cinq pages publiques n'avaient jamais été auditées, et ce ne sont pas les moins
exposées : la liste d'attente et le calculateur existent pour être trouvés par
quelqu'un qui n'a pas de compte, la récupération sert à celui qui n'entre plus,
et la connexion de l'application desktop est le premier écran qu'on y voit. Un
audit qui ne regarde que les pages qu'on a sous la main n'audite que celles-là.

`scripts/accessibilite.mjs` en couvre quinze depuis — `/waitlist`,
`/recuperation`, `/recuperation/valider`, `/calculateur`,
`/calculateur/league-of-legends`, `/connexion-app` en plus des neuf d'avant —
soit **90 passes** (quinze pages, six langues) au lieu de 54. **0 constat**,
aucune page laissée de côté.

`/calculateur/<jeu>` figure par un exemplaire : les seize pages sortent du même
gabarit. `/obs/<jeton>` reste dehors avec sa raison écrite dans le script —
c'est une source de diffusion lue par un logiciel de streaming, sans
navigation, sans formulaire et sans lecteur d'écran en face d'elle.

Zéro constat sur des pages jamais regardées demandait vérification : un
contraste de 1,21 posé volontairement sur `/waitlist` est bien remonté, avec
son ratio, sa taille et son texte. L'outil sait échouer.

### Ce que les pages publiques emportaient pour rien
La mise en page racine montait vingt composants clients sur **chaque** page.
Six ne peuvent rien faire sans l'application Windows (`window.electronLOL`),
sept commencent par `if (estPagePublique(chemin)) return`. Autrement dit :
quelqu'un qui ouvre les CGU depuis un téléphone téléchargeait la modale
d'accueil, la visite guidée, la demande de consentement santé, la détection de
partie, la lecture d'écran d'Apex — et leurs dictionnaires en six langues —
pour ne rien en montrer. Ce sont exactement les pages qu'un visiteur voit en
premier.

Deux ponts les chargent à la demande. `PontDesktop` décide sur la présence du
pont Electron, `PontConnecte` sur `usePathname()` : deux valeurs connues au
rendu, sans requête, donc sans texte qui apparaît en retard.

| page | avant | après |
|---|---|---|
| `/cgu` | 213 ko | 182 ko |
| `/calculateur` | 214 ko | 184 ko |
| `/telechargement` | 214 ko | 183 ko |
| `/` | 252 ko | 222 ko |
| `/login` | 246 ko | 217 ko |

Une trentaine de kilo-octets sur les dix pages publiques ; les trois écrans
connectés prennent 8 ko de plus, le prix d'un fragment supplémentaire. C'est le
bon sens de l'échange.

Trois pièces restent dans la mise en page, et pour des raisons distinctes :
`ServiceWorkerActif` doit s'enregistrer pour tout le monde (c'est lui qui porte
la page de secours hors ligne), `Nav` et `Footer` s'affichent partout, et
`RailLateral` rend du vrai balisage — le différer ferait sauter la page au
moment où il se pose.

Ce qui n'a **pas** été fait, et pourquoi : les dictionnaires partent en six
langues sur chaque page, alors qu'on en lit une. Les découper suppose de
connaître la langue au serveur, or elle est lue dans le stockage du navigateur
(`low_locale`, puis `navigator.language`). Un chargement par langue les ferait
donc arriver après le montage : le texte paraîtrait en retard, c'est-à-dire
exactement le défaut qu'on vient de corriger sur le tableau de bord. Ça se
règle en mettant la langue dans l'adresse, ce qui est une décision de produit.

`src/pontsDeChargement.test.ts` garde le mécanisme. Il repose sur deux choses
que rien ne signale si elles disparaissent : l'import doit rester
`dynamic(..., { ssr: false })`, et la mise en page ne doit pas importer ces
composants elle-même — un seul import direct ramène le module dans le morceau
commun, pont ou pas pont. Le composant se comporterait exactement pareil ; le
défaut ne se verrait qu'à la balance.

Deux pièges rencontrés en écrivant ce test, tous deux découverts en le
sabotant :
- **Lire la liste dans le mécanisme qu'on éprouve.** La première version tirait
  les noms des déclarations `const X = dynamic(...)`. Remplacer un import
  dynamique par un import ordinaire faisait donc sortir le nom de la liste, et
  le test vérifiait la propriété sur les seuls composants qui l'avaient encore.
  Les deux sabotages passaient au vert. La liste vient maintenant du JSX rendu,
  la seule chose qu'on ne peut pas retirer sans retirer le composant.
- **Borner une déclaration au nombre de caractères.** « Les 400 caractères qui
  suivent » laissaient lire le `ssr: false` de la déclaration d'après. La
  déclaration s'arrête à la suivante, pas à une longueur.

### Le tableau de bord sur téléphone bridé — réglé
Le premier écran est rendu au serveur depuis. Le titre et le rappel du test de
force ne dépendent que de trois valeurs (`User.pompesMax`, `User.pompesMaxLe`,
les paliers), lues dans `src/app/dashboard/page.tsx` et passées en `depart` au
composant client `TableauDeBord`. Le reste de la page n'a pas bougé : elle est
toujours cliente, elle lit toujours `/api/dashboard` après montage.

**1172 ms au lieu de 3456**, et le plus grand élément est bien le rappel. Les
neuf écrans sont désormais sous le seuil de 2500 ms.

L'ordre des sources compte, et il est écrit dans le composant : ce qu'on vient
de saisir passe devant la réponse de l'API, qui passe devant ce que le serveur
a rendu. Le départ serveur n'est jamais faux, il est seulement le plus ancien
des trois. Le fragment est écrit une fois et rendu dans les deux états — avant
et après l'arrivée des données — sinon il sauterait au moment de la bascule.

`e2e/premier-ecran.spec.ts` lit le HTML **brut** de la réponse, pas la page
rendue : une fois hydratée, elle afficherait le rappel dans les deux cas et le
défaut ne se verrait pas. Éprouvé en retirant le fragment du rendu d'attente :
le test tombe.

Ce que ça coûte : `/dashboard` passe de statique à rendu à la demande. La page
était derrière l'authentification de toute façon, et son HTML statique ne
contenait rien d'utile.

#### La suite navigateur butait sur son propre limiteur
Le sixième fichier de parcours ne pouvait pas ouvrir de compte : cinq
inscriptions par quart d'heure, et chaque fichier en fait une. La panne ne
ressemblait pas à sa cause — c'est le fichier ajouté en dernier qui échouait,
quel qu'il soit, et il passait seul. La purge existait déjà mais une seule fois
avant toute la suite, donc sans effet sur ce que la suite fait elle-même.
`e2e/limiteur.ts` la rend appelable, et chaque ouverture de compte l'appelle.

### Le tableau de bord sur téléphone bridé (avant correction)
3476 ms de LCP, au-dessus du seuil de 2500 — les seuls des neuf pages à le
franchir. Ce n'est pas un problème de poids : `/history` et `/settings` ont un
paquet de départ comparable et paraissent à 1300 ms.

La chaîne, mesurée sur 4G moyenne et processeur quatre fois plus lent : le
JavaScript initial charge jusqu'à 2845 ms, l'hydratation suit, les quatre
appels API partent ensemble à 3080 ms, et le plus grand élément — le rappel du
test de force — paraît à 3448 ms. Le tableau de bord n'a rien de grand à
montrer tant que ses données ne sont pas revenues, alors que les deux autres
écrans élisent un élément déjà présent.

Faire venir ce texte plus tôt suppose de rendre le premier écran côté serveur :
la page est entièrement cliente et lit tout après montage. C'est un chantier,
pas une retouche — il n'a pas été entrepris de nuit.

## Commandes utiles
```bash
npm run dev          # Lancer en local
npx jest             # Lancer les tests
npx tsc --noEmit     # Vérifier TypeScript avant commit
npx prisma generate  # Regénérer client après modif schema
npx prisma studio    # UI DB locale
```

## Déploiement Vercel

La commande de construction sur Vercel n'est **pas** celle de `package.json` :
c'est `prisma generate && prisma migrate deploy && next build`, réglée dans le
tableau de bord. Construire ici avec `npm run build` ne lance donc pas la même
chose, et un échec Vercel peut très bien ne pas se reproduire en local.

Vercel déploie **toute branche poussée**. Une branche sans code — dépôt de
fichiers, notes — échoue sur `prisma generate` en six secondes et envoie un
courriel d'échec. Y poser un `vercel.json` la met à l'écart :

```json
{ "git": { "deploymentEnabled": false } }
```

### Une base neuve se construit depuis `prisma/migrations`
Elle ne le pouvait pas. Le schéma d'origine avait été poussé sur Neon avant que
le dossier de migrations existe : aucune migration ne créait `User`, `Game` ni
`Goal`, et sur une base vide `prisma migrate deploy` échouait à la cinquième en
annonçant « relation "User" does not exist ». Ça ne se voyait pas en
production, dont la base est antérieure. Ça se serait vu le jour d'une reprise
après sinistre, c'est-à-dire le pire jour possible.

`20260101000000_socle` crée maintenant tout le schéma, **conditionnellement** :
sur une base vide il la monte entière, sur la production il ne fait rien. Les
trente-deux migrations qui suivent sont toutes écrites en `IF NOT EXISTS`, donc
elles n'ont plus rien à faire après lui. Il se régénère, il ne s'écrit pas à la
main :

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
```
puis on rend chaque création conditionnelle, et chaque clé étrangère tolérante
à sa propre présence (PostgreSQL n'a pas d'`ADD CONSTRAINT IF NOT EXISTS` : on
rattrape `duplicate_object`).

Éprouvé dans les deux sens, qui sont les deux seuls qui comptent : sur une base
vide, les trente-trois migrations passent et le schéma obtenu est **identique**
au schéma Prisma (diff vide) ; sur une base déjà à jour dont on retire la ligne
du socle — ce qui reproduit exactement la production —, le socle s'applique
sans rien changer.

Deux gardes pour que ça le reste :
- `src/migrationsRejouables.test.ts` refuse toute création, tout ajout de
  colonne et toute clé étrangère écrits inconditionnellement. Éprouvé en
  retirant un `IF NOT EXISTS`, puis en supprimant le socle.
- La CI ne monte plus sa base par un diff du schéma mais par
  `prisma migrate deploy`, puis vérifie que le résultat correspond au schéma.
  Le raccourci précédent cachait le défaut au lieu de le signaler : les
  parcours passaient au vert sur une base qu'aucune reprise n'aurait pu
  reconstruire.

Turbopack refuse d'analyser un chemin de fichier composé d'un paramètre ou
d'un tableau étalé : il annonce « Dynamic filesystem access causes tracing of
the whole project » et embarque tout le dépôt dans la fonction. Les chemins
lus au disque s'écrivent en toutes lettres, et de préférence à la racine du
module — la page qui les consomme est rendue à la construction, la présence se
constate donc une fois pour toutes (`src/lib/videoBoucle.ts`).

## Points d'attention
- `NEXT_PUBLIC_*` vars compilées au build → redeploy Vercel nécessaire après ajout
- `prisma migrate deploy` utilisé par Vercel (pas `db push`) → toute nouvelle table nécessite une migration dans `prisma/migrations/`
- `ChampionInput` est `"use client"` et fetch `/api/champions` au montage (liste dynamique)
- `SessionContext` (lib/) = session de JEU (polling Riot), différent de la session auth NextAuth
- Le `SessionProvider` dans layout.tsx est celui de `@/lib/SessionContext`, PAS de `next-auth/react` → ne pas utiliser `useSession` de `next-auth/react` dans des composants client (utiliser `fetch('/api/auth/session')` à la place)
