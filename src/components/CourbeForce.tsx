"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { AXE_TICK_DENSE, INFOBULLE, TEINTES } from "@/lib/graphiques";

/**
 * La courbe du test de force dans le temps (ligne 152 du plan).
 *
 * Elle vit dans son propre fichier, chargé à la demande par l'écran des
 * réglages, pour la raison écrite dans `CourbePoids` : un `dynamic()` ne sert à
 * rien tant qu'un import ordinaire du même module subsiste à côté, et
 * `recharts` pèse cent kilo-octets.
 *
 * **L'axe des ordonnées part de ZÉRO, et c'est l'inverse du choix fait pour le
 * poids.** Là-bas, l'ancrer écrase deux ans de variations en une ligne plate,
 * et zéro n'a aucun sens — personne ne pèse zéro. Ici il en a un : c'est
 * « je n'en fais aucune », et quelqu'un peut réellement en être proche. Douze
 * pompes qui deviennent dix-huit, c'est une progression de moitié, et c'est
 * exactement ce qu'un axe ancré rend fidèlement. Un axe tronqué la ferait
 * paraître spectaculaire, ce qui est le défaut que ce projet reproche partout
 * aux graphiques de volume.
 */
export function CourbeForce({
  points, formaterJour, formaterPompes,
}: {
  points: { jour: string; pompes: number }[];
  formaterJour: (jour: string) => string;
  formaterPompes: (pompes: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={points.map((p) => ({ ...p, label: formaterJour(p.jour) }))}>
        <XAxis dataKey="label" tick={AXE_TICK_DENSE} />
        <YAxis
          domain={[0, "dataMax + 2"]}
          allowDecimals={false}
          tickFormatter={(v) => String(Math.round(Number(v)))}
          tick={AXE_TICK_DENSE}
          width={38}
        />
        <Tooltip formatter={(v) => formaterPompes(Number(v))} contentStyle={INFOBULLE} />
        <Line
          type="monotone" dataKey="pompes" stroke={TEINTES.periode}
          strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
