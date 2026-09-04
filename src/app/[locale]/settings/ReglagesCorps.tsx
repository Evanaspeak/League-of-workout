"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { settings as settingsDict } from "@/lib/i18n/dictionaries/settings";
import {
  MULTIPLICATEURS, imc, masseGrasse, mesuresCompletes, objectifCalorique,
  type FormuleCalorique, type ModeCalorique, type NiveauActivite,
} from "@/lib/objectifCalorique";

/**
 * La rubrique « Ton corps » : l'objectif calorique et le mètre-ruban.
 *
 * Étape 05 du plan. Elle vit dans son propre fichier pour la raison qui avait
 * fait sortir « Avancé » : `settings/page.tsx` fait déjà sept cent quatre-vingts
 * lignes, et celles-ci ne partagent avec le reste que le poids, la taille et
 * l'âge — qui sont déjà des états de la page.
 *
 * **Réponse 014, « visible mais discret » :** une rubrique dans la liste des
 * réglages, comme les autres. Pas un onglet de navigation, pas une carte sur le
 * tableau de bord. Quelqu'un qui vient pour le jeu doit pouvoir l'ignorer toute
 * sa vie sans jamais buter dessus.
 *
 * **Réponse 013, « une option qu'on active » :** tout est éteint tant qu'aucun
 * mode n'est choisi, et c'est le mode qui sert d'interrupteur — pas un booléen
 * de plus qui pourrait le contredire.
 */

const ACTIVITES = Object.keys(MULTIPLICATEURS) as NiveauActivite[];
const MODES: ModeCalorique[] = ["perte", "maintien", "prise"];

export type CorpsPrefs = {
  formuleCalorique: FormuleCalorique | null;
  niveauActivite: NiveauActivite | null;
  modeCalorique: ModeCalorique | null;
  poidsCible: number | null;
  tourTaille: number | null;
  tourCou: number | null;
  tourHanches: number | null;
};

