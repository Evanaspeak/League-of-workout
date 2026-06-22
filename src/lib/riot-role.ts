// Détection du rôle / mode de jeu à partir des données Riot Match-V5.
// Utilisé par /api/riot/last-game et /api/riot/match-history pour rester cohérent.

const LANE_MAP: Record<string, string> = {
  TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid",
  BOTTOM: "ADC", UTILITY: "Support",
};

const ARAM_QUEUES = new Set([450]);
const ARENA_QUEUES = new Set([1700, 1710, 1712, 1720, 1730, 1750]);

type RiotInfo = {
  queueId?: number;
  gameMode?: string;
  mapId?: number;
  participants?: { length: number }[];
};
type RiotParticipant = {
  teamPosition?: string;
  individualPosition?: string;
};

export function detectRole(info: RiotInfo, participant: RiotParticipant): string {
  const queueId = info.queueId ?? 0;
  const gameMode = info.gameMode ?? "";
  const mapId = info.mapId ?? 0;
  const count = info.participants?.length ?? 0;

  // ARAM standard : Howling Abyss / gameMode ARAM / file 450 (toujours 10 joueurs)
  if (gameMode === "ARAM" || ARAM_QUEUES.has(queueId) || mapId === 12) {
    return "ARAM";
  }

  // Modes Arena/CHERRY : l'Arena se joue à 12 ou 18 joueurs.
  // Une variante "chaos" à 10 joueurs est traitée comme de l'ARAM.
  if (gameMode === "CHERRY" || ARENA_QUEUES.has(queueId)) {
    return count > 0 && count <= 10 ? "ARAM" : "Arena";
  }

  const pos = participant.teamPosition || participant.individualPosition || "";
  return LANE_MAP[pos] ?? "Mid";
}
