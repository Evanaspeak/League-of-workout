"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { useT } from "@/lib/i18n/LocaleContext";
import type { dashboard } from "@/lib/i18n/dictionaries/dashboard";
import { AXE_TICK, AXE_TICK_DENSE, INFOBULLE, RAYON_BARRE, TEINTES } from "@/lib/graphiques";
import { ResumeGraphique, decrireRepartition } from "./ResumeGraphique";

type T = ReturnType<typeof useT<typeof dashboard>>;

export type Periode = "hour" | "weekday" | "month" | "daily";
export type ModeStat = "avg" | "total";
export type PointPeriode = { label: string; avg: number; total: number };

/**
 * Le graphique de la dette par période, et sa barre de boutons.
 *
 * Quatre découpages : l'heure de la journée, le jour de la semaine, le mois,
 * et le détail d'une date précise. Les trois premiers viennent d'un même jeu
 * de données déjà traduit ; le quatrième se charge à la demande, parce qu'il
 * demande une requête par jour consulté.
 */
export function GraphiquePeriode({
  t, periode, setPeriode, mode, setMode, points,
  date, setDate, detailHoraire, resume, chargement, fmt, fmtAxe,
}: {
  t: T;
  periode: Periode;
  setPeriode: (p: Periode) => void;
  mode: ModeStat;
  setMode: (m: ModeStat) => void;
  points: PointPeriode[];
  date: string;
  setDate: (d: string) => void;
  detailHoraire: { label: string; total: number }[] | null;
  resume: { total: number; games: number } | null;
  chargement: boolean;
  fmt: (points: number) => string;
  fmtAxe: (points: number) => string;
}) {
  return (
    <div className="bloc-graphique">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="titre-section">
          {periode === "daily" ? t.dailyDetail : mode === "avg" ? t.avgPompesPerGame : t.totalPompesLabel}
        </h2>
        <div className="flex gap-1 flex-wrap">
          {/* Moyenne ou total : la question ne se pose pas pour un jour seul. */}
          {periode !== "daily" && (
            <>
              {(["avg", "total"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className="text-xs px-2 py-1 rounded"
                  style={{
                    background: mode === m ? "rgba(110,155,255,0.2)" : "rgba(152,162,176,0.06)",
                    color: mode === m ? "#6E9BFF" : "var(--faint)",
                    border: `1px solid ${mode === m ? "rgba(110,155,255,0.4)" : "rgba(152,162,176,0.12)"}`,
                  }}
                >
                  {m === "avg" ? t.average : t.total}
                </button>
              ))}
              <span style={{ width: 1, background: "rgba(152,162,176,0.15)", margin: "0 2px" }} />
            </>
          )}
          {(["hour", "weekday", "month", "daily"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setPeriode(key)}
              className="text-xs px-2 py-1 rounded"
              style={{
                background: periode === key ? "rgba(152,162,176,0.25)" : "rgba(152,162,176,0.06)",
                color: periode === key ? "#ECEFF4" : "var(--faint)",
                border: `1px solid ${periode === key ? "rgba(152,162,176,0.5)" : "rgba(152,162,176,0.12)"}`,
              }}
            >
              {key === "hour" ? t.hour : key === "weekday" ? t.weekday : key === "month" ? t.month : t.calendar}
            </button>
          ))}
        </div>
      </div>

      {periode === "daily" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="date"
              className="lol-input"
              style={{ fontSize: "0.85rem", width: "auto" }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
            />
            {resume && !chargement && (
              <span className="text-sm" style={{ color: "var(--faint)" }}>
                <span className="gold-text font-bold">{fmt(resume.total)}</span> ·{" "}
                <span style={{ color: "var(--faint)" }}>{t.gamesCount(resume.games)}</span>
              </span>
            )}
          </div>
          {chargement ? (
            <div className="text-center py-8 gold-text text-sm">{t.loading}</div>
          ) : detailHoraire && detailHoraire.length > 0 ? (
            <>
            {(() => {
              const detail = decrireRepartition(detailHoraire, "label", "total", fmt);
              return detail ? <ResumeGraphique texte={t.grapheRepartition(t.dailyDetail, detail)} /> : null;
            })()}
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={detailHoraire} accessibilityLayer>
                <XAxis dataKey="label" tick={AXE_TICK_DENSE} />
                <YAxis tickFormatter={fmtAxe} tick={AXE_TICK} />
                <Tooltip contentStyle={INFOBULLE} formatter={(v) => [fmt(Number(v)), t.tooltipTotal]} />
                <Bar dataKey="total" fill={TEINTES.periode} radius={RAYON_BARRE} />
              </BarChart>
            </ResponsiveContainer>
            </>
          ) : (
            <div className="text-center py-8" style={{ color: "var(--faint)", fontSize: "0.85rem" }}>
              {t.noGameThisDay}
            </div>
          )}
        </div>
      ) : (
        <>
        {(() => {
          const titre = mode === "avg" ? t.avgPompesPerGame : t.totalPompesLabel;
          const detail = decrireRepartition(points, "label", mode, fmt);
          return detail ? <ResumeGraphique texte={t.grapheRepartition(titre, detail)} /> : null;
        })()}
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={points} accessibilityLayer>
            <XAxis dataKey="label" tick={AXE_TICK_DENSE} />
            <YAxis tickFormatter={fmtAxe} tick={AXE_TICK} />
            <Tooltip
              contentStyle={INFOBULLE}
              formatter={(v) => [fmt(Number(v)), mode === "avg" ? t.tooltipAvgPerGameFull : t.tooltipTotal]}
            />
            <Bar dataKey={mode} fill={TEINTES.dette} radius={RAYON_BARRE} />
          </BarChart>
        </ResponsiveContainer>
        </>
      )}
    </div>
  );
}
