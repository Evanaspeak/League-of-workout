"use client";
import { ROLES } from "@/lib/scoringDefaut";
import { Icone } from "@/components/Icone";
import { Squelette } from "./Squelette";
import { Lien } from "@/components/Lien";
import { nomsExercices } from "@/lib/nomsExercices";
import { CorrectionDates } from "@/components/CorrectionDates";
import { Fragment, useEffect, useState } from "react";
import { ChampionIcon } from "@/components/ChampionIcon";
import { useT, useDateLocale, useMinuscule, useNombre } from "@/lib/i18n/LocaleContext";
import { history } from "@/lib/i18n/dictionaries/history";
import {
  EXERCICE_IDS, formaterCompact, formaterQuantite, parseRepartition,
  quantite, toExerciceId, type ExerciceId,
} from "@/lib/exercices";
import { JEU_DEFAUT, capacitesDuJeu, formaterTempsJeu, toTypeJeu, type TypeJeu } from "@/lib/jeux";
import { jeux as jeuxDict } from "@/lib/i18n/dictionaries/jeux";
import { baremeDeLaPartie, cumulsParExercice } from "@/lib/historiqueBareme";
import { exercices as exercicesDict } from "@/lib/i18n/dictionaries/exercices";

// ─── Types ───────────────────────────────────────────────────────────────────

