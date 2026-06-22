// Détection du rôle / mode de jeu à partir des données Riot Match-V5.
// Utilisé par /api/riot/last-game et /api/riot/match-history pour rester cohérent.
//
// NB: le mode "ARAM du chaos" n'est PAS renvoyé par l'API Riot (Match-V5 ne
// liste pas ce mode événementiel). Il ne peut donc être ajouté qu'à la main.

const LANE_MAP: Record<string, string> = {
  TOP: "Top", JUNGLE: "Jungle", MIDDLE: "Mid",
  BOTTOM: "ADC", UTILITY: "Support",
};

// ARAM standard : Howling Abyss, file 450, 10 joueurs.
const ARAM_QUEUES = new Set([450]);
// Arena (Rings of Wrath) : 1700/1710 (2x… ) et 1750 (Arena 3x6, 18 joueurs).
const ARENA_QUEUES = new Set([1700, 1710, 1712, 1720, 1730, 1750]);

type RiotInfo = {
  queueId?: number;
  gameMode?: string;
  mapId?: number;
};
type RiotParticipant = {
  teamPosition?: string;
  individualPosition?: string;
};

export function detectRole(info: RiotInfo, participant: RiotParticipant): string {
  const queueId = info.queueId ?? 0;
  const gameMode = info.gameMode ?? "";
  const mapId = info.mapId ?? 0;

  // ARAM standard (Howling Abyss / gameMode ARAM / file 450)
  if (gameMode === "ARAM" || mapId === 12 || ARAM_QUEUES.has(queueId)) {
    return "ARAM";
  }

  // Arena / CHERRY (Arena 3x6 inclus, file 1750)
  if (gameMode === "CHERRY" || ARENA_QUEUES.has(queueId)) {
    return "Arena";
  }

  const pos = participant.teamPosition || participant.individualPosition || "";
  return LANE_MAP[pos] ?? "Mid";
}
