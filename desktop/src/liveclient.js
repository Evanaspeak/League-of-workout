// Surveillance de l'API "Live Client Data" de League of Legends.
//
// Pendant une partie, le client League expose une API locale sur
// https://127.0.0.1:2999/liveclientdata/... avec un certificat AUTO-SIGNÉ Riot.
// - Quand une partie est en cours  → la requête répond 200 (données de jeu).
// - Quand aucune partie n'est lancée → la connexion est refusée / timeout.
//
// On en déduit les événements "début" et "fin" de partie en temps réel.

const https = require("https");
const { issueDeLEvenement, fusionnerReleve } = require("./issueLocale");

const LIVE_CLIENT_URL = "https://127.0.0.1:2999/liveclientdata/allgamedata";
// La fin de partie est une course : l'événement « GameEnd » n'est publié que
// dans les dernières secondes, et l'API se tait dès l'écran de fin. À cinq
// secondes d'intervalle, il arrivait qu'aucun relevé ne tombe dans cette
// fenêtre — et l'issue était alors perdue. Deux secondes divisent la fenêtre
// manquée par deux et demi, pour une requête locale qui ne coûte rien.
const POLL_INTERVAL_MS = 2000;
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

/**
 * Score du joueur devant l'écran, extrait de la liste des dix participants.
 *
 * Riot a changé d'identifiant en cours de route : `riotIdGameName` sur les
 * versions récentes, `summonerName` avant. On accepte les deux, sinon le KDA
 * disparaît au prochain patch.
 */
function scoreDuJoueur(data) {
  const moi = data?.activePlayer;
  const nom = moi?.riotIdGameName ?? moi?.summonerName ?? null;
  const liste = Array.isArray(data?.allPlayers) ? data.allPlayers : [];
  const joueur = liste.find((p) => {
    const n = p?.riotIdGameName ?? p?.summonerName ?? null;
    return n && nom && n === nom;
  });
  const s = joueur?.scores;
  if (!s) return null;
  return {
    kills: Number(s.kills) || 0,
    deaths: Number(s.deaths) || 0,
    assists: Number(s.assists) || 0,
    cs: Number(s.creepScore) || 0,
    champion: joueur?.championName ?? null,
  };
}

// Démarre la boucle de surveillance. `emit(event)` est appelé à chaque
// changement d'état avec { type: "game-started" | "game-ended", at: number },
// et à chaque relevé avec { type: "game-data", ... } pendant la partie.
function startLiveClientWatcher(emit, options = {}) {
  // Le lecteur et la période s'injectent : sans ça, la boucle ne s'éprouve
  // qu'en lançant League. Les valeurs par défaut sont celles de production, et
  // aucun appelant n'a changé.
  const lire = options.lire ?? fetchGameData;
  const periodeMs = options.periodeMs ?? POLL_INTERVAL_MS;
  let inGame = false;
  /**
   * Dernier relevé de la partie en cours.
   *
   * À la fin, l'API ne répond plus : il n'y a donc plus rien à interroger. Ce
   * qu'on a vu juste avant est tout ce qui restera pour enregistrer la partie.
   */
  let dernier = null;

  /**
   * Un tour à la fois.
   *
   * La scrutation est passée de cinq à deux secondes pour ne plus manquer
   * l'événement de fin ; le délai d'expiration d'une requête, lui, est de
   * trois. Sans ce verrou, un client qui répond lentement fait s'empiler les
   * tours, et l'ordre des relevés n'est plus garanti — c'est-à-dire que le
   * dernier relevé gardé peut ne pas être le dernier vu.
   */
  let enCours = false;

  const tick = async () => {
    if (enCours) return;
    enCours = true;
    try {
      await tour();
    } finally {
      enCours = false;
    }
  };

  const tour = async () => {
    const data = await lire();
    const available = !!data;

    if (available && !inGame) {
      inGame = true;
      dernier = null;
      emit({ type: "game-started", at: Date.now() });
    } else if (!available && inGame) {
      inGame = false;
      emit({ type: "game-ended", at: Date.now(), partie: dernier });
      dernier = null;
    }

    if (!available) return;
    // L'horloge de la partie vient du jeu lui-même : c'est du temps joué, pas
    // du temps écoulé. Elle s'arrête donc d'elle-même dans les menus, sans
    // qu'on ait à deviner quoi que ce soit.
    const releve = {
      dureeSec: Math.max(0, Math.round(Number(data?.gameData?.gameTime) || 0)),
      score: scoreDuJoueur(data),
      resultat: issueDeLEvenement(data).resultat,
    };
    // Conservé pour la fin de partie : l'issue n'apparaît que sur les derniers
    // relevés, et l'API se tait dès l'écran de fin. La règle de conservation
    // vit dans `issueLocale`, avec ses tests.
    dernier = fusionnerReleve(dernier, releve);
    emit({ type: "game-data", ...releve });
  };

  const timer = setInterval(tick, periodeMs);
  tick(); // premier check immédiat
  return () => clearInterval(timer);
}

module.exports = { startLiveClientWatcher };
