# Sauvegarde et restauration de la base

## Ce que ça protège

Le plan gratuit Neon ne garantit aucune sauvegarde, et une seule personne a
accès au compte. Sans ce dispositif, une suppression de projet, une migration
ratée ou un compte perdu efface tout, définitivement.

## Ce qui tourne

`.github/workflows/sauvegarde.yml`, tous les jours à 3 h 17 UTC, et à la
demande depuis l'onglet Actions.

Chaque exécution fait quatre choses, dans cet ordre :

1. **Exporte** la base au format `custom` de `pg_dump`, sans propriétaire ni
   privilèges — les rôles de Neon n'existent nulle part ailleurs, et une
   sauvegarde doit pouvoir se restaurer n'importe où.
2. **Restaure** ce fichier dans un PostgreSQL 16 neuf, monté pour l'occasion.
3. **Compare** le nombre de lignes table par table entre la source et la
   restauration. La liste des tables est lue à la source, jamais écrite en
   dur : un modèle ajouté demain entre dans le contrôle tout seul.
4. **Chiffre** le fichier en AES256 avant de le déposer, puis efface la
   version en clair.

L'étape 3 est celle qui compte. Une sauvegarde que personne n'a jamais
restaurée n'est pas une sauvegarde, c'est une croyance — et l'on découvrirait
le jour de l'accident que les fichiers étaient vides depuis six mois.

Le travail échoue bruyamment si un secret manque, si la source ne rend aucune
table, ou si un seul comptage diffère. Un travail qui « réussit » sans rien
sauvegarder est pire que pas de travail du tout : il rassure.

## Les deux secrets à poser

Dans **Settings → Secrets and variables → Actions** du dépôt :

| Secret | Valeur |
| --- | --- |
| `DATABASE_URL` | la chaîne de connexion Neon, celle qui sert déjà à Vercel |
| `SAUVEGARDE_PASSPHRASE` | une phrase longue, gardée hors du dépôt et hors de GitHub |

Sans eux, le travail s'arrête à la première étape avec un message explicite.
Il ne produit pas de fichier vide.

**La phrase de passe ne doit pas vivre uniquement dans GitHub.** Si le compte
GitHub est perdu, les sauvegardes le sont avec — gardez-en une copie ailleurs,
sur un support qui ne dépend pas du même mot de passe.

## Pourquoi le fichier est chiffré

Il contient des adresses électroniques, des empreintes de mot de passe et des
données de santé au sens de l'article 9 du RGPD. Un artefact GitHub se
télécharge par toute personne ayant accès au dépôt. Le chiffrement symétrique
fait que l'artefact seul ne vaut rien.

## Restaurer

Depuis l'onglet Actions, ouvrir la dernière exécution réussie et télécharger
l'artefact `base-<numéro>`. Puis :

```bash
# 1. Déchiffrer
gpg --batch --decrypt --passphrase "$SAUVEGARDE_PASSPHRASE" \
    --output base.dump base.dump.gpg

# 2. Restaurer dans une base VIDE — jamais par-dessus la production
createdb restauration
pg_restore --dbname="postgresql://…/restauration" \
    --no-owner --no-privileges --exit-on-error base.dump

# 3. Vérifier avant de basculer quoi que ce soit
psql "postgresql://…/restauration" -c 'SELECT count(*) FROM "User";'
```

Restaurer par-dessus une base qui contient encore des données mélange deux
états et n'est pas rattrapable. On restaure à côté, on vérifie, puis on
bascule la chaîne de connexion.

## Ce que ça ne couvre pas

- **Le point de reprise est le dernier passage de nuit.** Ce qui a été écrit
  depuis est perdu. Pour faire mieux, il faut le plan payant de Neon et sa
  restauration à l'instant près.
- **Les artefacts sont gardés quatre-vingt-dix jours.** Au-delà, une
  sauvegarde d'un schéma qui a changé deux fois ne se restaure plus utilement
  de toute façon.
- **Rien ne prévient si le travail cesse de tourner.** GitHub envoie un
  courriel sur un échec, mais pas sur une absence d'exécution. C'est le rôle
  de la supervision, qui vit ailleurs.

## Ce qui a été éprouvé, et comment

Le tour complet a été exécuté sur un PostgreSQL 16 réel, avec le schéma de
l'application posé depuis `prisma/schema.prisma` et des lignes dans `User` et
`LoginAttempt` :

- treize tables exportées puis restaurées, comptages identiques ;
- le contrôle saboté en supprimant une ligne après restauration : il signale
  `User : 2 à la source, 1 après restauration` et fait échouer le travail ;
- fichier chiffré puis déchiffré, identique à l'octet près, et restauré depuis
  sa version chiffrée ;
- déchiffrement refusé avec une mauvaise phrase.

Un contrôle qui ne sait pas échouer ne contrôle rien : c'est pour ça que le
deuxième point figure ici.
