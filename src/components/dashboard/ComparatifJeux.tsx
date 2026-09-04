"use client";
import type { useT } from "@/lib/i18n/LocaleContext";
import { usePourcentage } from "@/lib/i18n/LocaleContext";
import type { dashboard } from "@/lib/i18n/dictionaries/dashboard";

type T = ReturnType<typeof useT<typeof dashboard>>;

/** Une ligne du tableau : ce qu'un jeu a coûté, et ce qu'il a duré. */
export type JeuJoue = {
  nom: string;
  games: number;
  /** `null` pour un jeu au temps : il n'a ni victoire ni défaite. */
  winrate: number | null;
  points: number;
  detteMoyenne: number;
  tempsJoueSec: number;
};

/**
 * Le tableau qui compare les jeux entre eux.
 *
 * Il ne montre que ce qui veut dire la même chose partout. Un jeu au temps n'a
 * pas de winrate, un jeu à parties n'a pas de durée : la case reste vide
 * plutôt que d'afficher un zéro, qui se lirait comme une valeur.
 */
export function ComparatifJeux({
  jeux, t, onChoisirJeu, fmt, formaterTempsJeu,
}: {
  jeux: JeuJoue[];
  t: T;
  onChoisirJeu: (nom: string) => void;
  fmt: (points: number) => string;
  formaterTempsJeu: (secondes: number) => string;
}) {
  const pourcent = usePourcentage();
  return (
    <div className="lol-panel p-4 space-y-3">
      <div>
        <h2 className="titre-section">{t.comparatifTitre}</h2>
        <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>{t.comparatifAide}</p>
      </div>
      <div className="overflow-x-auto">
        {/*
          * Le titre au-dessus ne suffit pas à un lecteur d'écran : il annonce
          * « tableau », puis rien. `aria-label` le nomme sans rien changer à la
          * mise en page — un `<caption>` décalait les lignes de quatre pixels,
          * et c'est le défaut qu'on avait corrigé ailleurs de la même façon.
          */}
        <table
          className="w-full text-sm"
          aria-label={t.comparatifTitre}
          style={{ borderCollapse: "separate", borderSpacing: "0 4px", minWidth: 620 }}
        >
          <thead>
            <tr style={{ color: "var(--steel)" }} className="text-xs uppercase tracking-wider">
              <th className="text-left px-3 py-1">{t.colJeu}</th>
              <th className="text-right px-3 py-1">{t.colActivites}</th>
              <th className="text-right px-3 py-1">{t.colWinrate}</th>
              <th className="text-right px-3 py-1">{t.colDette}</th>
              <th className="text-right px-3 py-1">{t.colDetteMoy}</th>
              <th className="text-right px-3 py-1">{t.colTemps}</th>
            </tr>
          </thead>
          <tbody>
            {jeux.map((j) => (
              <tr key={j.nom} style={{ background: "var(--bg-raised)" }}>
                <td className="px-3 py-2" style={{ whiteSpace: "nowrap" }}>
                  <button
                    onClick={() => onChoisirJeu(j.nom)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--signal)" }}
                  >
                    {j.nom}
                  </button>
                </td>
                <td className="px-3 py-2 text-right mono-num" style={{ color: "var(--bone)" }}>{j.games}</td>
                <td className="px-3 py-2 text-right mono-num" style={{ color: j.winrate === null ? "rgba(152,162,176,0.35)" : "rgba(236,239,244,0.8)" }}>
                  {j.winrate === null ? t.sansObjet : pourcent(j.winrate)}
                </td>
                <td className="px-3 py-2 text-right mono-num gold-text font-semibold">{fmt(j.points)}</td>
                <td className="px-3 py-2 text-right mono-num" style={{ color: "var(--muted)" }}>{fmt(j.detteMoyenne)}</td>
                <td className="px-3 py-2 text-right mono-num" style={{ color: j.tempsJoueSec > 0 ? "rgba(236,239,244,0.8)" : "rgba(152,162,176,0.35)" }}>
                  {j.tempsJoueSec > 0 ? formaterTempsJeu(j.tempsJoueSec) : t.sansObjet}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
