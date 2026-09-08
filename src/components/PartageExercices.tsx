"use client";

import { useT, usePourcentage } from "@/lib/i18n/LocaleContext";
import { exercices as exercicesDict } from "@/lib/i18n/dictionaries/exercices";
import { nomsExercices } from "@/lib/nomsExercices";
import {
  PART_DEFAUT, PART_MAX, PART_MIN, repartirPoints,
  type ExerciceId, type PartsExercices,
} from "@/lib/exercices";

/**
 * Le poids de chaque exercice dans le partage de la dette (réponse 068).
 *
 * Il ne se propose qu'à partir de DEUX exercices cochés : à un seul, il n'y a
 * rien à partager et le panneau ne dirait rien.
 *
 * **Le pourcentage se déduit de `repartirPoints`, pas d'une seconde
 * arithmétique.** C'est la fonction que le serveur emploie pour de vrai : une
 * règle de trois écrite ici aurait l'air juste et divergerait au premier
 * arrondi — l'écran annoncerait 33 % là où la dette en donne 34. C'est le
 * défaut que ce projet paie en boucle, et il se paie ici en confiance : ce
 * panneau existe pour PROMETTRE un partage.
 */
export default function PartageExercices({
  selection,
  parts,
  onChange,
}: {
  selection: ExerciceId[];
  parts: PartsExercices;
  onChange: (prochain: PartsExercices) => void;
}) {
  const t = useT(exercicesDict);
  const pourcent = usePourcentage();
  const noms = nomsExercices(t);

  if (selection.length < 2) return null;

  /**
   * Cent points, parce que c'est l'échelle d'une soirée et que le partage y
   * est lisible. Le nombre exact n'a pas d'importance : ce qu'on montre est
   * une PROPORTION, et elle ne dépend pas du total.
   */
  const apercu = repartirPoints(100, selection, parts);

  const poser = (id: ExerciceId, valeur: number) => {
    const borne = Math.min(PART_MAX, Math.max(PART_MIN, valeur));
    onChange({ ...parts, [id]: borne });
  };

  return (
    <div
      role="group"
      aria-labelledby="partage-titre"
      style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}
      className="space-y-2"
    >
      <h3 id="partage-titre" className="text-sm" style={{ color: "var(--bone)", fontWeight: 600 }}>
        {t.partageTitre}
      </h3>
      <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
        {t.partageAide}
      </p>

      <div style={{ display: "grid", gap: 8 }}>
        {selection.map((id) => {
          const poids = parts[id] ?? PART_DEFAUT;
          const pct = pourcent(apercu[id] ?? 0);
          return (
            <div
              key={id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                gap: 10, flexWrap: "wrap",
              }}
            >
              {/* Une seule phrase pour un lecteur d'écran : le nom, le poids et
                  la part qu'il produit. Lus séparément, les trois chiffres
                  d'une ligne ne disent pas à quoi ils se rapportent. */}
              <span className="lecture-ecran">{t.partagePart(noms[id], poids, pct)}</span>
              <span aria-hidden className="text-sm" style={{ color: "var(--bone)" }}>{noms[id]}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => poser(id, poids - 1)}
                  disabled={poids <= PART_MIN}
                  aria-label={t.partageMoins(noms[id])}
                  className="lol-btn"
                  style={{ minWidth: 44, minHeight: 44, opacity: poids <= PART_MIN ? 0.4 : 1 }}
                >
                  −
                </button>
                <span
                  aria-hidden
                  className="mono-num text-sm"
                  style={{ minWidth: 24, textAlign: "center", color: "var(--gold)" }}
                >
                  {poids}
                </span>
                <button
                  type="button"
                  onClick={() => poser(id, poids + 1)}
                  disabled={poids >= PART_MAX}
                  aria-label={t.partagePlus(noms[id])}
                  className="lol-btn"
                  style={{ minWidth: 44, minHeight: 44, opacity: poids >= PART_MAX ? 0.4 : 1 }}
                >
                  +
                </button>
                <span
                  aria-hidden
                  className="mono-num text-xs"
                  style={{ minWidth: 52, textAlign: "right", color: "var(--faint)" }}
                >
                  {pct}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Revenir en arrière doit coûter un geste, pas huit. Le bouton ne
          paraît que si quelque chose a bougé : sinon il ne ferait rien. */}
      {selection.some((id) => (parts[id] ?? PART_DEFAUT) !== PART_DEFAUT) && (
        <button type="button" onClick={() => onChange({})} className="lol-btn text-xs">
          {t.partageEgal}
        </button>
      )}
    </div>
  );
}
