// Surveillance du CLIENT League — la fenêtre où l'on choisit sa partie.
//
// À ne pas confondre avec `liveclient.js`, qui interroge la partie EN COURS sur
// le port fixe 2999. Ici c'est le lanceur : il expose sa propre API locale, sur
// un port et avec un mot de passe tirés au hasard à chaque démarrage. Les deux
// se trouvent dans un fichier « lockfile » posé à la racine de l'installation,
// et dans la ligne de commande du processus.
//
// C'est cette API qui sait ce que l'API de partie ignore : le type de file
// (classée, ARAM, Arena…), le rôle attribué en sélection, et le moment exact où
// la recherche de partie démarre. Aucune clé développeur, aucune injection —
// une simple requête HTTP vers le lanceur, sur la machine du joueur.
//
// Elle n'est pas documentée par Riot : elle est tolérée, pas garantie. Tout ce
// qui en vient est donc traité comme faillible, et son absence n'empêche jamais
// l'enregistrement d'une partie.

const https = require("https");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { issueDeFinDePartie } = require("./issueLocale");

const PERIODE_MS = 4000;
const DELAI_REQUETE_MS = 3000;

// Certificat auto-signé de Riot, comme pour l'API de partie : vérification
// désactivée pour cet agent seul, et uniquement vers 127.0.0.1.
const agentLocal = new https.Agent({ rejectUnauthorized: false });

/** Emplacements habituels du lockfile, du plus probable au moins. */
function cheminsLockfile() {
  const local = process.env.LOCALAPPDATA || "";
  return [
    "C:\\Riot Games\\League of Legends\\lockfile",
    "D:\\Riot Games\\League of Legends\\lockfile",
    local && path.join(local, "Riot Games", "League of Legends", "lockfile"),
  ].filter(Boolean);
}

/** `LeagueClient:1234:PORT:MOTDEPASSE:https` */
function lireLockfile() {
  for (const p of cheminsLockfile()) {
    try {
      const morceaux = fs.readFileSync(p, "utf8").trim().split(":");
      if (morceaux.length >= 5) {
        return { port: morceaux[2], motDePasse: morceaux[3] };
      }
    } catch {
      /* fichier absent : le client n'est pas lancé, ou installé ailleurs */
    }
  }
  return null;
}

/**
 * Repli quand le lockfile est introuvable : le client passe ses identifiants en
 * ligne de commande. Couvre les installations hors des chemins habituels.
 */
function lireLigneDeCommande() {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve(null);
    execFile(
      "powershell.exe",
      ["-NoProfile", "-Command",
       "(Get-CimInstance Win32_Process -Filter \"name='LeagueClientUx.exe'\").CommandLine"],
      { windowsHide: true, timeout: 5000 },
      (err, stdout) => {
        if (err || !stdout) return resolve(null);
        const port = /--app-port=(\d+)/.exec(stdout);
        const jeton = /--remoting-auth-token=([\w-]+)/.exec(stdout);
        resolve(port && jeton ? { port: port[1], motDePasse: jeton[1] } : null);
      },
    );
  });
}

let identifiants = null;

async function obtenirIdentifiants() {
  if (identifiants) return identifiants;
  identifiants = lireLockfile() || (await lireLigneDeCommande());
  return identifiants;
}

/** Une requête GET sur l'API du lanceur. `null` si le client n'est pas là. */
function demander(ids, chemin) {
  return new Promise((resolve) => {
    const auth = Buffer.from(`riot:${ids.motDePasse}`).toString("base64");
    const req = https.get(
      `https://127.0.0.1:${ids.port}${chemin}`,
      { agent: agentLocal, timeout: DELAI_REQUETE_MS, headers: { Authorization: `Basic ${auth}` } },
      (res) => {
        if (res.statusCode !== 200) { res.resume(); return resolve(null); }
        let corps = "";
        res.on("data", (c) => (corps += c));
        res.on("end", () => { try { resolve(JSON.parse(corps)); } catch { resolve(null); } });
      },
    );
    req.on("error", () => resolve(null));
    req.on("timeout", () => { req.destroy(); resolve(null); });
  });
}

