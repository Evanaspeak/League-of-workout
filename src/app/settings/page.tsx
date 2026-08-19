"use client";
import { useEffect, useState } from "react";
import { logout, deleteAccount } from "@/lib/actions";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { settings as settingsDict } from "@/lib/i18n/dictionaries/settings";
import { exercices as exercicesDict } from "@/lib/i18n/dictionaries/exercices";
import { translateApiError } from "@/lib/i18n/apiErrors";
import {
  EXERCICE_DEFAUT, RAPPEL_SEUIL_DEFAUT, RAPPEL_SEUILS_SEC, RAPPEL_SEUIL_SEC_DEFAUT,
  PLAFONDS_QUOTIDIENS, EXERCICE_IDS, formaterCompact, toExerciceIds, type ExerciceId,
} from "@/lib/exercices";
import { ExerciceSelector } from "@/components/ExerciceSelector";
import { ReglageNotifications } from "@/components/ReglageNotifications";
import { ReglageJeux } from "@/components/ReglageJeux";
import { Icone } from "@/components/Icone";
import { ReglageApplication } from "@/components/ReglageApplication";
import { ReglageDetection } from "@/components/ReglageDetection";
import { TestPompes } from "@/components/TestPompes";
import { useValeurClient } from "@/lib/valeurClient";
import { oublierPremiereVisite } from "@/lib/premiereVisite";
import { getLevelParPompes } from "@/lib/scoring";
import {
  EnteteRubrique, LigneRubrique, ouvrirRubrique, useRubrique,
} from "@/components/ListeReglages";
import type { NomIcone } from "@/components/Icone";

// ─── Types ───────────────────────────────────────────────────────────────────

type RoleWeight = { role: string; poidsMort: number; poidsKill: number; poidsAssist: number; maitriseActive: boolean };
type LevelConfig = {
  niveau: number; seuilGainageSec: number; seuilPompes?: number;
  multiplicateur: number; malusDefaite: number;
};
type MasteryConfig = { surchargeMax: number; partiesPourMax: number };

/**
 * Rubriques des réglages, dans l'ordre de la liste. L'identifiant est aussi le
 * fragment d'adresse : `/settings#jeux` ouvre les jeux.
 */
const RUBRIQUES = ["profil", "effort", "jeux", "application", "donnees", "avance"] as const;
type Rubrique = (typeof RUBRIQUES)[number];

