"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { exercices as exercicesDict } from "@/lib/i18n/dictionaries/exercices";
import { formaterCompact, toExerciceId, type ExerciceId, type Repartition } from "@/lib/exercices";

type Dette = {
  points: number;
  exercices: ExerciceId[];
  repartition: Repartition;
  dureeSec: number;
  seuilSec: number;
};

/** Horloge d'un décompte : 4:32. */
function horloge(secondes: number): string {
  const s = Math.max(0, Math.ceil(secondes));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Durée lisible pour un libellé : « 5 min 20 ». */
function duree(secondes: number): string {
  const s = Math.max(0, Math.round(secondes));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const reste = s % 60;
  return reste === 0 ? `${m} min` : `${m} min ${String(reste).padStart(2, "0")}`;
}

/**
 * Compteur d'effort en attente. Il ne concerne que les exercices comptés en
 * temps : des pompes se font tout de suite après la partie, alors qu'un round
 * de boxe n'a d'intérêt qu'une fois quelques minutes réunies. Le compteur les
 * cumule donc, et prévient quand il y a de quoi faire une vraie séance.
 *
 * `variant="carte"` affiche le panneau du dashboard ; `variant="rappel"`
 * n'affiche qu'un bandeau flottant, et seulement une fois le seuil franchi.
 */
export function CompteurDette({ variant = "carte" }: { variant?: "carte" | "rappel" }) {
  const t = useT(exercicesDict);
  const nomsExo: Record<ExerciceId, string> = {
    pompes: t.pompesNom, squats: t.squatsNom, boxe: t.boxeNom,
  };

  const [dette, setDette] = useState<Dette | null>(null);
  const [chronoOuvert, setChronoOuvert] = useState(false);
  const [restantSec, setRestantSec] = useState(0);
  const [enPause, setEnPause] = useState(false);
  const [fini, setFini] = useState(false);
  const [rappelMasque, setRappelMasque] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalRef = useRef(0);
  const notifieRef = useRef(false);

  const charger = useCallback(async () => {
    try {
      const res = await fetch("/api/dette");
      if (!res.ok) return;
      setDette(await res.json());
    } catch { /* le prochain rafraîchissement retentera */ }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  // Une partie enregistrée ailleurs dans l'app fait remonter le compteur sans
  // recharger la page.
  useEffect(() => {
    const surAjout = () => charger();
    window.addEventListener("wow-dette-changee", surAjout);
    return () => window.removeEventListener("wow-dette-changee", surAjout);
  }, [charger]);

  const seuilFranchi = !!dette && dette.seuilSec > 0 && dette.dureeSec >= dette.seuilSec;

  // Notification système au franchissement du seuil, une seule fois par palier.
  useEffect(() => {
    if (!seuilFranchi) { notifieRef.current = false; return; }
    if (notifieRef.current) return;
    notifieRef.current = true;
    setRappelMasque(false);
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      new Notification("Win or Workout", {
        body: t.detteRappelCorps(duree(dette!.dureeSec)),
        icon: "/icon",
        tag: "wow-dette",
      });
    } catch { /* certains navigateurs refusent hors service worker */ }
  }, [seuilFranchi, dette, t]);

  const arreterTick = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };
  useEffect(() => arreterTick, []);

  const ouvrirChrono = () => {
    if (!dette || dette.dureeSec <= 0) return;
    totalRef.current = dette.dureeSec;
    setRestantSec(dette.dureeSec);
    setEnPause(false);
    setFini(false);
    setChronoOuvert(true);
    // Le clic est le geste utilisateur qu'exigent les navigateurs pour demander
    // l'autorisation de notifier.
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  };

  // Décompte : il s'arrête seul à zéro, l'effort est alors entièrement payé.
  useEffect(() => {
    if (!chronoOuvert || enPause || fini) { arreterTick(); return; }
    tickRef.current = setInterval(() => {
      setRestantSec((r) => {
        if (r <= 1) { setFini(true); return 0; }
        return r - 1;
      });
    }, 1000);
    return arreterTick;
  }, [chronoOuvert, enPause, fini]);

  /** Acquitte la part réellement faite, puis referme. */
  const cloturer = async (toutFait: boolean) => {
    const secondesFaites = Math.max(0, totalRef.current - restantSec);
    try {
      const res = await fetch("/api/dette", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toutFait ? { tout: true } : { secondes: secondesFaites }),
      });
      if (res.ok) setDette(await res.json());
    } catch { /* on referme quand même, la dette sera relue au prochain chargement */ }
    setChronoOuvert(false);
    setFini(false);
    notifieRef.current = false;
  };

  const lignes = dette
    ? Object.entries(dette.repartition)
        .map(([id, pts]) => ({ id: toExerciceId(id), pts: pts ?? 0 }))
        .filter((l) => l.pts > 0)
    : [];

  // ── Bandeau flottant : uniquement au-delà du seuil ──
  if (variant === "rappel") {
    if (!seuilFranchi || rappelMasque || chronoOuvert) return null;
    return (
      <>
        <div
          role="alert"
          style={{
            position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)",
            zIndex: 9000, width: "min(560px, calc(100vw - 32px))",
            background: "var(--carbon)", border: "1px solid rgba(255,77,46,0.45)",
            borderRadius: 14, padding: "14px 18px",
            boxShadow: "0 18px 50px rgba(0,0,0,0.55), 0 0 30px rgba(255,77,46,0.12)",
            display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
          }}
        >
          <div style={{ flex: 1, minWidth: 180 }}>
            <div className="gold-text" style={{ fontWeight: 700, fontSize: "0.9rem" }}>
              {t.detteRappelTitre}
            </div>
            <div style={{ fontSize: "0.8rem", color: "rgba(236,239,244,0.6)", marginTop: 2 }}>
              {t.detteRappelCorps(duree(dette.dureeSec))}
            </div>
          </div>
          <button
            className="py-2 px-3 rounded text-xs"
            style={{ background: "transparent", color: "rgba(236,239,244,0.5)", border: "1px solid rgba(152,162,176,0.25)" }}
            onClick={() => setRappelMasque(true)}
          >
            {t.detteChronoAbandon}
          </button>
          <button className="lol-btn text-sm px-4" onClick={ouvrirChrono}>
            {t.detteFaireBtn}
          </button>
        </div>
        {chronoOuvert && <ModaleChrono />}
      </>
    );
  }

  // ── Panneau du dashboard ──
  // Sans exercice compté en temps, il n'y a rien à accumuler : tout se fait
  // dans la foulée de la partie.
  if (!dette || dette.exercices.length === 0) return null;

  const progression = dette.seuilSec > 0
    ? Math.min(100, Math.round((dette.dureeSec / dette.seuilSec) * 100))
    : 0;

  return (
    <>
      <div
        className="lol-panel p-4 space-y-3"
        style={seuilFranchi ? { borderColor: "rgba(255,77,46,0.45)" } : undefined}
      >
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">{t.detteTitre}</h2>
          {dette.seuilSec > 0 && (
            <span className="text-xs" style={{ color: "rgba(152,162,176,0.6)" }}>
              {t.detteSeuil(duree(dette.seuilSec))}
            </span>
          )}
        </div>

        {lignes.length === 0 ? (
          <p className="text-sm" style={{ color: "rgba(236,239,244,0.45)" }}>{t.detteVide}</p>
        ) : (
          <>
            <div className="flex items-end gap-4 flex-wrap">
              {lignes.map((ligne) => (
                <div key={ligne.id}>
                  <div className="mono-num text-2xl font-bold gold-text">
                    {formaterCompact(ligne.pts, ligne.id)}
                  </div>
                  <div className="text-xs" style={{ color: "rgba(236,239,244,0.45)" }}>
                    {nomsExo[ligne.id].toLowerCase()}
                  </div>
                </div>
              ))}
              {/* Avec un seul exercice, le total répéterait la valeur de gauche. */}
              {lignes.length > 1 && (
                <div className="ml-auto text-right">
                  <div className="mono-num text-lg font-semibold" style={{ color: seuilFranchi ? "var(--ember)" : "rgba(236,239,244,0.75)" }}>
                    {duree(dette.dureeSec)}
                  </div>
                </div>
              )}
            </div>

            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(152,162,176,0.15)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${progression}%`,
                  background: seuilFranchi ? "var(--ember)" : "var(--brand-gradient)",
                  transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            </div>

            <button className="lol-btn w-full text-sm" onClick={ouvrirChrono}>
              {t.detteFaireBtn}
            </button>
          </>
        )}
      </div>

      {chronoOuvert && <ModaleChrono />}
    </>
  );

  /** Décompte plein écran du temps d'effort à faire. */
  function ModaleChrono() {
    return (
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9500,
          background: "rgba(6,8,10,0.88)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <div className="lol-panel p-6 w-full max-w-sm mx-4 space-y-5 text-center">
          <h2 className="gold-text font-bold text-lg uppercase tracking-widest">
            {fini ? t.detteChronoFini : t.detteChronoTitre}
          </h2>

          <div className="flex flex-wrap justify-center gap-4">
            {lignes.map((ligne) => (
              <div key={ligne.id}>
                <div className="mono-num text-xl font-bold gold-text">
                  {formaterCompact(ligne.pts, ligne.id)}
                </div>
                <div className="text-xs" style={{ color: "rgba(236,239,244,0.45)" }}>
                  {nomsExo[ligne.id].toLowerCase()}
                </div>
              </div>
            ))}
          </div>

          <div>
            <div
              className="mono-num font-bold"
              style={{
                fontSize: "clamp(3rem, 18vw, 4.5rem)", lineHeight: 1,
                color: fini ? "var(--victory)" : "#ECEFF4",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {horloge(restantSec)}
            </div>
            <div className="text-xs mt-2" style={{ color: "rgba(236,239,244,0.45)" }}>
              {t.detteChronoRestant}
            </div>
          </div>

          <div className="flex gap-2">
            {!fini && (
              <button
                className="py-2 px-4 rounded text-sm flex-1"
                style={{ background: "rgba(152,162,176,0.1)", color: "rgba(236,239,244,0.6)", border: "1px solid rgba(152,162,176,0.2)" }}
                onClick={() => setEnPause((p) => !p)}
              >
                {enPause ? t.detteChronoReprendre : t.detteChronoPause}
              </button>
            )}
            <button className="lol-btn flex-1" onClick={() => cloturer(fini)}>
              {fini ? t.detteChronoTermine : t.detteChronoAbandon}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
