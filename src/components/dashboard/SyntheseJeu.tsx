"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { useT } from "@/lib/i18n/LocaleContext";
import type { dashboard } from "@/lib/i18n/dictionaries/dashboard";
import { AXE_TICK, AXE_TICK_FORT, INFOBULLE, RAYON_BARRE, TEINTES } from "@/lib/graphiques";
import { ChampionCard, type ChampSummary } from "./Cartes";

type T = ReturnType<typeof useT<typeof dashboard>>;

/**
 * La synthèse d'un seul jeu : sa répartition, et ses deux champions notables.
 *
 * Rôles et champions ne veulent rien dire rapportés à plusieurs jeux — un
 * « MID » de League et un « Squad » de Fortnite ne se comparent pas. Le bloc
 * ne s'affiche donc que sous le nom d'un jeu, jamais en vue d'ensemble.
 */
export function SyntheseJeu({
  jeu, t, description, titreRepartition, repartition,
  vue, setVue, mostPlayed, leastEfficient, fmt, fmtAxe,
}: {
  jeu: string;
  t: T;
  /** Ce que ce jeu possède et ce qu'il ne possède pas. */
  description: string;
  titreRepartition: string;
  repartition: { label: string; pompes: number }[];
  vue: "total" | "avg";
  setVue: (v: "total" | "avg") => void;
  mostPlayed: ChampSummary | null;
  leastEfficient: ChampSummary | null;
  fmt: (points: number) => string;
  fmtAxe: (points: number) => string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="titre-groupe">{t.syntheseDe(jeu)}</h2>
        <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>{description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {repartition.length > 0 && (
          <div className="bloc-graphique">
            <div className="flex items-center justify-between mb-3">
              <h2 className="titre-section">{titreRepartition}</h2>
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
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={repartition}>
                <XAxis dataKey="label" tick={AXE_TICK_FORT} />
                <YAxis tickFormatter={fmtAxe} tick={AXE_TICK} />
                <Tooltip
                  contentStyle={INFOBULLE}
                  formatter={(v) => [fmt(Number(v)), vue === "avg" ? t.tooltipAvgPerGame : t.tooltipTotal]}
                />
                <Bar dataKey="pompes" fill={TEINTES.dette} radius={RAYON_BARRE} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {(mostPlayed || leastEfficient) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {mostPlayed && (
            <ChampionCard champ={mostPlayed} badge={t.mostPlayedBadge} badgeColor="#FFB454" t={t} />
          )}
          {leastEfficient && (
            <ChampionCard champ={leastEfficient} badge={t.leastEfficientBadge} badgeColor="#FF5A47" t={t} />
          )}
        </div>
      )}
    </div>
  );
}
