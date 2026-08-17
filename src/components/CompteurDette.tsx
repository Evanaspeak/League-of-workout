"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/LocaleContext";
import { exercices as exercicesDict } from "@/lib/i18n/dictionaries/exercices";
import { formaterCompact, toExerciceId, type ExerciceId, type Repartition } from "@/lib/exercices";
import { estPagePublique } from "@/lib/pagesPubliques";

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
 * Affichée en pastille fixe, elle suit sur toutes les pages et reste visible
 * quand on descend : c'est le point de la chose, ne pas oublier ce qu'on doit.
 */
export function CompteurDette({
  onEtat,
}: {
  /**
   * Remonte l'état au rail, qui doit pouvoir signaler une dette en attente
   * même replié : sur petit écran, la pastille elle-même est masquée.
   */
  onEtat?: (e: { enAttente: boolean; alerte: boolean }) => void;
} = {}) {
  const pathname = usePathname();
  const t = useT(exercicesDict);
  const nomsExo: Record<ExerciceId, string> = {
    pompes: t.pompesNom, squats: t.squatsNom, boxe: t.boxeNom,
  };

  const [dette, setDette] = useState<Dette | null>(null);
  const [chronoOuvert, setChronoOuvert] = useState(false);
  const [restantSec, setRestantSec] = useState(0);
  const [enPause, setEnPause] = useState(false);
  const [fini, setFini] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalRef = useRef(0);
  const notifieRef = useRef(false);

  const surPagePubliqueRef = useRef(false);
  surPagePubliqueRef.current = estPagePublique(pathname);

  const charger = useCallback(async () => {
    try {
      const res = await fetch("/api/dette");
      if (!res.ok) return;
      setDette(await res.json());
    } catch { /* le prochain rafraîchissement retentera */ }
  }, []);

  useEffect(() => {
    if (!estPagePublique(pathname)) charger();
  }, [charger, pathname]);

  // Une partie enregistrée ailleurs dans l'app fait remonter le compteur sans
  // recharger la page. Le retour sur l'onglet le resynchronise aussi, au cas
  // où la partie aurait été loggée depuis un autre appareil.
  useEffect(() => {
    const surAjout = () => charger();
    const surRetour = () => { if (!document.hidden) charger(); };
    window.addEventListener("wow-dette-changee", surAjout);
    document.addEventListener("visibilitychange", surRetour);
    return () => {
      window.removeEventListener("wow-dette-changee", surAjout);
      document.removeEventListener("visibilitychange", surRetour);
    };
  }, [charger]);

  const seuilFranchi = !!dette && dette.seuilSec > 0 && dette.dureeSec >= dette.seuilSec;
  const enAttente = !!dette && dette.exercices.length > 0 && dette.dureeSec > 0;

  useEffect(() => {
    onEtat?.({ enAttente, alerte: enAttente && seuilFranchi });
  }, [enAttente, seuilFranchi, onEtat]);

  // Notification système au franchissement du seuil, une seule fois par palier.
  useEffect(() => {
    if (!seuilFranchi) { notifieRef.current = false; return; }
    if (notifieRef.current) return;
    notifieRef.current = true;
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

  // Rien en attente, ou page publique : la pastille ne s'affiche pas.
  if (surPagePubliqueRef.current) return null;
  if (!dette || dette.exercices.length === 0 || dette.dureeSec <= 0) {
    return chronoOuvert ? <ModaleChrono /> : null;
  }

  const progression = dette.seuilSec > 0
    ? Math.min(100, Math.round((dette.dureeSec / dette.seuilSec) * 100))
    : 0;

  return (
    <>
      <button
        type="button"
        className="pastille-dette lol-panel"
        onClick={ouvrirChrono}
        title={t.detteFaireBtn}
        aria-live="polite"
        style={{
          padding: "10px 12px",
          textAlign: "left",
          cursor: "pointer",
          borderColor: seuilFranchi ? "rgba(255,77,46,0.5)" : "var(--line)",
          boxShadow: seuilFranchi
            ? "0 12px 34px rgba(0,0,0,0.5), 0 0 24px rgba(255,77,46,0.16)"
            : "0 10px 28px rgba(0,0,0,0.4)",
          transition: "border-color 0.3s, box-shadow 0.3s",
        }}
      >
        <div
          style={{
            fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.13em",
            color: seuilFranchi ? "var(--ember)" : "rgba(152,162,176,0.6)",
          }}
        >
          {t.detteTitre}
        </div>

        {lignes.map((ligne) => (
          <div key={ligne.id} style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 3 }}>
            <span
              className="mono-num"
              style={{
                fontSize: "1.35rem", fontWeight: 700, lineHeight: 1.1,
                color: seuilFranchi ? "var(--ember)" : "var(--amber)",
              }}
            >
              {formaterCompact(ligne.pts, ligne.id)}
            </span>
            <span style={{ fontSize: "0.66rem", color: "rgba(236,239,244,0.4)" }}>
              {nomsExo[ligne.id].toLowerCase()}
            </span>
          </div>
        ))}

        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: "rgba(152,162,176,0.16)", marginTop: 8 }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${progression}%`,
              background: seuilFranchi ? "var(--ember)" : "var(--brand-gradient)",
              transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        </div>

        <div style={{ fontSize: "0.62rem", marginTop: 6, color: seuilFranchi ? "var(--ember)" : "rgba(236,239,244,0.4)" }}>
          {seuilFranchi ? t.detteFaireBtn : t.detteSeuil(duree(dette.seuilSec))}
        </div>
      </button>

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

          {/* Consignes d'exécution, au moment exact où quelqu'un s'apprête à
              faire le mouvement — pas dans une page d'aide qu'on ne lit pas. */}
          {lignes.length > 0 && (
            <div style={{
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(152,162,176,0.06)",
              border: "1px solid var(--line)",
            }}>
              <div style={{
                fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.13em",
                color: "rgba(152,162,176,0.6)", marginBottom: 5,
              }}>
                {t.formeTitre}
              </div>
              {lignes.map((ligne) => (
                <p key={ligne.id} style={{
                  fontSize: "0.76rem", lineHeight: 1.55,
                  color: "rgba(236,239,244,0.6)", margin: 0,
                }}>
                  {t.forme[ligne.id]}
                </p>
              ))}
            </div>
          )}

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
