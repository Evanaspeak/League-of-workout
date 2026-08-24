"use client";
import { useEffect, useState } from "react";
import { descriptionsExercices, nomsExercices } from "@/lib/nomsExercices";
import { logout } from "@/lib/actions";
import { useT, useLocale, useMinuscule } from "@/lib/i18n/LocaleContext";
import { settings as settingsDict } from "@/lib/i18n/dictionaries/settings";
import { exercices as exercicesDict } from "@/lib/i18n/dictionaries/exercices";
import { translateApiError } from "@/lib/i18n/apiErrors";
import {
  EXERCICE_DEFAUT, RAPPEL_SEUIL_DEFAUT, RAPPEL_SEUILS_SEC, RAPPEL_SEUIL_SEC_DEFAUT,
  PLAFONDS_QUOTIDIENS, EXERCICE_IDS, formaterCompact, toExerciceIds, type ExerciceId,
} from "@/lib/exercices";
import { ExerciceSelector } from "@/components/ExerciceSelector";
import { MesuresPhysiques } from "@/components/MesuresPhysiques";
import { SimulateurDette } from "@/components/SimulateurDette";
import { SuspensionExercice } from "@/components/SuspensionExercice";
import { SourceObs } from "@/components/SourceObs";
import { JournalSynchro } from "@/components/JournalSynchro";
import { ReglageNotifications } from "@/components/ReglageNotifications";
import { ReglageJeux } from "@/components/ReglageJeux";
import { Icone } from "@/components/Icone";
import { ReglageApplication } from "@/components/ReglageApplication";
import { ReglageDetection } from "@/components/ReglageDetection";
import { TestPompes } from "@/components/TestPompes";
import { useValeurClient } from "@/lib/valeurClient";
import { getLevelParPompes } from "@/lib/scoring";
import {
  EnteteRubrique, LigneRubrique, ouvrirRubrique, useRubrique,
} from "@/components/ListeReglages";
import type { NomIcone } from "@/components/Icone";
import { ReglagesAvances, type LevelConfig } from "./ReglagesAvances";

// ─── Types ───────────────────────────────────────────────────────────────────


/**
 * Rubriques des réglages, dans l'ordre de la liste. L'identifiant est aussi le
 * fragment d'adresse : `/settings#jeux` ouvre les jeux.
 */
