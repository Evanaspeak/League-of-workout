// Surveillance de l'API "Live Client Data" de League of Legends.
//
// Pendant une partie, le client League expose une API locale sur
// https://127.0.0.1:2999/liveclientdata/... avec un certificat AUTO-SIGNÉ Riot.
// - Quand une partie est en cours  → la requête répond 200 (données de jeu).
// - Quand aucune partie n'est lancée → la connexion est refusée / timeout.
//
// On en déduit les événements "début" et "fin" de partie en temps réel.

const https = require("https");

const LIVE_CLIENT_URL = "https://127.0.0.1:2999/liveclientdata/allgamedata";
const POLL_INTERVAL_MS = 5000;
const REQUEST_TIMEOUT_MS = 3000;

// Le certificat de l'API locale est auto-signé : on désactive la vérification
// UNIQUEMENT pour cet agent, et UNIQUEMENT vers 127.0.0.1 (aucun risque réseau).
const localAgent = new https.Agent({ rejectUnauthorized: false });

function fetchGameData() {
  return new Promise((resolve) => {
    const req = https.get(
      LIVE_CLIENT_URL,
      { agent: localAgent, timeout: REQUEST_TIMEOUT_MS },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return resolve(null);
        }
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });
  });
}

// Démarre la boucle de surveillance. `emit(event)` est appelé à chaque
// changement d'état avec { type: "game-started" | "game-ended", at: number }.
function startLiveClientWatcher(emit) {
  let inGame = false;

  const tick = async () => {
    const data = await fetchGameData();
    const available = !!data;

    if (available && !inGame) {
      inGame = true;
      emit({ type: "game-started", at: Date.now() });
    } else if (!available && inGame) {
      inGame = false;
      emit({ type: "game-ended", at: Date.now() });
    }
  };

  const timer = setInterval(tick, POLL_INTERVAL_MS);
  tick(); // premier check immédiat
  return () => clearInterval(timer);
}

module.exports = { startLiveClientWatcher };
