"use client";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import type { useT } from "@/lib/i18n/LocaleContext";
import type { dashboard } from "@/lib/i18n/dictionaries/dashboard";
import {
  AXE_TICK, AXE_TICK_DENSE, AXE_TICK_FORT_DENSE, INFOBULLE,
  RAYON_BARRE, GRILLE_TRAIT, TEINTES,
} from "@/lib/graphiques";
import { ResumeGraphique, decrireEvolution, decrireRepartition } from "./ResumeGraphique";

type T = ReturnType<typeof useT<typeof dashboard>>;

/**
 * Les trois graphiques qui décrivent toute l'activité, jeux confondus.
 *
 * La dette par jeu n'a de sens qu'à partir de deux jeux. Le cumul ne fait que
 * monter, il ne dit donc rien des progrès ; c'est la moyenne par semaine qui
 * les montre, et elle est le seul tracé de l'écran qui puisse descendre.
 */
export function GraphiquesGlobaux({
  t, dateLocale, parJeu, cumul, moyenneParSemaine, vue, setVue, fmt, fmtAxe,
}: {
  t: T;
  /** Étiquette `Intl` pour les dates des axes. */
  dateLocale: string;
  /** `null` quand un seul jeu est joué : le graphique n'apprendrait rien. */
  parJeu: { jeu: string; pompes: number }[] | null;
  cumul: { date: string; cumul: number }[];
  moyenneParSemaine: { semaine: string; moyenne: number; parties: number }[];
  vue: "total" | "avg";
  setVue: (v: "total" | "avg") => void;
  fmt: (points: number) => string;
  fmtAxe: (points: number) => string;
}) {
  // Deux parties jouées le même jour donnent la même étiquette d'axe, et
  // Recharts n'en dessinerait qu'une. On numérote les doublons.
  const compteur: Record<string, number> = {};
  const cumulData = cumul.map((d) => {
    const court = new Date(d.date.slice(0, 10) + "T12:00:00")
      .toLocaleDateString(dateLocale, { day: "numeric", month: "short" });
    compteur[court] = (compteur[court] || 0) + 1;
    return { ...d, label: compteur[court] === 1 ? court : `${court} (${compteur[court]})` };
  });

  return (
    <>
      <h2 className="titre-groupe" data-visite="stats-globales">{t.globalStats}</h2>
      <div className={`grid gap-4 ${parJeu ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
        {parJeu && (
          <div className="bloc-graphique">
            <div className="flex items-center justify-between mb-3">
              <h2 className="titre-section">{t.detteParJeu(vue)}</h2>
              <div className="flex gap-1">
                {(["total", "avg"] as const).map((key) => (
                  <button
                    key={key}
                    onClick={() => setVue(key)}
                    className="text-xs px-2 py-1 rounded"
                    style={{
                      background: vue === key ? "rgba(152,162,176,0.25)" : "rgba(152,162,176,0.06)",
                      color: vue === key ? "#ECEFF4" : "var(--faint)",
                      border: `1px solid ${vue === key ? "rgba(152,162,176,0.5)" : "rgba(152,162,176,0.12)"}`,
                    }}
                  >
                    {key === "total" ? t.total : t.average}
                  </button>
                ))}
              </div>
            </div>
            {(() => {
              const detail = decrireRepartition(parJeu, "jeu", "pompes", fmt);
              return detail ? <ResumeGraphique texte={t.grapheRepartition(t.detteParJeu(vue), detail)} /> : null;
            })()}
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={parJeu} accessibilityLayer>
                <XAxis dataKey="jeu" tick={AXE_TICK_FORT_DENSE} interval={0} />
                <YAxis tickFormatter={fmtAxe} tick={AXE_TICK} />
                <Tooltip
                  contentStyle={INFOBULLE}
                  formatter={(v) => [fmt(Number(v)), vue === "avg" ? t.tooltipAvgPerActivite : t.tooltipTotal]}
                />
                <Bar dataKey="pompes" fill={TEINTES.jeux} radius={RAYON_BARRE} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {cumulData.length > 0 && (
          <div className="bloc-graphique">
            <h2 className="titre-section mb-3">{t.cumulativeProgress}</h2>
            {(() => {
              const e = decrireEvolution(cumulData, "cumul", fmt);
              return e ? <ResumeGraphique texte={t.grapheEvolution(t.cumulativeProgress, e.n, e.debut, e.fin)} /> : null;
            })()}
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={cumulData} accessibilityLayer>
                <CartesianGrid strokeDasharray="3 3" stroke={GRILLE_TRAIT} />
                <XAxis dataKey="label" tick={AXE_TICK_DENSE} />
                <YAxis tickFormatter={fmtAxe} tick={AXE_TICK} />
                <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={INFOBULLE} />
                <Line dataKey="cumul" stroke={TEINTES.dette} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Coût moyen par activité, semaine après semaine. C'est le seul
            graphique qui peut descendre : le cumul ne fait que monter et le
            total par jour suit surtout le temps qu'on a joué. */}
        {moyenneParSemaine.length > 1 && (
          <div className="bloc-graphique md:col-span-2" data-visite="graphique">
            <h2 className="titre-section">{t.progressionTitre}</h2>
            <p className="text-xs mt-1 mb-3" style={{ color: "var(--faint)" }}>{t.progressionAide}</p>
            {(() => {
              const e = decrireEvolution(moyenneParSemaine, "moyenne", fmt);
              return e ? <ResumeGraphique texte={t.grapheEvolution(t.progressionTitre, e.n, e.debut, e.fin)} /> : null;
            })()}
            <ResponsiveContainer width="100%" height={200}>
              <LineChart
                accessibilityLayer
                data={moyenneParSemaine.map((s) => ({
                  ...s,
                  label: new Date(s.semaine + "T12:00:00")
                    .toLocaleDateString(dateLocale, { day: "numeric", month: "short" }),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRILLE_TRAIT} />
                <XAxis dataKey="label" tick={AXE_TICK_DENSE} />
                <YAxis tickFormatter={fmtAxe} tick={AXE_TICK} />
                <Tooltip
                  contentStyle={INFOBULLE}
                  formatter={(v, _n, p) => [
                    `${fmt(Number(v))} · ${t.surNParties(Number(p?.payload?.parties ?? 0))}`,
                    t.progressionSerie,
                  ]}
                />
                <Line dataKey="moyenne" stroke={TEINTES.moyenne} strokeWidth={2} dot={{ r: 3, fill: TEINTES.moyenne }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </>
  );
}