const RUBRIQUES = ["profil", "effort", "jeux", "application", "donnees", "avance"] as const;
type Rubrique = (typeof RUBRIQUES)[number];

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const t = useT(settingsDict);
  const minuscule = useMinuscule();
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

  const nomsExo = nomsExercices(tExo);
  const descsExo = descriptionsExercices(tExo);
  const EXO_LABELS = Object.fromEntries(
    EXERCICE_IDS.map((id) => [id, { nom: nomsExo[id], desc: descsExo[id] }]),
  ) as Record<ExerciceId, { nom: string; desc: string }>;

  /** « 38 pompes » pour les répétitions, « 4 min 26 » pour le temps. */
  // ── Profile ──
  // Le compte Riot n'est plus ici : il vit dans le bloc « League of Legends »
  // des jeux, avec sa propre sauvegarde.
  const [profileForm, setProfileForm] = useState({ pseudo: "", objectifTotalPompes: 1000 });
  const [betaRank, setBetaRank] = useState<number | null>(null);
  // Les coefficients réglés dans la rubrique « avancé » sont communs à tous les
  // comptes. La route ne laisse plus que l'administration les écrire ; l'écran
  // suit, sinon le panneau resterait ouvert pour ne rendre qu'un refus.
  const [estAdmin, setEstAdmin] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savedProfile, setSavedProfile] = useState(false);
  const [profileError, setProfileError] = useState("");

  // ── Suppression de compte ──
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [erreurSuppression, setErreurSuppression] = useState(false);


  /**
   * Les paliers du barème, partagés avec la rubrique « Avancé ».
   *
   * La page les lit pour afficher le niveau du compte sur la ligne « Ton
   * effort » ; le panneau avancé les modifie. Un état par côté ferait diverger
   * les deux affichages dès la première correction.
   */
  const [levelConfigs, setLevelConfigs] = useState<LevelConfig[]>([]);

  // ── Exercice & rappel ──
  const [exercicesSel, setExercicesSel] = useState<ExerciceId[]>([EXERCICE_DEFAUT]);
  const [rappelSeuil, setRappelSeuil] = useState<number>(RAPPEL_SEUIL_DEFAUT);
  // Seuil du compteur de boxe, en secondes d'effort.
  const [seuilSec, setSeuilSec] = useState<number>(RAPPEL_SEUIL_SEC_DEFAUT);
  // Avertissement de volume quotidien, en points d'effort. 0 = désactivé.
  const [plafond, setPlafond] = useState<number>(0);
  /** Variante d'exécution des pompes déclarée pour soi : "genoux" ou rien. */
  const [variante, setVariante] = useState<string | null>(null);
  /** Recevoir le bilan hebdomadaire par courriel. */
  const [bilanActif, setBilanActif] = useState(true);
  const [savingExo, setSavingExo] = useState(false);
  const [savedExo, setSavedExo] = useState(false);
  const [erreurExo, setErreurExo] = useState(false);

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
      setEstAdmin(Boolean(u.estAdmin));
      // Repli explicite : une réponse incomplète posait `undefined` dans ces
      // états, et la liste des rubriques — qui lit `levelConfigs.length` pour
      // afficher le niveau — emportait alors toute la page.
      setLevelConfigs(Array.isArray(s.levelConfigs) ? s.levelConfigs : []);
      setExercicesSel(toExerciceIds(s.user?.exercices));
      setRappelSeuil(s.user?.rappelSeuilPoints ?? RAPPEL_SEUIL_DEFAUT);
      setSeuilSec(s.user?.rappelSeuilSec ?? RAPPEL_SEUIL_SEC_DEFAUT);
      setPlafond(s.user?.plafondQuotidien ?? 0);
      setVariante(s.user?.variantePompes ?? null);
      setBilanActif(s.user?.bilanActif !== false);
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
  /**
   * Enregistre un réglage, et dit quand ça n'a pas marché.
   *
   * Les cinq réglages de cette page posaient la nouvelle valeur à l'écran
   * AVANT de l'envoyer, et ne faisaient rien du refus : l'écran affichait donc
   * un réglage que le serveur n'avait pas. On s'en apercevait au rechargement
   * suivant, sans savoir pourquoi — et sur cette page, un exercice ou un
   * plafond mal enregistré change ce qu'on doit.
   *
   * Le `fetch` n'était pas protégé non plus : sans réseau, la promesse partait
   * en erreur, `setSavingExo(false)` n'était jamais atteint, et
   * « Enregistrement… » restait à l'écran pour toujours.
   *
   * `revenir` remet la valeur d'avant. Un réglage que le serveur n'a pas pris
   * doit disparaître de l'écran, sans quoi le message d'erreur et ce qu'on
   * voit se contredisent.
   */
  const enregistrerReglage = async (
    userPrefs: Record<string, unknown>,
    revenir: () => void,
  ): Promise<boolean> => {
    setSavingExo(true);
    setSavedExo(false);
    setErreurExo(false);
    let ok = false;
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPrefs }),
      });
      ok = res.ok;
    } catch {
      ok = false;
    }
    setSavingExo(false);
    if (ok) {
      setSavedExo(true);
      setTimeout(() => setSavedExo(false), 2000);
    } else {
      revenir();
      setErreurExo(true);
    }
    return ok;
  };

  /**
   * Le test de force, qui fixe le niveau — donc tout le reste.
   *
   * Il ne disait rien de son échec : la fenêtre se refermait, le chiffre
   * n'était pas posé, et personne ne savait pourquoi. C'est le réglage dont
   * une perte coûte le plus cher, puisque toute la dette en découle.
   */
  const handleSavePompesMax = async (valeur: number) => {
    const avantMax = pompesMax;
    const avantLe = pompesMaxLe;
    setPompesMax(valeur);
    setPompesMaxLe(new Date().toISOString());
    await enregistrerReglage(
      { pompesMax: valeur },
      () => { setPompesMax(avantMax); setPompesMaxLe(avantLe); },
    );
  };

  const handleSaveExo = async (nextExercices: ExerciceId[], nextSeuil: number) => {
    const avantExercices = exercicesSel;
    const avantSeuil = rappelSeuil;
    setExercicesSel(nextExercices);
    setRappelSeuil(nextSeuil);
    await enregistrerReglage(
      { exercices: nextExercices, rappelSeuilPoints: nextSeuil },
      () => { setExercicesSel(avantExercices); setRappelSeuil(avantSeuil); },
    );
  };

  /**
   * Déclare — ou retire — la variante d'exécution des pompes.
   *
   * Le retrait ne réécrit rien : les parties déjà enregistrées gardent leur
   * annotation. C'est tout l'intérêt, on veut pouvoir relire d'où on part.
   */
  const handleSaveVariante = async (prochaine: string | null) => {
    const avant = variante;
    setVariante(prochaine);
    await enregistrerReglage({ variantePompes: prochaine }, () => setVariante(avant));
  };

  /**
   * Allume ou coupe le bilan hebdomadaire.
   *
   * Un envoi récurrent sans bouton d'arrêt n'est pas un service rendu : celui
   * qui ne peut pas l'éteindre se désabonne de tout, y compris de ce qui lui
   * servait.
   */
  const handleSaveBilan = async (actif: boolean) => {
    const avant = bilanActif;
    setBilanActif(actif);
    await enregistrerReglage({ bilanActif: actif }, () => setBilanActif(avant));
  };

  /** Enregistre l'avertissement de volume quotidien, en points d'effort. */
  const handleSavePlafond = async (nextPlafond: number) => {
    const avant = plafond;
    setPlafond(nextPlafond);
    await enregistrerReglage({ plafondQuotidien: nextPlafond }, () => setPlafond(avant));
  };

  /** Enregistre le seuil du compteur de boxe, en secondes d'effort. */
  const handleSaveSeuilSec = async (nextSeuilSec: number) => {
    const avant = seuilSec;
    setSeuilSec(nextSeuilSec);
    const ok = await enregistrerReglage(
      { rappelSeuilSec: nextSeuilSec }, () => setSeuilSec(avant));
    // La pastille relit son seuil sans recharger la page.
    if (ok) window.dispatchEvent(new Event("wow-dette-changee"));
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setSavedProfile(false);
    setProfileError("");
    // Sans ce `try`, une coupure réseau laissait « Enregistrement… » à
    // l'écran pour toujours : la promesse partait en erreur et la ligne qui
    // l'efface n'était jamais atteinte.
    let res: Response;
    try {
      res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
    } catch {
      setSavingProfile(false);
      setProfileError(t.erreurSauvegarde);
      return;
    }
    setSavingProfile(false);
    if (res.ok) {
      setSavedProfile(true);
      setTimeout(() => setSavedProfile(false), 2000);
    } else {
      const err = await res.json().catch(() => ({}));
      setProfileError(err.error ? translateApiError(err.error, locale) : t.erreurSauvegarde);
    }
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
    ...(estAdmin
      ? [{ id: "avance" as Rubrique, icone: "cerveau" as NomIcone, titre: t.parametresAvancesBeta, aide: t.rubriqueAvanceAide }]
      : []),
  ];

  // ── La liste des rubriques ────────────────────────────────────────────────
  if (rubrique === null) {
    return (
      <div className="space-y-6">
        {/* Alignement sur la ligne de base : le titre porte un filet sous le
            mot, et centrer sur toute sa hauteur ferait descendre le badge. */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
          <h1 className="titre-page">{t.title}</h1>
          {betaRank !== null && (
            <span style={{
              fontSize: "0.65rem", letterSpacing: "0.1em", color: "var(--faint)",
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

        {/* La déconnexion reste sur ce premier écran, sous la liste. Rangée
            dans « Données », il fallait deviner derrière quelle rubrique elle
            se cachait pour quitter son compte. Elle n'entre pas dans la liste
            elle-même : les lignes portent un chevron et mènent quelque part,
            alors que celle-ci agit tout de suite. */}
        <form action={logout}>
          <button type="submit" className="lol-btn lol-btn-danger w-full">
            {t.seDeconnecter}
          </button>
        </form>
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
          <label className="block text-xs mb-1" style={{ color: "var(--steel)" }}>{t.pseudoAffiche}</label>
          <input
            className="lol-input"
            value={profileForm.pseudo}
            onChange={(e) => setProfileForm((f) => ({ ...f, pseudo: e.target.value }))}
          />
        </div>

        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--steel)" }}>{t.objectifTotalPompes}</label>
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

      {/* Les mesures physiques vivent dans leur propre bloc : elles portent
          une question de consentement, qui doit pouvoir changer de réponse
          sans recharger le reste des réglages. */}
      {rubrique === "profil" && <MesuresPhysiques />}

      {/* ── Ton effort : force, exercices, rappels ──────────────────────── */}
      {rubrique === "effort" && (
      <div className="lol-panel p-5 space-y-4">
        <div className="flex items-center justify-end gap-3">
          {savingExo ? (
            <span className="text-xs" style={{ color: "var(--faint)" }}>…</span>
          ) : savedExo ? (
            <span className="win-text"><Icone nom="coche" taille={14} titre={t.enregistre} /></span>
          ) : erreurExo ? (
            // Un réglage refusé se dit. Sans ça, l'écran montre une valeur que
            // le serveur n'a pas, et le rechargement suivant la reprend sans
            // explication.
            <span className="loss-text text-xs" role="status">{t.erreurSauvegarde}</span>
          ) : null}
        </div>
        <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
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
          <h2 className="titre-section">{tExo.sectionTitle}</h2>
          <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
            {tExo.sectionHint}
          </p>
          {/* Cette phrase se termine par deux-points : elle annonce les chiffres
              portés par les cartes. Placée après elles, elle n'introduisait
              plus rien et restait suspendue en fin de section. */}
          <p className="text-xs" style={{ color: "var(--faint)" }}>{tExo.exempleIntro}</p>
          <ExerciceSelector selection={exercicesSel} onChange={(next) => handleSaveExo(next, rappelSeuil)} />

          {exercicesSel.length > 1 && (
            <p className="text-xs" style={{ color: "var(--amber)" }}>{tExo.rotationActive(exercicesSel.length)}</p>
          )}

          {/* La variante ne se propose que si les pompes sont de la partie :
              ailleurs, elle ne qualifierait rien. */}
          {exercicesSel.includes("pompes") && (
            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }} className="space-y-2">
              <h3 className="text-sm" style={{ color: "var(--bone)", fontWeight: 600 }}>
                {tExo.varianteTitre}
              </h3>
              <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
                {tExo.varianteAide}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {[
                  { valeur: null, libelle: tExo.varianteInactive },
                  { valeur: "genoux", libelle: tExo.varianteActive },
                ].map(({ valeur, libelle }) => {
                  const actif = valeur === variante;
                  return (
                    <button
                      key={libelle}
                      onClick={() => handleSaveVariante(valeur)}
                      aria-pressed={actif}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 999,
                        cursor: "pointer",
                        fontSize: "0.8rem",
                        background: actif ? "rgba(255,180,84,0.1)" : "transparent",
                        border: `1px solid ${actif ? "var(--amber)" : "var(--line-strong)"}`,
                        color: actif ? "var(--amber)" : "var(--muted)",
                        transition: "all 0.15s",
                      }}
                    >
                      {libelle}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Rappel en session */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }} className="space-y-3">
          <h2 className="titre-section">{tExo.rappelTitle}</h2>
          <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
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
                    color: actif ? "var(--amber)" : "var(--muted)",
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

        {/* Bilan hebdomadaire */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }} className="space-y-3">
          <h2 className="titre-section">{tExo.bilanTitre}</h2>
          <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
            {tExo.bilanAide}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              { valeur: true, libelle: tExo.bilanActif },
              { valeur: false, libelle: tExo.bilanInactif },
            ].map(({ valeur, libelle }) => {
              const actif = valeur === bilanActif;
              return (
                <button
                  key={libelle}
                  onClick={() => handleSaveBilan(valeur)}
                  aria-pressed={actif}
                  style={{
                    padding: "7px 14px",
                    borderRadius: 999,
                    cursor: "pointer",
                    fontSize: "0.8rem",
                    minHeight: 44,
                    background: actif ? "rgba(255,180,84,0.1)" : "transparent",
                    border: `1px solid ${actif ? "var(--amber)" : "var(--line-strong)"}`,
                    color: actif ? "var(--amber)" : "var(--muted)",
                    transition: "all 0.15s",
                  }}
                >
                  {libelle}
                </button>
              );
            })}
          </div>
        </div>

        {/* Avertissement de volume quotidien */}
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }} className="space-y-3">
          <h2 className="titre-section">{tExo.plafondTitre}</h2>
          <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
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
                    color: actif ? "var(--amber)" : "var(--muted)",
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
                  <div style={{ fontSize: "0.7rem", color: "var(--faint)" }}>
                    {minuscule(EXO_LABELS[id].nom)}
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
      {/* Comprendre le barème sans avoir à perdre une partie. Il vit dans
          « Ton effort » : c'est là qu'on règle ce qui le fait varier. */}
      {/* Une gêne ne doit pas obliger à décocher un exercice et à perdre la
          trace de ce qu'on faisait. */}
      {rubrique === "effort" && <SuspensionExercice />}

      {rubrique === "effort" && <SimulateurDette />}

      {/* Le compteur pour le stream vit avec les jeux : c'est en jouant qu'on
          diffuse, et c'est là qu'on va le chercher. */}
      {rubrique === "jeux" && <SourceObs />}

      {/* Pourquoi les parties n'arrivent pas : la boucle avalait toutes les
          erreurs, et rien ne distinguait une panne de Riot d'une soirée sans
          partie. */}
      {rubrique === "jeux" && <JournalSynchro />}

      {rubrique === "jeux" && (
      <div className="lol-panel p-5 space-y-4">
        <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
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
      {/* Les paliers restent partagés : la page les lit pour afficher le
          niveau du compte, et les modifier ici doit continuer de le mettre à
          jour. Le reste — poids par rôle, maîtrise — ne servait qu'ici, et
          était chargé pour tout le monde, y compris pour les comptes qui ne
          verront jamais ce panneau. */}
      {rubrique === "avance" && estAdmin && (
        <ReglagesAvances niveaux={levelConfigs} setNiveaux={setLevelConfigs} />
      )}

      {/* ── Compte et données ──────────────────────────────────────────── */}
      {/* Portabilité des données : un droit, et deux lignes de code. La
          déconnexion, elle, est remontée sur la liste des rubriques : rangée
          ici, il fallait deviner qu'elle se trouvait derrière « Données »
          pour pouvoir quitter son compte. */}
      {rubrique === "donnees" && (<>
      <div className="lol-panel p-5 space-y-3">
        <p style={{ fontSize: "0.8rem", color: "var(--faint)", lineHeight: 1.6 }}>
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
      </div>

      <div style={{
        marginTop: "1.5rem",
        padding: "1.25rem",
        borderRadius: 6,
        border: "1px solid rgba(255,90,71,0.3)",
        background: "rgba(255,90,71,0.04)",
      }}>
        <h2 className="titre-section" style={{ color: "#FF5A47" }}>{t.zoneDeDanger}</h2>
        <p style={{ fontSize: "0.8rem", color: "var(--faint)", lineHeight: 1.6, margin: "0.75rem 0 1rem" }}>
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
          role="dialog"
          aria-modal="true"
          aria-label={t.supprimerDefinitivement}
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
              fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)",
              fontSize: "1.05rem", color: "#FF5A47", letterSpacing: "0.1em", marginBottom: "0.75rem",
            }}>
              {t.supprimerLeCompte}
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: 1.6, marginBottom: "1rem" }}>
              {t.confirmPhraseAvant}
              <strong style={{ color: "#FF5A47" }}>{t.confirmMot}</strong>
              {t.confirmPhraseApres}
            </p>
            <input
              autoFocus
              className="lol-input w-full"
              placeholder={t.confirmMot}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              style={{ marginBottom: "1rem" }}
            />
            {erreurSuppression && (
              <p className="loss-text" role="status" style={{
                fontSize: "0.82rem", marginBottom: "0.8rem", lineHeight: 1.5,
              }}>
                {t.erreurSauvegarde}
              </p>
            )}
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{
                  flex: 1, padding: "0.55rem",
                  background: "transparent",
                  border: "1px solid rgba(152,162,176,0.3)",
                  borderRadius: 4, color: "var(--bone)",
                  fontSize: "0.85rem", cursor: "pointer",
                }}
              >
                {t.annuler}
              </button>
              <button
                /**
                 * La suppression passe par une route, pas par une action.
                 *
                 * Elle passait par l'action serveur `deleteAccount`, et si la
                 * base ne répondait pas, « Suppression… » restait à l'écran
                 * pour toujours : la personne croyait que son compte
                 * s'effaçait, et il n'en était rien.
                 *
                 * Un `try/catch` autour de l'appel n'y changeait rien, et
                 * c'est la mesure qui l'a montré : le client Next ne rejette
                 * pas la promesse quand l'action répond mal, il remonte
                 * l'erreur à la page. Le `await` ne rend jamais la main, donc
                 * ni le `catch` ni le `finally` ne sont atteints.
                 *
                 * Une route ordinaire répond ce qu'elle a fait, et l'écran
                 * sait le lire. La déconnexion reste une action : elle n'écrit
                 * rien en base, et elle redirige.
                 */
                onClick={async () => {
                  setDeleting(true);
                  setErreurSuppression(false);
                  try {
                    const res = await fetch("/api/user", { method: "DELETE" });
                    if (!res.ok) {
                      setErreurSuppression(true);
                      setDeleting(false);
                      return;
                    }
                    // La déconnexion n'écrit rien en base : elle ne peut pas
                    // échouer pour la raison qui vient d'être traitée, et elle
                    // redirige, donc rien ne revient ici.
                    await logout();
                  } catch {
                    setErreurSuppression(true);
                    setDeleting(false);
                  }
                }}
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
