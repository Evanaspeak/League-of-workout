"use client";
import { useEffect, useState } from "react";
import { ChampionIcon } from "@/components/ChampionIcon";
import { ChampionInput } from "@/components/ChampionInput";
import { useChampions, championConnu } from "@/lib/useChampions";
import { useT, useDateLocale, useLocale } from "@/lib/i18n/LocaleContext";
import { history } from "@/lib/i18n/dictionaries/history";
import { translateApiError } from "@/lib/i18n/apiErrors";
import {
  EXERCICE_DEFAUT, formaterCompact, toExerciceId, toExerciceIds,
  type ExerciceId, type Repartition,
} from "@/lib/exercices";
import { JEU_DEFAUT, capacitesDuJeu, equipesDuMode, type TypeJeu } from "@/lib/jeux";
import { JeuSelector } from "@/components/JeuSelector";
import { jeux as jeuxDict } from "@/lib/i18n/dictionaries/jeux";
import { ExerciceSelector } from "@/components/ExerciceSelector";
import { exercices as exercicesDict } from "@/lib/i18n/dictionaries/exercices";

// ─── Types ───────────────────────────────────────────────────────────────────

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

type PreviewResult = {
  scoring: Scoring; partiesAvant: number; gainageSec: number; exercice?: ExerciceId;
  placement?: number; joueurs?: number;
  /** Ce qu'il y aura à faire, exercice par exercice. */
  repartition?: Repartition;
};

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

// ─── Composant ───────────────────────────────────────────────────────────────

/**
 * Saisie d'une activité : suivi Riot, ARAM du chaos et ajout manuel. Vit sur le
 * dashboard, là où on arrive en sortant de partie — l'historique n'a plus qu'à
 * montrer ce qui est déjà enregistré.
 */
