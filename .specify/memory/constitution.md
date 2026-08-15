<!--
Sync Impact Report
==================
Version : (aucune) → 1.0.0
Motif du bump : MAJOR — première ratification. Le document passe du gabarit
vierge à une constitution complète ; tous les principes sont nouveaux.

Principes ajoutés :
  I.   Le point d'effort est la seule monnaie
  II.  Le moteur de calcul est sous test
  III. Un jeu ne montre que ce qu'il possède
  IV.  Rien n'arrive en prod dans une seule langue
  V.   Livrer petit, livrer versionné

Sections ajoutées :
  - Cap produit (horizon 3 mois)
  - Contraintes techniques et sécurité
  - Workflow de développement
  - Gouvernance

Sections supprimées : aucune.

TODO différés : aucun.

Cohérence des artefacts dépendants :
  ✅ CLAUDE.md — conventions de branche et de versionnage déjà alignées
  ⚠️  src/lib/exercices.ts, src/lib/jeux.ts — non couverts par des tests à la
      ratification ; le principe II impose de combler avant tout nouveau
      changement de leur logique
  ⚠️  src/app/LandingClient.tsx — l'accueil décrit encore le produit d'avant
      (pompes + League) ; contredit le Cap produit, refonte à faire
-->

# Constitution de Win or Workout

## Core Principles

### I. Le point d'effort est la seule monnaie

Toute activité enregistrée est convertie en **points d'effort** avant d'être
stockée. Un point vaut une pompe. Les exercices ne sont que des unités
d'affichage : les répétitions et les durées se calculent au moment du rendu,
jamais en base.

Règles non négociables :

- La base ne stocke JAMAIS de répétitions ni de secondes d'exercice, seulement
  des points et leur répartition.
- Un nouvel exercice s'ajoute en déclarant son taux de conversion, et rien
  d'autre. S'il faut toucher au scoring pour l'ajouter, c'est que la règle est
  violée.
- Une partie reste UNE ligne, même payée en plusieurs exercices : la ventilation
  vit dans `repartition`, pas dans des lignes dupliquées.

*Raison* : c'est ce qui a permis d'ajouter squats, boxe, jeux au temps et
battle royale sans jamais migrer les données existantes. C'est l'invariant qui
tient tout le produit debout.

### II. Le moteur de calcul est sous test (NON NÉGOCIABLE)

`src/lib/scoring.ts`, `src/lib/exercices.ts` et `src/lib/jeux.ts` forment le
moteur. Ils décident ce que l'utilisateur doit physiquement faire.

Règles non négociables :

- Toute modification du comportement d'une de ces trois unités DOIT être
  accompagnée d'un test automatisé qui échoue avant le correctif et passe après.
- Les invariants suivants DOIVENT rester couverts en permanence : la somme d'une
  répartition égale exactement le total (aucun point perdu ni inventé) ; une
  conversion aller-retour d'un mode d'équipe retrouve le mode d'origine ; un
  scoring de battle royale est monotone par rapport au classement.
- Une vérification par script jetable ou par capture d'écran NE COMPTE PAS comme
  un test. Elle prouve le présent, pas le futur.

*Raison* : si le moteur se trompe, tout le produit ment à l'utilisateur sur ce
qu'il doit à son corps, et il ne peut pas s'en rendre compte. Le reste du code
peut casser bruyamment ; celui-ci casse en silence.

### III. Un jeu ne montre que ce qu'il possède

Les capacités d'un jeu sont déclarées une seule fois, dans le catalogue
(`src/lib/jeux.ts`), et l'interface s'y plie.

Règles non négociables :

- Aucun écran ne DOIT demander ni afficher une donnée que le jeu sélectionné n'a
  pas : pas de champion sur Counter-Strike, pas de rôle sur Fortnite, pas de
  victoire/défaite sur une session Minecraft, pas de KDA sur un battle royale.
- Une statistique qui n'a pas de sens pour un jeu s'affiche `—`, jamais `0`.
  Zéro est une valeur ; l'absence n'en est pas une.
- Une nouvelle capacité s'ajoute au type `CapacitesJeu`, jamais par un test sur
  le nom du jeu ailleurs dans le code.

*Raison* : le winrate comptait les soirées Minecraft comme des défaites, et le
graphique par rôle mettait toutes les parties Fortnite dans une case `—`. Les
deux venaient du même défaut : une donnée réclamée à un jeu qui ne l'a pas.

### IV. Rien n'arrive en prod dans une seule langue

L'application est bilingue FR/EN de bout en bout, via les dictionnaires de
`src/lib/i18n/dictionaries/`.

Règles non négociables :

- Aucune chaîne visible par l'utilisateur ne DOIT être écrite en dur dans un
  composant. Elle passe par un dictionnaire, dans les deux langues.
- Un texte ajouté en français sans son équivalent anglais bloque la mise en
  prod, au même titre qu'une erreur de compilation.
- Les messages d'erreur d'API sont traduits côté client via `translateApiError`,
  pas renvoyés traduits par le serveur.

*Raison* : la traduction rétroactive coûte dix fois le prix de la traduction
immédiate, et l'ouverture au public rend l'anglais obligatoire.

