"use client";
import { Fragment, useEffect, useState } from "react";
import { ChampionIcon } from "@/components/ChampionIcon";
import { ChampionInput } from "@/components/ChampionInput";
import { findChampion } from "@/lib/champions";
import { useT, useDateLocale, useLocale } from "@/lib/i18n/LocaleContext";
import { history } from "@/lib/i18n/dictionaries/history";
import { translateApiError } from "@/lib/i18n/apiErrors";
import {
  EXERCICE_DEFAUT, formaterCompact, toExerciceId, toExerciceIds, ventiler, type ExerciceId,
} from "@/lib/exercices";
import { JEU_DEFAUT, formaterTempsJeu, toTypeJeu, type TypeJeu } from "@/lib/jeux";
import { JeuSelector } from "@/components/JeuSelector";
import { jeux as jeuxDict } from "@/lib/i18n/dictionaries/jeux";
import { ExerciceSelector } from "@/components/ExerciceSelector";
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
  exercice?: ExerciceId;
  source: string;
  // ── Multi-jeu ── (absents des lignes créées avant l'arrivée des jeux)
  jeu?: string;
  typeJeu?: string;
  dureeSec?: number | null;
};

type MatchEntry = {
  matchId: string;
  champion: string;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  result: string;
  date: string;
  alreadyLogged: boolean;
  pompesCalculees: number | null;
  exercice?: ExerciceId | null;
  indisponible?: boolean;
};

type Scoring = {
  niveau: number;
  multiplicateur: number;
  scoreBase: number;
  malus: number;
  surcharge: number;
  pompesFinales: number;
};

type PreviewResult = { scoring: Scoring; partiesAvant: number; gainageSec: number; exercice?: ExerciceId };

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLES_FILTER = ["Tous", "Top", "Jungle", "Mid", "ADC", "Support", "ARAM", "Arena"];
const ROLES_FORM = ["Top", "Jungle", "Mid", "ADC", "Support", "ARAM", "Arena"];

function getLevelLabel(sec: number, locale: "fr" | "en"): string {
  const prefix = locale === "fr" ? "Niv." : "Lvl.";
  if (sec <= 45) return `${prefix} 1`;
  if (sec <= 90) return `${prefix} 2`;
  if (sec <= 150) return `${prefix} 3`;
  if (sec <= 240) return `${prefix} 4`;
  return `${prefix} 5`;
}

/**
 * Cellule de résultat. Une session au temps n'a ni victoire ni défaite : sans
 * ce cas neutre, elle s'affichait « Défaite » en rouge, ce qui est faux.
 */
