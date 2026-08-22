"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AXE_TICK_DENSE, INFOBULLE, RAYON_BARRE, TEINTES } from "@/lib/graphiques";

/**
 * Le coût de chaque partie de la session en cours.
 *
 * Ce graphique tenait dans la page du tableau de bord, et son import de
 * `recharts` y était statique. Les trois autres graphiques avaient beau être
 * chargés à la demande, la bibliothèque entrait quand même dans le paquet de
 * la page : un `dynamic()` ne sert à rien tant qu'un import ordinaire du même
 * module subsiste à côté.
 */
export function GraphiqueSession({
  titre, points, fmt, fmtAxe,
}: {
  titre: string;
  points: { label: string; pompes: number }[];
  fmt: (points: number) => string;
  fmtAxe: (points: number) => string;
}) {
  return (
    <div className="lol-panel p-3" style={{ background: "rgba(152,162,176,0.04)" }}>
      <h3 className="titre-bloc mb-2">{titre}</h3>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={points}>
          <XAxis dataKey="label" tick={AXE_TICK_DENSE} />
          <YAxis tickFormatter={fmtAxe} tick={AXE_TICK_DENSE} />
          <Tooltip formatter={(v) => fmt(Number(v))} contentStyle={INFOBULLE} />
          <Bar dataKey="pompes" fill={TEINTES.periode} radius={RAYON_BARRE} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
