"use client";
import { useEffect, useMemo, useState } from "react";
import { avecLocale } from "@/lib/i18n/cheminLocalise";
import { nomsExercices } from "@/lib/nomsExercices";
import { SerieEtRetard } from "@/components/SerieEtRetard";
import { Paliers } from "@/components/Paliers";
import { DefiDuJour } from "@/components/DefiDuJour";
import { PremiersPas } from "@/components/PremiersPas";
import { OBJECTIF_PARTIES } from "@/lib/premiereSemaine";
import dynamic from "next/dynamic";
import { DesktopAuthHandler } from "@/components/DesktopAuthHandler";
import { ChampionIcon } from "@/components/ChampionIcon";
import { Icone } from "@/components/Icone";
import { useSession } from "@/lib/SessionContext";
import { useT, useDateLocale, useLocale, etiquetteLocale, useMinuscule, usePourcentage } from "@/lib/i18n/LocaleContext";
import { dashboard } from "@/lib/i18n/dictionaries/dashboard";
import { exercices as exercicesDict } from "@/lib/i18n/dictionaries/exercices";
import { translateApiError } from "@/lib/i18n/apiErrors";
import {
  EXERCICES, EXERCICE_DEFAUT, EXERCICE_IDS, formaterAxe, formaterCompact,
  toExerciceId, toExerciceIds, type ExerciceId,
} from "@/lib/exercices";
import { ExerciceSelector } from "@/components/ExerciceSelector";
import { jeux as jeuxDict } from "@/lib/i18n/dictionaries/jeux";
import { JEU_DEFAUT, capacitesDuJeu, formaterTempsJeu, typeDuJeu, type TypeJeu } from "@/lib/jeux";
import { JeuSelector } from "@/components/JeuSelector";
import { SessionChrono } from "@/components/SessionChrono";
import { RailActions } from "@/components/RailLateral";
import { Modale } from "@/components/Modale";
import { TestPompes } from "@/components/TestPompes";
import { getLevelParPompes, testAFaire, type LevelCfg } from "@/lib/scoring";
import { StatCard, type ChampSummary } from "@/components/dashboard/Cartes";
import { ComparatifJeux } from "@/components/dashboard/ComparatifJeux";
import { PlaceGraphique } from "@/components/dashboard/Squelette";

/**
 * Les graphiques arrivent à part.
 *
 * La bibliothèque de tracés pèse 447 ko, et elle se retrouvait dans le morceau
 * de code commun : l'historique et les réglages, qui n'ont aucun graphique, la
 * téléchargeaient quand même. Sur un téléphone au réseau moyen et au
 * processeur quatre fois plus lent, le premier rendu utile du tableau de bord
 * arrivait à 3,7 secondes, contre 0,9 pour l'historique.
 *
 * Chargés à la demande, ils forment leur propre morceau : les deux autres
 * écrans ne le voient plus, et le haut du tableau de bord s'affiche sans
 * l'attendre. Le cadre est réservé pendant ce temps, sinon la page sauterait
 * au moment où les tracés se posent.
 */
/**
 * Le formulaire d'ajout ne s'affiche que dans une fenêtre ouverte à la demande.
 *
 * Huit cent soixante-dix lignes, et tout ce qu'elles traînent — la saisie de
 * champion avec son autocomplétion, la liste des parties Riot, deux
 * dictionnaires — partaient dans le paquet initial du tableau de bord pour un
 * écran que la plupart des chargements ne montrent jamais. Même traitement que
 * les graphiques, et pour la même raison.
 *
 * Sans repli visible : il n'apparaît qu'à l'intérieur d'une fenêtre qu'on vient
 * d'ouvrir, où un cadre vide le temps du chargement vaut mieux qu'un squelette
 * qui bouge.
 */
const AjoutActivite = dynamic(
  () => import("@/components/AjoutActivite").then((m) => m.AjoutActivite),
  { ssr: false },
);

const GraphiquePeriode = dynamic(
  () => import("@/components/dashboard/GraphiquePeriode").then((m) => m.GraphiquePeriode),
  { ssr: false, loading: () => <PlaceGraphique /> },
);
const SyntheseJeu = dynamic(
  () => import("@/components/dashboard/SyntheseJeu").then((m) => m.SyntheseJeu),
  { ssr: false, loading: () => <PlaceGraphique /> },
);
const GraphiqueSession = dynamic(
  () => import("@/components/dashboard/GraphiqueSession").then((m) => m.GraphiqueSession),
  { ssr: false, loading: () => <PlaceGraphique /> },
);
const GraphiquesGlobaux = dynamic(
  () => import("@/components/dashboard/GraphiquesGlobaux").then((m) => m.GraphiquesGlobaux),
  { ssr: false, loading: () => <PlaceGraphique double /> },
);
import { Squelette } from "@/components/dashboard/Squelette";
import { ecrire, lire } from "@/lib/stockage";

/**
 * `jour` (0 = dimanche) et `mois` (0 = janvier) viennent du serveur ; `label`
 * est le repli français des installations plus anciennes. C'est le
 * navigateur qui nomme le jour et le mois, dans la langue du lecteur.
 */
type PeriodStat = { label: string; jour?: number; mois?: number; avg: number; total: number };