const HEADING: React.CSSProperties = {
  fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
  fontSize: "0.72rem",
  color: "#ECEFF4",
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const t = useT(settingsDict);
  const tExo = useT(exercicesDict);
  const { locale } = useLocale();
  // Lu sans effet : le rendu serveur dit « non », le navigateur tranche, et
  // aucun second rendu n'est imposé au montage.
  const surDesktop = useValeurClient(() => Boolean(window.electronLOL), false);
  // Rubrique ouverte, lue dans l'adresse : le bouton « précédent » ramène à la
  // liste, et un lien peut viser une rubrique directement.
  const rubrique = useRubrique(RUBRIQUES) as Rubrique | null;
  // Résumés affichés à droite des lignes, pour éviter d'ouvrir juste pour voir.
  const [nbJeux, setNbJeux] = useState(0);
  const [version, setVersion] = useState<string | null>(null);

  const EXO_LABELS: Record<ExerciceId, { nom: string; desc: string }> = {
    pompes: { nom: tExo.pompesNom, desc: tExo.pompesDesc },
    squats: { nom: tExo.squatsNom, desc: tExo.squatsDesc },
    boxe: { nom: tExo.boxeNom, desc: tExo.boxeDesc },
  };

  /** « 38 pompes » pour les répétitions, « 4 min 26 » pour le temps. */
  // ── Profile ──
  // Le compte Riot n'est plus ici : il vit dans le bloc « League of Legends »
  // des jeux, avec sa propre sauvegarde.
  const [profileForm, setProfileForm] = useState({ pseudo: "", objectifTotalPompes: 1000 });
  const [betaRank, setBetaRank] = useState<number | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  // ── Suppression de compte ──
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);

  // ── Beta panel ──
  const [roleWeights, setRoleWeights] = useState<RoleWeight[]>([]);
  const [levelConfigs, setLevelConfigs] = useState<LevelConfig[]>([]);
  const [masteryConfig, setMasteryConfig] = useState<MasteryConfig | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSettings, setSavedSettings] = useState(false);

  // ── Exercice & rappel ──
  const [exercicesSel, setExercicesSel] = useState<ExerciceId[]>([EXERCICE_DEFAUT]);
  const [rappelSeuil, setRappelSeuil] = useState<number>(RAPPEL_SEUIL_DEFAUT);
  // Seuil du compteur de boxe, en secondes d'effort.
  const [seuilSec, setSeuilSec] = useState<number>(RAPPEL_SEUIL_SEC_DEFAUT);
  // Avertissement de volume quotidien, en points d'effort. 0 = désactivé.
  const [plafond, setPlafond] = useState<number>(0);
  const [savingExo, setSavingExo] = useState(false);
  const [savedExo, setSavedExo] = useState(false);

  // ── Test de pompes maximales (fixe le niveau) ──
  const [pompesMax, setPompesMax] = useState(0);
  const [pompesMaxLe, setPompesMaxLe] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/user").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([u, s]) => {
      setProfileForm({
        pseudo: u.pseudo ?? "",
        objectifTotalPompes: s.goal?.objectifTotalPompes ?? 1000,
      });
      setBetaRank(u.betaRank ?? null);
      // Repli explicite : une réponse incomplète posait `undefined` dans ces
      // états, et la liste des rubriques — qui lit `levelConfigs.length` pour
      // afficher le niveau — emportait alors toute la page.
      setRoleWeights(Array.isArray(s.roleWeights) ? s.roleWeights : []);
      setLevelConfigs(Array.isArray(s.levelConfigs) ? s.levelConfigs : []);
      setMasteryConfig(s.masteryConfig ?? null);
      setExercicesSel(toExerciceIds(s.user?.exercices));
      setRappelSeuil(s.user?.rappelSeuilPoints ?? RAPPEL_SEUIL_DEFAUT);
      setSeuilSec(s.user?.rappelSeuilSec ?? RAPPEL_SEUIL_SEC_DEFAUT);
      setPlafond(s.user?.plafondQuotidien ?? 0);
      setPompesMax(s.user?.pompesMax ?? 0);
      setPompesMaxLe(s.user?.pompesMaxLe ?? null);
    });
  }, []);

  // Résumés affichés à droite des lignes de la liste. Lus ici et non dans les
  // rubriques : il faut les connaître AVANT d'ouvrir, sans quoi la liste
  // n'annoncerait rien tant qu'on n'a pas déjà été voir.
  useEffect(() => {
    const pont = typeof window !== "undefined" ? window.electronLOL : undefined;
    if (!pont) return;
    pont.overlayJeuxLire?.().then((e) => setNbJeux(e.jeux.length)).catch(() => {});
    pont.version?.().then(setVersion).catch(() => {});
  }, []);

  /**
   * Enregistre le résultat du test de force. La date de passage est posée par
   * le serveur, pas ici — sinon un test périmé pourrait passer pour récent.
   */
  const handleSavePompesMax = async (valeur: number) => {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userPrefs: { pompesMax: valeur } }),
    });
    if (res.ok) {
      setPompesMax(valeur);
      setPompesMaxLe(new Date().toISOString());
    }
  };

  const handleSaveExo = async (nextExercices: ExerciceId[], nextSeuil: number) => {
    setExercicesSel(nextExercices);
    setRappelSeuil(nextSeuil);
    setSavingExo(true);
    setSavedExo(false);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userPrefs: { exercices: nextExercices, rappelSeuilPoints: nextSeuil },
      }),
    });
    setSavingExo(false);
    if (res.ok) {
      setSavedExo(true);
      setTimeout(() => setSavedExo(false), 2000);
    }
  };

  /** Enregistre l'avertissement de volume quotidien, en points d'effort. */
  const handleSavePlafond = async (nextPlafond: number) => {
    setPlafond(nextPlafond);
    setSavingExo(true);
    setSavedExo(false);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userPrefs: { plafondQuotidien: nextPlafond } }),
    });
    setSavingExo(false);
    if (res.ok) {
      setSavedExo(true);
      setTimeout(() => setSavedExo(false), 2000);
    }
  };

  /** Enregistre le seuil du compteur de boxe, en secondes d'effort. */
  const handleSaveSeuilSec = async (nextSeuilSec: number) => {
    setSeuilSec(nextSeuilSec);
    setSavingExo(true);
    setSavedExo(false);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userPrefs: { rappelSeuilSec: nextSeuilSec } }),
    });
    setSavingExo(false);
    if (res.ok) {
      setSavedExo(true);
      setTimeout(() => setSavedExo(false), 2000);
      // La pastille relit son seuil sans recharger la page.
      window.dispatchEvent(new Event("wow-dette-changee"));
    }
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setSavedProfile(false);
    setProfileError("");
    const res = await fetch("/api/user", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileForm),
    });
    setSavingProfile(false);
    if (res.ok) {
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2000);
    } else {
      const err = await res.json().catch(() => ({}));
      setProfileError(err.error ? translateApiError(err.error, locale) : t.erreurSauvegarde);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleWeights, levelConfigs, masteryConfig }),
    });
    setSavingSettings(false);
    setSavedSettings(true);
    setTimeout(() => setSavedSettings(false), 2000);
  };

  const updateRole = (role: string, field: keyof RoleWeight, value: string | boolean) => {
    setRoleWeights((prev) => prev.map((r) => r.role === role ? { ...r, [field]: value } : r));
  };

  const updateLevel = (niveau: number, field: keyof LevelConfig, value: string) => {
    setLevelConfigs((prev) => prev.map((l) => l.niveau === niveau ? { ...l, [field]: Number(value) } : l));
  };

  // Niveau tiré du test de force : sert de résumé sur la ligne « Ton effort »,
  // pour ne pas avoir à ouvrir la rubrique juste pour le lire.
  const niveauActuel = pompesMax > 0 && levelConfigs.length > 0
    ? getLevelParPompes(pompesMax, levelConfigs).niveau
    : null;

  const rubriques: {
    id: Rubrique; icone: NomIcone; titre: string; aide: string; valeur?: string;
  }[] = [
    { id: "profil", icone: "personne", titre: t.profil, aide: t.rubriqueProfilAide, valeur: profileForm.pseudo || undefined },
    {
      id: "effort", icone: "muscle", titre: t.sectionEffort, aide: t.rubriqueEffortAide,
      valeur: niveauActuel ? t.valeurNiveau(niveauActuel) : t.valeurTestAFaire,
    },
    { id: "jeux", icone: "manette", titre: t.sectionJeux, aide: t.rubriqueJeuxAide, valeur: nbJeux ? t.valeurJeux(nbJeux) : undefined },
    ...(surDesktop
      ? [{ id: "application" as Rubrique, icone: "moniteur" as NomIcone, titre: t.sectionApplication, aide: t.rubriqueApplicationAide, valeur: version ?? undefined }]
      : []),
    { id: "donnees", icone: "telecharger", titre: t.exportTitre, aide: t.rubriqueDonneesAide },
    ...(betaRank !== null
      ? [{ id: "avance" as Rubrique, icone: "cerveau" as NomIcone, titre: t.parametresAvancesBeta, aide: t.rubriqueAvanceAide }]
      : []),
  ];

  // ── La liste des rubriques ────────────────────────────────────────────────
  if (rubrique === null) {
    return (
      <div className="space-y-6">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <h1 style={{ fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)", fontSize: "1.5rem", color: "#ECEFF4", letterSpacing: "0.18em" }}>{t.title}</h1>
          {betaRank !== null && (
            <span style={{
              fontSize: "0.65rem", letterSpacing: "0.1em", color: "rgba(152,162,176,0.5)",
              background: "rgba(152,162,176,0.07)", border: "1px solid rgba(152,162,176,0.15)",
              borderRadius: 3, padding: "2px 8px",
            }}>
              {t.betaRank(betaRank)}
            </span>
          )}
        </div>

        <div className="lol-panel" style={{ padding: 0, overflow: "hidden" }}>
          {rubriques.map((r, i) => (
            <LigneRubrique
              key={r.id}
              id={r.id}
              icone={r.icone}
              titre={r.titre}
              aide={r.aide}
              valeur={r.valeur}
              premiere={i === 0}
              derniere={i === rubriques.length - 1}
              onOuvrir={() => ouvrirRubrique(r.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  const titreRubrique = rubriques.find((r) => r.id === rubrique)?.titre ?? t.title;

  return (
    <div className="space-y-6">
      <EnteteRubrique titre={titreRubrique} retour={t.retourListe} />

      {/* ── Profil : qui tu es, et ce que tu vises ──────────────────────── */}
      {rubrique === "profil" && (
      <div className="lol-panel p-5 space-y-4">
        <div>
          <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{t.pseudoAffiche}</label>
          <input
            className="lol-input"
            value={profileForm.pseudo}
            onChange={(e) => setProfileForm((f) => ({ ...f, pseudo: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{t.objectifTotalPompes}</label>
          <input
            type="number" min="0" className="lol-input"
            value={profileForm.objectifTotalPompes}
            onChange={(e) => setProfileForm((f) => ({ ...f, objectifTotalPompes: Number(e.target.value) }))}
          />
        </div>

        {/* Le compte Riot a rejoint le bloc « League of Legends » : c'est une
            information sur un jeu, pas sur la personne. */}

        {profileError && <p className="text-sm loss-text">{profileError}</p>}
        <button className="lol-btn w-full" onClick={handleSaveProfile} disabled={savingProfile}>
          {savingProfile ? t.enregistrementEnCours : savedProfile ? t.profilEnregistre : t.enregistrerProfil}
        </button>
      </div>
      )}

      {/* ── Ton effort : force, exercices, rappels ──────────────────────── */}
      {rubrique === "effort" && (
      <div className="lol-panel p-5 space-y-4">
        <div className="flex items-center justify-end gap-3">
          {savingExo ? (
            <span className="text-xs" style={{ color: "rgba(236,239,244,0.4)" }}>…</span>
          ) : savedExo ? (
            <span className="win-text"><Icone nom="coche" taille={14} titre={t.enregistre} /></span>
          ) : null}
        </div>
        <p className="text-xs" style={{ color: "rgba(236,239,244,0.45)", lineHeight: 1.6 }}>
          {t.sectionEffortAide}
        </p>

        {/* Le test de force vient en premier : c'est lui qui fixe le
            multiplicateur appliqué à toute la dette. Tout le reste en découle,
            et il était enterré sous quatre réglages. */}
        <TestPompes
          pompesMax={pompesMax}
          faitLe={pompesMaxLe}
          niveaux={levelConfigs}
          onEnregistre={handleSavePompesMax}
        />

        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }} className="space-y-3">
          <h2 style={HEADING}>{tExo.sectionTitle}</h2>
          <p className="text-xs" style={{ color: "rgba(236,239,244,0.45)", lineHeight: 1.6 }}>
            {tExo.sectionHint}
          </p>
          <ExerciceSelector selection={exercicesSel} onChange={(next) => handleSaveExo(next, rappelSeuil)} />

          {exercicesSel.length > 1 && (
            <p className="text-xs" style={{ color: "var(--amber)" }}>{tExo.rotationActive(exercicesSel.length)}</p>
          )}
          <p className="text-xs" style={{ color: "rgba(236,239,244,0.35)" }}>{tExo.exempleIntro}</p>
        </div>

        {/* Rappel en session */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }} className="space-y-3">
          <h2 style={HEADING}>{tExo.rappelTitle}</h2>
          <p className="text-xs" style={{ color: "rgba(236,239,244,0.45)", lineHeight: 1.6 }}>
            {tExo.rappelSeuilAide}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {RAPPEL_SEUILS_SEC.map((seuil) => {
              const actif = seuil === seuilSec;
              return (
                <button
                  key={seuil}
                  onClick={() => handleSaveSeuilSec(seuil)}
                  aria-pressed={actif}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    background: actif ? "rgba(255,180,84,0.1)" : "transparent",
                    border: `1px solid ${actif ? "var(--amber)" : "var(--line-strong)"}`,
                    color: actif ? "var(--amber)" : "rgba(236,239,244,0.6)",
                    transition: "all 0.15s",
                  }}
                >
                  {seuil === 0
                    ? tExo.rappelDesactive
                    : tExo.rappelSeuilValeur(seuil % 60 === 0 ? `${seuil / 60} min` : `${seuil} s`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Avertissement de volume quotidien */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }} className="space-y-3">
          <h2 style={HEADING}>{tExo.plafondTitre}</h2>
          <p className="text-xs" style={{ color: "rgba(236,239,244,0.45)", lineHeight: 1.6 }}>
            {tExo.plafondAide}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PLAFONDS_QUOTIDIENS.map((valeur) => {
              const actif = valeur === plafond;
              return (
                <button
                  key={valeur}
                  onClick={() => handleSavePlafond(valeur)}
                  aria-pressed={actif}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    background: actif ? "rgba(255,180,84,0.1)" : "transparent",
                    border: `1px solid ${actif ? "var(--amber)" : "var(--line-strong)"}`,
                    color: actif ? "var(--amber)" : "rgba(236,239,244,0.6)",
                    transition: "all 0.15s",
                  }}
                >
                  {valeur === 0 ? tExo.plafondDesactive : tExo.plafondValeur(valeur)}
                </button>
              );
            })}
          </div>

          {/* « 300 points » ne dit rien à personne. Ce que ça donne dans les
              trois exercices, si. */}
          {plafond > 0 && (
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 18,
              paddingTop: 4,
            }}>
              {EXERCICE_IDS.map((id) => (
                <div key={id}>
                  <div className="mono-num" style={{
                    fontSize: "1.05rem", fontWeight: 600, color: "var(--amber)", lineHeight: 1.2,
                  }}>
                    {formaterCompact(plafond, id)}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "rgba(236,239,244,0.45)" }}>
                    {EXO_LABELS[id].nom.toLowerCase()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <ReglageNotifications />
      </div>
      )}

      {/* ── Tes jeux : un bloc dépliable par jeu ────────────────────────── */}
      {rubrique === "jeux" && (
      <div className="lol-panel p-5 space-y-4">
        <p className="text-xs" style={{ color: "rgba(236,239,244,0.45)", lineHeight: 1.6 }}>
          {t.sectionJeuxAide}
        </p>
        <ReglageJeux />
      </div>
      )}

      {/* ── Application desktop ─────────────────────────────────────────── */}
      {rubrique === "application" && (
        <div className="lol-panel p-5 space-y-4">
          <ReglageDetection />
          <ReglageApplication />
        </div>
      )}

      {/* ── Panneau Beta (coefficients) ─────────────────────────────────── */}
      {rubrique === "avance" && betaRank !== null && masteryConfig && (
        <div>
            <div className="lol-panel p-5 space-y-6">

              <p style={{ fontSize: "0.78rem", color: "rgba(236,239,244,0.4)", lineHeight: 1.6 }}>
                {t.betaExplication}
              </p>

              {/* Poids par rôle */}
              <div className="space-y-3">
                <h2 style={HEADING}>{t.poidsParRole}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ color: "rgba(152,162,176,0.6)" }} className="text-xs uppercase tracking-wider">
                        <th className="text-left py-2 pr-3">{t.role}</th>
                        <th className="text-center py-2 px-2">{t.poidsMorts}</th>
                        <th className="text-center py-2 px-2">{t.poidsKills}</th>
                        <th className="text-center py-2 px-2">{t.poidsAssists}</th>
                        <th className="text-center py-2 px-2">{t.maitrise}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roleWeights.map((rw) => (
                        <tr key={rw.role} style={{ borderTop: "1px solid rgba(152,162,176,0.1)" }}>
                          <td className="py-2 pr-3 gold-text font-medium">{rw.role}</td>
                          {(["poidsMort", "poidsKill", "poidsAssist"] as const).map((field) => (
                            <td key={field} className="py-2 px-2 text-center">
                              <input
                                type="number" step="0.1" min="0"
                                className="lol-input text-center w-20"
                                value={rw[field]}
                                onChange={(e) => updateRole(rw.role, field, e.target.value)}
                              />
                            </td>
                          ))}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="checkbox"
                              checked={rw.maitriseActive}
                              onChange={(e) => updateRole(rw.role, "maitriseActive", e.target.checked)}
                              className="w-4 h-4 accent-yellow-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Niveaux */}
              <div className="space-y-3">
                <h2 style={HEADING}>{t.niveauxGainage}</h2>
                <p className="text-xs" style={{ color: "rgba(236,239,244,0.4)" }}>
                  {t.niveauxExplication}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ color: "rgba(152,162,176,0.6)" }} className="text-xs uppercase tracking-wider">
                        <th className="text-left py-2 pr-3">{t.niveau}</th>
                        <th className="text-center py-2 px-2">{t.seuilPompes}</th>
                        <th className="text-center py-2 px-2">{t.multiplicateur}</th>
                        <th className="text-center py-2 px-2">{t.malusDefaite}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levelConfigs.map((lc) => (
                        <tr key={lc.niveau} style={{ borderTop: "1px solid rgba(152,162,176,0.1)" }}>
                          <td className="py-2 pr-3 gold-text font-bold">{t.niveauAbrev(lc.niveau)}</td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number" min="1"
                              className="lol-input text-center w-24"
                              value={lc.niveau === 5 ? "∞" : lc.seuilPompes ?? ""}
                              readOnly={lc.niveau === 5}
                              style={lc.niveau === 5 ? { opacity: 0.5, cursor: "not-allowed" } : {}}
                              onChange={(e) => lc.niveau !== 5 && updateLevel(lc.niveau, "seuilPompes", e.target.value)}
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number" step="0.01" min="0"
                              className="lol-input text-center w-24"
                              value={lc.multiplicateur}
                              onChange={(e) => updateLevel(lc.niveau, "multiplicateur", e.target.value)}
                            />
                          </td>
                          <td className="py-2 px-2 text-center">
                            <input
                              type="number" min="0"
                              className="lol-input text-center w-20"
                              value={lc.malusDefaite}
                              onChange={(e) => updateLevel(lc.niveau, "malusDefaite", e.target.value)}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Maîtrise */}
              <div className="space-y-4">
                <h2 style={HEADING}>{t.parametresMaitrise}</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>
                      {t.surchargeMax(Math.round(masteryConfig.surchargeMax * 100))}
                    </label>
                    <input
                      type="number" step="0.01" min="0" max="2"
                      className="lol-input"
                      value={masteryConfig.surchargeMax}
                      onChange={(e) => setMasteryConfig((m) => m ? { ...m, surchargeMax: Number(e.target.value) } : m)}
                    />
                    <p className="text-xs mt-1" style={{ color: "rgba(236,239,244,0.4)" }}>{t.surchargeMaxDetail}</p>
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>{t.partiesPourMax}</label>
                    <input
                      type="number" min="1"
                      className="lol-input"
                      value={masteryConfig.partiesPourMax}
                      onChange={(e) => setMasteryConfig((m) => m ? { ...m, partiesPourMax: Number(e.target.value) } : m)}
                    />
                    <p className="text-xs mt-1" style={{ color: "rgba(236,239,244,0.4)" }}>{t.partiesPourMaxDetail}</p>
                  </div>
                </div>
              </div>

              <button className="lol-btn w-full text-base" onClick={handleSaveSettings} disabled={savingSettings}>
                {savingSettings ? t.enregistrementEnCours : savedSettings ? t.reglagesSauvegardes : t.sauvegarderReglages}
              </button>

              {/* Outils de test bêta */}
              <div style={{ borderTop: "1px solid rgba(152,162,176,0.1)", paddingTop: "1rem" }}>
                <p style={{ fontSize: "0.7rem", color: "rgba(236,239,244,0.3)", letterSpacing: "0.08em", marginBottom: "0.6rem" }}>
                  {t.outilsDeTest}
                </p>
                <button
                  onClick={() => {
                    oublierPremiereVisite();
                    window.location.href = "/dashboard";
                  }}
                  style={{
                    width: "100%",
                    padding: "0.55rem",
                    background: "transparent",
                    border: "1px dashed rgba(152,162,176,0.2)",
                    borderRadius: 4,
                    color: "rgba(152,162,176,0.45)",
                    fontSize: "0.78rem",
                    cursor: "pointer",
                    letterSpacing: "0.06em",
                  }}
                >
                  {t.rejouerIntro}
                </button>
              </div>
            </div>
        </div>
      )}

      {/* ── Compte et données ──────────────────────────────────────────── */}
      {/* Portabilité des données : un droit, et deux lignes de code. La
          déconnexion les rejoint : elle concerne le compte, pas un réglage, et
          traînait au milieu de la page. */}
      {rubrique === "donnees" && (<>
      <div className="lol-panel p-5 space-y-3">
        <p style={{ fontSize: "0.8rem", color: "rgba(236,239,244,0.5)", lineHeight: 1.6 }}>
          {t.exportAide}
        </p>
        <a
          href="/api/user/export"
          download
          className="lol-btn text-sm"
          style={{ display: "inline-block", textDecoration: "none" }}
        >
          {t.exportBouton}
        </a>

        <form action={logout} style={{ borderTop: "1px solid var(--line)", paddingTop: 14, marginTop: 14 }}>
          <button type="submit" className="lol-btn lol-btn-danger w-full">
            {t.seDeconnecter}
          </button>
        </form>
      </div>

      <div style={{
        marginTop: "1.5rem",
        padding: "1.25rem",
        borderRadius: 6,
        border: "1px solid rgba(255,90,71,0.3)",
        background: "rgba(255,90,71,0.04)",
      }}>
        <h2 style={{ ...HEADING, color: "#FF5A47" }}>{t.zoneDeDanger}</h2>
        <p style={{ fontSize: "0.8rem", color: "rgba(236,239,244,0.5)", lineHeight: 1.6, margin: "0.75rem 0 1rem" }}>
          {t.suppressionExplication}
        </p>
        <button
          onClick={() => { setShowDeleteModal(true); setDeleteConfirm(""); }}
          style={{
            width: "100%",
            padding: "0.6rem",
            background: "transparent",
            border: "1px solid rgba(255,90,71,0.5)",
            borderRadius: 4,
            color: "#FF5A47",
            fontSize: "0.85rem",
            fontWeight: 600,
            letterSpacing: "0.04em",
            cursor: "pointer",
          }}
        >
          {t.supprimerMonCompte}
        </button>
      </div>
      </>)}

      {/* Modal de confirmation */}
      {showDeleteModal && (
        <div
          onClick={() => !deleting && setShowDeleteModal(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.7)", padding: "1rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="lol-panel"
            style={{ maxWidth: 420, width: "100%", padding: "1.75rem" }}
          >
            <h3 style={{
              fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
              fontSize: "1.05rem", color: "#FF5A47", letterSpacing: "0.1em", marginBottom: "0.75rem",
            }}>
              {t.supprimerLeCompte}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "rgba(236,239,244,0.6)", lineHeight: 1.6, marginBottom: "1rem" }}>
              {locale === "fr" ? (
                <>Cette action est irréversible. Pour confirmer, tapez{" "}
                  <strong style={{ color: "#FF5A47" }}>{t.confirmMot}</strong> ci-dessous.</>
              ) : (
                <>This action is irreversible. To confirm, type{" "}
                  <strong style={{ color: "#FF5A47" }}>{t.confirmMot}</strong> below.</>
              )}
            </p>
            <input
              autoFocus
              className="lol-input w-full"
              placeholder={t.confirmMot}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              style={{ marginBottom: "1rem" }}
            />
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{
                  flex: 1, padding: "0.55rem",
                  background: "transparent",
                  border: "1px solid rgba(152,162,176,0.3)",
                  borderRadius: 4, color: "rgba(236,239,244,0.7)",
                  fontSize: "0.85rem", cursor: "pointer",
                }}
              >
                {t.annuler}
              </button>
              <button
                onClick={async () => { setDeleting(true); await deleteAccount(); }}
                disabled={deleteConfirm !== t.confirmMot || deleting}
                style={{
                  flex: 1, padding: "0.55rem",
                  background: deleteConfirm === t.confirmMot ? "#FF5A47" : "rgba(255,90,71,0.25)",
                  border: "none", borderRadius: 4, color: "#fff",
                  fontSize: "0.85rem", fontWeight: 600,
                  cursor: deleteConfirm === t.confirmMot && !deleting ? "pointer" : "not-allowed",
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                {deleting ? t.suppressionEnCours : t.supprimerDefinitivement}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
