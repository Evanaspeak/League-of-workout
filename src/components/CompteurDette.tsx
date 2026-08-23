"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { nomsExercices } from "@/lib/nomsExercices";
import { jourLocal } from "@/lib/serie";
import { usePathname } from "next/navigation";
import { useT, useMinuscule } from "@/lib/i18n/LocaleContext";
import { exercices as exercicesDict } from "@/lib/i18n/dictionaries/exercices";
import { formaterCompact, toExerciceId, type ExerciceId, type Repartition } from "@/lib/exercices";
import { estPagePublique } from "@/lib/pagesPubliques";
import { notifierSysteme } from "@/lib/notifier";
import { echauffementConseille } from "@/lib/echauffement";
import { abonnerFile, enfiler, lireFile, viderFile } from "@/lib/fileHorsLigne";
import { useValeurClient } from "@/lib/valeurClient";

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
  const minuscule = useMinuscule();
  const nomsExo: Record<ExerciceId, string> = nomsExercices(t);

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

  /**
   * Séances faites sans réseau et pas encore envoyées.
   *
   * Lu par abonnement plutôt que par état : la file s'écrit aussi depuis le
   * renvoi automatique, qui ne passe pas par ce composant. Le serveur rend
   * zéro — il ne voit pas le stockage du navigateur.
   */
  const enAttenteEnvoi = useValeurClient(() => lireFile().length, 0, abonnerFile);

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

  /**
   * Renvoi de ce qui attend : au chargement, et dès que le réseau revient.
   *
   * `online` n'est pas fiable seul — il se déclenche sur une connexion au
   * routeur, pas sur un accès réel à Internet — mais il ne coûte rien et
   * rattrape le cas courant. Le chargement s'occupe du reste : rouvrir
   * l'application est le geste qu'on fait de toute façon.
   */
  useEffect(() => {
    if (estPagePublique(pathname)) return;
    const renvoyer = () => { viderFile().catch(() => {}); };
    renvoyer();
    window.addEventListener("online", renvoyer);
    return () => window.removeEventListener("online", renvoyer);
  }, [pathname]);

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
    notifierSysteme("Win or Workout", t.detteRappelCorps(duree(dette!.dureeSec)), "wow-dette");
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
        // Le jour part d'ici : le serveur ne connaît que l'heure UTC, et la
        // série d'un paiement fait à une heure du matin basculerait sur la
        // veille ou le lendemain selon le fuseau de la personne.
        body: JSON.stringify({
          ...(toutFait ? { tout: true } : { secondes: secondesFaites }),
          jour: jourLocal(),
        }),
      });
      if (res.ok) setDette(await res.json());
    } catch {
      /**
       * Pas de réseau : la séance est mise de côté, pas perdue.
       *
       * L'échec était avalé en silence — la fenêtre se refermait et la dette
       * restait entière. C'est la pire façon de se tromper : celui qui vient
       * de faire ses pompes en conclut que l'application ne marche pas.
       */
      enfiler(toutFait ? { tout: true, jour: jourLocal() }
                       : { secondes: secondesFaites, jour: jourLocal() });
    }
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
        data-visite="dette"
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
            color: seuilFranchi ? "var(--ember)" : "var(--steel)",
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
            <span style={{ fontSize: "0.66rem", color: "var(--faint)" }}>
              {minuscule(nomsExo[ligne.id])}
            </span>
          </div>
        ))}

        {/* Ce qui attend d'être envoyé se dit sur la pastille : sans ça, la
            dette paraît intacte après une séance, et on la refait. */}
        {enAttenteEnvoi > 0 && (
          <div style={{ fontSize: "0.62rem", color: "var(--steel)", marginTop: 5 }}>
            {enAttenteEnvoi === 1 ? t.detteHorsLigneUne : t.detteHorsLignePlusieurs(enAttenteEnvoi)}
          </div>
        )}

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

        <div style={{ fontSize: "0.62rem", marginTop: 6, color: seuilFranchi ? "var(--ember)" : "var(--faint)" }}>
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
        role="dialog"
        aria-modal="true"
        aria-label={t.detteChronoTitre}
        style={{
          position: "fixed", inset: 0, zIndex: 9500,
          background: "rgba(6,8,10,0.88)", backdropFilter: "blur(6px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <div className="lol-panel p-6 w-full max-w-sm mx-4 space-y-5 text-center">
          <h2 className="titre-section" style={{ justifyContent: "center" }}>
            {fini ? t.detteChronoFini : t.detteChronoTitre}
          </h2>

          <div className="flex flex-wrap justify-center gap-4">
            {lignes.map((ligne) => (
              <div key={ligne.id}>
                <div className="mono-num text-xl font-bold gold-text">
                  {formaterCompact(ligne.pts, ligne.id)}
                </div>
                <div className="text-xs" style={{ color: "var(--faint)" }}>
                  {minuscule(nomsExo[ligne.id])}
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
                color: "var(--steel)", marginBottom: 5,
              }}>
                {t.formeTitre}
              </div>
              {lignes.map((ligne) => (
                <p key={ligne.id} style={{
                  fontSize: "0.76rem", lineHeight: 1.55,
                  color: "var(--muted)", margin: 0,
                }}>
                  {t.forme[ligne.id]}
                </p>
              ))}
              {/* Un simple rappel, quand la séance est assez longue pour que
                  ça compte. Pas d'étape à franchir, pas de minuteur imposé :
                  une phrase, qui n'empêche personne de commencer tout de
                  suite. Une obligation ferait fermer la fenêtre. */}
              {echauffementConseille(totalRef.current) && (
                <p style={{
                  fontSize: "0.74rem", lineHeight: 1.5, margin: "8px 0 0",
                  paddingTop: 8, borderTop: "1px solid var(--line)",
                  color: "var(--amber)",
                }}>
                  {t.echauffement}
                </p>
              )}
              {/* La consigne de prudence accompagne la consigne d'exécution :
                  elle n'a aucun intérêt dans un article de CGU que personne
                  n'ouvre, et tout son intérêt ici. */}
              <p style={{
                fontSize: "0.72rem", lineHeight: 1.5, margin: "8px 0 0",
                paddingTop: 8, borderTop: "1px solid var(--line)",
                color: "var(--faint)",
              }}>
                {t.prudence}
              </p>
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
            <div className="text-xs mt-2" style={{ color: "var(--faint)" }}>
              {t.detteChronoRestant}
            </div>
          </div>

          <div className="flex gap-2">
            {!fini && (
              <button
                className="py-2 px-4 rounded text-sm flex-1"
                style={{ background: "rgba(152,162,176,0.1)", color: "var(--muted)", border: "1px solid rgba(152,162,176,0.2)" }}
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