export function AjoutActivite({
  onAjout,
  enModale = false,
}: {
  /** Appelé après chaque enregistrement réussi. */
  onAjout: () => void;
  /**
   * Rendu dans une fenêtre dédiée : le formulaire est déjà ce qu'on est venu
   * chercher, il s'ouvre donc d'emblée et la fenêtre porte sa propre fermeture.
   */
  enModale?: boolean;
}) {
  const t = useT(history);
  const tExo = useT(exercicesDict);
  const tJeux = useT(jeuxDict);
  const nomsExo: Record<ExerciceId, string> = {
    pompes: tExo.pompesNom, squats: tExo.squatsNom, boxe: tExo.boxeNom,
  };
  const dateLocale = useDateLocale();
  const { locale } = useLocale();

  // ── Parties view ──
  const [matches, setMatches] = useState<MatchEntry[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchError, setMatchError] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);


  // ── Add form ──
  // Même source de vérité que ChampionInput : sinon un champion ajouté par
  // l'admin s'affiche comme valide dans le champ mais bloque le bouton.
  const champList = useChampions();
  const [exercicesAjout, setExercicesAjout] = useState<ExerciceId[]>([EXERCICE_DEFAUT]);
  const [showAddForm, setShowAddForm] = useState(enModale);
  const [addForm, setAddForm] = useState({
    role: "Jungle", champion: "", kills: "", deaths: "", assists: "", result: "D", gainageSec: "60",
  });
  const [jeu, setJeu] = useState<string>(JEU_DEFAUT);
  const [typeJeu, setTypeJeu] = useState<TypeJeu>("parties");
  const [dureeH, setDureeH] = useState("");
  const [dureeM, setDureeM] = useState("");
  // Battle royale : place finale et taille de la partie (modifiable pour les
  // modes en équipe, où le classement porte sur les escouades).
  const [placement, setPlacement] = useState("");
  // Taille d'équipe du mode joué (1 = solo, 4 = squad). Mémorisée d'une partie
  // sur l'autre : on ne change pas de mode à chaque game.
  const [tailleEquipe, setTailleEquipe] = useState(1);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [addLogging, setAddLogging] = useState(false);
  const [addLogged, setAddLogged] = useState(false);
  const [addError, setAddError] = useState("");


  // ── Riot manual fetch ──
  const [riotLoading, setRiotLoading] = useState(false);
  const [riotError, setRiotError] = useState("");


  // ─── Load localStorage on mount ──────────────────────────────────────────
  useEffect(() => {
    const savedSec = localStorage.getItem("lastGainageSec");
    const savedRole = localStorage.getItem("lastRole");
    const savedMode = Number(localStorage.getItem("lastModeBr"));
    if (savedMode >= 1) setTailleEquipe(savedMode);
    setAddForm((f) => ({
      ...f,
      ...(savedSec ? { gainageSec: savedSec } : {}),
      ...(savedRole ? { role: savedRole } : {}),
    }));
  }, []);

  // ─── Préférences d'exercices ─────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((u) => setExercicesAjout(toExerciceIds(u?.exercices)))
      .catch(() => {});
  }, []);

  // ─── Parties Riot récentes ───────────────────────────────────────────────
  useEffect(() => {
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
    loadMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      onAjout();
      window.dispatchEvent(new Event("wow-dette-changee"));
    }
    setAddingId(null);
  };

  // ─── Manual add form ─────────────────────────────────────────────────────

  // Ce que le jeu permet de renseigner : Counter-Strike n'a ni lane ni
  // champion, Rocket League n'a même pas de KDA.
  const capacites = capacitesDuJeu(jeu, typeJeu);

  // Le mode donne le dénominateur du classement : en squad de 4 à 100 joueurs,
  // on ne peut pas finir mieux que 1er sur 25.
  const modesDisponibles = capacites.modes;
  const tailleRetenue = modesDisponibles.includes(tailleEquipe) ? tailleEquipe : modesDisponibles[0];
  const equipesConsultees = equipesDuMode(capacites.joueurs, tailleRetenue);

  /**
   * Corps envoyé à l'API, identique pour l'aperçu et l'enregistrement — on
   * n'envoie que ce que le jeu possède réellement.
   */
  const corpsAjout = (exercice: ExerciceId | null, dureeSec?: number) => ({
    jeu,
    typeJeu,
    // Un seul exercice coché (ou une part de session déjà attribuée) : on
    // l'impose. Plusieurs cochés sur une partie : on envoie la sélection et
    // le serveur avance d'un cran dans la rotation, pour équilibrer.
    ...(exercice ? { exercice } : {}),
    exercices: exercicesAjout,
    gainageSec: Number(addForm.gainageSec) || 60,
    ...(typeJeu === "temps"
      ? { dureeSec: dureeSec ?? dureeEnSecondes }
      : {
          result: addForm.result,
          ...(capacites.roles ? { role: addForm.role } : {}),
          ...(capacites.champions ? { champion: addForm.champion } : {}),
          ...(capacites.kda
            ? {
                kills: Number(addForm.kills) || 0,
                deaths: Number(addForm.deaths) || 0,
                assists: Number(addForm.assists) || 0,
              }
            : {}),
          ...(capacites.br
            ? {
                placement: Number(placement) || 0,
                joueurs: equipesConsultees,
                kills: Number(addForm.kills) || 0,
              }
            : {}),
        }),
  });

  const openAddForm = (role?: string) => {
    const savedRole = localStorage.getItem("lastRole") ?? "Jungle";
    setAddForm((f) => ({ ...f, role: role ?? savedRole }));
    setPreview(null);
    setAddLogged(false);
    setAddError("");
    setShowAddForm(true);
  };


  const handleAddLog = async () => {
    setAddLogging(true);
    setAddError("");

    // Une seule ligne, quels que soient les exercices : la dette se partage
    // entre eux, la partie reste une partie.
    const res = await fetch("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...corpsAjout(exercicesAjout.length === 1 ? exercicesAjout[0] : null),
        source: "manuel",
      }),
    });

    if (res.ok) {
      const { game, scoring } = await res.json();
      onAjout();
      window.dispatchEvent(new Event("wow-dette-changee"));
      setPreview(null);
      setAddLogged(true);
      setAddForm((f) => ({ ...f, champion: "", kills: "", deaths: "", assists: "", result: "D" }));
      setPlacement("");
    } else {
      const err = await res.json().catch(() => ({}));
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


  const dureeEnSecondes = (Number(dureeH) || 0) * 3600 + (Number(dureeM) || 0) * 60;
  const isChampionValid = !addForm.champion || championConnu(champList, addForm.champion);
  const isAddReady = typeJeu === "temps"
    ? jeu.trim().length > 0 && dureeEnSecondes > 0
    : jeu.trim().length > 0
      && (!capacites.champions || isChampionValid)
      && (!capacites.kda || (addForm.kills !== "" && addForm.deaths !== "" && addForm.assists !== ""))
      && (!capacites.br || Number(placement) >= 1);

  /**
   * Coût réel de la partie en cours de saisie. Chaque carte d'exercice le
   * convertit dans son unité, ce qui répond à « et si je payais en squats ? ».
   * Tant que la partie n'est pas renseignée, le sélecteur garde son exemple.
   */
  const coutVivant = isAddReady && preview ? preview.scoring.pompesFinales : undefined;

  // Corps de la requête d'aperçu, sérialisé : c'est lui qui décide quand
  // recalculer, plutôt que la longue liste des champs qui le composent.
  const corpsApercu = JSON.stringify(
    corpsAjout(exercicesAjout.length === 1 ? exercicesAjout[0] : null),
  );

  /**
   * Aperçu permanent : la dette se recalcule à mesure qu'on remplit la partie,
   * il n'y a donc plus rien à déclencher à la main. Le délai laisse finir la
   * frappe, et la requête précédente est annulée pour qu'une réponse en retard
   * ne vienne pas écraser un chiffre plus récent.
   */
  useEffect(() => {
    if (!isAddReady) return;
    const controleur = new AbortController();
    const attente = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const res = await fetch("/api/games/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: corpsApercu,
          signal: controleur.signal,
        });
        if (res.ok) setPreview(await res.json());
      } catch { /* annulée par une saisie plus récente, ou réseau coupé */ }
      setPreviewLoading(false);
    }, 350);
    return () => { clearTimeout(attente); controleur.abort(); };
  }, [corpsApercu, isAddReady]);

  return (
    <div className="space-y-4">

          {/* Ajout manuel : action générique, valable pour n'importe quel jeu.
              En fenêtre dédiée, le formulaire est déjà ouvert : ce bouton
              n'aurait plus rien à déclencher. */}
          {!enModale && (
            <button className="lol-btn w-full text-sm" onClick={() => openAddForm()}>
              {t.addBtn}
            </button>
          )}

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
                {!enModale && (
                  <button
                    onClick={() => { setShowAddForm(false); setPreview(null); setAddLogged(false); }}
                    style={{ color: "rgba(236,239,244,0.4)", background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem" }}
                  >✕</button>
                )}
              </div>

              {addLogged && (
                <div className="text-center p-3 rounded" style={{ background: "rgba(47,217,138,0.1)", border: "1px solid rgba(47,217,138,0.3)" }}>
                  <span className="win-text font-semibold">{t.gameLogged}</span>
                </div>
              )}

              <JeuSelector
                jeu={jeu}
                typeJeu={typeJeu}
                onChange={(j, ty) => { setJeu(j); setTypeJeu(ty); }}
              />

              {typeJeu === "temps" ? (
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{tJeux.dureeLabel}</label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" max="24" className="lol-input text-center" placeholder="2"
                      value={dureeH} onChange={(e) => { setDureeH(e.target.value); }} />
                    <span className="text-sm" style={{ color: "rgba(236,239,244,0.5)" }}>{tJeux.heures}</span>
                    <input type="number" min="0" max="59" className="lol-input text-center" placeholder="30"
                      value={dureeM} onChange={(e) => { setDureeM(e.target.value); }} />
                    <span className="text-sm" style={{ color: "rgba(236,239,244,0.5)" }}>{tJeux.minutes}</span>
                  </div>
                  <p className="text-xs mt-2" style={{ color: "rgba(236,239,244,0.4)" }}>{tJeux.sessionSousTitre}</p>
                </div>
              ) : (
              <>
              {(capacites.roles || capacites.champions) && (
              <div className={`grid gap-3 ${capacites.roles && capacites.champions ? "grid-cols-2" : "grid-cols-1"}`}>
                {capacites.roles && (
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{t.role}</label>
                  <select className="lol-select w-full" value={addForm.role}
                    onChange={(e) => {
                      setAddForm((f) => ({ ...f, role: e.target.value }));
                      localStorage.setItem("lastRole", e.target.value);
                     
                    }}>
                    {ROLES_FORM.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                )}
                {capacites.champions && (
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{t.champion}</label>
                  <ChampionInput
                    value={addForm.champion}
                    onChange={(val) => setAddForm((f) => ({ ...f, champion: val }))}
                  />
                </div>
                )}
              </div>
              )}

              {capacites.br && (
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>
                    {t.modeLabel}
                  </label>
                  <div className="flex gap-2">
                    {modesDisponibles.map((taille) => {
                      const actif = tailleRetenue === taille;
                      return (
                        <button
                          key={taille}
                          type="button"
                          aria-pressed={actif}
                          onClick={() => {
                            setTailleEquipe(taille);
                            localStorage.setItem("lastModeBr", String(taille));
                           
                          }}
                          style={{
                            flex: 1, padding: "8px 4px", borderRadius: 8, cursor: "pointer",
                            fontSize: "0.82rem", fontWeight: 600,
                            background: actif ? "rgba(255,180,84,0.1)" : "rgba(152,162,176,0.06)",
                            border: `1px solid ${actif ? "var(--amber)" : "rgba(152,162,176,0.2)"}`,
                            color: actif ? "var(--amber)" : "rgba(236,239,244,0.6)",
                            transition: "all 0.15s",
                          }}
                        >
                          <span style={{ display: "block" }}>{t.modeNom(taille)}</span>
                          <span className="mono-num" style={{ display: "block", fontSize: "0.68rem", opacity: 0.7, marginTop: 2 }}>
                            {t.modeDenominateur(equipesDuMode(capacites.joueurs, taille), taille)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {capacites.br && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="ajout-placement" className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>
                      {t.placementLabel}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="ajout-placement"
                        type="number" min="1" max={equipesConsultees} className="lol-input text-center" placeholder="12"
                        value={placement}
                        onChange={(e) => { setPlacement(e.target.value); }}
                      />
                      <span className="text-sm shrink-0 mono-num" style={{ color: "rgba(236,239,244,0.5)" }}>
                        {t.placementSur} {equipesConsultees}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label htmlFor="ajout-eliminations" className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>
                      {t.eliminations}
                    </label>
                    <input
                      id="ajout-eliminations"
                      type="number" min="0" className="lol-input text-center" value={addForm.kills}
                      onChange={(e) => { setAddForm((f) => ({ ...f, kills: e.target.value })); }}
                    />
                  </div>
                </div>
              )}

              {capacites.kda && (
              <div className="grid grid-cols-3 gap-3">
                {(["kills", "deaths", "assists"] as const).map((field) => (
                  <div key={field}>
                    <label htmlFor={`ajout-${field}`} className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>
                      {field === "kills" ? t.kills : field === "deaths" ? t.deaths : t.assists}
                    </label>
                    <input id={`ajout-${field}`} type="number" min="0" className="lol-input text-center" value={addForm[field]}
                      onChange={(e) => { setAddForm((f) => ({ ...f, [field]: e.target.value })); }} />
                  </div>
                ))}
              </div>
              )}

              <div className={`grid gap-3 items-end ${capacites.br ? "grid-cols-1" : "grid-cols-2"}`}>
                {!capacites.br && (
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
                        onClick={() => { setAddForm((f) => ({ ...f, result: r })); }}>
                        {r === "V" ? t.victory : t.defeat}
                      </button>
                    ))}
                  </div>
                </div>
                )}
                <div>
                  <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>
                    {t.gainageTime}
                  </label>
                  <div className="flex items-center gap-2">
                    <input type="number" min="1" className="lol-input text-center" value={addForm.gainageSec}
                      onChange={(e) => {
                        setAddForm((f) => ({ ...f, gainageSec: e.target.value }));
                        localStorage.setItem("lastGainageSec", e.target.value);
                       
                      }} />
                    <span className="text-xs gold-text shrink-0">{getLevelLabel(Number(addForm.gainageSec) || 60, locale)}</span>
                  </div>
                </div>
              </div>
              </>
              )}

              <div className="space-y-2">
                <div className="flex items-baseline justify-between gap-2">
                  <label className="block text-xs" style={{ color: "rgba(152,162,176,0.7)" }}>
                    {tExo.choisirTitre}
                  </label>
                  <span
                    className="text-xs"
                    style={{ color: coutVivant !== undefined ? "var(--amber)" : "rgba(152,162,176,0.45)" }}
                  >
                    {previewLoading
                      ? t.calculating
                      : coutVivant !== undefined
                        ? tExo.apercuLive
                        : tExo.apercuExemple}
                  </span>
                </div>
                <ExerciceSelector
                  selection={exercicesAjout}
                  onChange={setExercicesAjout}
                  exemplePoints={coutVivant}
                  compact
                />
                {exercicesAjout.length > 1 && (
                  <p className="text-xs" style={{ color: "var(--amber)" }}>
                    {tExo.partageActif(exercicesAjout.length)}
                  </p>
                )}
              </div>

              {isAddReady && (
                <div className="space-y-3">
                  {preview && (
                  <>
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
                    {capacites.br ? (
                      <div className="flex justify-between p-2 rounded" style={{ background: "rgba(152,162,176,0.08)" }}>
                        <span style={{ color: "rgba(236,239,244,0.6)" }}>{t.placementLabel}</span>
                        <span className="gold-text font-bold mono-num">
                          {t.placementAffiche(preview.placement ?? 0, preview.joueurs ?? 0)}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between p-2 rounded" style={{ background: "rgba(152,162,176,0.08)" }}>
                          <span style={{ color: "rgba(236,239,244,0.6)" }}>{t.defeatMalus}</span>
                          <span className={preview.scoring.malus > 0 ? "loss-text font-bold" : "gold-text font-bold"}>+{preview.scoring.malus}</span>
                        </div>
                        <div className="flex justify-between p-2 rounded col-span-2" style={{ background: "rgba(152,162,176,0.08)" }}>
                          <span style={{ color: "rgba(236,239,244,0.6)" }}>{t.mastery(preview.partiesAvant)}</span>
                          <span className="blue-text font-bold">+{Math.round(preview.scoring.surcharge * 100)}%</span>
                        </div>
                      </>
                    )}
                  </div>
                  )}
                  <div className="text-center p-4 rounded" style={{ background: "rgba(152,162,176,0.1)", border: "1px solid rgba(152,162,176,0.3)" }}>
                    {(() => {
                      // Tout ce qu'il y a à faire, dans l'unité de chaque exercice.
                      const parts = Object.entries(preview.repartition ?? {})
                        .map(([id, pts]) => ({ id: toExerciceId(id), pts: pts ?? 0 }));
                      if (parts.length <= 1) {
                        const seul = parts[0] ?? { id: toExerciceId(preview.exercice), pts: preview.scoring.pompesFinales };
                        return (
                          <>
                            <div className="text-4xl font-bold gold-text">{formaterCompact(seul.pts, seul.id)}</div>
                            <div className="text-sm mt-1" style={{ color: "rgba(236,239,244,0.6)" }}>
                              {nomsExo[seul.id].toUpperCase()}
                            </div>
                          </>
                        );
                      }
                      return (
                        <div className="space-y-1">
                          {parts.map((part) => (
                            <div key={part.id} className="text-2xl font-bold gold-text">
                              {formaterCompact(part.pts, part.id)}
                              <span className="text-sm ml-2" style={{ color: "rgba(236,239,244,0.5)" }}>
                                {nomsExo[part.id].toLowerCase()}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                  </>
                  )}
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
  );
}