type Game = {
  id: string;
  date: string;
  role: string;
  champion: string | null;
  kills: number;
  deaths: number;
  assists: number;
  result: string;
  niveauCalcule: number;
  scoreCalcule: number;
  malusCalcule: number;
  surchargeCalculee: number;
  pompesCalculees: number;
  /** Partie refusée à l'écran de chargement : elle est là, elle ne compte pas. */
  sansEnjeu?: boolean;
  exercice?: ExerciceId;
  source: string;
  // ── Multi-jeu ── (absents des lignes créées avant l'arrivée des jeux)
  jeu?: string;
  typeJeu?: string;
  dureeSec?: number | null;
  placement?: number | null;
  joueurs?: number | null;
  /** JSON de ventilation entre exercices, absent si un seul est concerné. */
  repartition?: string | null;
  /** Variante d'exécution déclarée à l'enregistrement ("genoux"). */
  variante?: string | null;
  /** Barème sous lequel la partie a été chiffrée, en JSON. Null = celui d'origine. */
  ratios?: string | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

// « Tous » n'est pas un rôle : c'est l'absence de filtre, et elle n'a rien
// à faire dans le barème.
const ROLES_FILTER = ["Tous", ...ROLES];
/**
 * Cellule de résultat. Une session au temps n'a ni victoire ni défaite : sans
 * ce cas neutre, elle s'affichait « Défaite » en rouge, ce qui est faux.
 */
/**
 * L'instant présent au format attendu par `datetime-local`, en heure locale.
 * `toISOString()` donnerait de l'UTC : le sélecteur plafonnerait alors une ou
 * deux heures à côté selon le fuseau.
 */
function maintenantLocal(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

type TexteResultat = {
  victory: string; defeat: string; sessionLibelle: string;
  editResultTitle: string; editResultHint: string; cancelTitle: string;
};

/**
 * Le résultat d'une activité, et sa correction.
 *
 * La correction vit DANS ce composant, pas à ses trois points d'appel : les
 * cartes l'affichent une fois, le tableau deux fois selon le jeu de colonnes.
 * Écrite trois fois, elle finirait par ne valoir que pour l'une d'elles —
 * c'est déjà arrivé sur cette page, où le même défaut existait des deux
 * côtés.
 *
 * Corriger demande deux gestes : ouvrir, puis choisir. Un simple bascule au
 * clic ferait d'une frappe malheureuse une dette qu'on ne doit pas, sur la
 * ligne d'à côté.
 */
/**
 * L'annotation d'une partie sans enjeu.
 *
 * Écrite une seule fois et rendue aux trois endroits où une ligne s'affiche —
 * la carte sur téléphone et les deux cellules du tableau. C'est la règle de cet
 * écran : les deux présentations lisent la même préparation, pour qu'une
 * correction faite d'un côté ne manque pas de l'autre.
 *
 * `title` porte l'explication, et le texte visible reste court : la place est
 * comptée à côté d'un nom de champion, et une phrase entière y pousserait la
 * ligne hors de l'écran sur un téléphone.
 */
function BadgeSansEnjeu({ t }: { t: { sansEnjeu: string; sansEnjeuAide: string } }) {
  return (
    <span
      title={t.sansEnjeuAide}
      style={{
        fontSize: ".68rem", textTransform: "uppercase", letterSpacing: ".06em",
        padding: "1px 6px", borderRadius: 4, whiteSpace: "nowrap",
        border: "1px solid rgba(152,162,176,0.35)", color: "var(--steel)",
      }}
    >
      {t.sansEnjeu}
    </span>
  );
}

function ResultatCell({ result, t, correction }: {
  result: string;
  t: TexteResultat;
  correction?: {
    ouvert: boolean;
    enCours: boolean;
    ouvrir: () => void;
    annuler: () => void;
    choisir: (r: "V" | "D") => void;
  };
}) {
  const libelle = result === "V"
    ? <span className="win-text">{t.victory}</span>
    : result === "D"
    ? <span className="loss-text">{t.defeat}</span>
    : <span style={{ color: "var(--steel)", fontWeight: 500 }}>{t.sessionLibelle}</span>;

  if (!correction) return libelle;

  if (!correction.ouvert) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {libelle}
        <button
          onClick={correction.ouvrir}
          title={t.editResultTitle}
          aria-label={t.editResultTitle}
          className="commande-resultat"
          style={{ color: "var(--faint)" }}
        ><Icone nom="crayon" taille={13} /></button>
      </span>
    );
  }

  const choix = (valeur: "V" | "D", texte: string, classe: string) => (
    <button
      onClick={() => (valeur === result ? correction.annuler() : correction.choisir(valeur))}
      disabled={correction.enCours}
      aria-pressed={valeur === result}
      className={`choix-resultat ${classe}`}
    >{texte}</button>
  );

  return (
    <span role="group" aria-label={t.editResultHint}
      style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      {choix("V", t.victory, "win-text")}
      {choix("D", t.defeat, "loss-text")}
      <button onClick={correction.annuler} title={t.cancelTitle} aria-label={t.cancelTitle}
        disabled={correction.enCours}
        className="commande-resultat"
        style={{ color: "#e05555" }}
      ><Icone nom="croix" taille={14} /></button>
    </span>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Ce que le serveur sait déjà en rendant la page.
 *
 * Un seul champ, et c'est le strict nécessaire : sans lui, le message
 * d'historique vide — le plus grand élément de la page pour un compte neuf —
 * attendait le paquet JavaScript, l'hydratation et un aller-retour.
 */
export default function HistoryPage({ depart }: { depart: { aucuneActivite: boolean } }) {
  const t = useT(history);
  const minuscule = useMinuscule();
  const tExo = useT(exercicesDict);
  const tJeux = useT(jeuxDict);
  const nomsExo: Record<ExerciceId, string> = nomsExercices(tExo);
  const dateLocale = useDateLocale();
  const nombre = useNombre();
  /**
   * « 380 pompes · 4 min 25 boxe » — chaque exercice dans sa propre unité.
   *
   * Reçoit des QUANTITÉS déjà converties, pas des points : les parties n'ont
   * pas toutes le même barème, et les additionner en points reviendrait à
   * reconvertir le tout au barème du jour.
   *
   * La QUANTITÉ vient en premier, et le nom la suit en minuscule. C'est
   * l'ordre de tout le reste du produit — les cellules de dette juste en
   * dessous, la pastille, le décompte, les notifications — et cette ligne-ci
   * était la seule à l'inverser. Elle écrivait « 60 parties · Pompes 480 » :
   * nombre puis nom d'un côté du point médian, nom puis nombre de l'autre,
   * sur la même ligne. Ça ne saute pas aux yeux en français, où les deux
   * mots se ressemblent ; ça saute aux yeux en japonais, où « 腕立て 480 »
   * porte une espace latine au milieu des idéogrammes.
   */
  const resumeParExo = (parExercice: Record<string, number>) => {
    const parts = EXERCICE_IDS
      .filter((id) => (parExercice[id] ?? 0) > 0)
      .map((id) => `${formaterQuantite(parExercice[id], id, dateLocale)} ${minuscule(nomsExo[id])}`);
    return parts.length > 0 ? parts.join(" · ") : "—";
  };

  // ── Lignes de dette ──
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  /**
   * La liste n'a pas pu être chargée.
   *
   * Distinct de « la liste est vide » : l'échec était avalé, et l'écran
   * annonçait « aucune game à afficher » à quelqu'un dont la requête venait
   * d'échouer. Il n'y a pas pire message — il affirme quelque chose de faux
   * sur les données de la personne, et lui fait croire que son historique a
   * disparu.
   */
  const [chargementRate, setChargementRate] = useState(false);
  const [filterRole, setFilterRole] = useState("Tous");
  const [filterResult, setFilterResult] = useState("Tous");
  const [filtreJeu, setFiltreJeu] = useState<string | null>(null);
  // Ligne dont on a déplié le détail de calcul.
  const [ligneDepliee, setLigneDepliee] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "pompes">("date");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Date editing ──
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  /**
   * La dernière action a échoué.
   *
   * Modifier une date et supprimer une partie retiraient la ligne de l'écran
   * QUELLE QUE SOIT la réponse du serveur. Une suppression refusée paraissait
   * donc réussie jusqu'au rechargement suivant, où la partie revenait sans
   * explication — et le compteur de dette avait entre-temps été prié de se
   * rafraîchir sur une valeur qui n'avait pas bougé.
   */
  const [erreurAction, setErreurAction] = useState(false);
  const [editDateVal, setEditDateVal] = useState("");

  // ── Correction du résultat ──
  const [editingResultId, setEditingResultId] = useState<string | null>(null);
  const [correctionEnCours, setCorrectionEnCours] = useState<string | null>(null);

  // ─── Chargement initial (games + parties Riot) ───────────────────────────
  useEffect(() => {
    fetch("/api/games")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        if (!Array.isArray(data)) throw new Error("réponse inattendue");
        setGames(data);
      })
      .catch(() => setChargementRate(true))
      .finally(() => setLoadingGames(false));
  }, []);

  // ─── Edit game date ──────────────────────────────────────────────────────
  const handleEditDate = async (id: string) => {
    if (!editDateVal) return;
    setErreurAction(false);
    try {
      const res = await fetch(`/api/games/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: editDateVal }),
      });
      if (!res.ok) { setErreurAction(true); return; }
      setGames((prev) => prev.map((g) => g.id === id ? { ...g, date: editDateVal } : g));
      setEditingDateId(null);
    } catch {
      setErreurAction(true);
    }
  };

  // ─── Corriger le résultat d'une partie ───────────────────────────────────
  /**
   * Le serveur rejoue le barème et rend le nouveau coût : on ne le recalcule
   * pas de notre côté. Une seconde implémentation du barème dans le navigateur
   * finirait par diverger de celle qui fait foi, et c'est celle-ci qui décide
   * de la dette.
   *
   * La ligne ne change à l'écran que si elle a changé en base. Annoncer une
   * correction qui n'a pas eu lieu est le défaut qu'on a corrigé sur la
   * suppression et sur la date : la partie revenait au rechargement suivant
   * sans que rien ne l'explique.
   */
  const handleEditResult = async (id: string, result: "V" | "D") => {
    setCorrectionEnCours(id);
    setErreurAction(false);
    try {
      const res = await fetch(`/api/games/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      if (!res.ok) { setErreurAction(true); return; }
      const data = await res.json().catch(() => null);
      setGames((prev) => prev.map((g) => g.id === id
        ? { ...g, result, pompesCalculees: data?.pompesCalculees ?? g.pompesCalculees }
        : g));
      setEditingResultId(null);
      // Le coût de la partie a bougé, donc la dette : la pastille doit suivre.
      window.dispatchEvent(new Event("wow-dette-changee"));
    } catch {
      setErreurAction(true);
    } finally {
      setCorrectionEnCours(null);
    }
  };

  // ─── Delete pompe entry ──────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setErreurAction(false);
    try {
      const res = await fetch(`/api/games/${id}`, { method: "DELETE" });
      // La ligne ne quitte l'écran que si elle a quitté la base. Sinon on
      // annonce une suppression qui n'a pas eu lieu, et la partie revient au
      // rechargement suivant sans que rien ne l'explique.
      if (!res.ok) { setErreurAction(true); return; }
      setGames((prev) => prev.filter((g) => g.id !== id));
      // La suppression rend aussi du temps au compteur : la pastille doit suivre.
      window.dispatchEvent(new Event("wow-dette-changee"));
    } catch {
      setErreurAction(true);
    } finally {
      setDeletingId(null);
    }
  };

  /** Ce que `ResultatCell` a besoin de savoir pour proposer la correction. */
  const correctionDe = (id: string, corrigible: boolean) => corrigible ? {
    ouvert: editingResultId === id,
    enCours: correctionEnCours === id,
    ouvrir: () => setEditingResultId(id),
    annuler: () => setEditingResultId(null),
    choisir: (r: "V" | "D") => handleEditResult(id, r),
  } : undefined;

  // ─── Filtered pompe games ─────────────────────────────────────────────────
  // ── Multi-jeu : périmètre consulté et jeu de colonnes qui en découle ──
  const nomDuJeu = (g: Game) => g.jeu || JEU_DEFAUT;
  /** Ce que cette partie doit, exercice par exercice. */
  const ventilationDe = (g: Game) => parseRepartition(g.repartition, g.exercice, g.pompesCalculees);
  /** Le barème de CETTE partie, et pas celui du jour. Voir `historiqueBareme`. */
  const ratiosDe = (g: Game) => baremeDeLaPartie(g.ratios);
  const typeDeLaLigne = (g: Game): TypeJeu => toTypeJeu(g.typeJeu);

  // Jeux réellement présents dans l'historique : eux seuls méritent un filtre.
  const jeuxJoues = [...new Set(games.map(nomDuJeu))].sort();

  const filtered = games
    .filter((g) => filtreJeu === null || nomDuJeu(g) === filtreJeu)
    .filter((g) => filterRole === "Tous" || g.role === filterRole)
    .filter((g) => filterResult === "Tous" || g.result === filterResult)
    .sort((a, b) =>
      sortBy === "date"
        ? new Date(b.date).getTime() - new Date(a.date).getTime()
        : b.pompesCalculees - a.pompesCalculees
    );

  /**
   * Les colonnes s'adaptent au périmètre affiché, pour ne jamais montrer une
   * colonne vide : un jeu au temps n'a ni rôle, ni champion, ni KDA, et une
   * partie de League n'a pas de durée.
   *   « parties » → colonnes de jeu compétitif
   *   « temps »   → colonnes de session
   *   « mixte »   → colonnes communes, avec une cellule « Détail » qui s'adapte
   */
  const typesAffiches = new Set(filtered.map(typeDeLaLigne));
  const modeColonnes: TypeJeu | "mixte" =
    typesAffiches.size === 1 ? [...typesAffiches][0] : "mixte";

  // La colonne « Jeu » ne sert qu'en vue d'ensemble : sur un jeu filtré, elle
  // répéterait la même valeur sur chaque ligne.
  const afficherColonneJeu = filtreJeu === null && jeuxJoues.length > 1;

  // Tous les jeux à parties n'ont pas de lane, de personnage ni de KDA : une
  // colonne ne s'affiche que si au moins une ligne a quelque chose à y mettre.
  const afficherRole = filtered.some((g) => g.role && g.role !== "—");
  const afficherChampion = filtered.some((g) => !!g.champion);
  const afficherKda = filtered.some((g) => !g.placement && (g.kills > 0 || g.deaths > 0 || g.assists > 0));
  // Battle royale : la place finale remplace le KDA comme mesure de la partie.
  const afficherPlacement = filtered.some((g) => !!g.placement);

  const nbColonnes =
    1 // date
    + (afficherColonneJeu ? 1 : 0)
    + (modeColonnes === "parties"
        ? 1 + (afficherRole ? 1 : 0) + (afficherChampion ? 1 : 0) + (afficherKda ? 1 : 0)
          + (afficherPlacement ? 1 : 0) // + résultat
        : 1) // durée, ou détail
    + 4; // niveau, dette, cumul, actions
  /**
   * Les lignes préparées une seule fois, pour les deux présentations.
   *
   * Le tableau sert sur grand écran ; sous 760 px, il forçait un défilement
   * horizontal et on ne voyait jamais une activité entière — la date d'un
   * côté, le résultat de l'autre, le KDA coupé au milieu. Les cartes montrent
   * la même chose d'un seul tenant. Les deux lisent ce tableau-ci, pour qu'une
   * correction faite d'un côté ne manque pas de l'autre.
   */
  const lignes = (() => {
    // Cumul tenu SÉPARÉMENT par exercice : chaque ligne affiche le total de
    // son propre exercice à cet instant. Mélanger des répétitions et des
    // secondes n'aurait aucun sens.
    const cumulMap = cumulsParExercice(
      filtered.map((g) => ({ id: g.id, parts: ventilationDe(g), ratios: g.ratios })),
    );
    return filtered.map((g) => ({
      g,
      cumul: cumulMap.get(g.id) ?? {},
      parts: Object.entries(ventilationDe(g))
        .map(([id, pts]) => ({
          id: toExerciceId(id),
          pts: pts ?? 0,
          // La valeur affichée est calculée ICI, sous le barème de la partie.
          valeur: formaterCompact(pts ?? 0, toExerciceId(id), ratiosDe(g), dateLocale),
        })),
      type: typeDeLaLigne(g),
      // Une séance au temps n'a pas de résultat, et un battle royale déduit le
      // sien du classement : la route refuse les deux. On ne propose donc pas
      // un geste qui sera repoussé — la règle est la même des deux côtés.
      corrigible: typeDeLaLigne(g) === "parties"
        && !capacitesDuJeu(nomDuJeu(g), g.typeJeu).br,
    }));
  })();

  // Ventilation du total affiché : une entrée par exercice réellement joué.
  const totauxParExo = filtered.reduce<Record<string, number>>((acc, g) => {
    const bareme = ratiosDe(g);
    for (const [ex, pts] of Object.entries(ventilationDe(g))) {
      acc[ex] = (acc[ex] ?? 0) + quantite(pts ?? 0, toExerciceId(ex), bareme);
    }
    return acc;
  }, {});

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <h1 className="titre-page">{t.pageTitle}</h1>

      {erreurAction && (
        <p role="alert" className="lol-panel p-3" style={{ color: "var(--loss)", fontSize: "0.85rem" }}>
          {t.erreurAction}
        </p>
      )}

      <div className="space-y-4">
          {loadingGames && depart.aucuneActivite ? (
            /**
             * Le serveur sait déjà qu'il n'y a rien : on le DIT tout de suite.
             *
             * Réserver la place d'une liste qui n'arrivera jamais fait attendre
             * pour rien, et c'est ce message-ci qui était le plus grand élément
             * de la page — donc celui que la mesure attendait. Il part
             * maintenant avec la réponse.
             */
            <div className="lol-panel p-8 text-center" data-visite="historique-table">
              <p style={{ color: "var(--faint)" }}>{t.noGameToDisplay}</p>
              <p style={{ color: "var(--steel)", fontSize: "0.86rem", marginTop: 10 }}>
                {t.ouAjouter}{" "}
                <Lien href="/dashboard" style={{ color: "var(--amber)", textDecoration: "underline" }}>
                  {t.allerAuTableauDeBord}
                </Lien>
              </p>
            </div>
          ) : loadingGames ? (
            /* Le squelette réserve la place de la liste : sans lui, tout ce
               qui est visible saute quand les parties arrivent. Il est
               `aria-hidden`, d'où l'annonce qui l'accompagne — un lecteur
               d'écran n'a rien à faire d'une forme, il a besoin du mot. */
            <>
              <span className="lecture-ecran" role="status">{t.loading}</span>
              <Squelette />
            </>
          ) : (
            <>
              {/* Filtres — le filtre par jeu commande le reste */}
              <div className="lol-panel p-3 space-y-3">
                {jeuxJoues.length > 1 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs" style={{ color: "var(--steel)" }}>{tJeux.filtreJeuTitre}</span>
                    {[null, ...jeuxJoues].map((nom) => {
                      const actif = filtreJeu === nom;
                      return (
                        <button
                          key={nom ?? "tous"}
                          onClick={() => { setFiltreJeu(nom); setLigneDepliee(null); }}
                          aria-pressed={actif}
                          style={{
                            padding: "4px 12px", borderRadius: 999, fontSize: "0.75rem", cursor: "pointer",
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

                <div className="flex flex-wrap gap-3 items-center">
                  {/* Chaque filtre n'apparaît que s'il a quelque chose à filtrer :
                      pas de lane sur Counter-Strike, pas de résultat sur une
                      session au temps. */}
                  {afficherRole && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: "var(--steel)" }}>{t.roleLabel}</span>
                      <select className="lol-select text-sm" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                        {ROLES_FILTER.map((r) => <option key={r} value={r}>{t.roleOptionLabel(r)}</option>)}
                      </select>
                    </div>
                  )}
                  {modeColonnes !== "temps" && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: "var(--steel)" }}>{t.resultLabel}</span>
                        <select className="lol-select text-sm" value={filterResult} onChange={(e) => setFilterResult(e.target.value)}>
                          <option value="Tous">{t.all}</option>
                          <option value="V">{t.victory}</option>
                          <option value="D">{t.defeat}</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "var(--steel)" }}>{t.sortLabel}</span>
                    <select className="lol-select text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as "date" | "pompes")}>
                      <option value="date">{t.date}</option>
                      <option value="pompes">{t.pompes}</option>
                    </select>
                  </div>
                  <span className="ml-auto text-sm gold-text font-semibold">
                    {t.activitesAndTotal(nombre(filtered.length), filtered.length, resumeParExo(totauxParExo))}
                  </span>
                </div>
              </div>

              {chargementRate ? (
                <div className="lol-panel p-8 text-center" data-visite="historique-table">
                  <p style={{ color: "var(--loss)" }}>{t.chargementRate}</p>
                  <button
                    type="button"
                    className="lol-btn mt-4"
                    onClick={() => window.location.reload()}
                  >
                    {t.reessayer}
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                // L'ancre de la visite guidée vit aussi ici : un compte neuf
                // n'a aucune ligne, et l'étape qui montre « où retrouver tes
                // activités » restait alors sans cible — écran figé le temps du
                // délai, puis étape sautée. Montrer l'emplacement vide répond
                // exactement à la question posée.
                <div className="lol-panel p-8 text-center" data-visite="historique-table">
                  <p style={{ color: "var(--faint)" }}>{t.noGameToDisplay}</p>
                  {/**
                    * Un écran vide qui ne dit pas quoi faire est un cul-de-sac.
                    *
                    * L'ajout d'activité vit dans le rail du tableau de bord, et
                    * nulle part ici : quelqu'un qui vient chercher « où
                    * j'enregistre ma partie » à l'endroit le plus évident —
                    * l'historique — ne trouvait que « aucune game à afficher ».
                    * On ne déplace pas le bouton, on dit où il est.
                    */}
                  {games.length === 0 && (
                    <p style={{ color: "var(--steel)", fontSize: "0.86rem", marginTop: 10 }}>
                      {t.ouAjouter}{" "}
                      <Lien href="/dashboard" style={{ color: "var(--amber)", textDecoration: "underline" }}>
                        {t.allerAuTableauDeBord}
                      </Lien>
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3" data-visite="historique-table">
                  {/* Réparer une soirée entière d'un coup : le défaut de date
                      collait toutes les parties d'un soir sur le jour de la
                      saisie, et les reprendre une par une n'est pas un travail
                      qu'on demande à quelqu'un. */}
                  <CorrectionDates
                    parties={games.map((g) => ({ id: g.id, date: g.date }))}
                    surCorrection={() => {
                      fetch("/api/games")
                        .then((r) => r.json())
                        .then((d) => { if (Array.isArray(d)) setGames(d); })
                        .catch(() => {});
                    }}
                  />
                {/* Sur téléphone : une carte par activité, tout tient à
                    l'écran. Le tableau ci-dessous ne s'affiche qu'à partir de
                    760 px. Les deux sont rendus, et c'est la feuille de styles
                    qui choisit : un basculement en JavaScript dépend de la
                    largeur, que le serveur ne connaît pas, et la première
                    peinture montrerait alors la mauvaise vue. */}
                <div className="historique-cartes">
                  {lignes.map(({ g, cumul, parts, type, corrigible }) => {
                    const depliee = ligneDepliee === g.id;
                    return (
                      <article key={g.id} className="carte-activite lol-panel">
                        <div className="carte-activite-haut">
                          {g.champion && <ChampionIcon name={g.champion} size={30} />}
                          <div className="carte-activite-titre">
                            <div className="carte-activite-nom">
                              <span>{g.champion ?? nomDuJeu(g)}</span>
                              {type === "temps"
                                ? <span className="mono-num" style={{ color: "var(--bone)" }}>{formaterTempsJeu(g.dureeSec ?? 0)}</span>
                                : <ResultatCell result={g.result} t={t} correction={correctionDe(g.id, corrigible)} />}
                              {g.sansEnjeu && <BadgeSansEnjeu t={t} />}
                            </div>

                            {editingDateId === g.id ? (
                              <div className="carte-activite-edition">
                                <input
                                  type="datetime-local"
                                  className="lol-input"
                                  max={maintenantLocal()}
                                  value={editDateVal}
                                  onChange={(e) => setEditDateVal(e.target.value)}
                                />
                                <button onClick={() => handleEditDate(g.id)} aria-label={t.editDateTitle} style={{ color: "#2FD98A" }}><Icone nom="coche" taille={15} /></button>
                                <button onClick={() => setEditingDateId(null)} aria-label={t.cancelTitle} style={{ color: "#e05555" }}><Icone nom="croix" taille={15} /></button>
                              </div>
                            ) : (
                              <div className="carte-activite-precisions">
                                <span>
                                  {[
                                    afficherColonneJeu && g.champion ? nomDuJeu(g) : null,
                                    g.role && g.role !== "—" ? g.role : null,
                                    g.placement ? t.placementAffiche(g.placement, g.joueurs ?? 0) : null,
                                    type !== "temps" && !g.placement && (g.kills > 0 || g.deaths > 0 || g.assists > 0)
                                      ? `${g.kills}/${g.deaths}/${g.assists}` : null,
                                    new Date(g.date).toLocaleDateString(dateLocale),
                                  ].filter(Boolean).join(" · ")}
                                </span>
                                <button
                                  onClick={() => {
                                    const d = new Date(g.date);
                                    const offset = d.getTimezoneOffset() * 60000;
                                    setEditDateVal(new Date(d.getTime() - offset).toISOString().slice(0, 16));
                                    setEditingDateId(g.id);
                                  }}
                                  title={t.editDateTitle}
                                  aria-label={t.editDateTitle}
                                  className="carte-activite-crayon"
                                ><Icone nom="crayon" taille={13} /></button>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="carte-activite-pied">
                          <div className="carte-activite-cout">
                            {parts.map((part) => (
                              <div key={part.id}>
                                <span className="gold-text" style={{ fontSize: "1.05rem" }}>
                                  {part.valeur}
                                </span>
                                <span style={{ marginLeft: 5, fontSize: "0.72rem", color: "var(--steel)" }}>
                                  {minuscule(nomsExo[part.id])}
                                </span>
                                {part.id === "pompes" && g.variante === "genoux" && (
                                  <span className="carte-activite-variante">{tExo.varianteBadge}</span>
                                )}
                                <span style={{ marginLeft: 8, fontSize: "0.72rem", color: "var(--faint)" }}>
                                  {minuscule(t.tableCumul)} {formaterQuantite(cumul[part.id] ?? 0, part.id, dateLocale)}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="carte-activite-actions">
                            <button
                              onClick={() => setLigneDepliee(depliee ? null : g.id)}
                              title={t.detailToggleTitle}
                              aria-label={t.detailToggleTitle}
                              aria-expanded={depliee}
                              style={{ color: depliee ? "var(--amber)" : "rgba(152,162,176,0.6)" }}
                            >{depliee ? "▲" : "▼"}</button>
                            <button
                              onClick={() => handleDelete(g.id)}
                              disabled={deletingId === g.id}
                              title={t.deleteGameTitle}
                              aria-label={t.deleteGameTitle}
                              style={{ color: "rgba(220,80,80,0.8)" }}
                            >{deletingId === g.id ? "…" : <Icone nom="croix" taille={14} />}</button>
                          </div>
                        </div>

                        {depliee && (
                          <div className="carte-activite-detail">
                            {type === "temps" ? (
                              <span>{t.detailDuree} : <span className="mono-num" style={{ color: "var(--bone)" }}>{formaterTempsJeu(g.dureeSec ?? 0)}</span></span>
                            ) : (
                              <>
                                <span>{t.detailScore} : <span className="mono-num" style={{ color: "var(--bone)" }}>{g.scoreCalcule}</span></span>
                                <span>{t.detailMalus} : <span className="mono-num loss-text">+{g.malusCalcule}</span></span>
                                <span>{t.detailMastery} : <span className="mono-num blue-text">+{Math.round(g.surchargeCalculee * 100)}%</span></span>
                              </>
                            )}
                            <span>{t.tableLevel} : <span className="mono-num gold-text">{g.niveauCalcule}</span></span>
                            {!afficherColonneJeu && <span>{t.tableJeu} : <span style={{ color: "var(--bone)" }}>{nomDuJeu(g)}</span></span>}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>

                <div className="historique-tableau overflow-x-auto">
                  {/* Un lecteur d'écran annonce « tableau » et le nombre de
                      colonnes ; sans nom, il ne dit pas de quoi il parle. Le nom
                      passe par `aria-label` et non par une balise `caption` :
                      celle-ci reste une boîte de mise en page même rendue
                      invisible, et décalait les lignes de quatre pixels. */}
                  <table
                    className="w-full text-sm"
                    aria-label={t.legendeTableau}
                    style={{ borderCollapse: "separate", borderSpacing: "0 4px", minWidth: modeColonnes === "parties" ? 760 : 660 }}
                  >
                    <thead>
                      <tr style={{ color: "var(--steel)" }} className="text-xs uppercase tracking-wider">
                        <th className="text-left px-3 py-1">{t.tableDate}</th>
                        {afficherColonneJeu && <th className="text-left px-3 py-1">{t.tableJeu}</th>}
                        {modeColonnes === "parties" && (
                          <>
                            {afficherRole && <th className="text-left px-3 py-1">{t.tableRole}</th>}
                            {afficherChampion && <th className="text-left px-3 py-1">{t.tableChampion}</th>}
                            {afficherPlacement && <th className="text-center px-3 py-1">{t.tablePlacement}</th>}
                            {afficherKda && <th className="text-center px-3 py-1">{t.tableKda}</th>}
                            <th className="text-center px-3 py-1">{t.tableResult}</th>
                          </>
                        )}
                        {modeColonnes === "temps" && <th className="text-center px-3 py-1">{t.tableDuree}</th>}
                        {modeColonnes === "mixte" && <th className="text-left px-3 py-1">{t.tableDetail}</th>}
                        <th className="text-center px-3 py-1">{t.tableLevel}</th>
                        <th className="text-right px-3 py-1">{t.tablePompes}</th>
                        <th className="text-right px-3 py-1">{t.tableCumul}</th>
                        <th className="px-3 py-1"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {lignes.map(({ g, cumul, parts, type, corrigible }) => {
                          const depliee = ligneDepliee === g.id;
                          const fond = { background: "var(--bg-raised)", borderBottom: "1px solid rgba(152,162,176,0.08)" };
                          return (
                            <Fragment key={g.id}>
                            <tr style={fond}>
                              <td className="px-3 py-2" style={{ color: "var(--muted)", whiteSpace: "nowrap" }}>
                                {editingDateId === g.id ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <input
                                      type="datetime-local"
                                      className="lol-input"
                                      // Le serveur refuse une date future ; le
                                      // sélecteur la refuse aussi, pour ne pas
                                      // laisser saisir ce qui sera rejeté.
                                      max={maintenantLocal()}
                                      style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                                      value={editDateVal}
                                      onChange={(e) => setEditDateVal(e.target.value)}
                                    />
                                    <button onClick={() => handleEditDate(g.id)} style={{ color: "#2FD98A", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem" }}><Icone nom="coche" taille={15} /></button>
                                    <button onClick={() => setEditingDateId(null)} style={{ color: "#e05555", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem" }}><Icone nom="croix" taille={15} /></button>
                                  </div>
                                ) : (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <span>{new Date(g.date).toLocaleDateString(dateLocale)}</span>
                                    <button
                                      onClick={() => {
                                        const d = new Date(g.date);
                                        const offset = d.getTimezoneOffset() * 60000;
                                        setEditDateVal(new Date(d.getTime() - offset).toISOString().slice(0, 16));
                                        setEditingDateId(g.id);
                                      }}
                                      title={t.editDateTitle}
                                      aria-label={t.editDateTitle}
                                      style={{ color: "var(--faint)", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", lineHeight: 1 }}
                                    ><Icone nom="crayon" taille={14} /></button>
                                  </div>
                                )}
                              </td>

                              {afficherColonneJeu && (
                                <td className="px-3 py-2" style={{ color: "var(--bone)", whiteSpace: "nowrap" }}>{nomDuJeu(g)}</td>
                              )}

                              {modeColonnes === "parties" && (
                                <>
                                  {afficherRole && <td className="px-3 py-2 gold-text font-medium">{g.role}</td>}
                                  {afficherChampion && (
                                  <td className="px-3 py-2">
                                    {g.champion ? (
                                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                        <ChampionIcon name={g.champion} size={26} />
                                        <span style={{ color: "var(--bone)" }}>{g.champion}</span>
                                      </div>
                                    ) : (
                                      <span style={{ color: "var(--faint)" }}>—</span>
                                    )}
                                  </td>
                                  )}
                                  {afficherPlacement && (
                                  <td className="px-3 py-2 text-center mono-num" style={{ color: "var(--bone)" }}>
                                    {g.placement ? (
                                      <>
                                        {t.placementAffiche(g.placement, g.joueurs ?? 0)}
                                        {g.kills > 0 && (
                                          <span style={{ color: "var(--faint)" }}> · {t.elimCourt(g.kills)}</span>
                                        )}
                                      </>
                                    ) : "—"}
                                  </td>
                                  )}
                                  {afficherKda && (
                                  <td className="px-3 py-2 text-center" style={{ color: "var(--bone)" }}>
                                    {g.kills}/{g.deaths}/{g.assists}
                                  </td>
                                  )}
                                  <td className="px-3 py-2 text-center font-bold">
                                    <ResultatCell result={g.result} t={t} correction={correctionDe(g.id, corrigible)} />
                                    {g.sansEnjeu && <BadgeSansEnjeu t={t} />}
                                  </td>
                                </>
                              )}

                              {modeColonnes === "temps" && (
                                <td className="px-3 py-2 text-center mono-num" style={{ color: "var(--bone)" }}>
                                  {formaterTempsJeu(g.dureeSec ?? 0)}
                                </td>
                              )}

                              {modeColonnes === "mixte" && (
                                <td className="px-3 py-2">
                                  {type === "temps" ? (
                                    <span className="mono-num" style={{ color: "var(--bone)" }}>
                                      {formaterTempsJeu(g.dureeSec ?? 0)}
                                    </span>
                                  ) : (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                                      {g.champion && (
                                        <>
                                          <ChampionIcon name={g.champion} size={22} />
                                          <span style={{ color: "var(--bone)" }}>{g.champion}</span>
                                          <span style={{ color: "var(--faint)" }}>·</span>
                                        </>
                                      )}
                                      {g.role && g.role !== "—" && (
                                        <>
                                          <span className="gold-text">{g.role}</span>
                                          <span style={{ color: "var(--faint)" }}>·</span>
                                        </>
                                      )}
                                      {g.placement ? (
                                        <span className="mono-num" style={{ color: "var(--bone)" }}>
                                          {t.placementAffiche(g.placement, g.joueurs ?? 0)}
                                          {g.kills > 0 && ` · ${t.elimCourt(g.kills)}`}
                                        </span>
                                      ) : (g.kills > 0 || g.deaths > 0 || g.assists > 0) && (
                                        <span className="mono-num" style={{ color: "var(--bone)" }}>
                                          {g.kills}/{g.deaths}/{g.assists}
                                        </span>
                                      )}
                                      <ResultatCell result={g.result} t={t} correction={correctionDe(g.id, corrigible)} />
                                      {g.sansEnjeu && <BadgeSansEnjeu t={t} />}
                                    {g.sansEnjeu && <BadgeSansEnjeu t={t} />}
                                    </div>
                                  )}
                                </td>
                              )}

                              <td className="px-3 py-2 text-center gold-text">{g.niveauCalcule}</td>
                              {/* L'exercice se lit sur la ligne repliée : un
                                  nombre seul ne dit pas si ce sont des pompes,
                                  des squats ou des secondes de boxe, et il
                                  fallait déplier chaque ligne pour le savoir. */}
                              <td className="px-3 py-2 text-right gold-text font-bold" style={{ whiteSpace: "nowrap" }}>
                                {parts.map((part) => (
                                  <div key={part.id}>
                                    {part.valeur}
                                    <span style={{
                                      marginLeft: 5, fontWeight: 400, fontSize: "0.72rem",
                                      color: "var(--steel)",
                                    }}>
                                      {minuscule(nomsExo[part.id])}
                                    </span>
                                    {/* L'annotation d'exécution, là où elle se
                                        lit : sur la ligne qu'elle qualifie. Le
                                        chiffre, lui, ne bouge pas — une pompe
                                        genoux au sol vaut une pompe. */}
                                    {part.id === "pompes" && g.variante === "genoux" && (
                                      <span style={{
                                        marginLeft: 5, fontWeight: 400, fontSize: "0.62rem",
                                        color: "var(--steel)", border: "1px solid var(--line-strong)",
                                        borderRadius: 999, padding: "1px 6px",
                                      }}>
                                        {tExo.varianteBadge}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </td>
                              <td className="px-3 py-2 text-right" style={{ color: "var(--steel)", whiteSpace: "nowrap" }}>
                                {parts.map((part) => (
                                  <div key={part.id}>{formaterQuantite(cumul[part.id] ?? 0, part.id, dateLocale)}</div>
                                ))}
                              </td>
                              <td className="px-3 py-2 text-center" style={{ whiteSpace: "nowrap" }}>
                                <button
                                  onClick={() => setLigneDepliee(depliee ? null : g.id)}
                                  title={t.detailToggleTitle}
                                      aria-label={t.detailToggleTitle}
                                  aria-expanded={depliee}
                                  style={{
                                    color: depliee ? "var(--amber)" : "rgba(152,162,176,0.5)",
                                    background: "none", border: "none", cursor: "pointer",
                                    fontSize: "0.7rem", padding: "2px 6px", lineHeight: 1,
                                  }}
                                >{depliee ? "▲" : "▼"}</button>
                                <button
                                  onClick={() => handleDelete(g.id)}
                                  disabled={deletingId === g.id}
                                  title={t.deleteGameTitle}
                                      aria-label={t.deleteGameTitle}
                                  style={{ color: "rgba(220,80,80,0.7)", lineHeight: 1, background: "none", border: "none", cursor: "pointer", fontSize: "1rem", padding: "2px 6px", borderRadius: "4px" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(220,80,80,1)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(220,80,80,0.7)")}
                                >
                                  {deletingId === g.id ? "…" : <Icone nom="croix" taille={14} />}
                                </button>
                              </td>
                            </tr>

                            {/* Détail du calcul : replié par défaut, il n'est utile
                                qu'à qui veut comprendre le chiffre. */}
                            {depliee && (
                              <tr style={{ background: "rgba(152,162,176,0.05)" }}>
                                <td colSpan={nbColonnes} className="px-3 py-2">
                                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs" style={{ color: "var(--muted)" }}>
                                    {type === "temps" ? (
                                      <span>{t.detailDuree} : <span className="mono-num" style={{ color: "var(--bone)" }}>{formaterTempsJeu(g.dureeSec ?? 0)}</span></span>
                                    ) : (
                                      <>
                                        <span>{t.detailScore} : <span className="mono-num" style={{ color: "var(--bone)" }}>{g.scoreCalcule}</span></span>
                                        <span>{t.detailMalus} : <span className="mono-num loss-text">+{g.malusCalcule}</span></span>
                                        <span>{t.detailMastery} : <span className="mono-num blue-text">+{Math.round(g.surchargeCalculee * 100)}%</span></span>
                                      </>
                                    )}
                                    <span>{t.tableLevel} : <span className="mono-num gold-text">{g.niveauCalcule}</span></span>
                                    {!afficherColonneJeu && <span>{t.tableJeu} : <span style={{ color: "var(--bone)" }}>{nomDuJeu(g)}</span></span>}
                                  </div>
                                </td>
                              </tr>
                            )}
                            </Fragment>
                          );
                      })}
                    </tbody>
                  </table>
                </div>
                </div>
              )}
            </>
          )}
      </div>
    </div>
  );
}
