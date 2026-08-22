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

### Historique (history/page.tsx)
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
- CGU et politique de confidentialité restent en français et en anglais ; un
  bandeau (`LangueDocument`) le dit aux quatre autres langues.

### Admin (/admin)
- Accès restreint : `user.email === "evantocquet@gmail.com"`
- Éditeur liste champions (1 par ligne) → stocké en DB table SystemConfig
- GET `/api/champions` retourne la liste DB ou la liste hardcodée par défaut
- Le lien "Admin" apparaît dans la Nav uniquement pour cet email (via fetch `/api/auth/session`)

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
556 tests unitaires, 34 suites. Base et session doublées : aucune dépendance à
PostgreSQL ni aux variables d'environnement, `npx jest` suffit. La CI
(`.github/workflows/tests.yml`) lance types et tests à chaque poussée, puis les
parcours navigateur dans un second job avec un PostgreSQL de service.

Les tests de routes API appellent les handlers directement, avec les outils de
`src/test/api.ts`. Ce qui est systématiquement éprouvé : refus sans session,
refus pour un compte non administrateur là où c'est requis, et filtrage par
compte sur chaque requête en base.

L'empreinte du mot de passe ne sort pas de la base : `getCurrentUser` la retire
par `omit`, et un test le vérifie sur la requête elle-même. Les deux routes qui
rendent le compte par diffusion passent en plus par `comptePublic`
(`src/lib/compte.ts`), parce qu'un `{ ...user }` publie tout ce qu'on lui remet.
Cette fonction vit à part d'`auth-helpers` : les tests de routes doublent ce
module entier, et le filtre y serait remplacé par une doublure — les tests de
fuite éprouveraient alors un filtre qui n'est pas celui qui tourne.

Au navigateur (`npm run e2e`), 56 tests : `e2e/parcours.spec.ts` suit le chemin
complet d'un compte neuf, `e2e/langues.spec.ts` ouvre les cinq pages publiques
puis les trois écrans connectés — tableau de bord, historique, réglages — dans
les six langues, sur un compte qu'il ouvre lui-même.

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

## Commandes utiles
```bash
npm run dev          # Lancer en local
npx jest             # Lancer les tests
npx tsc --noEmit     # Vérifier TypeScript avant commit
npx prisma generate  # Regénérer client après modif schema
npx prisma studio    # UI DB locale
```

## Points d'attention
- `NEXT_PUBLIC_*` vars compilées au build → redeploy Vercel nécessaire après ajout
- `prisma migrate deploy` utilisé par Vercel (pas `db push`) → toute nouvelle table nécessite une migration dans `prisma/migrations/`
- `ChampionInput` est `"use client"` et fetch `/api/champions` au montage (liste dynamique)
- `SessionContext` (lib/) = session de JEU (polling Riot), différent de la session auth NextAuth
- Le `SessionProvider` dans layout.tsx est celui de `@/lib/SessionContext`, PAS de `next-auth/react` → ne pas utiliser `useSession` de `next-auth/react` dans des composants client (utiliser `fetch('/api/auth/session')` à la place)
