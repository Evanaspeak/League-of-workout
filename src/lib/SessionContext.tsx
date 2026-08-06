"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  EXERCICE_DEFAUT, RAPPEL_SEUIL_DEFAUT, formaterCompact, toExerciceId, type ExerciceId,
} from "@/lib/exercices";

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
  // ── Rappel fractionné ──
  /** Points d'effort accumulés et non encore acquittés. */
  dettePoints: number;
  /** Le seuil est franchi : il est temps d'aller payer. */
  rappelActif: boolean;
  exercice: ExerciceId;
  /** Marque la dette comme payée et repart de zéro. */
  acquitterRappel: () => void;
  /** Masque le rappel : il reviendra au palier suivant. */
  reporterRappel: () => void;
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

  // ── Rappel fractionné ──
  const [dettePoints, setDettePoints] = useState(0);
  const dettePointsRef = useRef(0);
  const [rappelActif, setRappelActif] = useState(false);
  const [exercice, setExercice] = useState<ExerciceId>(EXERCICE_DEFAUT);
  // Seuil configuré par l'utilisateur (0 = rappel désactivé).
  const seuilRef = useRef<number>(RAPPEL_SEUIL_DEFAUT);
  // Palier au-delà duquel le prochain rappel se déclenche.
  const prochainRappelRef = useRef<number>(RAPPEL_SEUIL_DEFAUT);
  const exerciceRef = useRef<ExerciceId>(EXERCICE_DEFAUT);

  const notifier = useCallback((points: number) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    const quantite = formaterCompact(points, exerciceRef.current);
    try {
      new Notification("Win or Workout", {
        body: `${quantite} à faire maintenant.`,
        icon: "/icon",
        tag: "wow-rappel",
      });
    } catch { /* certains navigateurs refusent hors service worker */ }
  }, []);

  const acquitterRappel = useCallback(() => {
    setRappelActif(false);
    dettePointsRef.current = 0;
    setDettePoints(0);
    prochainRappelRef.current = seuilRef.current;
  }, []);

  const reporterRappel = useCallback(() => {
    setRappelActif(false);
    // Le rappel réapparaîtra seulement au palier suivant.
    prochainRappelRef.current = dettePointsRef.current + seuilRef.current;
  }, []);

  const stopSession = useCallback(() => {
    setSessionActive(false);
    setPolling(false);
    setCountdown(0);
    setRappelActif(false);
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

        // Accumule la dette et déclenche le rappel au franchissement du palier,
        // pour fractionner l'effort au lieu de tout reporter en fin de soirée.
        // Le calcul passe par une ref : un updater React peut être rejoué, ce
        // qui enverrait la notification en double.
        const total = dettePointsRef.current + scoring.pompesFinales;
        dettePointsRef.current = total;
        setDettePoints(total);
        if (seuilRef.current > 0 && total >= prochainRappelRef.current) {
          setRappelActif(true);
          notifier(total);
        }
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

    // Repart d'une dette vierge à chaque session.
    dettePointsRef.current = 0;
    setDettePoints(0);
    setRappelActif(false);

    // Récupère les préférences de rappel de l'utilisateur.
    try {
      const u = await fetch("/api/user").then((r) => r.json());
      const ex = toExerciceId(u?.exercice);
      const seuil = typeof u?.rappelSeuilPoints === "number" ? u.rappelSeuilPoints : RAPPEL_SEUIL_DEFAUT;
      setExercice(ex);
      exerciceRef.current = ex;
      seuilRef.current = seuil;
      prochainRappelRef.current = seuil;
    } catch { /* valeurs par défaut conservées */ }

    // Le clic sur « démarrer » est le geste utilisateur qu'exigent les
    // navigateurs pour pouvoir demander l'autorisation de notifier.
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

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
      dettePoints, rappelActif, exercice, acquitterRappel, reporterRappel,
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