type DashData = {
  totalGames: number;
  wins: number;
  winrate: number;
  totalPompes: number;
  /** Absent tant que le consentement aux données de santé n'est pas donné. */
  calories: { total: number; marcheMin: number } | null;
  recordPompes: number;
  pompesByRole: Record<string, number>;
  gamesByRole: Record<string, number>;
  /** Battle royale : ventilation par mode d'équipe, indexée par taille de groupe. */
  pompesByMode?: Record<string, number>;
  gamesByMode?: Record<string, number>;
  pompesByJeu?: Record<string, number>;
  gamesByJeu?: Record<string, number>;
  cumulByDate: { date: string; cumul: number }[];
  /** Coût moyen d'une activité, semaine par semaine : le seul indicateur qui peut descendre. */
  moyenneParSemaine?: { semaine: string; moyenne: number; parties: number }[];
  statsByPeriod: { hour: PeriodStat[]; weekday: PeriodStat[]; month: PeriodStat[] };
  /** Paliers du test de force, livrés avec le reste pour éviter un aller-retour. */
  levelConfigs?: LevelCfg[];
  pompesMax?: number;
  pompesMaxLe?: string | null;
  dailyPompes: { date: string; total: number }[];
  /** Effort accumulé aujourd'hui, et seuil au-delà duquel on prévient. */
  pointsAujourdhui?: number;
  veille?: { pointsJour: number; pointsSemaine: number; alerte: "jour" | "semaine" | null };
  defaitesDAffilee?: number;
  premiereSemaine?: {
    parties: number; avancement: number; restantes: number; joursRestants: number;
    atteint: boolean; visible: boolean;
  };
  plafondQuotidien?: number;
  mostPlayed: ChampSummary | null;
  leastEfficient: ChampSummary | null;
  objectifTotalPompes: number;
  exercices?: ExerciceId[];
  filtreExercice?: ExerciceId | null;
  global?: {
    totalGames: number; wins: number; winrate: number; totalPoints: number;
    tempsJoueSec?: number; totalParties?: number;
  };
  pointsParExercice?: Record<string, number>;
  recordExercice?: ExerciceId | null;
  // ── Multi-jeu ──
  jeuxJoues?: {
    nom: string; type: TypeJeu; games: number; points: number;
    wins: number; parties: number; tempsJoueSec: number;
    winrate: number | null; detteMoyenne: number;
  }[];
  filtreJeu?: string | null;
  typeJeuFiltre?: TypeJeu | null;
  tempsJoueSec?: number;
  totalParties?: number;
};

/**
 * Ce que le serveur a déjà en main au moment de rendre la page.
 *
 * Le tableau de bord lisait tout après montage : tant que `/api/dashboard`
 * n'avait pas répondu, il n'y avait rien d'autre qu'un squelette à l'écran, et
 * le plus grand élément — le rappel du test de force — paraissait à 3456 ms
 * sur téléphone bridé. Les trois valeurs dont ce premier écran a besoin sont
 * lues côté serveur et parties dans le HTML : elles n'attendent plus rien.
 */
export type DepartServeur = {
  pompesMax: number;
  pompesMaxLe: string | null;
  niveaux: LevelCfg[];
};

