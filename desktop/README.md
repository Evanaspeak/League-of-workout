# League of Workouts — App Desktop

App Electron qui transforme League of Workouts en application native, avec
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

Une fenêtre « League of Workouts » s'ouvre. Connecte-toi, lance une session
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

## Prochaines étapes

- Overlay transparent au-dessus du jeu (prompt de pompes en fin de partie)
- Démarrage automatique de session (sans passer par le bouton du dashboard)
- Lancement au démarrage de Windows / réduction en barre des tâches
