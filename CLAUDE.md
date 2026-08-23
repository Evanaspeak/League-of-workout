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
1003 tests unitaires, 78 suites. Base et session doublées : aucune dépendance à
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

### Le tableau de bord sur téléphone bridé
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

### Une base neuve ne se construit pas depuis `prisma/migrations`
Le schéma d'origine a été poussé sur Neon avant que le dossier de migrations
existe : aucune migration ne crée `User`, `Game` ni `Goal`. Sur une base vide,
`prisma migrate deploy` échoue donc à la cinquième migration
(`20260707140000_add_user_optional_fields`, « relation "User" does not exist »)
et laisse une ligne en échec dans `_prisma_migrations` qui bloque tout le
reste. Ça ne se voit pas en production, dont la base est antérieure — ça se
voit le jour où l'on provisionne un environnement, une base de test, ou une
reprise après sinistre.

Pour monter une base de travail (tests navigateur, essai local) :

```bash
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script \
  | grep -v '^Loaded Prisma config' > /tmp/socle.sql
psql -d wow -f /tmp/socle.sql
```

`prisma db push` ferait la même chose mais réclame un consentement explicite
de l'utilisateur, et refuse de tourner sans lui.

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