export default function TableauDeBord({ depart }: { depart: DepartServeur }) {
  const pourcent = usePourcentage();
  const t = useT(dashboard);
  const minuscule = useMinuscule();
  const tExo = useT(exercicesDict);
  const tJeux = useT(jeuxDict);
  const dateLocale = useDateLocale();
  const [data, setData] = useState<DashData | null>(null);
  /**
   * Les statistiques n'ont pas pu être chargées.
   *
   * Sans cet état, une réponse en erreur laissait le squelette à l'écran pour
   * toujours : une panne serveur ressemblait exactement à une page qui met du
   * temps. On attend, on recharge, on attend encore. Le dire coûte une ligne.
   */
  const [chargementRate, setChargementRate] = useState(false);
  /** Modale ouverte depuis le rail latéral. */
  const [modale, setModale] = useState<"session" | "ajout" | null>(null);
  const [statsPeriod, setStatsPeriod] = useState<"hour" | "weekday" | "month" | "daily">("weekday");

  const [statsMode, setStatsMode] = useState<"avg" | "total">("avg");
  const [calendarDate, setCalendarDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [dailyHourly, setDailyHourly] = useState<{ label: string; total: number }[] | null>(null);
  const [dailySummary, setDailySummary] = useState<{ total: number; games: number } | null>(null);
  // Jour dont le détail est effectivement affiché. Le chargement s'en déduit :
  // tant qu'il ne correspond pas à la date demandée, la réponse est en route.
  const [dailyCharge, setDailyCharge] = useState<string | null>(null);
  const [roleView, setRoleView] = useState<"total" | "avg">("total");
  const [exercicesSel, setExercicesSel] = useState<ExerciceId[]>([EXERCICE_DEFAUT]);
  const [filtreExo, setFiltreExo] = useState<ExerciceId | null>(null);
  const [filtreJeu, setFiltreJeu] = useState<string | null>(null);
  // Jeu de la prochaine session, mémorisé d'une fois sur l'autre.
  const [jeuChoisi, setJeuChoisi] = useState<string>(() => {
    if (typeof window !== "undefined") return lire("lastJeu") ?? JEU_DEFAUT;
    return JEU_DEFAUT;
  });
  const [typeJeuChoisi, setTypeJeuChoisi] = useState<TypeJeu>(() => {
    if (typeof window !== "undefined") return typeDuJeu(lire("lastJeu") ?? JEU_DEFAUT);
    return "parties";
  });
  const [arretEnCours, setArretEnCours] = useState(false);
  // Test de force : le niveau n'est plus redemandé à chaque session, il vit sur
  // le compte. Chargé à l'ouverture de la modale, pas au chargement du tableau.
  /**
   * Le test de force vient maintenant avec les statistiques, dans la même
   * réponse. On ne le recopie pas dans un état : le faire imposerait un second
   * rendu, et le rappel du test — deux cent trente-trois pixels — apparaîtrait
   * après le reste en poussant toute la page vers le bas. Mesuré à 0,083 de
   * déplacement cumulé, deux fois sur trois.
   *
   * Seul l'enregistrement d'un nouveau test garde un état : il doit s'afficher
   * avant que le serveur n'ait confirmé.
   */
  const [testLocal, setTestLocal] = useState<{ max: number; le: string } | null>(null);


  const {
    sessionActive, sessionGames, sessionError, polling, countdown, sessionNiveau,
    startSession, stopSession,
    typeSession, jeuSession, chronoSec, chronoErreur, arreterChrono, dettePoints,
  } = useSession();
  const { locale } = useLocale();
  /**
   * Les jours et les mois se nomment avec `Intl`, jamais avec une table écrite
   * à la main : six langues voudraient six tables, et le navigateur sait déjà
   * le faire. Le 4 janvier 1970 était un dimanche — c'est le point de départ
   * qui fait correspondre le numéro de jour à sa date.
   */
  const periodeTraduite = useMemo(() => {
    const source = data?.statsByPeriod?.[statsPeriod === "daily" ? "weekday" : statsPeriod] ?? [];
    const etiquette = etiquetteLocale(locale);
    const jours = new Intl.DateTimeFormat(etiquette, { weekday: "short", timeZone: "UTC" });
    const mois = new Intl.DateTimeFormat(etiquette, { month: "short", timeZone: "UTC" });
    return source.map((p) => {
      if (typeof p.jour === "number") {
        return { ...p, label: jours.format(new Date(Date.UTC(1970, 0, 4 + p.jour))) };
      }
      if (typeof p.mois === "number") {
        return { ...p, label: mois.format(new Date(Date.UTC(1970, p.mois, 1))) };
      }
      return p;
    });
  }, [data, statsPeriod, locale]);

  const loadDash = (filtre: ExerciceId | null = filtreExo, jeu: string | null = filtreJeu) => {
    const qs = new URLSearchParams();
    if (filtre) qs.set("exercice", filtre);
    if (jeu) qs.set("jeu", jeu);
    const url = qs.toString() ? `/api/dashboard?${qs}` : "/api/dashboard";
    return fetch(url).then(async (res) => {
      if (!res.ok) {
        // Session invalide (ex. cookie d'une ancienne base) → retour au login.
        if (res.status === 401 && typeof window !== "undefined") {
          window.location.href = avecLocale("/login", locale);
          return;
        }
        setChargementRate(true);
        return;
      }
      const d = await res.json();
      setChargementRate(false);
      setData(d);
      setExercicesSel(toExerciceIds(d?.exercices));
    }).catch(() => setChargementRate(true));
  };

  // Charge au montage puis à chaque changement de périmètre consulté.
  useEffect(() => { loadDash(filtreExo, filtreJeu); }, [filtreExo, filtreJeu]);

  // Rafraîchit les stats globales à chaque nouvelle game loggée en session.
  useEffect(() => {
    if (sessionGames.length > 0) loadDash();
  }, [sessionGames.length]);

  useEffect(() => {
    if (statsPeriod !== "daily") return;
    // En changeant de date rapidement, une réponse tardive écrasait la plus
    // récente : on ignore celles dont on n'attend plus rien.
    let obsolete = false;
    fetch(`/api/dashboard/daily?date=${calendarDate}`)
      .then((r) => r.json())
      .then((d) => {
        if (obsolete) return;
        setDailyHourly(d.hourly ?? []);
        setDailySummary({ total: d.total ?? 0, games: d.games ?? 0 });
        setDailyCharge(calendarDate);
      })
      .catch(() => { if (!obsolete) setDailyCharge(calendarDate); });
    return () => { obsolete = true; };
  }, [statsPeriod, calendarDate]);

  const dailyLoading = statsPeriod === "daily" && dailyCharge !== calendarDate;

  // Le niveau vient du test de force enregistré sur le compte. Il arrivait par
  // une requête à part, ce qui faisait paraître le rappel du test après le
  // reste et poussait toute la page vers le bas. Il voyage désormais avec les
  // statistiques : une seule réponse, et rien ne bouge après coup.


  const handleSavePompesMax = async (valeur: number): Promise<boolean> => {
    // L'échec était avalé : le panneau se fermait, la saisie s'effaçait, et
    // rien n'était enregistré. C'est ce test qui fixe le niveau, donc toute la
    // dette. Le résultat remonte maintenant à l'écran, qui garde la saisie.
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPrefs: { pompesMax: valeur } }),
      });
      if (!res.ok) return false;
      setTestLocal({ max: valeur, le: new Date().toISOString() });
      return true;
    } catch {
      return false;
    }
  };

  // Les trois valeurs du test de force, lues directement de la réponse — sauf
  // celle qu'on vient d'enregistrer, qui doit paraître sans attendre le
  // rechargement des statistiques.
  // L'ordre compte : ce qu'on vient de saisir passe devant la réponse de
  // l'API, qui passe devant ce que le serveur a rendu. Le départ serveur n'est
  // donc jamais faux, il est seulement le plus ancien des trois.
  const niveaux: LevelCfg[] = data?.levelConfigs ?? depart.niveaux;
  const pompesMax = testLocal?.max ?? data?.pompesMax ?? depart.pompesMax;
  const pompesMaxLe = testLocal?.le ?? data?.pompesMaxLe ?? depart.pompesMaxLe;

  // Niveau affiché pendant la session : celui que le serveur appliquera, déduit
  // du test de force. Tant que le test n'est pas fait, le compte reste au plus bas.
  const niveauActuel =
    pompesMax > 0 && niveaux.length > 0 ? getLevelParPompes(pompesMax, niveaux).niveau : 1;

  const handleDemarrerSession = async () => {
    ecrire("lastJeu", jeuChoisi);
    // La fenêtre reste ouverte : elle bascule sur l'état de la session qui vient
    // de démarrer, ce qui confirme le lancement sans clic supplémentaire.
    // Le choix fait ici devient la préférence, pour l'ARAM du chaos comme pour
    // les prochaines sessions.
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userPrefs: { exercices: exercicesSel } }),
    }).catch(() => {});
    await startSession(niveauActuel, jeuChoisi);
  };

  // Fin d'une session chronométrée : la durée est écrite, puis les stats
  // rechargées pour que la nouvelle dette apparaisse tout de suite.
  const handleArreterChrono = async () => {
    setArretEnCours(true);
    const ok = await arreterChrono();
    setArretEnCours(false);
    if (ok) loadDash();
  };

  // Le transfert de session vers l'application desktop ne dépend pas des
  // statistiques : il était monté plus bas, donc APRÈS ce retour anticipé.
  // Tant que le tableau de bord chargeait, le relais n'était pas même tenté —
  // et si le chargement échouait, l'application restait indéfiniment sur son
  // écran « Authentification en cours », le navigateur affichant pourtant une
  // session parfaitement valide.
  /**
   * Le premier écran : le titre, et le rappel du test de force.
   *
   * Il ne dépend que de ce que le serveur a passé, donc il part dans le HTML
   * de la réponse. C'est lui qu'on voyait arriver à 3456 ms sur téléphone
   * bridé, parce que la page rendait son squelette tant que l'API n'avait pas
   * répondu. Écrit une fois et rendu dans les deux états, pour qu'il ne saute
   * pas quand les données arrivent.
   */
  const premierEcran = (
    <>
      <h1 className="titre-page">{t.pageTitle}</h1>

      {/* Bannière bêta : la synchronisation depuis le site attend Riot.

          Elle vit dans le PREMIER écran, et non dans le rendu principal : elle
          ne dépend d'aucune donnée, et elle y attendait pourtant la réponse de
          l'API. Sur téléphone bridé, elle est devenue le plus grand élément de
          la page le jour où son texte s'est allongé, et le faisait paraître à
          3540 ms contre 1108 avant. Rendue avec le HTML, elle est là tout de
          suite — et elle explique justement ce qu'il faut faire en attendant. */}
      <div style={{
        padding: "12px 16px",
        borderRadius: 8,
        background: "rgba(110,155,255,0.06)",
        border: "1px solid rgba(110,155,255,0.25)",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
      }}>
        <Icone nom="recharger" taille={17} couleur="#6E9BFF" style={{ marginTop: 1 }} />
        <div>
          <p style={{ fontSize: "0.82rem", color: "#6E9BFF", fontWeight: 600, marginBottom: 4 }}>
            {t.syncBannerTitle}
          </p>
          <p style={{ fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.6 }}>
            {t.syncBannerBody}
          </p>
        </div>
      </div>
      {/* Le rappel du test de force. Il ne vivait que dans les réglages et
          dans la modale de session : deux endroits où l'on ne va pas de
          soi-même, pour un chiffre qui fixe le multiplicateur appliqué à TOUTE
          la dette. Sans lui, tout le monde reste au niveau 1 sans savoir
          pourquoi. Il s'affiche ici, et disparaît dès qu'il est passé. */}
      {testAFaire(pompesMax, pompesMaxLe) && niveaux.length > 0 && (
        <div className="lol-panel p-5">
          <TestPompes
            autonome
            pompesMax={pompesMax}
            faitLe={pompesMaxLe}
            niveaux={niveaux}
            onEnregistre={handleSavePompesMax}
          />
        </div>
      )}
    </>
  );

  if (!data) {
    return (
      <div className="space-y-6">
        <DesktopAuthHandler />
        {premierEcran}
        {chargementRate ? (
          <div className="lol-panel p-8 text-center">
            <p style={{ color: "var(--loss)" }}>{t.chargementRate}</p>
            <button
              type="button"
              className="lol-btn mt-4"
              onClick={() => { setChargementRate(false); loadDash(); }}
            >
              {t.reessayer}
            </button>
          </div>
        ) : (
          <>
            <span className="lecture-ecran" role="status">{t.loading}</span>
            <Squelette />
          </>
        )}
      </div>
    );
  }

  // Les données restent en POINTS D'EFFORT : on ne convertit qu'à l'affichage,
  // ce qui laisse les échelles des graphiques inchangées (conversion linéaire).
  const exercicesActifs = toExerciceIds(data.exercices);
  // Exercices réellement présents dans l'historique : ils seuls méritent un filtre.
  const exercicesJoues = EXERCICE_IDS.filter((id) => (data.pointsParExercice?.[id] ?? 0) > 0);
  const multi = filtreExo === null && exercicesJoues.length > 1;
  const exercice = filtreExo ?? (exercicesJoues[0] ?? exercicesActifs[0]);
  const nomsExo: Record<ExerciceId, string> = nomsExercices(tExo);
  // Ventilation du total : une ligne par exercice réellement utilisé.
  const lignesTotal = Object.entries(data.pointsParExercice ?? {})
    .filter(([, pts]) => pts > 0)
    .map(([ex, pts]) => ({
      nom: nomsExo[toExerciceId(ex)],
      valeur: formaterCompact(pts, toExerciceId(ex)),
    }));
  const exerciceRecord = toExerciceId(data.recordExercice ?? exercice);
  const globalStats = data.global ?? {
    totalGames: data.totalGames,
    wins: data.wins,
    winrate: data.winrate,
    totalPoints: data.totalPompes,
  };
  // ── Multi-jeu ──
  // Le filtre par jeu n'a de sens qu'à partir de deux jeux différents.
  const jeuxJoues = data.jeuxJoues ?? [];
  const typeConsulte = data.typeJeuFiltre ?? null;
  // Un jeu au temps n'a ni résultat, ni rôle, ni champion : afficher ces
  // sections reviendrait à montrer des graphiques vides ou faux.
  const vueTemps = typeConsulte === "temps";
  const aDuTemps = (data.global?.tempsJoueSec ?? 0) > 0;

  const fmt = (points: number) => formaterCompact(points, exercice);
  const fmtAxe = (points: number) => formaterAxe(points, exercice);

  const progress = data.objectifTotalPompes > 0
    ? Math.min(100, Math.round((globalStats.totalPoints / data.objectifTotalPompes) * 100))
    : 0;
  const roleData = Object.entries(data.pompesByRole ?? {}).map(([role, pompes]) => ({
    role,
    pompes: roleView === "avg"
      ? Math.round(pompes / (data.gamesByRole?.[role] || 1))
      : pompes,
  }));

  /**
   * Le jeu que la page décrit réellement. Les statistiques par rôle et par
   * champion n'ont de sens que sur un seul jeu — mais ne pas filtrer ne veut
   * pas dire « plusieurs jeux » : quand on n'en a joué qu'un, « tous les jeux »
   * désigne celui-là. Sans cette nuance, quelqu'un qui ne joue qu'à League ne
   * voyait jamais ses champions, faute de filtre à cliquer.
   */
  const jeuUnique = filtreJeu ?? (jeuxJoues.length === 1 ? jeuxJoues[0].nom : null);

  // Le plafond est un avertissement, pas une limite : il se déclenche une fois
  // franchi et n'empêche jamais d'enregistrer une partie de plus.
  const plafondDepasse =
    (data.plafondQuotidien ?? 0) > 0
    && (data.pointsAujourdhui ?? 0) > (data.plafondQuotidien ?? 0);

  // Sur un battle royale, les rôles n'existent pas : toutes les parties
  // tombent dans la même case et le graphique ne dit rien. On le remplace par
  // la ventilation solo / duo / trio / squad, qui elle distingue vraiment.
  const estBattleRoyale = jeuUnique !== null && capacitesDuJeu(jeuUnique).br;
  const modeData = Object.entries(data.pompesByMode ?? {})
    .map(([taille, pompes]) => ({
      taille: Number(taille),
      label: t.modeNom(Number(taille)),
      pompes: roleView === "avg"
        ? Math.round(pompes / (data.gamesByMode?.[taille] || 1))
        : pompes,
    }))
    .sort((a, b) => a.taille - b.taille);
  const repartitionData: { label: string; pompes: number }[] = estBattleRoyale
    ? modeData.map(({ label, pompes }) => ({ label, pompes }))
    : roleData.map(({ role, pompes }) => ({ label: role, pompes }));

  // Répartition par jeu : la lecture d'ensemble d'un joueur multi-jeux. Elle
  // n'a de sens qu'à partir de deux jeux, et pas quand on en filtre un seul.
  const jeuData = Object.entries(data.pompesByJeu ?? {})
    .map(([jeu, pompes]) => ({
      jeu,
      pompes: roleView === "avg"
        ? Math.round(pompes / (data.gamesByJeu?.[jeu] || 1))
        : pompes,
    }))
    .sort((a, b) => b.pompes - a.pompes);
  const afficherParJeu = filtreJeu === null && jeuData.length > 1;
  const totalSessionPompes = sessionGames.reduce((s, g) => s + g.pompes, 0);
  const sessionChartData = [...sessionGames].reverse().map((g, i) => ({ label: `G${i + 1}`, pompes: g.pompes }));

  return (
    <div className="space-y-6">
      <DesktopAuthHandler />
      {premierEcran}


      {/* Avertissement de volume quotidien. Ce n'est pas un blocage : la dette
          reste due, on signale seulement qu'on a dépassé ce qu'on s'était fixé
          pour la journée, et on rappelle qu'on a le droit de s'arrêter là. */}
      {plafondDepasse && (
        <div style={{
          padding: "12px 16px",
          borderRadius: 8,
          background: "rgba(255,180,84,0.07)",
          border: "1px solid rgba(255,180,84,0.3)",
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
        }}>
          <Icone nom="alerte" taille={17} couleur="var(--amber)" style={{ marginTop: 1 }} />
          <div>
            <p style={{ fontSize: "0.82rem", color: "var(--amber)", fontWeight: 600, marginBottom: 4 }}>
              {t.plafondTitre}
            </p>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.6 }}>
              {t.plafondCorps(
                fmt(data.pointsAujourdhui ?? 0),
                fmt(data.plafondQuotidien ?? 0),
              )}
            </p>
          </div>
        </div>
      )}

      {/* Vue d'ensemble — jamais filtrée : elle décrit toute l'activité */}
      <div data-visite="stats" className={`grid grid-cols-1 gap-3 ${aDuTemps ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
        <StatCard label={t.gamesPlayed} value={globalStats.totalGames} i={0} />
        <StatCard
          label={t.winrate}
          value={pourcent(globalStats.winrate)}
          // Le dénominateur est le nombre de parties compétitives : les
          // sessions au temps n'ont pas de résultat et n'entrent pas au compte.
          sub={`${globalStats.wins}V / ${(globalStats.totalParties ?? globalStats.totalGames) - globalStats.wins}D`}
          i={1}
        />
        <StatCard
          label={t.totalPompes}
          value={lignesTotal.length <= 1 ? fmt(globalStats.totalPoints) : undefined}
          lignes={lignesTotal.length > 1 ? lignesTotal : undefined}
          i={2}
          // Repli de l'étape « ce que tu dois » : la pastille de dette n'existe
          // pas tant qu'on ne doit rien, et c'est précisément le cas d'un
          // compte neuf — le seul public de la visite.
          ancre="dette-carte"
        />
        {aDuTemps && (
          <StatCard
            label={tJeux.tempsJoueLabel}
            value={formaterTempsJeu(data.global?.tempsJoueSec ?? 0)}
            i={3}
          />
        )}
      </div>

      {/* Les sept premiers jours décident du reste : ce qu'on fait pendant
          cette semaine-là dit si on reviendra, et le produit n'y peut plus
          grand-chose après. L'objectif est donc petit — cinq parties, ce qu'on
          enregistre en une soirée — et il disparaît au bout de sept jours,
          atteint ou non. Un objectif raté qui reste affiché n'est plus un
          objectif, c'est un reproche.

          Atteint, il reste jusqu'à la fin de la fenêtre, mais il change
          d'état. Il s'effaçait à la seconde où on l'atteignait : réussir et
          ignorer produisaient exactement le même écran, c'est-à-dire rien.
          Un objectif réussi qu'on laisse est un trophée, pas un reproche. */}
      {data.premiereSemaine?.visible && (
        <div className="lol-panel p-4">
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "baseline", gap: 12, flexWrap: "wrap",
          }}>
            <div style={{
              color: data.premiereSemaine.atteint ? "var(--victory)" : "var(--gold)",
              fontWeight: 600,
            }}>
              {data.premiereSemaine.atteint ? t.debutAtteintTitre : t.debutTitre}
            </div>
            {/* Le décompte n'a plus de sens une fois l'objectif atteint : il
                ne reste rien à faire avant la fin de la fenêtre. */}
            {!data.premiereSemaine.atteint && (
              <div className="text-xs" style={{ color: "var(--faint)" }}>
                {t.debutJours(data.premiereSemaine.joursRestants)}
              </div>
            )}
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6, margin: "4px 0 10px" }}>
            {data.premiereSemaine.atteint
              ? t.debutAtteintTexte
              : t.debutTexte(data.premiereSemaine.restantes)}
          </p>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={OBJECTIF_PARTIES}
            aria-valuenow={data.premiereSemaine.avancement}
            aria-label={t.debutTitre}
            className="h-2 rounded-full overflow-hidden"
            style={{ background: "rgba(152,162,176,0.16)" }}
          >
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round((data.premiereSemaine.avancement / OBJECTIF_PARTIES) * 100)}%`,
                background: data.premiereSemaine.atteint
                  ? "var(--victory)"
                  : "var(--brand-gradient)",
                transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </div>
          <div className="text-xs mt-2" style={{ color: "var(--steel)" }}>
            {t.debutAvancement(data.premiereSemaine.avancement, OBJECTIF_PARTIES)}
          </div>
        </div>
      )}

      {/* Trois défaites d'affilée : on le dit une fois, sans y revenir. Un
          rappel qui reviendrait à chaque défaite deviendrait un reproche, et
          un reproche se ferme sans se lire. */}
      {(data.defaitesDAffilee ?? 0) >= 3 && (
        <div className="lol-panel p-4">
          <div style={{ color: "var(--gold)", fontWeight: 600, marginBottom: 4 }}>
            {t.pauseTitre(data.defaitesDAffilee ?? 0)}
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
            {t.pauseTexte}
          </p>
        </div>
      )}

      {/* Ce qu'on voit du volume, dit une fois et sans y revenir. Ça ne
          bloque rien : le choix a été fait de laisser chacun libre de
          continuer, ce qui suppose de dire ce qu'on voit. */}
      {data.veille?.alerte && (
        <div className="lol-panel p-4" style={{ borderColor: "var(--gold)" }}>
          <div style={{ color: "var(--gold)", fontWeight: 600, marginBottom: 4 }}>
            {t.veilleTitre}
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
            {data.veille.alerte === "jour" ? t.veilleJour : t.veilleSemaine}
          </p>
        </div>
      )}

      {/* Ce qui a déjà été fait, à côté de ce qui reste dû : l'application ne
          savait dire que la seconde moitié. */}
      <DefiDuJour />
      <Paliers />

      {/* La série ne paraît qu'une fois lancée, et le retard qu'une fois
          constitué : un écran qui annonce « 0 jour d'affilée » à un compte
          neuf lui reproche quelque chose qu'il n'a pas encore pu faire. */}
      <SerieEtRetard />

      {/* L'énergie dépensée n'apparaît qu'avec le consentement aux données de
          santé : sans le poids, il n'y a rien à estimer, et la politique de
          confidentialité annonce qu'on ne l'affiche pas. */}
      {data.calories && (
        <div className="lol-panel p-4" style={{
          display: "flex", alignItems: "baseline", justifyContent: "space-between",
          gap: 12, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{
              fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase",
              color: "var(--steel)",
            }}>
              {t.energieLabel}
            </span>
            <span style={{ fontSize: "0.72rem", color: "var(--steel)" }}>
              {t.energieEstimation}
            </span>
          </div>
          <div style={{ textAlign: "right" }}>
            <b style={{
              fontFamily: "var(--font-heading)", fontSize: "1.6rem", color: "var(--gold)",
              fontVariantNumeric: "tabular-nums",
            }}>
              {fmt(data.calories.total)} kcal
            </b>
            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              {t.energieSub(data.calories.marcheMin)}
            </div>
          </div>
        </div>
      )}

      {data.objectifTotalPompes > 0 && (
        <div className="lol-panel p-4 space-y-2 rise" style={{ animationDelay: "320ms" }}>
          <div className="flex justify-between text-sm">
            <span className="gold-text font-semibold">{t.objectiveLibre(fmt(data.objectifTotalPompes))}</span>
            <span className="mono-num" style={{ color: "var(--amber)", fontWeight: 600 }}>{progress}%</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: "rgba(152,162,176,0.15)" }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: "var(--brand-gradient)",
                boxShadow: "0 0 12px rgba(255,138,61,0.45)",
                transition: "width 1s cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </div>
          <div className="text-xs" style={{ color: "var(--faint)" }}>
            {t.objectiveProgressLibre(fmt(globalStats.totalPoints), fmt(data.objectifTotalPompes))}
            {data.objectifTotalPompes - globalStats.totalPoints > 0
              ? t.objectiveRemainingLibre(fmt(data.objectifTotalPompes - globalStats.totalPoints))
              : t.objectiveReached}
          </div>
        </div>
      )}

      {/* Filtre par jeu — n'apparaît qu'à partir de deux jeux différents */}
      {jeuxJoues.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap rise" style={{ animationDelay: "220ms" }}>
          <span className="text-xs" style={{ color: "var(--steel)" }}>{tJeux.filtreJeuTitre}</span>
          {[null, ...jeuxJoues.map((j) => j.nom)].map((nom) => {
            const actif = filtreJeu === nom;
            return (
              <button
                key={nom ?? "tous"}
                onClick={() => setFiltreJeu(nom)}
                aria-pressed={actif}
                style={{
                  padding: "5px 13px", borderRadius: 999, fontSize: "0.78rem", cursor: "pointer",
                  background: actif ? "rgba(110,155,255,0.1)" : "transparent",
                  border: `1px solid ${actif ? "var(--signal)" : "var(--line-strong)"}`,
                  color: actif ? "var(--signal)" : "var(--muted)",
                  transition: "all 0.15s",
                }}
              >
                {nom === null ? tJeux.filtreTousJeux : nom}
              </button>
            );
          })}
        </div>
      )}

      {/* Contexte : exercice consulté, et son record */}
      {exercicesJoues.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap justify-between rise" style={{ animationDelay: "260ms" }}>
          {exercicesJoues.length > 1 ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs" style={{ color: "var(--steel)" }}>{tExo.filtreTitre}</span>
              {[null, ...exercicesJoues].map((id) => {
                const actif = filtreExo === id;
                return (
                  <button
                    key={id ?? "tous"}
                    onClick={() => setFiltreExo(id)}
                    aria-pressed={actif}
                    style={{
                      padding: "5px 13px", borderRadius: 999, fontSize: "0.78rem", cursor: "pointer",
                      background: actif ? "rgba(255,180,84,0.1)" : "transparent",
                      border: `1px solid ${actif ? "var(--amber)" : "var(--line-strong)"}`,
                      color: actif ? "var(--amber)" : "var(--muted)",
                      transition: "all 0.15s",
                    }}
                  >
                    {id === null ? tExo.filtreTous : nomsExo[id]}
                  </button>
                );
              })}
            </div>
          ) : <span />}

          {vueTemps && (data.tempsJoueSec ?? 0) > 0 && (
            <div className="flex items-baseline gap-2" style={{
              padding: "7px 14px", borderRadius: 10,
              border: "1px solid var(--line)", background: "var(--carbon)",
            }}>
              <span style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--steel)" }}>
                {tJeux.tempsJoueLabel}
              </span>
              <span className="mono-num" style={{ fontSize: "1rem", fontWeight: 600, color: "var(--signal)" }}>
                {formaterTempsJeu(data.tempsJoueSec ?? 0)}
              </span>
            </div>
          )}

          {data.totalGames > 0 && (
            <div className="flex items-baseline gap-2" style={{
              padding: "7px 14px", borderRadius: 10,
              border: "1px solid var(--line)", background: "var(--carbon)",
            }}>
              <span style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--steel)" }}>
                {t.recordPerGame}
              </span>
              <span className="mono-num" style={{ fontSize: "1rem", fontWeight: 600, color: "var(--amber)" }}>
                {formaterCompact(data.recordPompes, exerciceRecord)}
              </span>
              {EXERCICES[exerciceRecord].unite === "reps" && (
                <span style={{ fontSize: "0.72rem", color: "var(--faint)" }}>{minuscule(nomsExo[exerciceRecord])}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Session et saisie vivent dans le rail latéral : la synthèse reste une
          synthèse, et les deux actions restent accessibles en permanence. */}
      <RailActions>
        <button
          type="button"
          className="rail-action lol-panel"
          data-visite="rail-session"
          onClick={() => setModale("session")}
          style={{ borderColor: sessionActive ? "rgba(47,217,138,0.5)" : undefined }}
        >
          <div style={{ fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.13em", color: sessionActive ? "var(--victory)" : "var(--steel)" }}>
            {t.sessionModeTitle}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            {sessionActive && (
              <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: "var(--victory)", animation: "pulse 1.5s ease-in-out infinite" }} />
            )}
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: sessionActive ? "var(--victory)" : "var(--bone)" }}>
              {sessionActive ? t.sessionActive : t.startSession}
            </span>
          </div>
          {sessionActive && sessionGames.length > 0 && (
            <div className="mono-num" style={{ fontSize: "0.66rem", marginTop: 3, color: "var(--faint)" }}>
              {t.railSessionGames(sessionGames.length, fmt(totalSessionPompes))}
            </div>
          )}
        </button>

        <button
          type="button"
          className="rail-action lol-panel"
          data-visite="rail-ajout"
          onClick={() => setModale("ajout")}
        >
          <div style={{ fontSize: "0.58rem", textTransform: "uppercase", letterSpacing: "0.13em", color: "var(--steel)" }}>
            {t.railAjoutSurtitre}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: "1.05rem", lineHeight: 1, color: "var(--amber)", fontWeight: 700 }}>+</span>
            <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--bone)" }}>
              {t.railAjoutTitre}
            </span>
          </div>
        </button>
      </RailActions>

      {modale === "session" && (
      <Modale titre={t.sessionModeTitle} onFermer={() => setModale(null)}>
      <div className="space-y-3">
        <p className="text-xs" style={{ color: "var(--faint)" }}>
          {t.sessionModeDesc}
        </p>

        {!sessionActive ? (
          <div className="space-y-4">
            {/* Le jeu détermine la nature de la session : suivi de parties via
                l'API Riot, ou simple chronomètre. */}
            <div className="space-y-2">
              <label className="block text-xs" style={{ color: "var(--steel)" }}>
                {tJeux.sessionQuelJeu}
              </label>
              <JeuSelector
                jeu={jeuChoisi}
                typeJeu={typeJeuChoisi}
                onChange={(j, ty) => { setJeuChoisi(j); setTypeJeuChoisi(ty); }}
              />
            </div>

            {/* Le niveau ne se ressaisit plus à chaque session : il découle du
                test de force, qu'on peut refaire ici sans quitter la modale. */}
            <TestPompes
              pompesMax={pompesMax}
              faitLe={pompesMaxLe}
              niveaux={niveaux}
              onEnregistre={handleSavePompesMax}
            />

            <div className="space-y-2">
              <label className="block text-xs" style={{ color: "var(--steel)" }}>
                {tExo.choisirTitre}
              </label>
              <ExerciceSelector selection={exercicesSel} onChange={setExercicesSel} compact />
              {exercicesSel.length > 1 && (
                <p className="text-xs" style={{ color: "var(--amber)" }}>{tExo.partageActif(exercicesSel.length)}</p>
              )}
            </div>

            <button
              className="lol-btn w-full"
              onClick={handleDemarrerSession}
              disabled={jeuChoisi.trim().length === 0}
            >
              {t.start}
            </button>
          </div>
        ) : typeSession === "temps" ? (
          <SessionChrono
            jeu={jeuSession}
            niveau={t.levelLabel(sessionNiveau)}
            chronoSec={chronoSec}
            dette={fmt(dettePoints)}
            erreur={chronoErreur}
            enregistrement={arretEnCours}
            onArreter={handleArreterChrono}
            onAnnuler={stopSession}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded" style={{ background: "rgba(47,217,138,0.1)", border: "1px solid rgba(47,217,138,0.3)" }}>
              <div className="w-2 h-2 rounded-full" style={{ background: "#2FD98A", boxShadow: "0 0 6px #2FD98A", animation: "pulse 1.5s infinite" }} />
              <span className="text-sm win-text font-semibold">{t.sessionActive}</span>
              <span className="text-xs gold-text">{t.levelLabel(sessionNiveau)}</span>
              <span className="ml-auto text-xs" style={{ color: "var(--faint)" }}>
                {polling ? t.checking : t.nextCheck(countdown)}
              </span>
            </div>

            {sessionGames.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                <div className="lol-panel p-3 text-center" style={{ background: "rgba(152,162,176,0.06)" }}>
                  <div className="text-2xl font-bold gold-text">{sessionGames.length}</div>
                  <div className="text-xs" style={{ color: "var(--faint)" }}>games</div>
                </div>
                <div className="lol-panel p-3 text-center" style={{ background: "rgba(152,162,176,0.06)" }}>
                  <div className="text-2xl font-bold gold-text">{totalSessionPompes}</div>
                  <div className="text-xs" style={{ color: "var(--faint)" }}>pompes</div>
                </div>
                <div className="lol-panel p-3 text-center" style={{ background: "rgba(152,162,176,0.06)" }}>
                  <div className="text-2xl font-bold win-text">
                    {sessionGames.filter((g) => g.result === "V").length}V
                  </div>
                  <div className="text-xs loss-text">
                    {sessionGames.filter((g) => g.result === "D").length}D
                  </div>
                </div>
              </div>
            )}

            {sessionGames.length > 0 && (
              <GraphiqueSession
                titre={t.pompesPerGameSession}
                points={sessionChartData}
                fmt={fmt}
                fmtAxe={fmtAxe}
              />
            )}

            {sessionGames.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs gold-text font-semibold">{t.detail(fmt(totalSessionPompes))}</p>
                {sessionGames.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2 rounded text-sm"
                    style={{ background: "rgba(152,162,176,0.06)", border: "1px solid rgba(152,162,176,0.1)" }}>
                    <span className={g.result === "V" ? "win-text font-bold" : "loss-text font-bold"}>
                      {g.result === "V" ? "V" : "D"}
                    </span>
                    <ChampionIcon name={g.champion} size={30} />
                    <span className="gold-text font-medium">{g.champion}</span>
                    <span className="text-xs" style={{ color: "var(--faint)" }}>{g.role}</span>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>{g.kills}/{g.deaths}/{g.assists}</span>
                    <span className="ml-auto gold-text font-bold">{g.pompes}</span>
                  </div>
                ))}
              </div>
            )}

            {sessionGames.length === 0 && !polling && (
              <p className="text-xs text-center" style={{ color: "var(--faint)" }}>
                {t.waitingNextGame}
              </p>
            )}

            {sessionError && <p className="text-sm loss-text">{translateApiError(sessionError, locale)}</p>}

            <button
              className="lol-btn lol-btn-danger w-full"
              onClick={stopSession}
            >
              {t.stopSession}
            </button>
          </div>
        )}
      </div>
      </Modale>
      )}

      {modale === "ajout" && (
        <Modale titre={t.railAjoutTitre} onFermer={() => setModale(null)} largeur="40rem">
          <AjoutActivite onAjout={() => loadDash()} enModale />
        </Modale>
      )}

      {/* Comparaison entre jeux — uniquement en vue d'ensemble. Sur un jeu
          filtré, c'est sa synthèse propre qui prend le relais plus bas. */}
      {filtreJeu === null && jeuxJoues.length > 1 && (
        <ComparatifJeux
          jeux={jeuxJoues}
          t={t}
          onChoisirJeu={setFiltreJeu}
          fmt={fmt}
          formaterTempsJeu={formaterTempsJeu}
        />
      )}

      {/* Statistiques globales */}
      {/* Repli de l'étape « le chiffre qui compte » : aucun graphique n'existe
          avant d'avoir joué, et c'est ici qu'ils apparaîtront. */}
      <GraphiquesGlobaux
        t={t}
        dateLocale={dateLocale}
        parJeu={afficherParJeu ? jeuData : null}
        cumul={data.cumulByDate ?? []}
        moyenneParSemaine={data.moyenneParSemaine ?? []}
        vue={roleView}
        setVue={setRoleView}
        fmt={fmt}
        fmtAxe={fmtAxe}
      />

      {/* Analytiques par période */}
      {data.statsByPeriod && data.totalGames > 0 && (
        <GraphiquePeriode
          t={t}
          periode={statsPeriod}
          setPeriode={setStatsPeriod}
          mode={statsMode}
          setMode={setStatsMode}
          points={periodeTraduite}
          date={calendarDate}
          setDate={setCalendarDate}
          detailHoraire={dailyHourly}
          resume={dailySummary}
          chargement={dailyLoading}
          fmt={fmt}
          fmtAxe={fmtAxe}
        />
      )}

      {/* Un compte neuf voit une démonstration chiffrée plutôt qu'un message
          qui le renvoie ailleurs : c'est la seule question qu'on se pose à ce
          moment-là, et elle mérite un nombre. */}
      {data.totalGames === 0 && (
        <PremiersPas pompesMax={data.pompesMax ?? 0} onAjouter={() => setModale("ajout")} />
      )}

      {data.totalGames === 0 && (
        <div className="lol-panel p-8 text-center space-y-2">
          <div style={{ display: "flex", justifyContent: "center", padding: "6px 0" }}>
            <span aria-hidden style={{ width: 10, height: 34, background: "var(--ember)", transform: "skewX(-18deg)", borderRadius: 2, display: "inline-block" }} />
          </div>
          <p className="gold-text font-semibold">{t.noGameLogged}</p>
          <p className="text-sm" style={{ color: "var(--faint)" }}>{t.premierAjoutAide}</p>
          {/* Le panneau renvoyait vers l'historique, qui ne porte aucun
              formulaire d'ajout : le seul est la fenêtre ouverte ici. Un
              écran vide doit offrir le geste qui le remplit, pas l'adresse
              d'un autre écran qui ne l'offre pas non plus. */}
          <button type="button" className="lol-btn" onClick={() => setModale("ajout")}>
            {t.railAjoutTitre}
          </button>
        </div>
      )}

      {/* Rôles et champions ne veulent dire quelque chose que rapportés à un
          seul jeu : on les regroupe sous son nom plutôt que de les laisser
          passer pour des statistiques générales. */}
      {jeuUnique !== null && (repartitionData.length > 0 || data.mostPlayed || data.leastEfficient) && (
        <SyntheseJeu
          jeu={jeuUnique}
          t={t}
          description={estBattleRoyale ? t.sectionBrDesc : t.sectionLeagueDesc}
          titreRepartition={
            estBattleRoyale
              ? (multi ? t.pompesByMode(roleView) : t.parModeDe(nomsExo[exercice], roleView))
              : (multi ? t.pompesByRole(roleView) : t.parRoleDe(nomsExo[exercice], roleView))
          }
          repartition={repartitionData}
          vue={roleView}
          setVue={setRoleView}
          mostPlayed={data.mostPlayed ?? null}
          leastEfficient={data.leastEfficient ?? null}
          fmt={fmt}
          fmtAxe={fmtAxe}
        />
      )}

    </div>
  );
}