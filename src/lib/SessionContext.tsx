"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { lireCode, noter } from "@/lib/journalSynchro";
import {
  EXERCICE_DEFAUT, RAPPEL_SEUIL_DEFAUT, formaterCompact, toExerciceId, toExerciceIds,
  type ExerciceId,
} from "@/lib/exercices";
import { JEU_DEFAUT, typeDuJeu, type TypeJeu } from "@/lib/jeux";
import { notifierSysteme } from "@/lib/notifier";
import { ecrire, effacer, lire } from "./stockage";

const POLL_MS = 2 * 60 * 1000;
/** Le chrono d'une session au temps rafraîchit son affichage à la seconde. */
const CHRONO_TICK_MS = 1000;
/** Sous ce seuil, une session au temps n'a rien produit qui mérite d'être écrit. */
const CHRONO_MIN_SEC = 30;
/** Une session chronométrée survit à un rechargement de page. */
const CHRONO_STORAGE_KEY = "wow-chrono-session";

type ChronoSauvegarde = { jeu: string; debut: number; niveau: number };
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
  /** Niveau du joueur (1-5), issu de son test de force. 0 = pas encore connu. */
  sessionNiveau: number;
  startSession: (niveau: number, jeu?: string) => Promise<void>;
  stopSession: () => void;
  // ── Session au temps (jeux sans victoire ni défaite) ──
  /** Nature de la session en cours : parties suivies, ou chrono. */
  typeSession: TypeJeu;
  /** Jeu de la session en cours. */
  jeuSession: string;
  /** Secondes écoulées depuis le démarrage du chrono. */
  chronoSec: number;
  /** Message d'erreur du chrono (échec d'enregistrement). */
  chronoErreur: string;
  /** Arrête le chrono et enregistre la session. `false` si rien n'a été écrit. */
  arreterChrono: () => Promise<boolean>;
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

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionGames, setSessionGames] = useState<SessionGame[]>([]);
  const [sessionError, setSessionError] = useState("");
  const [polling, setPolling] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [sessionNiveau, setSessionNiveau] = useState(0);

  // ── Session au temps ──
  const [typeSession, setTypeSession] = useState<TypeJeu>("parties");
  const [jeuSession, setJeuSession] = useState<string>(JEU_DEFAUT);
  const [chronoSec, setChronoSec] = useState(0);
  const [chronoErreur, setChronoErreur] = useState("");
  const typeSessionRef = useRef<TypeJeu>("parties");
  const jeuSessionRef = useRef<string>(JEU_DEFAUT);
  const chronoDebutRef = useRef<number | null>(null);
  const chronoTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Coût d'une heure de jeu, calculé une fois par le serveur au démarrage :
  // la logique de scoring reste à un seul endroit.
  const pointsParHeureRef = useRef(0);
  // Points déjà acquittés pendant le chrono : la dette affichée est le total
  // dû depuis le début, moins ce qui a déjà été fait.
  const chronoPayesRef = useRef(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  // Sélection complète : une session au temps se répartit entre tous les
  // exercices cochés, comme un ajout manuel.
  const exercicesRef = useRef<ExerciceId[]>([EXERCICE_DEFAUT]);

  const notifier = useCallback((points: number) => {
    const quantite = formaterCompact(points, exerciceRef.current);
    notifierSysteme("Win or Workout", `${quantite} à faire maintenant.`, "wow-rappel");
  }, []);

  /** Dette totale générée depuis le début du chrono, acquittements compris. */
  const detteTotaleChrono = useCallback(() => {
    if (chronoDebutRef.current === null) return 0;
    const ecoule = (Date.now() - chronoDebutRef.current) / 1000;
    return Math.round((pointsParHeureRef.current * ecoule) / 3600);
  }, []);

  const acquitterRappel = useCallback(() => {
    setRappelActif(false);
    // En mode chrono la dette se recalcule à chaque seconde depuis le temps
    // écoulé : il faut mémoriser ce qui vient d'être payé, sinon le prochain
    // tick le réclamerait à nouveau.
    if (typeSessionRef.current === "temps") chronoPayesRef.current = detteTotaleChrono();
    dettePointsRef.current = 0;
    setDettePoints(0);
    prochainRappelRef.current = seuilRef.current;
  }, [detteTotaleChrono]);

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
    if (chronoTickRef.current) { clearInterval(chronoTickRef.current); chronoTickRef.current = null; }
    chronoDebutRef.current = null;
    chronoPayesRef.current = 0;
    setChronoSec(0);
    setTypeSession("parties");
    typeSessionRef.current = "parties";
    if (typeof window !== "undefined") effacer(CHRONO_STORAGE_KEY);
  }, []);

  /**
   * Fait vivre le chrono : une fois par seconde, on recalcule la dette à partir
   * du temps réellement écoulé. Passer par l'horloge plutôt que par un
   * compteur incrémental garde le compte juste même si l'onglet a été mis en
   * veille par le navigateur.
   */
  const lancerTickChrono = useCallback(() => {
    if (chronoTickRef.current) clearInterval(chronoTickRef.current);
    const tick = () => {
      if (chronoDebutRef.current === null) return;
      setChronoSec(Math.floor((Date.now() - chronoDebutRef.current) / 1000));

      const restant = Math.max(0, detteTotaleChrono() - chronoPayesRef.current);
      dettePointsRef.current = restant;
      setDettePoints(restant);

      if (seuilRef.current > 0 && restant >= prochainRappelRef.current) {
        setRappelActif(true);
        notifier(restant);
        // Le palier avance tout de suite : sans cela, le rappel se déclencherait
        // à nouveau à chaque seconde tant que la dette reste au-dessus du seuil.
        prochainRappelRef.current = restant + seuilRef.current;
      }
    };
    tick();
    chronoTickRef.current = setInterval(tick, CHRONO_TICK_MS);
  }, [detteTotaleChrono, notifier]);

  /**
   * Arrête le chrono et écrit la session. Sur échec, la session reste active
   * pour que le temps joué ne soit pas perdu et qu'on puisse réessayer.
   * `chronoErreur` porte un code : "court" ou "erreur".
   */
  const arreterChrono = useCallback(async (): Promise<boolean> => {
    const debut = chronoDebutRef.current;
    if (debut === null) { stopSession(); return false; }

    const dureeSec = Math.round((Date.now() - debut) / 1000);
    if (dureeSec < CHRONO_MIN_SEC) {
      setChronoErreur("court");
      stopSession();
      return false;
    }

    setChronoErreur("");

    // Une seule ligne : quand plusieurs exercices sont cochés, la dette se
    // partage entre eux côté serveur.
    const selection = exercicesRef.current.length > 0 ? exercicesRef.current : [exerciceRef.current];

    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jeu: jeuSessionRef.current,
          typeJeu: "temps",
          dureeSec,
          exercices: selection,
          source: "manuel",
        }),
      });
      if (!res.ok) { setChronoErreur("erreur"); return false; }
      window.dispatchEvent(new Event("wow-dette-changee"));
      stopSession();
      return true;
    } catch {
      setChronoErreur("erreur");
      return false;
    }
  }, [stopSession]);

  const doPoll = useCallback(async () => {
    setPolling(true);
    setCountdown(POLL_MS / 1000);
    try {
      const res = await fetch("/api/riot/last-game");
      if (res.status === 409) { setPolling(false); return; }
      if (res.status === 400) {
        noter({ resultat: "erreur", code: 400, motif: lireCode(400).motif });
        setSessionError("PUUID manquant. Configure ton Riot ID dans Réglages.");
        stopSession();
        return;
      }
      /**
       * Une erreur Riot laisse une trace.
       *
       * Elle disparaissait dans un `return` muet : rien ne distinguait « Riot
       * est en panne » de « la clé est saturée » ou de « tu n'as pas encore
       * joué ». Trois situations qui ne se corrigent pas de la même façon, et
       * dont aucune n'était visible.
       */
      if (!res.ok) {
        const { resultat, motif } = lireCode(res.status);
        noter({ resultat, code: res.status, motif });
        setPolling(false);
        return;
      }
      const riotData = await res.json();

      // Game identique au point de départ → encore rien de joué depuis la session.
      if (riotData.matchId === baselineRef.current) {
        noter({ resultat: "rien" });
        setPolling(false);
        return;
      }

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
        }),
      });
      if (logRes.ok) {
        const { scoring } = await logRes.json();
        noter({ resultat: "partie", detail: `${riotData.champion ?? "partie"} · ${riotData.result === "V" ? "victoire" : "défaite"}` });
        window.dispatchEvent(new Event("wow-dette-changee"));
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
      } else {
        /**
         * L'enregistrement refusé ne disait rien.
         *
         * La partie était bien lue chez Riot, et le `POST` échouait sans
         * laisser de trace : le journal restait vide, la partie n'entrait
         * jamais, et la relecture suivante recommençait à l'identique. Ça
         * compte davantage depuis que la route REFUSE un résultat qu'elle ne
         * sait pas lire — un remake, ou deux sources Riot contradictoires :
         * ce refus est légitime, et il doit se voir.
         */
        const { resultat, motif } = lireCode(logRes.status);
        noter({ resultat, code: logRes.status, motif });
      }
    } catch { /* retry next poll */ }
    setPolling(false);
  }, [stopSession]);

  const startSession = useCallback(async (niveau: number, jeu: string = JEU_DEFAUT) => {
    const type = typeDuJeu(jeu);

    setSessionNiveau(niveau);
    setSessionActive(true);
    setSessionGames([]);
    setSessionError("");
    setChronoErreur("");
    setTypeSession(type);
    typeSessionRef.current = type;
    setJeuSession(jeu);
    jeuSessionRef.current = jeu;

    // Repart d'une dette vierge à chaque session.
    dettePointsRef.current = 0;
    setDettePoints(0);
    setRappelActif(false);
    chronoPayesRef.current = 0;
    setChronoSec(0);

    // Récupère les préférences de rappel de l'utilisateur.
    try {
      const u = await fetch("/api/user").then((r) => r.json());
      const selection = toExerciceIds(u?.exercices);
      const ex = selection[0] ?? toExerciceId(u?.exercice);
      const seuil = typeof u?.rappelSeuilPoints === "number" ? u.rappelSeuilPoints : RAPPEL_SEUIL_DEFAUT;
      setExercice(ex);
      exerciceRef.current = ex;
      exercicesRef.current = selection.length > 0 ? selection : [ex];
      seuilRef.current = seuil;
      prochainRappelRef.current = seuil;
    } catch { /* valeurs par défaut conservées */ }

    // Le clic sur « démarrer » est le geste utilisateur qu'exigent les
    // navigateurs pour pouvoir demander l'autorisation de notifier.
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    // ── Jeu au temps : chrono, pas de suivi de parties ──
    if (type === "temps") {
      // Le coût d'une heure est calculé par le serveur, avec la même formule
      // que l'enregistrement final : l'estimation affichée ne peut pas diverger.
      pointsParHeureRef.current = 0;
      try {
        const res = await fetch("/api/games/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jeu, typeJeu: "temps", dureeSec: 3600 }),
        });
        if (res.ok) {
          const { scoring } = await res.json();
          pointsParHeureRef.current = Number(scoring?.pompesFinales) || 0;
        }
      } catch { /* la dette live restera à 0, l'enregistrement final fera foi */ }

      const debut = Date.now();
      chronoDebutRef.current = debut;
      if (typeof window !== "undefined") {
        const sauvegarde: ChronoSauvegarde = { jeu, debut, niveau };
        ecrire(CHRONO_STORAGE_KEY, JSON.stringify(sauvegarde));
      }
      lancerTickChrono();
      return;
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
  }, [doPoll, lancerTickChrono]);

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

  // Un chrono en cours survit à un rechargement de page : sans cela, deux
  // heures de Minecraft disparaîtraient sur un F5 malheureux.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const brut = lire(CHRONO_STORAGE_KEY);
    if (!brut) return;

    let sauvegarde: ChronoSauvegarde;
    try { sauvegarde = JSON.parse(brut); } catch { effacer(CHRONO_STORAGE_KEY); return; }
    const debut = Number(sauvegarde?.debut);
    // Au-delà de 12 h, c'est un chrono oublié plutôt qu'une session en cours.
    if (!debut || Date.now() - debut > 12 * 3600 * 1000) {
      effacer(CHRONO_STORAGE_KEY);
      return;
    }

    let annule = false;
    (async () => {
      setSessionNiveau(Number(sauvegarde.niveau) || 0);
      setTypeSession("temps");
      typeSessionRef.current = "temps";
      setJeuSession(sauvegarde.jeu);
      jeuSessionRef.current = sauvegarde.jeu;
      chronoDebutRef.current = debut;
      chronoPayesRef.current = 0;
      setSessionActive(true);

      try {
        const u = await fetch("/api/user").then((r) => r.json());
        const selection = toExerciceIds(u?.exercices);
        const ex = selection[0] ?? toExerciceId(u?.exercice);
        const seuil = typeof u?.rappelSeuilPoints === "number" ? u.rappelSeuilPoints : RAPPEL_SEUIL_DEFAUT;
        setExercice(ex);
        exerciceRef.current = ex;
        exercicesRef.current = selection.length > 0 ? selection : [ex];
        seuilRef.current = seuil;
        prochainRappelRef.current = seuil;
      } catch { /* valeurs par défaut conservées */ }

      try {
        const res = await fetch("/api/games/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jeu: sauvegarde.jeu, typeJeu: "temps", dureeSec: 3600 }),
        });
        if (res.ok) {
          const { scoring } = await res.json();
          pointsParHeureRef.current = Number(scoring?.pompesFinales) || 0;
        }
      } catch { /* dette live à 0, l'enregistrement final fera foi */ }

      if (!annule) lancerTickChrono();
    })();

    return () => { annule = true; };
    // Restauration unique au montage du provider.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nettoyage uniquement à la fermeture de l'app (le provider vit dans le layout).
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (chronoTickRef.current) clearInterval(chronoTickRef.current);
  }, []);

  return (
    <SessionContext.Provider value={{
      sessionActive, sessionGames, sessionError,
      polling, countdown, sessionNiveau,
      startSession, stopSession,
      typeSession, jeuSession, chronoSec, chronoErreur, arreterChrono,
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
