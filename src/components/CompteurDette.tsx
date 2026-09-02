"use client";
import { useEffect, useRef, useState } from "react";
import { duree, horloge, secondesAnnoncees, seuilFranchi } from "@/lib/compteurDette";
import { usePiegeFocus } from "@/lib/usePiegeFocus";
import { useContexteConnecte } from "@/lib/ContexteConnecte";
import { nomsExercices } from "@/lib/nomsExercices";
import { jourLocal } from "@/lib/serie";
import { useChemin } from "@/lib/i18n/useChemin";
import { useT, useMinuscule } from "@/lib/i18n/LocaleContext";
import { exercices as exercicesDict } from "@/lib/i18n/dictionaries/exercices";
import { formaterCompact, formaterQuantite, quantite, toExerciceId, type ExerciceId } from "@/lib/exercices";
import type { DettePourEcran } from "@/lib/contexteConnecte";
import { estPagePublique } from "@/lib/pagesPubliques";
import { notifierSysteme } from "@/lib/notifier";
import { echauffementConseille } from "@/lib/echauffement";
import { abonnerFile, echecFile, enfiler, lireFile, viderFile } from "@/lib/fileHorsLigne";
import { ecrire, effacer, lire } from "@/lib/stockage";
import { useValeurClient } from "@/lib/valeurClient";

type Dette = DettePourEcran;

/** Le seuil a déjà donné lieu à une notification, pour ce franchissement-ci. */
const CLE_SEUIL_NOTIFIE = "low_dette_seuil_notifie";

/**
 * Compteur d'effort en attente. Il ne concerne que les exercices comptés en
 * temps : des pompes se font tout de suite après la partie, alors qu'un round
 * de boxe n'a d'intérêt qu'une fois quelques minutes réunies. Le compteur les
 * cumule donc, et prévient quand il y a de quoi faire une vraie séance.
 *
 * Affichée en pastille fixe, elle suit sur toutes les pages et reste visible
 * quand on descend : c'est le point de la chose, ne pas oublier ce qu'on doit.
 */
