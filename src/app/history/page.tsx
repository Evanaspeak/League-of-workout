"use client";
import { Icone } from "@/components/Icone";
import { Fragment, useEffect, useState } from "react";
import { ChampionIcon } from "@/components/ChampionIcon";
import { useT, useDateLocale, useMinuscule } from "@/lib/i18n/LocaleContext";
import { history } from "@/lib/i18n/dictionaries/history";
import {
  formaterCompact, parseRepartition, toExerciceId, ventiler, type ExerciceId,
} from "@/lib/exercices";
import { JEU_DEFAUT, formaterTempsJeu, toTypeJeu, type TypeJeu } from "@/lib/jeux";
import { jeux as jeuxDict } from "@/lib/i18n/dictionaries/jeux";
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
  placement?: number | null;
  joueurs?: number | null;
  /** JSON de ventilation entre exercices, absent si un seul est concerné. */
  repartition?: string | null;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLES_FILTER = ["Tous", "Top", "Jungle", "Mid", "ADC", "Support", "ARAM", "Arena"];
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

function ResultatCell({ result, t }: { result: string; t: { victory: string; defeat: string; sessionLibelle: string } }) {
  if (result === "V") return <span className="win-text">{t.victory}</span>;
  if (result === "D") return <span className="loss-text">{t.defeat}</span>;
  return <span style={{ color: "var(--steel)", fontWeight: 500 }}>{t.sessionLibelle}</span>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const t = useT(history);
  const minuscule = useMinuscule();
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

  // ── Lignes de dette ──
  const [games, setGames] = useState<Game[]>([]);
  const [loadingGames, setLoadingGames] = useState(true);
  const [filterRole, setFilterRole] = useState("Tous");
  const [filterResult, setFilterResult] = useState("Tous");
  const [filtreJeu, setFiltreJeu] = useState<string | null>(null);
  // Ligne dont on a déplié le détail de calcul.
  const [ligneDepliee, setLigneDepliee] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "pompes">("date");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Date editing ──
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editDateVal, setEditDateVal] = useState("");

  // ─── Chargement initial (games + parties Riot) ───────────────────────────
  useEffect(() => {
    fetch("/api/games")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setGames(data); })
      .catch(() => {})
      .finally(() => setLoadingGames(false));
  }, []);

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
    // La suppression rend aussi du temps au compteur : la pastille doit suivre.
    window.dispatchEvent(new Event("wow-dette-changee"));
    setDeletingId(null);
  };

  // ─── Filtered pompe games ─────────────────────────────────────────────────
  // ── Multi-jeu : périmètre consulté et jeu de colonnes qui en découle ──
  const nomDuJeu = (g: Game) => g.jeu || JEU_DEFAUT;
  /** Ce que cette partie doit, exercice par exercice. */
  const ventilationDe = (g: Game) => parseRepartition(g.repartition, g.exercice, g.pompesCalculees);
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
  // Ventilation du total affiché : une entrée par exercice réellement joué.
  const totauxParExo = filtered.reduce<Record<string, number>>((acc, g) => {
    for (const [ex, pts] of Object.entries(ventilationDe(g))) {
      acc[ex] = (acc[ex] ?? 0) + (pts ?? 0);
    }
    return acc;
  }, {});

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <h1 className="titre-page">{t.pageTitle}</h1>

      <div className="space-y-4">
          {loadingGames ? (
            <div className="text-center py-10 gold-text">{t.loading}</div>
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
                    {t.activitesAndTotal(filtered.length, resumeParExo(totauxParExo))}
                  </span>
                </div>
              </div>

              {filtered.length === 0 ? (
                // L'ancre de la visite guidée vit aussi ici : un compte neuf
                // n'a aucune ligne, et l'étape qui montre « où retrouver tes
                // activités » restait alors sans cible — écran figé le temps du
                // délai, puis étape sautée. Montrer l'emplacement vide répond
                // exactement à la question posée.
                <div className="lol-panel p-8 text-center" data-visite="historique-table">
                  <p style={{ color: "var(--faint)" }}>{t.noGameToDisplay}</p>
                </div>
              ) : (
                <div className="overflow-x-auto" data-visite="historique-table">
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
                      {(() => {
                        // Cumul tenu SÉPARÉMENT par exercice : chaque ligne affiche
                        // le total de son propre exercice à cet instant. Mélanger des
                        // répétitions et des secondes n'aurait aucun sens.
                        const cumulMap = new Map<string, Record<string, number>>();
                        const running: Record<string, number> = {};
                        for (let i = filtered.length - 1; i >= 0; i--) {
                          const parts = ventilationDe(filtered[i]);
                          for (const [ex, pts] of Object.entries(parts)) {
                            running[ex] = (running[ex] ?? 0) + (pts ?? 0);
                          }
                          // On fige l'état des compteurs concernés par cette ligne.
                          const instantane: Record<string, number> = {};
                          for (const ex of Object.keys(parts)) instantane[ex] = running[ex];
                          cumulMap.set(filtered[i].id, instantane);
                        }
                        return filtered.map((g) => {
                          const cumul = cumulMap.get(g.id) ?? {};
                          const parts = Object.entries(ventilationDe(g))
                            .map(([id, pts]) => ({ id: toExerciceId(id), pts: pts ?? 0 }));
                          const type = typeDeLaLigne(g);
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
                                    <ResultatCell result={g.result} t={t} />
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
                                      <ResultatCell result={g.result} t={t} />
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
                                    {formaterCompact(part.pts, part.id)}
                                    <span style={{
                                      marginLeft: 5, fontWeight: 400, fontSize: "0.72rem",
                                      color: "var(--steel)",
                                    }}>
                                      {minuscule(nomsExo[part.id])}
                                    </span>
                                  </div>
                                ))}
                              </td>
                              <td className="px-3 py-2 text-right" style={{ color: "var(--steel)", whiteSpace: "nowrap" }}>
                                {parts.map((part) => (
                                  <div key={part.id}>{formaterCompact(cumul[part.id] ?? 0, part.id)}</div>
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
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
      </div>
    </div>
  );
}
