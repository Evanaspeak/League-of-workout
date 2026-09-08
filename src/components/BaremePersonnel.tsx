"use client";

import { useT, useDateLocale } from "@/lib/i18n/LocaleContext";
import { exercices as exercicesDict } from "@/lib/i18n/dictionaries/exercices";
import { nomsExercices } from "@/lib/nomsExercices";
import {
  EXERCICES_REGLABLES, RATIO_BORNES, formaterQuantite, fusionnerRatios, quantite,
  type ExerciceId, type RatiosExercices,
} from "@/lib/exercices";

/**
 * Ce que chaque exercice coûte, pour CE compte (réponse 047).
 *
 * Le barème se réglait depuis l'administration, donc le même pour tout le
 * monde. Une seconde de boxe ne demande pas le même effort à tout le monde, et
 * un barème unique oblige à choisir pour quelqu'un d'autre.
 *
 * **Ce qui est montré est le COÛT, pas le ratio.** « 0,14 » ne dit rien ;
 * « 1 min 40 pour 100 points » se lit. Et le chiffre affiché passe par
 * `quantite`, c'est-à-dire la fonction que le serveur emploie pour de vrai :
 * une seconde arithmétique écrite ici aurait l'air juste et divergerait au
 * premier arrondi. C'est la règle déjà posée pour le panneau du partage, qui
 * existe lui aussi pour PROMETTRE un chiffre.
 *
 * **Les pompes n'y figurent pas** : elles sont l'unité de compte, un point
 * d'effort vaut une pompe depuis le premier jour, et les laisser régler
 * changerait le sens du registre entier plutôt que la difficulté d'un
 * exercice.
 */

/** Le total de référence. Cent points, c'est l'échelle d'une soirée. */
const REFERENCE = 100;

/**
 * Le pas, en quart du barème COMMUN de l'exercice.
 *
 * Un pas fixe ne peut pas marcher : la boxe se règle entre 1 et 60, la course
 * entre 0,005 et 0,2. Un quart du barème commun donne quatre tapes pour
 * doubler la difficulté et deux pour la diviser, à toutes les échelles.
 */
function pas(commun: number): number {
  return commun / 4;
}

/** Quatre décimales : de quoi loger le pas de la course sans traîner de flottant. */
function arrondir(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

export default function BaremePersonnel({
  selection,
  communs,
  perso,
  onChange,
}: {
  selection: ExerciceId[];
  communs: RatiosExercices;
  perso: Partial<RatiosExercices>;
  onChange: (prochain: Partial<RatiosExercices>) => void;
}) {
  const t = useT(exercicesDict);
  const etiquette = useDateLocale();
  const noms = nomsExercices(t);

  const reglables = selection.filter((id) => EXERCICES_REGLABLES.includes(id));
  if (reglables.length === 0) return null;

  const actifs = fusionnerRatios(communs, perso);

  const poser = (id: ExerciceId, valeur: number) => {
    const { min, max } = RATIO_BORNES[id];
    const borne = arrondir(Math.min(max, Math.max(min, valeur)));
    // Revenir exactement au barème commun EFFACE la clé plutôt que de la
    // recopier : c'est ce qui distingue « je n'ai rien réglé » de « j'ai
    // réglé la même chose », et ce qui laisse le barème commun bouger sous
    // quelqu'un qui n'a rien demandé.
    const prochain = { ...perso };
    if (borne === arrondir(communs[id])) delete prochain[id];
    else prochain[id] = borne;
    onChange(prochain);
  };

  return (
    <div
      role="group"
      aria-labelledby="bareme-titre"
      style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}
      className="space-y-2"
    >
      <h3 id="bareme-titre" className="text-sm" style={{ color: "var(--bone)", fontWeight: 600 }}>
        {t.baremeTitre}
      </h3>
      <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
        {t.baremeAide}
      </p>

      <div style={{ display: "grid", gap: 8 }}>
        {reglables.map((id) => {
          const ratio = actifs[id];
          const { min, max } = RATIO_BORNES[id];
          const cout = formaterQuantite(quantite(REFERENCE, id, actifs), id, etiquette);
          return (
            <div
              key={id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 10, flexWrap: "wrap",
              }}
            >
              {/* Une seule phrase pour un lecteur d'écran : le nom et le coût.
                  Lus séparément, les deux ne disent pas à quoi ils se
                  rapportent — c'est la règle du panneau d'à côté. */}
              <span className="lecture-ecran">{t.baremeLigne(noms[id], cout)}</span>
              <span aria-hidden className="text-sm" style={{ color: "var(--bone)" }}>{noms[id]}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => poser(id, ratio - pas(communs[id]))}
                  disabled={ratio <= min}
                  aria-label={t.baremeMoins(noms[id])}
                  className="lol-btn"
                  style={{ minWidth: 44, minHeight: 44, opacity: ratio <= min ? 0.4 : 1 }}
                >
                  −
                </button>
                <span
                  aria-hidden
                  className="mono-num text-sm"
                  style={{ minWidth: 76, textAlign: "center", color: "var(--gold)" }}
                >
                  {cout}
                </span>
                <button
                  type="button"
                  onClick={() => poser(id, ratio + pas(communs[id]))}
                  disabled={ratio >= max}
                  aria-label={t.baremePlus(noms[id])}
                  className="lol-btn"
                  style={{ minWidth: 44, minHeight: 44, opacity: ratio >= max ? 0.4 : 1 }}
                >
                  +
                </button>
                <span aria-hidden className="text-xs" style={{ color: "var(--faint)" }}>
                  {t.baremePour}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Revenir en arrière doit coûter un geste. Le bouton ne paraît que si
          quelque chose a bougé : sinon il ne ferait rien. */}
      {Object.keys(perso).length > 0 && (
        <button type="button" onClick={() => onChange({})} className="lol-btn text-xs">
          {t.baremeCommun}
        </button>
      )}
    </div>
  );
}