export function CompteurDette() {
  const pathname = useChemin();
  const t = useT(exercicesDict);
  const minuscule = useMinuscule();
  const nomsExo: Record<ExerciceId, string> = nomsExercices(t);


  const [chronoOuvert, setChronoOuvert] = useState(false);
  const chronoRef = useRef<HTMLDivElement>(null);

  /**
   * Le décompte recouvre l'écran entier : au clavier, il ne retenait rien.
   *
   * Le piège se pose depuis le PARENT et non depuis la fenêtre, parce que
   * `ModaleChrono` n'est pas un composant stable : c'était une fonction
   * redéfinie à chaque rendu, donc un type différent à chaque fois, donc un
   * démontage et un remontage complets — une fois par seconde, puisque le
   * décompte fait rendre le parent à chaque tic. Le focus y aurait été détruit
   * aussitôt posé. Elle est appelée comme une fonction maintenant, ce qui la
   * fait entrer dans l'arbre du parent au lieu d'en créer un nouveau.
   *
   * Échap abandonne la séance sans rien acquitter, ce qui est le seul choix
   * sûr : acquitter au clavier ce qu'on n'a peut-être pas fait effacerait une
   * dette qu'on doit encore.
   */
  usePiegeFocus(chronoRef, { actif: chronoOuvert, onEchap: () => setChronoOuvert(false) });
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
  /** Pourquoi la file n'avance pas, quand elle n'avance pas. */
  const blocage = useValeurClient(() => echecFile()?.motif ?? null, null, abonnerFile);

  /**
   * La dette vient du contexte commun, plus d'un appel à soi.
   *
   * Ce composant et le titre de l'onglet la demandaient chacun de son côté :
   * deux fois la même réponse par chargement de page. Le fournisseur la lit une
   * fois et écoute `wow-dette-changee` pour tout le monde.
   */
  const contexte = useContexteConnecte();
  const dette = (contexte.dette ?? null) as Dette | null;

  /**
   * Les lignes de la dette, une par exercice réellement dû.
   *
   * `valeur` vient du SERVEUR (`dette.quantites`) et n'est pas recalculée ici.
   * Elle l'était, à partir des points et des ratios du navigateur : la
   * pastille affichait alors « 3 min 35 » pendant que le seuil d'alerte et la
   * notification lisaient `dureeSec` et voyaient 8 min 06. Deux conversions de
   * la même dette, sur deux machines.
   *
   * Le repli sur la conversion locale ne sert qu'aux réponses d'avant cette
   * colonne : il vaut mieux un nombre approché qu'une case vide.
   */
  const lignesDette = dette
    ? Object.entries(dette.repartition)
        .map(([id, pts]) => {
          const exercice = toExerciceId(id);
          const rendue = dette.quantites?.[id];
          return {
            id: exercice,
            pts: pts ?? 0,
            valeur: typeof rendue === "number"
              ? formaterQuantite(rendue, exercice)
              : formaterCompact(pts ?? 0, exercice),
            secondes: typeof rendue === "number" ? rendue : quantite(pts ?? 0, exercice),
          };
        })
        .filter((l) => l.pts > 0)
    : [];

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
    /**
     * Et on réessaie tant qu'il reste quelque chose.
     *
     * Le renvoi ne se déclenchait qu'au chargement d'une page et au retour de
     * l'événement `online`. Un envoi refusé alors qu'on est connecté — le
     * serveur qui tousse, une session qui vient d'expirer — n'était donc plus
     * jamais retenté tant qu'on ne changeait pas de page. Six séances ont
     * ainsi attendu des heures sur une machine parfaitement en ligne.
     *
     * Une minute : assez pour rattraper une panne passagère, assez peu pour ne
     * pas marteler un serveur qui refuse. La boucle s'arrête d'elle-même
     * quand la file est vide — `viderFile` ne fait alors aucun appel.
     */
    const reprise = setInterval(renvoyer, 60_000);
    return () => {
      window.removeEventListener("online", renvoyer);
      clearInterval(reprise);
    };
  }, [pathname]);

  const seuilAtteint = seuilFranchi(dette);

  /**
   * Notification système au franchissement du seuil, une seule fois par palier.
   *
   * La marque vivait dans une `useRef`, donc dans le MONTAGE du composant :
   * elle repartait à zéro à chaque changement de page. Sur une soirée passée à
   * naviguer entre le tableau de bord, l'historique et les réglages, ça faisait
   * une notification par navigation — treize d'affilée relevées sur une seule
   * session. Une application qui redit la même chose treize fois se fait
   * couper les notifications, et elle l'a cherché.
   *
   * Elle vit donc dans le stockage, qui survit au montage comme au
   * rechargement, et elle s'efface quand la dette repasse sous le seuil : le
   * palier suivant doit pouvoir prévenir à son tour.
   */
  useEffect(() => {
    if (!seuilAtteint) {
      notifieRef.current = false;
      effacer(CLE_SEUIL_NOTIFIE);
      return;
    }
    if (notifieRef.current || lire(CLE_SEUIL_NOTIFIE) === "1") return;
    notifieRef.current = true;
    ecrire(CLE_SEUIL_NOTIFIE, "1");
    notifierSysteme("Win or Workout", t.detteRappelCorps(duree(dette!.dureeSec)), "wow-dette");
  }, [seuilAtteint, dette, t]);

  const arreterTick = () => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
  };
  useEffect(() => arreterTick, []);

  const ouvrirChrono = () => {
    if (!dette || dette.dureeSec <= 0) return;
    // On décompte le nombre ANNONCÉ juste au-dessus, pas `dureeSec` : voir
    // `secondesAnnoncees`. Sans ça, l'en-tête disait « 1 min 15 » et le chrono
    // démarrait à 1:17.
    const total = secondesAnnoncees(lignesDette, dette.dureeSec);
    totalRef.current = total;
    setRestantSec(total);
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
      if (res.ok) {
        contexte.poserDette(await res.json());
      } else if (res.status >= 500 || res.status === 401) {
        /**
         * Le serveur a répondu, mal.
         *
         * Le `catch` ne rattrape que l'absence de réseau : une réponse 500 ou
         * une session expirée passaient donc par `if (res.ok)` sans rien
         * faire, la fenêtre se refermait, et la séance qu'on venait de faire
         * disparaissait sans un mot. C'est exactement le défaut que la file
         * hors ligne existe pour empêcher, laissé ouvert sur le seul chemin
         * où le serveur est joignable.
         *
         * Mêmes règles que la file : 401 et 5xx se rejouent, le reste non —
         * un 4xx ne passera jamais, et le garder bloquerait la file derrière.
         */
        enfiler(toutFait ? { tout: true, jour: jourLocal() }
                         : { secondes: secondesFaites, jour: jourLocal() });
      }
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

  const lignes = lignesDette;

  // Rien en attente, ou page publique : la pastille ne s'affiche pas.
  if (surPagePubliqueRef.current) return null;
  if (!dette || dette.exercices.length === 0 || dette.dureeSec <= 0) {
    return chronoOuvert ? ModaleChrono() : null;
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
          borderColor: seuilAtteint ? "rgba(255,77,46,0.5)" : "var(--line)",
          boxShadow: seuilAtteint
            ? "0 12px 34px rgba(0,0,0,0.5), 0 0 24px rgba(255,77,46,0.16)"
            : "0 10px 28px rgba(0,0,0,0.4)",
          transition: "border-color 0.3s, box-shadow 0.3s",
        }}
      >
        <div
          style={{
            fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.13em",
            color: seuilAtteint ? "var(--ember)" : "var(--steel)",
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
                color: seuilAtteint ? "var(--ember)" : "var(--amber)",
              }}
            >
              {ligne.valeur}
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
            {/* Et pourquoi elles attendent. Sans ça, une file qui grossit sur
                une machine connectée ne s'explique par rien. */}
            {blocage && (
              <span style={{ display: "block", color: "var(--ember)", marginTop: 2 }}>
                {blocage === "session" ? t.detteFileSession
                  : blocage === "reseau" ? t.detteFileReseau
                  : t.detteFileServeur}
              </span>
            )}
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
              background: seuilAtteint ? "var(--ember)" : "var(--brand-gradient)",
              transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          />
        </div>

        <div style={{ fontSize: "0.62rem", marginTop: 6, color: seuilAtteint ? "var(--ember)" : "var(--faint)" }}>
          {seuilAtteint ? t.detteFaireBtn : t.detteSeuil(duree(dette.seuilSec))}
        </div>
      </button>

      {chronoOuvert && ModaleChrono()}
    </>
  );

  /** Décompte plein écran du temps d'effort à faire. */
  function ModaleChrono() {
    return (
      <div
        ref={chronoRef}
        tabIndex={-1}
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
                  {ligne.valeur}
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
