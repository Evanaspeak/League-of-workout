# Win or Workout — App Desktop

App Electron qui transforme Win or Workout en application native, avec
**détection automatique des parties en temps réel** via l'API locale de League
of Legends (`127.0.0.1:2999`).

## Comment ça marche

- L'app ouvre une fenêtre native qui **charge le site** (`http://localhost:3000`
  en dev). Tu te connectes avec Google/Discord comme sur le web — toute l'UI et
  l'authentification de la Phase 1 sont réutilisées.
- En arrière-plan, l'app **surveille l'API Live Client** de League :
  - Début de partie détecté → événement `game-started`
  - Fin de partie détectée → événement `game-ended`
- Quand une **session est active** et qu'une partie se termine, les pompes sont
  **loggées immédiatement** (au lieu d'attendre le timer de 2 min du web).

## Lancer en développement

Prérequis : avoir **Node.js** installé, et le serveur web qui tourne
(`npm run dev` à la racine du projet, sur `http://localhost:3000`).

```bash
cd desktop
npm install
npm start
```

Une fenêtre « Win or Workout » s'ouvre. Connecte-toi, lance une session
depuis le dashboard, puis joue une partie de League : à la fin de la partie elle
sera détectée et loggée automatiquement.

### Pointer vers un backend déployé

Par défaut l'app charge `http://localhost:3000`. Pour viser le site en ligne :

```bash
# Windows (cmd)
set LOW_BACKEND_URL=https://ton-site.com && npm start

# macOS / Linux
LOW_BACKEND_URL=https://ton-site.com npm start
```

## Générer l'exécutable (.exe)

```bash
cd desktop
npm install
npm run build
```

L'installeur Windows est produit dans `desktop/dist/`. (À lancer depuis Windows.)

## Structure

```
desktop/
  src/
    main.js         Processus principal : fenêtre + surveillance des parties
    preload.js      Pont sécurisé → expose window.electronLOL à la page web
    liveclient.js   Lecture de l'API Live Client de League (127.0.0.1:2999)
```

## Zone de notification

Fermer la fenêtre ne quitte pas l'application : elle se replie près de
l'horloge et continue de détecter les parties. C'est la raison d'être de
l'icône — la détection suppose que l'app tourne pendant qu'on joue, et
personne ne garde une fenêtre ouverte toute une soirée.

- **Double-clic** sur l'icône : rouvrir la fenêtre.
- **Clic droit** : ouvrir, activer ou couper l'overlay, quitter.
- Le premier repli affiche une notification, pour qu'on ne croie pas avoir
  quitté. Une application vivante sans rien à l'écran est un piège ; l'icône
  est ce qui rend cet état visible.
- Si l'icône ne peut pas être créée, fermer la fenêtre arrête l'application :
  mieux vaut s'arrêter franchement que survivre sans moyen de revenir.

## Détection des jeux

L'application repère le lancement d'un jeu en lisant la liste des processus,
comme le fait le gestionnaire des tâches. Rien n'est injecté, aucun processus
n'est ouvert ni modifié, et aucun droit d'administration n'est nécessaire.

Dans les réglages : les jeux à surveiller, et ce que leur lancement déclenche
— démarrer une session, afficher l'overlay, ouvrir la fenêtre.

**Pourquoi une entrée au démarrage de Windows.** Pour remarquer qu'un jeu se
lance, il faut déjà tourner. Windows n'offre à un programme ordinaire aucun
crochet du type « réveille-moi quand tel exécutable démarre » : les mécanismes
qui existent (consommateurs d'événements WMI permanents, tâches déclenchées par
le journal d'audit) exigent des droits d'administration et sont ceux qu'emploient
les logiciels de persistance malveillants. L'application se lance donc avec
Windows, mais sans fenêtre : seule l'icône près de l'horloge est là.

Trois jeux ne peuvent pas être distingués de leur voisin, faute de signal
propre : Teamfight Tactics partage son exécutable avec League of Legends,
Warzone avec Call of Duty, et Minecraft Java s'exécute dans `javaw.exe` que
partagent tous les programmes Java — seule l'édition Windows est surveillée.

## Prochaines étapes

- Rien de prévu : dis ce qui manque.

## Overlay en jeu (test)

L'app affiche une pastille de test par-dessus le jeu. Elle sert à vérifier un
point précis : **est-ce qu'une fenêtre transparente arrive à se dessiner
au-dessus de League quand il est en plein écran ?**

- Elle apparaît **au lancement de l'app**, en haut à droite.
- Elle apparaît aussi **toute seule au début d'une partie**, et disparaît à la fin.
- **Ctrl + Maj + O** l'affiche ou la masque à tout moment, même en jeu.
- Elle laisse passer les clics : impossible de gêner une partie.

Le chronomètre qui défile est là pour prouver que l'overlay est *vivant* :
s'il avance pendant la partie, le rendu passe bien par-dessus le jeu.

Aucune injection n'est faite dans le processus du jeu — c'est une simple
fenêtre Electron maintenue au premier plan, donc rien qui puisse inquiéter un
anti-cheat.

### Résultats possibles

| Ce que tu vois | Ce que ça veut dire |
|---|---|
| La pastille s'affiche et le chrono avance | Windows compose le plein écran : la voie est libre |
| Rien en jeu, mais visible sur le bureau | Plein écran exclusif réel : il faudra une autre méthode |

### Résultat mesuré (17 août 2026, League of Legends, Windows 11)

- **Sans bordure** : l'overlay s'affiche correctement.
- **Plein écran** : il disparaît et ne revient pas. Les « optimisations de
  plein écran » de Windows étaient pourtant actives : le jeu obtient bien un
  plein écran exclusif, où rien d'autre n'est composé.

Conclusion : un overlay est viable en sans bordure, pas en plein écran
exclusif. Le contourner demanderait de s'accrocher au rendu du jeu, ce que
l'anti-cheat interdit — c'est donc une limite à assumer, pas un bug à corriger.
