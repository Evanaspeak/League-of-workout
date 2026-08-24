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

## Travail sur une fenêtre longue (IMPORTANT)

Quand l'utilisateur annonce qu'il s'absente pour une durée donnée — « je pars
huit heures », « je reviens demain matin » — cette durée est la durée du
travail attendu, pas un délai maximal.

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
   reprogrammer la suivante.
4. Ne rendre le bilan qu'à la fin de la fenêtre annoncée.

Ce qui demande un arbitrage produit ne se décide pas seul : ça part dans les
questions, pas dans le code.

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
```
Si aucun commit `Vx` n'existe encore, commencer à V1. **Ne pas** utiliser de
tags git (`git push --tags` échoue côté proxy) — le numéro vit dans le message
du commit de merge.

## Architecture fichiers clés

```
src/
  app/
    page.tsx                        # Dashboard (client) — stats, graphiques, mode session
    history/page.tsx                # Historique parties + pompes (client)
    admin/page.tsx                  # Panel admin (server) — restreint à evantocquet@gmail.com
    admin/AdminChampionEditor.tsx   # Éditeur liste champions (client)
    admin/AdminRatiosExercices.tsx  # Réglage des ratios squats et boxe (client)
    settings/page.tsx               # Réglages utilisateur
    login/page.tsx                  # Login
    telechargement/page.tsx         # Page download app desktop
    api/
      dashboard/route.ts            # GET stats globales (totalPompes, statsByPeriod, dailyPompes, etc.)
      dashboard/daily/route.ts      # GET ?date=YYYY-MM-DD → détail horaire du jour
      games/route.ts                # GET liste games, POST nouvelle game
      games/[id]/route.ts           # DELETE + PATCH (modifier date)
      games/preview/route.ts        # POST preview scoring sans sauvegarder
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
prisma/
  schema.prisma       # Modèles DB
  migrations/
    20260629000000_create_system_config/migration.sql  # Crée table SystemConfig
desktop/              # App Electron Windows
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
- CGU et politique de confidentialité restent en français et en anglais ; un
  bandeau (`LangueDocument`) le dit aux quatre autres langues.

### Objectif de première semaine
Ce que quelqu'un fait dans ses sept premiers jours décide s'il reviendra ; le
reste du produit n'y peut plus grand-chose après. L'objectif est donc petit —
cinq parties, ce qu'on enregistre en une soirée — et il ne demande aucun geste
nouveau. Il disparaît au bout de sept jours, atteint ou non : un objectif raté
qui reste affiché n'est plus un objectif, c'est un reproche.

Il se calcule au serveur (`premiereSemaine()` dans `/api/dashboard`) parce que
la date d'inscription n'est pas remise au navigateur, et n'a aucune raison de
l'être pour ce seul usage. Une date illisible ne montre rien plutôt que de
faire vivre l'objectif à vie.

### Envois programmés
`.github/workflows/envois-programmes.yml` appelle `/api/push/programme` toutes
les heures ; la route regarde chez qui il est neuf heures **localement**, à
partir de `User.fuseau` remonté par `ContexteNavigateur`. Deux envois en
sortent :

- **Le rappel du matin.** Une soirée qui finit à deux heures laisse une dette
  que personne ne paie avant d'aller dormir, et le rappel de seuil est déjà
  parti la veille au milieu d'une partie.
- **Le bilan de la semaine**, par courriel, le lundi à neuf heures locales.
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

Un compte sans fuseau connu n'est jamais notifié : envoyer « bonjour » à trois
heures du matin est pire que ne rien envoyer, et `heureLocale()` rend `null`
plutôt que de faire passer une heure UTC pour une heure locale.

Deux secrets à poser dans le dépôt : `SITE_URL` et `RAPPEL_SECRET`, ce dernier
devant valoir la même chose que la variable d'environnement du même nom côté
Vercel. Sans secret configuré, la route refuse tout le monde — une variable
oubliée ne doit pas transformer un déclencheur en porte ouverte.

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

## Tests
1009 tests unitaires, 79 suites. Base et session doublées : aucune dépendance à
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

Au navigateur (`npm run e2e`), 71 tests : `e2e/parcours.spec.ts` suit le chemin
complet d'un compte neuf, `e2e/langues.spec.ts` ouvre les cinq pages publiques
puis les trois écrans connectés — tableau de bord, historique, réglages — dans
les six langues, sur un compte qu'il ouvre lui-même, et
`e2e/installation.spec.ts` éprouve l'invitation à installer l'app et la page
de secours hors ligne, `e2e/historique.spec.ts` regarde l'historique sur un
écran de téléphone, et `e2e/reglages.spec.ts` vérifie que « Tes jeux » explique
pourquoi il n'y a qu'un jeu hors application.

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

Trois scripts pilotent un Chromium sur l'application lancée en local. Ils ne
tournent pas en CI : ils servent à constater, pas à bloquer une poussée.

```bash
node scripts/accessibilite.mjs   # neuf pages, six langues, règles WCAG
node scripts/performance.mjs     # LCP, CLS, poids du JavaScript par page
node scripts/comparer-rendu.mjs  # captures avant/après, par largeur d'écran
```

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
- **Tuer le serveur avec `pkill -f`.** Le motif `next start -p 3311` figure
  aussi dans la ligne de commande du shell qui lance la commande : `pkill` tue
  le shell, le serveur survit, et le `next start` suivant échoue sur
  EADDRINUSE dans un journal que personne ne lit. Huit tests navigateur ont
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