/**
 * Phases pendant lesquelles le lanceur publie son écran de fin. Elles se
 * suivent : on interroge dès la première et on s'arrête à la première réponse
 * lisible, plutôt que d'attendre la dernière.
 */
/**
 * Rôles tels que les nomme le client, traduits dans ceux de l'application.
 * « utility » désigne le support, et « bottom » l'ADC : les noms internes de
 * Riot ne sont pas ceux qu'affiche le jeu.
 */
const PHASES_FIN = new Set(["WaitingForStats", "PreEndOfGame", "EndOfGame"]);

const ROLES = {
  top: "Top",
  jungle: "Jungle",
  middle: "Mid",
  bottom: "ADC",
  utility: "Support",
};

/**
 * Modes qui remplacent le rôle plutôt que de s'y ajouter : sur l'ARAM et
 * l'Arena, il n'y a pas de ligne, et l'application les traite déjà comme des
 * rôles à part entière.
 */
function roleDuMode(queue) {
  const mode = String(queue?.gameMode ?? "").toUpperCase();
  if (mode === "ARAM") return "ARAM";
  if (mode === "CHERRY") return "Arena";
  return null;
}

/**
 * Surveille le lanceur et signale ce qu'il apprend.
 *
 * @param {(e: object) => void} signaler
 *   - `{ type: "phase", phase }` à chaque changement : Lobby, Matchmaking,
 *     ChampSelect, InProgress, EndOfGame.
 *   - `{ type: "contexte", file, role }` quand la file ou le rôle sont connus.
 * @returns {() => void} Arrête la surveillance.
 */
function surveillerClient(signaler) {
  let phasePrecedente = null;
  let arrete = false;
  /** L'écran de fin ne se lit qu'une fois par partie. */
  let issueLue = false;

  const tour = async () => {
    if (arrete) return;
    const ids = await obtenirIdentifiants();
    if (!ids) return;

    const session = await demander(ids, "/lol-gameflow/v1/session");
    if (!session) {
      // Identifiants périmés : le client a été relancé, on les redemandera.
      identifiants = null;
      if (phasePrecedente !== null) {
        phasePrecedente = null;
        signaler({ type: "phase", phase: null });
      }
      return;
    }

    const phase = session.phase ?? null;
    if (phase !== phasePrecedente) {
      phasePrecedente = phase;
      signaler({ type: "phase", phase });
    }

    // L'écran de fin : la seule source d'issue qui parle encore quand l'API de
    // partie s'est tue. Elle n'est pas documentée par Riot, donc son absence
    // n'empêche rien : c'est un complément, jamais une condition.
    if (PHASES_FIN.has(phase)) {
      if (!issueLue) {
        const bloc = await demander(ids, "/lol-end-of-game/v1/eog-stats-block");
        const issue = issueDeFinDePartie(bloc);
        // Un « inconnu » ne se publie pas : l'écran n'est peut-être pas encore
        // rempli, et le tour suivant retentera. Un remake, lui, est une
        // réponse — elle dit que la partie ne compte pas.
        if (issue.resultat !== null || issue.motif === "remake") {
          issueLue = true;
          signaler({ type: "issue", ...issue });
        }
      }
    } else {
      issueLue = false;
    }

    const queue = session.gameData?.queue;
    if (!queue) return;

    // Le rôle n'existe qu'en sélection de champion, et seulement sur les files
    // qui en attribuent un.
    let role = roleDuMode(queue);
    if (!role) {
      const selection = await demander(ids, "/lol-champ-select/v1/session");
      const moi = selection?.myTeam?.find(
        (j) => j?.cellId === selection?.localPlayerCellId,
      );
      const position = String(moi?.assignedPosition ?? "").toLowerCase();
      role = ROLES[position] ?? null;
    }

    signaler({
      type: "contexte",
      file: {
        id: queue.id ?? null,
        nom: queue.description ?? queue.shortName ?? null,
        type: queue.type ?? null,
        mode: queue.gameMode ?? null,
        classee: Boolean(queue.isRanked),
      },
      role,
    });
  };

  tour();
  const minuteur = setInterval(tour, PERIODE_MS);
  return () => { arrete = true; clearInterval(minuteur); };
}

module.exports = { surveillerClient, ROLES };