function ResultatCell({ result, t }: { result: string; t: { victory: string; defeat: string; sessionLibelle: string } }) {
  if (result === "V") return <span className="win-text">{t.victory}</span>;
  if (result === "D") return <span className="loss-text">{t.defeat}</span>;
  return <span style={{ color: "rgba(152,162,176,0.6)", fontWeight: 500 }}>{t.sessionLibelle}</span>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const t = useT(history);
  const tExo = useT(exercicesDict);
  const tJeux = useT(jeuxDict);
  const nomsExo: Record<ExerciceId, string> = {
    pompes: tExo.pompesNom, squats: tExo.squatsNom, boxe: tExo.boxeNom,
  };
  /** « Pompes 380 · Boxe 4 min 25 » — chaque exercice dans sa propre unité. */
  const resumeParExo = (parExercice: Record<string, number>) => {
    const parts = ventiler(parExercice).map((v) => `${nomsExo[v.id]} ${v.valeur}`);
    return parts.length > 0 ? parts.join(" · ") : "—";
  };
  const dateLocale = useDateLocale();
  const { locale } = useLocale();
  const [view, setView] = useState<"parties" | "pompes">("parties");

  // ── Pompes view ──
  const [games, setGames] = useState<Game[]>([]);
  const [exercicesSel, setExercicesSel] = useState<ExerciceId[]>([EXERCICE_DEFAUT]);
  const [exerciceAjout, setExerciceAjout] = useState<ExerciceId>(EXERCICE_DEFAUT);
  const [loadingGames, setLoadingGames] = useState(true);
  const [filterRole, setFilterRole] = useState("Tous");
  const [filterResult, setFilterResult] = useState("Tous");
  const [filtreJeu, setFiltreJeu] = useState<string | null>(null);
  // Ligne dont on a déplié le détail de calcul.
  const [ligneDepliee, setLigneDepliee] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "pompes">("date");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Parties view ──
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);

  // ── Add form ──
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({
    role: "Jungle", champion: "", kills: "", deaths: "", assists: "", result: "D", gainageSec: "60",
  });
  const [jeu, setJeu] = useState<string>(JEU_DEFAUT);
  const [typeJeu, setTypeJeu] = useState<TypeJeu>("parties");
  const [dureeH, setDureeH] = useState("");
  const [dureeM, setDureeM] = useState("");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [addLogging, setAddLogging] = useState(false);
  const [addLogged, setAddLogged] = useState(false);
  const [addError, setAddError] = useState("");

  // ── Date editing ──
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editDateVal, setEditDateVal] = useState("");

  // ── Riot manual fetch ──
  const [riotLoading, setRiotLoading] = useState(false);
  const [riotError, setRiotError] = useState("");

  // ─── Load localStorage on mount ──────────────────────────────────────────
  useEffect(() => {
    const savedSec = localStorage.getItem("lastGainageSec");
    const savedRole = localStorage.getItem("lastRole");
    setAddForm((f) => ({
      ...f,
      ...(savedSec ? { gainageSec: savedSec } : {}),
      ...(savedRole ? { role: savedRole } : {}),
    }));
  }, []);

  // ─── Chargement initial (games + parties Riot) ───────────────────────────
  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((u) => {
        const prefs = toExerciceIds(u?.exercices);
        setExercicesSel(prefs);
        setExerciceAjout(prefs[0]);
      })
      .catch(() => {});
  }, []);


  useEffect(() => {
    const loadGames = async () => {
      const data = await fetch("/api/games").then((r) => r.json());
      if (Array.isArray(data)) setGames(data);
      setLoadingGames(false);
    };
    const loadMatches = async () => {
      setLoadingMatches(true);
      try {
        const data = await fetch("/api/riot/match-history").then((r) => r.json());
        if (Array.isArray(data)) setMatches(data);
        else setMatchError(data.error ? translateApiError(data.error, locale) : t.unexpectedApiResponse);
      } catch {
        setMatchError(t.loadError);
      }
      setLoadingMatches(false);
    };
    loadGames();
    loadMatches();
  }, []);

  // ─── Quick-add from Riot history ─────────────────────────────────────────
  const handleQuickAdd = async (m: MatchEntry) => {
    setAddingId(m.matchId);
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: m.role, champion: m.champion,
        kills: m.kills, deaths: m.deaths, assists: m.assists,
        result: m.result, source: "riot_api", riotMatchId: m.matchId,
      }),
    });
    if (res.ok) {
      const { game, scoring } = await res.json();
      setMatches((prev) => prev.map((x) =>
        x.matchId === m.matchId
          ? { ...x, alreadyLogged: true, pompesCalculees: scoring.pompesFinales, exercice: toExerciceId(game?.exercice) }
          : x
      ));
      // Sync immédiate de la vue Pompes (pas besoin de changer d'onglet).
      setGames((prev) => [{ ...game, pompesCalculees: scoring.pompesFinales }, ...prev]);
    }
    setAddingId(null);
  };

  // ─── Manual add form ─────────────────────────────────────────────────────
  const openAddForm = (role?: string) => {
    const savedRole = localStorage.getItem("lastRole") ?? "Jungle";
    setAddForm((f) => ({ ...f, role: role ?? savedRole }));
    setPreview(null);
    setAddLogged(false);
    setAddError("");
    setShowAddForm(true);
  };

  const handlePreview = async () => {
    if (!addForm.kills || !addForm.deaths || !addForm.assists) return;
    setPreviewLoading(true);
    const res = await fetch("/api/games/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...addForm,
        kills: Number(addForm.kills),
        deaths: Number(addForm.deaths),
        assists: Number(addForm.assists),
        gainageSec: Number(addForm.gainageSec) || 60,
        exercice: exerciceAjout,
        jeu,
        typeJeu,
        ...(typeJeu === "temps" ? { dureeSec: dureeEnSecondes } : {}),
      }),
    });
    setPreview(await res.json());
    setPreviewLoading(false);
  };

  const handleAddLog = async () => {
    setAddLogging(true);
    setAddError("");
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...addForm,
        kills: Number(addForm.kills),
        deaths: Number(addForm.deaths),
        assists: Number(addForm.assists),
        gainageSec: Number(addForm.gainageSec) || 60,
        exercice: exerciceAjout,
        jeu,
        typeJeu,
        ...(typeJeu === "temps" ? { dureeSec: dureeEnSecondes } : {}),
        source: "manuel",
      }),
    });
    if (res.ok) {
      const { game, scoring } = await res.json();
      setGames((prev) => [{ ...game, pompesCalculees: scoring.pompesFinales }, ...prev]);
      setAddLogged(true);
      setPreview(null);
      setAddForm((f) => ({ ...f, champion: "", kills: "", deaths: "", assists: "", result: "D" }));
    } else {
      const err = await res.json();
      setAddError(err.error ? translateApiError(err.error, locale) : t.logError);
    }
    setAddLogging(false);
  };

  // ─── Riot manual fetch ───────────────────────────────────────────────────
  const handleRiotFetch = async () => {
    setRiotLoading(true);
    setRiotError("");
    const res = await fetch("/api/riot/last-game");
    if (res.ok) {
      const data = await res.json();
      setAddForm((f) => ({
        ...f,
        role: data.role,
        champion: data.champion,
        kills: String(data.kills),
        deaths: String(data.deaths),
        assists: String(data.assists),
        result: data.result,
      }));
      setPreview(null);
      setShowAddForm(true);
    } else {
      const err = await res.json();
      setRiotError(err.error ? translateApiError(err.error, locale) : t.riotApiError);
    }
    setRiotLoading(false);
  };

  // ─── Edit game date ──────────────────────────────────────────────────────
  const handleEditDate = async (id: string) => {
    if (!editDateVal) return;
    await fetch(`/api/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: editDateVal }),
    });
    setGames((prev) => prev.map((g) => g.id === id ? { ...g, date: editDateVal } : g));
    setEditingDateId(null);
  };

  // ─── Delete pompe entry ──────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await fetch(`/api/games/${id}`, { method: "DELETE" });
    setGames((prev) => prev.filter((g) => g.id !== id));
    setDeletingId(null);
  };

  // ─── Filtered pompe games ─────────────────────────────────────────────────
  // ── Multi-jeu : périmètre consulté et jeu de colonnes qui en découle ──
  const nomDuJeu = (g: Game) => g.jeu || JEU_DEFAUT;
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
  const nbColonnes =
    1 // date
    + (afficherColonneJeu ? 1 : 0)
    + (modeColonnes === "parties" ? 4 : 1) // rôle/champion/KDA/résultat, ou durée, ou détail
    + 4; // niveau, dette, cumul, actions
  // Ventilation du total affiché : une entrée par exercice réellement joué.
  const totauxParExo = filtered.reduce<Record<string, number>>((acc, g) => {
    const ex = toExerciceId(g.exercice);
    acc[ex] = (acc[ex] ?? 0) + g.pompesCalculees;
    return acc;
  }, {});

  const dureeEnSecondes = (Number(dureeH) || 0) * 3600 + (Number(dureeM) || 0) * 60;
  const isChampionValid = !addForm.champion || !!findChampion(addForm.champion);
  const isAddReady = typeJeu === "temps"
    ? jeu.trim().length > 0 && dureeEnSecondes > 0
    : addForm.kills !== "" && addForm.deaths !== "" && addForm.assists !== "" && isChampionValid;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <h1 style={{ fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)", fontSize: "1.5rem", color: "#ECEFF4", letterSpacing: "0.18em" }}>{t.pageTitle}</h1>

      {/* Tab toggle */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid rgba(152,162,176,0.14)" }}>
        {(["parties", "pompes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setView(tab)}
            style={{
              position: "relative",
              padding: "6px 22px 8px",
              background: "transparent",
              border: "none",
              borderBottom: `2px solid ${view === tab ? "#ECEFF4" : "transparent"}`,
              marginBottom: -1,
              color: view === tab ? "#ECEFF4" : "rgba(236,239,244,0.4)",
              fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
              fontSize: "0.75rem",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {tab === "parties" ? t.tabAjouter : t.tabPompes}
          </button>
        ))}
      </div>

      {/* ═══ PARTIES VIEW ══════════════════════════════════════════════════ */}
      {view === "parties" && (
        <div className="space-y-4">

          {/* Ajout manuel : action générique, valable pour n'importe quel jeu. */}
          <button className="lol-btn w-full text-sm" onClick={() => openAddForm()}>
            {t.addBtn}
          </button>

          {/* Tout ce qui suit est propre à League of Legends : le suivi
              automatique passe par l'API Riot, et l'ARAM du chaos est un mode
              de ce jeu. Le cadre l'annonce, pour ne pas laisser croire que ça
              vaut pour Minecraft ou Valorant. */}
          <div className="lol-panel p-4 space-y-3" style={{ borderColor: "rgba(152,162,176,0.22)" }}>
            <div>
              <h2 className="gold-text text-xs font-semibold uppercase tracking-widest">{t.lolSectionTitle}</h2>
              <p className="text-xs mt-1" style={{ color: "rgba(236,239,244,0.45)" }}>{t.lolSectionDesc}</p>
            </div>

            <button className="lol-btn lol-btn-blue w-full text-sm" onClick={handleRiotFetch} disabled={riotLoading}>
              {riotLoading ? t.fetchingLastGame : t.fetchLastGameBtn}
            </button>
            {riotError && <p className="text-sm loss-text">{riotError}</p>}

            <div className="flex items-start gap-3 p-3 rounded" style={{ background: "rgba(152,162,176,0.06)", border: "1px solid rgba(152,162,176,0.16)" }}>
              <span className="text-lg" style={{ lineHeight: 1.2 }}>⚠️</span>
              <div className="flex-1 space-y-2">
                <p className="text-sm" style={{ color: "rgba(236,239,244,0.75)" }}>
                  <span className="gold-text font-semibold">{t.aramTitle}</span>{" "}
                  {t.aramDesc}
                </p>
                <button className="lol-btn text-xs px-4 py-1" onClick={() => openAddForm("ARAM")}>
                  {t.aramAddBtn}
                </button>
              </div>
            </div>
          </div>

          {/* Manual add form */}
          {showAddForm && (
            <div className="lol-panel p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">{typeJeu === "temps" ? tJeux.sessionTitre : t.addGameTitle}</h2>
                <button
                  onClick={() => { setShowAddForm(false); setPreview(null); setAddLogged(false); }}
                  style={{ color: "rgba(236,239,244,0.4)", background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }}
                >✕</button>
              </div>

              {addLogged && (
                <div className="text-center p-3 rounded" style={{ background: "rgba(47,217,138,0.1)", border: "1px solid rgba(47,217,138,0.3)" }}>
                  <span className="win-text font-semibold">{t.gameLogged}</span>
                </div>
              )}

              <JeuSelector
                jeu={jeu}
                typeJeu={typeJeu}
                onChange={(j, ty) => { setJeu(j); setTypeJeu(ty); setPreview(null); }}
              />

              {typeJeu === "temps" ? (
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{tJeux.dureeLabel}</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" max="24" className="lol-input text-center" placeholder="2"
                      value={dureeH} onChange={(e) => { setDureeH(e.target.value); setPreview(null); }} />
                    <span className="text-sm" style={{ color: "rgba(236,239,244,0.5)" }}>{tJeux.heures}</span>
                    <input type="number" min="0" max="59" className="lol-input text-center" placeholder="30"
                      value={dureeM} onChange={(e) => { setDureeM(e.target.value); setPreview(null); }} />
                    <span className="text-sm" style={{ color: "rgba(236,239,244,0.5)" }}>{tJeux.minutes}</span>
                  </div>
                  <p className="text-xs mt-2" style={{ color: "rgba(236,239,244,0.4)" }}>{tJeux.sessionSousTitre}</p>
                </div>
              ) : (
              <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{t.role}</label>
                  <select className="lol-select w-full" value={addForm.role}
                    onChange={(e) => {
                      setAddForm((f) => ({ ...f, role: e.target.value }));
                      localStorage.setItem("lastRole", e.target.value);
                      setPreview(null);
                    }}>
                    {ROLES_FORM.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{t.champion}</label>
                  <ChampionInput
                    value={addForm.champion}
                    onChange={(val) => setAddForm((f) => ({ ...f, champion: val }))}
                    onReset={() => setPreview(null)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(["kills", "deaths", "assists"] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>
                      {field === "kills" ? t.kills : field === "deaths" ? t.deaths : t.assists}
                    </label>
                    <input type="number" min="0" className="lol-input text-center" value={addForm[field]}
                      onChange={(e) => { setAddForm((f) => ({ ...f, [field]: e.target.value })); setPreview(null); }} />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 items-end">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{t.result}</label>
                  <div className="flex gap-2">
                    {(["V", "D"] as const).map((r) => (
                      <button key={r} className="flex-1 py-2 rounded text-sm font-bold"
                        style={{
                          background: addForm.result === r ? (r === "V" ? "rgba(47,217,138,0.25)" : "rgba(255,90,71,0.25)") : "rgba(152,162,176,0.08)",
                          border: `1px solid ${addForm.result === r ? (r === "V" ? "#2FD98A" : "#FF5A47") : "rgba(152,162,176,0.2)"}`,
                          color: addForm.result === r ? (r === "V" ? "#2FD98A" : "#FF5A47") : "rgba(236,239,244,0.6)",
                        }}
                        onClick={() => { setAddForm((f) => ({ ...f, result: r })); setPreview(null); }}>
                        {r === "V" ? t.victory : t.defeat}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>
                    {t.gainageTime}
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" className="lol-input text-center" value={addForm.gainageSec}
                      onChange={(e) => {
                        setAddForm((f) => ({ ...f, gainageSec: e.target.value }));
                        localStorage.setItem("lastGainageSec", e.target.value);
                        setPreview(null);
                      }} />
                    <span className="text-xs gold-text shrink-0">{getLevelLabel(Number(addForm.gainageSec) || 60, locale)}</span>
                  </div>
                </div>
              </div>
              </>
              )}

              <div className="space-y-2">
                <label className="block text-xs" style={{ color: "rgba(152,162,176,0.7)" }}>
                  {tExo.choisirTitre}
                </label>
                <ExerciceSelector
                  selection={[exerciceAjout]}
                  onChange={(next) => { setExerciceAjout(next[0]); setPreview(null); }}
                  compact
                  single
                />
              </div>

              <button className="lol-btn w-full" onClick={handlePreview} disabled={!isAddReady || previewLoading}>
                {previewLoading ? t.calculating : (typeJeu === "temps" ? tJeux.apercuSession : t.calculatePompes)}
              </button>

              {preview && (
                <div className="space-y-3">
                  {typeJeu === "temps" ? (
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between p-2 rounded" style={{ background: "rgba(152,162,176,0.08)" }}>
                        <span style={{ color: "rgba(236,239,244,0.6)" }}>{t.level}</span>
                        <span className="gold-text font-bold">{preview.scoring.niveau}</span>
                      </div>
                      <div className="flex justify-between p-2 rounded" style={{ background: "rgba(152,162,176,0.08)" }}>
                        <span style={{ color: "rgba(236,239,244,0.6)" }}>{tJeux.dureeLabel}</span>
                        <span className="gold-text font-bold mono-num">
                          {(Number(dureeH) || 0) > 0 ? `${Number(dureeH)} ${tJeux.heures} ` : ""}
                          {(Number(dureeM) || 0) > 0 ? `${Number(dureeM)} ${tJeux.minutes}` : ""}
                        </span>
                      </div>
                    </div>
                  ) : (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between p-2 rounded" style={{ background: "rgba(152,162,176,0.08)" }}>
                      <span style={{ color: "rgba(236,239,244,0.6)" }}>{t.level}</span>
                      <span className="gold-text font-bold">{preview.scoring.niveau}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded" style={{ background: "rgba(152,162,176,0.08)" }}>
                      <span style={{ color: "rgba(236,239,244,0.6)" }}>{t.multiplier}</span>
                      <span className="gold-text font-bold">×{preview.scoring.multiplicateur}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded" style={{ background: "rgba(152,162,176,0.08)" }}>
                      <span style={{ color: "rgba(236,239,244,0.6)" }}>{t.baseScore}</span>
                      <span className="gold-text font-bold">{preview.scoring.scoreBase}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded" style={{ background: "rgba(152,162,176,0.08)" }}>
                      <span style={{ color: "rgba(236,239,244,0.6)" }}>{t.defeatMalus}</span>
                      <span className={preview.scoring.malus > 0 ? "loss-text font-bold" : "gold-text font-bold"}>+{preview.scoring.malus}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded col-span-2" style={{ background: "rgba(152,162,176,0.08)" }}>
                      <span style={{ color: "rgba(236,239,244,0.6)" }}>{t.mastery(preview.partiesAvant)}</span>
                      <span className="blue-text font-bold">+{Math.round(preview.scoring.surcharge * 100)}%</span>
                    </div>
                  </div>
                  )}
                  <div className="text-center p-4 rounded" style={{ background: "rgba(152,162,176,0.1)", border: "1px solid rgba(152,162,176,0.3)" }}>
                    <div className="text-4xl font-bold gold-text">{formaterCompact(preview.scoring.pompesFinales, exerciceAjout)}</div>
                    <div className="text-sm mt-1" style={{ color: "rgba(236,239,244,0.6)" }}>{nomsExo[exerciceAjout].toUpperCase()}</div>
                  </div>
                  <button className="lol-btn w-full" onClick={handleAddLog} disabled={addLogging}>
                    {addLogging ? t.saving : (typeJeu === "temps" ? tJeux.ajouterSession : t.logThisGame)}
                  </button>
                  {addError && <p className="text-sm loss-text text-center">{addError}</p>}
                </div>
              )}
            </div>
          )}

          {/* Riot match history list */}
          {loadingMatches ? (
            <div className="text-center py-10 gold-text">{t.loadingRiotGames}</div>
          ) : matchError ? (
            <div className="lol-panel p-6 text-center loss-text">{matchError}</div>
          ) : matches.length === 0 ? (
            <div className="lol-panel p-8 text-center">
              <p style={{ color: "rgba(236,239,244,0.5)" }}>{t.noGameFound}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: "rgba(236,239,244,0.4)" }}>
                {t.last20Games}
              </p>
              {matches.map((m, i) => (
                <div
                  key={m.matchId}
                  className="lol-panel px-4 py-3 flex items-center gap-3"
                  style={{ background: "var(--bg-raised)" }}
                >
                  <span className="text-xs w-5 text-center shrink-0" style={{ color: "rgba(152,162,176,0.4)" }}>{i + 1}</span>

                  <ChampionIcon name={m.champion} size={38} />

                  <span
                    className="font-bold text-sm w-16 text-center rounded px-2 py-0.5 shrink-0"
                    style={{
                      background: m.result === "V" ? "rgba(70,180,100,0.15)" : "rgba(200,70,70,0.15)",
                      color: m.result === "V" ? "#4eb86e" : "#e05555",
                    }}
                  >
                    {m.result === "V" ? t.victory : m.result === "D" ? t.defeat : m.result}
                  </span>

                  <span className="gold-text font-semibold text-sm w-14 shrink-0">{m.role}</span>
                  <span className="text-sm w-24 shrink-0" style={{ color: "rgba(236,239,244,0.85)" }}>{m.champion}</span>
                  <span className="text-sm font-mono shrink-0" style={{ color: "rgba(236,239,244,0.7)" }}>
                    {m.kills} / <span style={{ color: "#e05555" }}>{m.deaths}</span> / {m.assists}
                  </span>
                  <span className="text-xs shrink-0" style={{ color: "rgba(236,239,244,0.35)" }}>
                    {(() => { try { return new Date(m.date).toLocaleDateString(dateLocale); } catch { return m.date; } })()}
                  </span>

                  <div className="ml-auto flex items-center gap-3 shrink-0">
                    {m.indisponible ? (
                      <span className="text-xs px-3 py-1 rounded" style={{ color: "rgba(236,239,244,0.35)" }}>{t.unavailable}</span>
                    ) : m.alreadyLogged ? (
                      <>
                        <span className="text-sm gold-text font-bold">{formaterCompact(m.pompesCalculees ?? 0, toExerciceId(m.exercice))}</span>
                        <span className="text-xs px-3 py-1 rounded" style={{ background: "rgba(152,162,176,0.1)", color: "rgba(152,162,176,0.5)" }}>
                          {t.loggedBadge}
                        </span>
                      </>
                    ) : (
                      <button
                        className="lol-btn text-xs px-4 py-1"
                        onClick={() => handleQuickAdd(m)}
                        disabled={addingId === m.matchId}
                      >
                        {addingId === m.matchId ? "…" : t.add}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ POMPES VIEW ════════════════════════════════════════════════════ */}
      {view === "pompes" && (
        <div className="space-y-4">
          {loadingGames ? (
            <div className="text-center py-10 gold-text">{t.loading}</div>
          ) : (
            <>
              {/* Filtres — le filtre par jeu commande le reste */}
              <div className="lol-panel p-3 space-y-3">
                {jeuxJoues.length > 1 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs" style={{ color: "rgba(152,162,176,0.6)" }}>{tJeux.filtreJeuTitre}</span>
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
                            color: actif ? "var(--signal)" : "rgba(236,239,244,0.6)",
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
                  {/* Rôle et résultat n'existent que pour les jeux à parties. */}
                  {modeColonnes !== "temps" && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: "rgba(152,162,176,0.6)" }}>{t.roleLabel}</span>
                        <select className="lol-select text-sm" value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
                          {ROLES_FILTER.map((r) => <option key={r} value={r}>{t.roleOptionLabel(r)}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: "rgba(152,162,176,0.6)" }}>{t.resultLabel}</span>
                        <select className="lol-select text-sm" value={filterResult} onChange={(e) => setFilterResult(e.target.value)}>
                          <option value="Tous">{t.all}</option>
                          <option value="V">{t.victory}</option>
                          <option value="D">{t.defeat}</option>
                        </select>
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs" style={{ color: "rgba(152,162,176,0.6)" }}>{t.sortLabel}</span>
                    <select className="lol-select text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as "date" | "pompes")}>
                      <option value="date">{t.date}</option>
                      <option value="pompes">{t.pompes}</option>
                    </select>
                  </div>
                  <span className="ml-auto text-sm gold-text font-semibold">
                    {t.activitesAndTotal(filtered.length, resumeParExo(totauxParExo))}
                  </span>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="lol-panel p-8 text-center">
                  <p style={{ color: "rgba(236,239,244,0.5)" }}>{t.noGameToDisplay}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: "separate", borderSpacing: "0 4px", minWidth: modeColonnes === "parties" ? 760 : 660 }}>
                    <thead>
                      <tr style={{ color: "rgba(152,162,176,0.6)" }} className="text-xs uppercase tracking-wider">
                        <th className="text-left px-3 py-1">{t.tableDate}</th>
                        {afficherColonneJeu && <th className="text-left px-3 py-1">{t.tableJeu}</th>}
                        {modeColonnes === "parties" && (
                          <>
                            <th className="text-left px-3 py-1">{t.tableRole}</th>
                            <th className="text-left px-3 py-1">{t.tableChampion}</th>
                            <th className="text-center px-3 py-1">{t.tableKda}</th>
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
                      {(() => {
                        // Cumul tenu SÉPARÉMENT par exercice : chaque ligne affiche
                        // le total de son propre exercice à cet instant. Mélanger des
                        // répétitions et des secondes n'aurait aucun sens.
                        const cumulMap = new Map<string, number>();
                        const running: Record<string, number> = {};
                        for (let i = filtered.length - 1; i >= 0; i--) {
                          const ex = toExerciceId(filtered[i].exercice);
                          running[ex] = (running[ex] ?? 0) + filtered[i].pompesCalculees;
                          cumulMap.set(filtered[i].id, running[ex]);
                        }
                        return filtered.map((g) => {
                          const cumul = cumulMap.get(g.id) ?? 0;
                          const exo = toExerciceId(g.exercice);
                          const type = typeDeLaLigne(g);
                          const depliee = ligneDepliee === g.id;
                          const fond = { background: "var(--bg-raised)", borderBottom: "1px solid rgba(152,162,176,0.08)" };
                          return (
                            <Fragment key={g.id}>
                            <tr style={fond}>
                              <td className="px-3 py-2" style={{ color: "rgba(236,239,244,0.6)", whiteSpace: "nowrap" }}>
                                {editingDateId === g.id ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                    <input
                                      type="datetime-local"
                                      className="lol-input"
                                      style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                                      value={editDateVal}
                                      onChange={(e) => setEditDateVal(e.target.value)}
                                    />
                                    <button onClick={() => handleEditDate(g.id)} style={{ color: "#2FD98A", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem" }}>✓</button>
                                    <button onClick={() => setEditingDateId(null)} style={{ color: "#e05555", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem" }}>✕</button>
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
                                      style={{ color: "rgba(152,162,176,0.35)", background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", lineHeight: 1 }}
                                    >✎</button>
                                  </div>
                                )}
                              </td>

                              {afficherColonneJeu && (
                                <td className="px-3 py-2" style={{ color: "rgba(236,239,244,0.75)", whiteSpace: "nowrap" }}>{nomDuJeu(g)}</td>
                              )}

                              {modeColonnes === "parties" && (
                                <>
                                  <td className="px-3 py-2 gold-text font-medium">{g.role}</td>
                                  <td className="px-3 py-2">
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <ChampionIcon name={g.champion} size={26} />
                                      <span style={{ color: "rgba(236,239,244,0.8)" }}>{g.champion ?? "—"}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2 text-center" style={{ color: "rgba(236,239,244,0.8)" }}>
                                    {g.kills}/{g.deaths}/{g.assists}
                                  </td>
                                  <td className="px-3 py-2 text-center font-bold">
                                    <ResultatCell result={g.result} t={t} />
                                  </td>
                                </>
                              )}

                              {modeColonnes === "temps" && (
                                <td className="px-3 py-2 text-center mono-num" style={{ color: "rgba(236,239,244,0.8)" }}>
                                  {formaterTempsJeu(g.dureeSec ?? 0)}
                                </td>
                              )}

                              {modeColonnes === "mixte" && (
                                <td className="px-3 py-2">
                                  {type === "temps" ? (
                                    <span className="mono-num" style={{ color: "rgba(236,239,244,0.8)" }}>
                                      {formaterTempsJeu(g.dureeSec ?? 0)}
                                    </span>
                                  ) : (
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                                      <ChampionIcon name={g.champion} size={22} />
                                      <span style={{ color: "rgba(236,239,244,0.8)" }}>{g.champion ?? "—"}</span>
                                      <span style={{ color: "rgba(152,162,176,0.5)" }}>·</span>
                                      <span className="gold-text">{g.role}</span>
                                      <span style={{ color: "rgba(152,162,176,0.5)" }}>·</span>
                                      <span className="mono-num" style={{ color: "rgba(236,239,244,0.7)" }}>
                                        {g.kills}/{g.deaths}/{g.assists}
                                      </span>
                                      <ResultatCell result={g.result} t={t} />
                                    </div>
                                  )}
                                </td>
                              )}

                              <td className="px-3 py-2 text-center gold-text">{g.niveauCalcule}</td>
                              <td className="px-3 py-2 text-right gold-text font-bold">{formaterCompact(g.pompesCalculees, exo)}</td>
                              <td className="px-3 py-2 text-right" style={{ color: "rgba(152,162,176,0.6)" }}>{formaterCompact(cumul, exo)}</td>
                              <td className="px-3 py-2 text-center" style={{ whiteSpace: "nowrap" }}>
                                <button
                                  onClick={() => setLigneDepliee(depliee ? null : g.id)}
                                  title={t.detailToggleTitle}
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
                                  style={{ color: "rgba(220,80,80,0.7)", lineHeight: 1, background: "none", border: "none", cursor: "pointer", fontSize: "1rem", padding: "2px 6px", borderRadius: "4px" }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = "rgba(220,80,80,1)")}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = "rgba(220,80,80,0.7)")}
                                >
                                  {deletingId === g.id ? "…" : "✕"}
                                </button>
                              </td>
                            </tr>

                            {/* Détail du calcul : replié par défaut, il n'est utile
                                qu'à qui veut comprendre le chiffre. */}
                            {depliee && (
                              <tr style={{ background: "rgba(152,162,176,0.05)" }}>
                                <td colSpan={nbColonnes} className="px-3 py-2">
                                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs" style={{ color: "rgba(236,239,244,0.6)" }}>
                                    {type === "temps" ? (
                                      <span>{t.detailDuree} : <span className="mono-num" style={{ color: "rgba(236,239,244,0.85)" }}>{formaterTempsJeu(g.dureeSec ?? 0)}</span></span>
                                    ) : (
                                      <>
                                        <span>{t.detailScore} : <span className="mono-num" style={{ color: "rgba(236,239,244,0.85)" }}>{g.scoreCalcule}</span></span>
                                        <span>{t.detailMalus} : <span className="mono-num loss-text">+{g.malusCalcule}</span></span>
                                        <span>{t.detailMastery} : <span className="mono-num blue-text">+{Math.round(g.surchargeCalculee * 100)}%</span></span>
                                      </>
                                    )}
                                    <span>{t.tableLevel} : <span className="mono-num gold-text">{g.niveauCalcule}</span></span>
                                    {!afficherColonneJeu && <span>{t.tableJeu} : <span style={{ color: "rgba(236,239,244,0.85)" }}>{nomDuJeu(g)}</span></span>}
                                  </div>
                                </td>
                              </tr>
                            )}
                            </Fragment>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
