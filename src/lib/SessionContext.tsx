"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const POLL_MS = 2 * 60 * 1000;
// Délai après la fin d'une partie (détectée nativement par l'app desktop) avant
// d'interroger l'API Riot — le match met quelques secondes à y apparaître.
const POST_GAME_DELAY_MS = 20 * 1000;

export type SessionGame = {
  champion: string;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  result: string;
  pompes: number;
};

type SessionCtx = {
  sessionActive: boolean;
  sessionGames: SessionGame[];
  sessionError: string;
  polling: boolean;
  countdown: number;
  sessionLevel: string;
  gainageSec: number;
  startSession: (gainageSec: number) => Promise<void>;
  stopSession: () => void;
};

const SessionContext = createContext<SessionCtx | null>(null);

function getLevelLabel(sec: number): string {
  if (sec <= 45) return "Niveau 1";
  if (sec <= 90) return "Niveau 2";
  if (sec <= 150) return "Niveau 3";
  if (sec <= 240) return "Niveau 4";
  return "Niveau 5";
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionGames, setSessionGames] = useState<SessionGame[]>([]);
  const [sessionError, setSessionError] = useState("");
  const [polling, setPolling] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sessionLevel, setSessionLevel] = useState("");
  const [gainageSec, setGainageSec] = useState(60);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gainageRef = useRef<number>(60);
  const baselineRef = useRef<string | null>(null);
  const sessionActiveRef = useRef(false);

  const stopSession = useCallback(() => {
    setSessionActive(false);
    setPolling(false);
    setCountdown(0);
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  const doPoll = useCallback(async () => {
    setPolling(true);
    setCountdown(POLL_MS / 1000);
    try {
      const res = await fetch("/api/riot/last-game");
      if (res.status === 409) { setPolling(false); return; }
      if (res.status === 400) {
        setSessionError("PUUID manquant. Configure ton Riot ID dans Réglages.");
        stopSession();
        return;
      }
      if (!res.ok) { setPolling(false); return; }
      const riotData = await res.json();

      // Game identique au point de départ → encore rien de joué depuis la session.
      if (riotData.matchId === baselineRef.current) { setPolling(false); return; }

      const logRes = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: riotData.role,
          champion: riotData.champion,
          kills: riotData.kills,
          deaths: riotData.deaths,
          assists: riotData.assists,
          result: riotData.result,
          source: "riot_api",
          riotMatchId: riotData.matchId,
          gainageSec: gainageRef.current,
        }),
      });
      if (logRes.ok) {
        const { scoring } = await logRes.json();
        baselineRef.current = riotData.matchId;
        setSessionGames((prev) => [{
          champion: riotData.champion,
          role: riotData.role,
          kills: riotData.kills,
          deaths: riotData.deaths,
          assists: riotData.assists,
          result: riotData.result,
          pompes: scoring.pompesFinales,
        }, ...prev]);
      }
    } catch { /* retry next poll */ }
    setPolling(false);
  }, [stopSession]);

  const startSession = useCallback(async (sec: number) => {
    gainageRef.current = sec;
    setGainageSec(sec);
    setSessionLevel(getLevelLabel(sec));
    setSessionActive(true);
    setSessionGames([]);
    setSessionError("");

    // Capture la dernière game existante comme point de départ.
    baselineRef.current = null;
    try {
      const peekRes = await fetch("/api/riot/last-game?peek=1");
      if (peekRes.ok) {
        const { matchId } = await peekRes.json();
        baselineRef.current = matchId;
      }
    } catch { /* pas de baseline : OK, on logge la prochaine game détectée */ }

    doPoll();
    intervalRef.current = setInterval(doPoll, POLL_MS);
    setCountdown(POLL_MS / 1000);
    countdownRef.current = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
  }, [doPoll]);

  // Garde une référence à jour de l'état de session pour les callbacks natifs.
  useEffect(() => { sessionActiveRef.current = sessionActive; }, [sessionActive]);

  // ── Intégration app desktop (Electron) ────────────────────────────────────
  // Si on tourne dans l'app desktop, on écoute la détection NATIVE de fin de
  // partie (API Live Client de League) pour logger tout de suite, sans attendre
  // le prochain cycle du timer de 2 min. Le timer reste actif en filet de
  // sécurité au cas où l'événement natif serait manqué.
  useEffect(() => {
    const lol = typeof window !== "undefined" ? window.electronLOL : undefined;
    if (!lol?.onGameEnded) return;
    return lol.onGameEnded(() => {
      if (!sessionActiveRef.current) return;
      setTimeout(() => { if (sessionActiveRef.current) doPoll(); }, POST_GAME_DELAY_MS);
    });
  }, [doPoll]);

  // Nettoyage uniquement à la fermeture de l'app (le provider vit dans le layout).
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  return (
    <SessionContext.Provider value={{
      sessionActive, sessionGames, sessionError,
      polling, countdown, sessionLevel, gainageSec,
      startSession, stopSession,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