export function ReglagesCorps({
  prefs, setPrefs, poids, taille, age, enregistrer,
}: {
  prefs: CorpsPrefs;
  setPrefs: (maj: (p: CorpsPrefs) => CorpsPrefs) => void;
  poids: number | null;
  taille: number | null;
  age: number | null;
  /**
   * Le même chemin d'enregistrement que le reste de la page.
   *
   * Il porte quatre règles qui ont chacune leur raison écrite là-bas : le
   * `try` autour de l'envoi, le message d'échec, le retour à la valeur d'avant
   * quand le serveur refuse, et l'indicateur d'attente. Écrire un second
   * enregistrement ici les aurait recopiées toutes les quatre — et c'est le
   * motif que ce projet paie en boucle.
   */
  enregistrer: (userPrefs: Record<string, unknown>, revenir: () => void) => Promise<unknown>;
}) {
  const t = useT(settingsDict);
  const [peseeKg, setPeseeKg] = useState("");
  const [peseeEtat, setPeseeEtat] = useState<"" | "envoi" | "ok" | "echec">("");

  /** Enregistre un réglage en revenant en arrière si le serveur refuse. */
  const poser = <K extends keyof CorpsPrefs>(cle: K, valeur: CorpsPrefs[K]) => {
    const avant = prefs[cle];
    setPrefs((p) => ({ ...p, [cle]: valeur }));
    void enregistrer({ [cle]: valeur }, () => setPrefs((p) => ({ ...p, [cle]: avant })));
  };

  const mesures = {
    formule: prefs.formuleCalorique ?? undefined,
    poids: poids ?? undefined,
    taille: taille ?? undefined,
    age: age ?? undefined,
    activite: prefs.niveauActivite ?? undefined,
  };
  const objectif = prefs.modeCalorique && mesuresCompletes(mesures)
    ? objectifCalorique(mesures, prefs.modeCalorique)
    : null;

  const graisse = prefs.formuleCalorique && taille && prefs.tourTaille && prefs.tourCou
    ? masseGrasse(prefs.formuleCalorique, taille, prefs.tourTaille, prefs.tourCou, prefs.tourHanches)
    : null;

  /**
   * Enregistre une pesée.
   *
   * Elle ne passe PAS par `/api/settings` : une pesée est une ligne du
   * registre, pas un réglage. Le poids part en GRAMMES, comme la colonne le
   * demande, parce que quelqu'un qui se pèse à 78,4 kg doit pouvoir l'écrire.
   */
  const peser = async () => {
    const kg = Number(peseeKg.replace(",", "."));
    if (!Number.isFinite(kg) || kg <= 0) { setPeseeEtat("echec"); return; }
    setPeseeEtat("envoi");
    try {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      const res = await fetch("/api/pesees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grammes: Math.round(kg * 1000),
          jour: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
        }),
      });
      // Un 500 ou une session expirée traversent `if (res.ok)` sans rien dire :
      // la saisie disparaîtrait en silence, ce que ce projet corrige en boucle.
      setPeseeEtat(res.ok ? "ok" : "echec");
      if (res.ok) setPeseeKg("");
    } catch {
      setPeseeEtat("echec");
    }
  };

  const indice = poids && taille ? imc(poids, taille) : null;

  return (
    <div className="space-y-6">
      <div className="lol-panel space-y-4">
        <div>
          <h2 className="titre-section">{t.corpsTitre}</h2>
          <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>{t.corpsAide}</p>
        </div>

        {/*
          Le MODE est l'interrupteur. Un booléen séparé pourrait le contredire —
          « activé » avec aucun mode, ou l'inverse — et il faudrait alors
          décider lequel des deux fait foi.
        */}
        <div>
          <label className="text-xs" style={{ color: "var(--muted)" }}>{t.corpsMode}</label>
          <div className="flex gap-2 flex-wrap mt-2">
            <button
              className="py-2 px-3 rounded text-sm"
              aria-pressed={prefs.modeCalorique === null}
              style={boutonStyle(prefs.modeCalorique === null)}
              onClick={() => poser("modeCalorique", null)}
            >
              {t.corpsModeEteint}
            </button>
            {MODES.map((m) => (
              <button
                key={m}
                className="py-2 px-3 rounded text-sm"
                aria-pressed={prefs.modeCalorique === m}
                style={boutonStyle(prefs.modeCalorique === m)}
                onClick={() => poser("modeCalorique", m)}
              >
                {t.corpsModes[m]}
              </button>
            ))}
          </div>
        </div>

        {prefs.modeCalorique && (
          <>
            <div>
              <label className="text-xs" style={{ color: "var(--muted)" }}>{t.corpsFormule}</label>
              <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>{t.corpsFormuleAide}</p>
              <div className="flex gap-2 mt-2">
                {(["h", "f"] as FormuleCalorique[]).map((f) => (
                  <button
                    key={f}
                    className="py-2 px-3 rounded text-sm"
                    aria-pressed={prefs.formuleCalorique === f}
                    style={boutonStyle(prefs.formuleCalorique === f)}
                    onClick={() => poser("formuleCalorique", f)}
                  >
                    {t.corpsFormules[f]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs" style={{ color: "var(--muted)" }}>{t.corpsActivite}</label>
              <select
                className="lol-select w-full mt-2"
                value={prefs.niveauActivite ?? ""}
                onChange={(e) => poser("niveauActivite", (e.target.value || null) as NiveauActivite | null)}
              >
                <option value="">{t.corpsActiviteVide}</option>
                {ACTIVITES.map((a) => (
                  <option key={a} value={a}>{t.corpsActivites[a]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs" style={{ color: "var(--muted)" }}>{t.corpsPoidsCible}</label>
              <input
                type="number" inputMode="numeric" min={20} max={500}
                className="lol-input w-full mt-2"
                value={prefs.poidsCible ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  setPrefs((p) => ({ ...p, poidsCible: v }));
                }}
                onBlur={() => poser("poidsCible", prefs.poidsCible)}
              />
            </div>

            {/*
              L'objectif, et les deux avertissements qui ne l'empêchent JAMAIS
              de s'afficher (réponses 017 et 018). Refuser d'afficher pousserait
              à aller chercher le chiffre ailleurs, sans l'avertissement.
            */}
            {objectif ? (
              <div className="space-y-2" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <div className="mono-num font-bold" style={{ fontSize: "1.6rem" }}>
                  {t.corpsObjectifValeur(objectif.cible)}
                </div>
                <div className="text-xs" style={{ color: "var(--faint)" }}>
                  {t.corpsMaintienValeur(objectif.maintien)}
                  {objectif.imc !== null && ` · ${t.corpsImc(objectif.imc)}`}
                </div>
                {objectif.sousPlancher && (
                  <p role="note" className="text-xs" style={{ color: "var(--loss, #ef5350)" }}>
                    {t.corpsAvertPlancher}
                  </p>
                )}
                {objectif.imcBas && (
                  <p role="note" className="text-xs" style={{ color: "var(--loss, #ef5350)" }}>
                    {t.corpsAvertImc}
                  </p>
                )}
                {/*
                  Aucune date, aucun « dans X semaines » (réponse 016). La règle
                  des 7 700 kcal par kilo est fausse, et une échéance chiffrée
                  est crue précisément parce qu'elle est chiffrée. On dit
                  pourquoi plutôt que de laisser un vide qu'on prendrait pour un
                  oubli.
                */}
                <p className="text-xs" style={{ color: "var(--faint)" }}>{t.corpsPasDeDate}</p>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--faint)" }}>{t.corpsIncomplet}</p>
            )}
          </>
        )}
      </div>

      {/* ── Le suivi du poids (réponse 021) ─────────────────────────────── */}
      <div className="lol-panel space-y-3">
        <div>
          <h2 className="titre-section">{t.corpsPeseeTitre}</h2>
          <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>{t.corpsPeseeAide}</p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="number" inputMode="decimal" step="0.1" min={20} max={500}
            className="lol-input flex-1"
            aria-label={t.corpsPeseeLabel}
            value={peseeKg}
            onChange={(e) => { setPeseeKg(e.target.value); setPeseeEtat(""); }}
          />
          <button className="lol-btn" disabled={peseeEtat === "envoi"} onClick={peser}>
            {peseeEtat === "envoi" ? t.enregistrementEnCours : t.corpsPeseeEnregistrer}
          </button>
        </div>
        {peseeEtat === "ok" && (
          <p role="status" className="text-xs" style={{ color: "var(--victory, #4caf50)" }}>{t.enregistre}</p>
        )}
        {peseeEtat === "echec" && (
          <p role="alert" className="text-xs" style={{ color: "var(--loss, #ef5350)" }}>{t.erreurSauvegarde}</p>
        )}
        {indice !== null && (
          <p className="text-xs" style={{ color: "var(--faint)" }}>{t.corpsImc(indice)}</p>
        )}
      </div>

      {/* ── Le mètre-ruban (réponse 023, en option) ─────────────────────── */}
      <div className="lol-panel space-y-3">
        <div>
          <h2 className="titre-section">{t.corpsRubanTitre}</h2>
          <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>{t.corpsRubanAide}</p>
        </div>
        {([
          ["tourTaille", t.corpsTourTaille],
          ["tourCou", t.corpsTourCou],
          ["tourHanches", t.corpsTourHanches],
        ] as const).map(([cle, libelle]) => (
          <div key={cle}>
            <label className="text-xs" style={{ color: "var(--muted)" }}>{libelle}</label>
            <input
              type="number" inputMode="numeric" min={15} max={300}
              className="lol-input w-full mt-1"
              value={prefs[cle] ?? ""}
              onChange={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                setPrefs((p) => ({ ...p, [cle]: v }));
              }}
              onBlur={() => poser(cle, prefs[cle])}
            />
          </div>
        ))}
        {graisse !== null ? (
          <p className="mono-num" style={{ fontSize: "1.2rem" }}>{t.corpsMasseGrasse(graisse)}</p>
        ) : (
          <p className="text-xs" style={{ color: "var(--faint)" }}>{t.corpsRubanIncomplet}</p>
        )}
      </div>
    </div>
  );
}

function boutonStyle(actif: boolean): React.CSSProperties {
  return actif
    ? { background: "var(--gold, #C8AA6E)", color: "#0b0d12", border: "1px solid var(--gold, #C8AA6E)" }
    : { background: "rgba(152,162,176,0.1)", color: "var(--muted)", border: "1px solid rgba(152,162,176,0.2)" };
}
