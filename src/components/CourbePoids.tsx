"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AXE_TICK_DENSE, INFOBULLE, TEINTES } from "@/lib/graphiques";

/**
 * La courbe du poids dans le temps (réponse 021).
 *
 * Elle vit dans son propre fichier, chargé à la demande par l'écran des
 * réglages, pour la raison écrite dans `GraphiqueSession` : un `dynamic()` ne
 * sert à rien tant qu'un import ordinaire du même module subsiste à côté, et
 * `recharts` pèse cent kilo-octets. La page des réglages n'a aucune raison de
 * les porter pour les comptes qui n'ouvriront jamais cette rubrique.
 *
 * L'axe des ordonnées ne part PAS de zéro, et c'est délibéré. Une courbe de
 * poids ancrée à zéro écrase deux ans de variations en une ligne plate : le
 * seul intérêt de ce graphique est de montrer un mouvement de quelques kilos.
 * `domain={["dataMin - 1", "dataMax + 1"]}` cadre sur ce qui a bougé.
 *
 * C'est un choix qu'on ne ferait PAS sur un graphique de volume, où l'axe
 * tronqué exagère les écarts et trompe. Ici la grandeur n'a pas de zéro
 * significatif — personne ne pèse zéro — donc l'ancrer n'informe de rien.
 */
export function CourbePoids({
  points, formaterJour, formaterPoids,
}: {
  points: { jour: string; kg: number }[];
  formaterJour: (jour: string) => string;
  formaterPoids: (kg: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={points.map((p) => ({ ...p, label: formaterJour(p.jour) }))}>
        <XAxis dataKey="label" tick={AXE_TICK_DENSE} />
        <YAxis
          domain={["dataMin - 1", "dataMax + 1"]}
          tickFormatter={(v) => String(Math.round(Number(v)))}
          tick={AXE_TICK_DENSE}
          width={38}
        />
        <Tooltip formatter={(v) => formaterPoids(Number(v))} contentStyle={INFOBULLE} />
        <Line
          type="monotone" dataKey="kg" stroke={TEINTES.periode}
          strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