### V. Livrer petit, livrer versionné

Le développement se fait sur `claude/excel-app-conversion-5hk2fg`, la prod est
`main`.

Règles non négociables :

- Chaque passage en prod est un commit de merge `--no-ff` nommé
  `Vx — description courte`, où `x` s'incrémente depuis l'historique de `main`.
  C'est la seule façon d'identifier une version dans le tableau de bord Vercel.
- `npx tsc --noEmit` et `npm run build` DOIVENT passer avant tout merge sur
  `main`. Le nombre d'erreurs de lint ne DOIT jamais augmenter.
- Toute nouvelle table ou colonne DOIT venir avec une migration dans
  `prisma/migrations/` : la prod déploie avec `prisma migrate deploy`, pas
  `db push`. Une migration DOIT être additive et idempotente (`IF NOT EXISTS`).

*Raison* : 54 versions en six semaines n'ont tenu que grâce à ça. Le jour où une
version casse, on veut pouvoir dire laquelle.

## Cap produit (horizon 3 mois)

Le produit vise l'**ouverture publique des inscriptions**. Les décisions
d'arbitrage se tranchent en faveur de « ça marche sans qu'Evan soit là »
plutôt que « ça va plus vite pour Evan ».

Trois orientations arrêtées :

1. **L'overlay OCR est le pari technique central.** L'API Riot étant bloquée en
   attente d'autorisation, la reconnaissance à l'écran est la voie retenue pour
   l'enregistrement automatique et l'affichage en direct pendant la partie.
   L'application desktop Electron en est le véhicule.
2. **Le catalogue jeux et exercices est gelé.** Après vingt-trois versions
   consécutives d'élargissement du modèle, aucun nouveau jeu ni exercice n'est
   ajouté sans justification explicite. Le modèle est assez large.
3. **Le prochain palier fonctionnel est le social** : classements, défis entre
   amis, partage. C'est ce qui donne une raison de revenir.

Une dette produit est reconnue à la ratification : **l'écran d'accueil décrit
encore le produit d'avant** — les pompes et League of Legends — alors que
l'application accepte n'importe quel jeu payé en n'importe quel exercice. Tant
qu'elle n'est pas corrigée, l'ouverture publique est prématurée.

## Contraintes techniques et sécurité

Stack imposée : Next.js 15/16 (App Router), React, TypeScript, Prisma +
PostgreSQL (Neon), Auth.js v5, Tailwind v4, Recharts, Vercel pour le web,
Electron pour le desktop.

Règles de sécurité non négociables :

- Toute route API vérifie `getCurrentUser()` avant d'accéder à la moindre
  donnée. Le contrôle d'accès admin se fait côté serveur, jamais par un test
  côté client.
- Aucune réponse d'API ne DOIT exposer `passwordHash` ni aucun secret. Le défaut
  est de lister explicitement les champs renvoyés, pas de retirer les champs
  sensibles d'un objet complet.
- Aucun identifiant, jeton ou clé ne DOIT être écrit dans le code, dans un
  commit, ni affiché en conversation — y compris pour confirmer qu'une
  manipulation a réussi.

Contraintes d'interface :

- Les libellés de formulaire DOIVENT être reliés à leur champ (`htmlFor`/`id`).
- Un composant interactif construit à la main (autocomplétion, liste, modale)
  DOIT porter les rôles ARIA correspondants et rester utilisable au clavier.
- Une modale DOIT offrir au moins trois sorties : le fond, la croix et `Échap`.

## Workflow de développement

- Les vérifications minimales avant merge sont : `npx tsc --noEmit`, `npm run
  build`, et `npx jest` pour tout changement touchant le moteur.
- Le comportement d'une interface se vérifie sur la vraie page, en interceptant
  les appels réseau, pas sur une page de démonstration reconstruite à côté.
- Quand une correction est demandée pour un cas précis, chercher les autres
  occurrences du même défaut avant de conclure. Un symptôme rapporté est
  rarement seul.
- Le code écrit ressemble au code qui l'entoure : commentaires en français,
  expliquant le *pourquoi*, jamais le *quoi*.

## Governance

Cette constitution prime sur les habitudes et sur les préférences ponctuelles.
Un choix qui la contredit n'est pas interdit, mais il DOIT être signalé
explicitement au moment où il est fait, et justifié.

**Amendement** : toute modification passe par une mise à jour de ce fichier,
accompagnée du Sync Impact Report en tête de document et de la mise à jour des
artefacts dépendants (`CLAUDE.md` en particulier).

**Versionnage** : versionnage sémantique du document.
MAJOR pour un retrait ou une redéfinition incompatible d'un principe, MINOR pour
un principe ou une section ajoutée, PATCH pour une clarification.

**Conformité** : les principes marqués NON NÉGOCIABLE bloquent une mise en prod.
Les autres se vérifient au fil de l'eau ; un écart répété sur l'un d'eux est le
signal qu'il faut soit corriger le code, soit amender la constitution.

**Version**: 1.0.0 | **Ratified**: 2026-08-15 | **Last Amended**: 2026-08-15
