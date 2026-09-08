"use client";
import { ChampionIcon } from "@/components/ChampionIcon";
import { useT, useMinuscule, useNombre } from "@/lib/i18n/LocaleContext";
import { dashboard } from "@/lib/i18n/dictionaries/dashboard";

/** Résumé d'un champion, tel que le renvoie /api/dashboard. */
export type ChampSummary = {
  name: string;
  games: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  kda: number | null;
  avgPompes: number;
};

export function StatCard({ label, value, sub, lignes, i = 0, ancre }: {
  label: string;
  /**
   * DÉJÀ mise en forme, et le type le dit.
   *
   * Elle acceptait `string | number`, et c'est par là qu'un compte de parties
   * est passé brut : « 1116 » à côté d'un « 8 905 » groupé, sur la même
   * rangée. Le resserrer ne casse aucun appelant — il n'y en avait qu'un, et
   * il est corrigé — mais il ferme la porte pour de bon : le prochain qui
   * passera un nombre se le fera dire par le compilateur, ce qui vaut mieux
   * qu'un test et infiniment mieux qu'une relecture.
   */
  value?: string;
  sub?: string;
  /** Ventilation par exercice : des répétitions et des minutes ne s'additionnent pas. */
  lignes?: { nom: string; valeur: string }[];
  i?: number;
  /** Ancre de la visite guidée, quand cette carte sert de repli à une étape. */
  ancre?: string;
}) {
  const minuscule = useMinuscule();
  return (
    <div className="stat-card p-4 flex flex-col gap-1 rise" data-visite={ancre} style={{ animationDelay: `${i * 80}ms` }}>
      <span style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--faint)" }}>{label}</span>
      {lignes ? (
        <span style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
          {lignes.map((l) => (
            <span key={l.nom} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span className="mono-num" style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--amber)", lineHeight: 1.2 }}>{l.valeur}</span>
              <span style={{ fontSize: "0.7rem", color: "var(--faint)" }}>{minuscule(l.nom)}</span>
            </span>
          ))}
        </span>
      ) : (
        <span className="mono-num" style={{ fontSize: "1.7rem", fontWeight: 600, color: "var(--amber)", lineHeight: 1.15 }}>{value}</span>
      )}
      {sub && <span style={{ fontSize: "0.75rem", color: "var(--faint)" }}>{sub}</span>}
    </div>
  );
}

export function ChampionCard({ champ, badge, badgeColor, t }: { champ: ChampSummary; badge: string; badgeColor: string; t: ReturnType<typeof useT<typeof dashboard>> }) {
  /*
    Le KDA passe par `Intl` : `toFixed` rend toujours un POINT décimal, et
    l'allemand y lit un séparateur de milliers — « 3.25 » s'y comprend comme
    trois mille deux cent cinquante.
  */
  const nombre = useNombre({ minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kdaLabel = champ.kda === null ? t.kdaParfait : nombre(champ.kda);
  return (
    <div className="lol-panel p-4 fade-in" style={{ position: "relative" }}>
      <span style={{
        position: "absolute", top: 10, right: 12,
        fontSize: "0.6rem", fontWeight: 700, letterSpacing: "0.1em",
        color: badgeColor, textTransform: "uppercase",
        /*
          `color-mix` plutôt qu'un alpha collé au bout de la chaîne.
          `${badgeColor}55` ne marche que si `badgeColor` est un hexadécimal :
          le jour où l'appelant passe `var(--amber)`, la chaîne devient
          `var(--amber)55`, qui n'est pas du CSS — la bordure et le fond
          disparaissent sans erreur. C'est ce qui a forcé les appelants à
          écrire la couleur en dur, donc à s'écarter de la palette.
          55 sur 255 fait un tiers, 14 sur 255 fait huit pour cent.
        */
        border: `1px solid color-mix(in srgb, ${badgeColor} 33%, transparent)`,
        borderRadius: 4,
        padding: "2px 7px",
        background: `color-mix(in srgb, ${badgeColor} 8%, transparent)`,
      }}>{badge}</span>

      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <ChampionIcon name={champ.name} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)",
            fontSize: "1.05rem", color: "var(--bone)", lineHeight: 1.1,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{champ.name}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--faint)", marginTop: 2 }}>
            {t.gamesCount(champ.games)}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 14 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--faint)", marginBottom: 3 }}>{t.kda}</div>
          <div style={{ fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)", fontSize: "0.95rem", color: "var(--bone)" }}>{kdaLabel}</div>
          <div style={{ fontSize: "0.65rem", color: "var(--faint)" }}>
            {champ.avgKills}/{champ.avgDeaths}/{champ.avgAssists}
          </div>
        </div>
        <div style={{ textAlign: "center", borderLeft: "1px solid color-mix(in srgb, var(--steel) 12%, transparent)", borderRight: "1px solid color-mix(in srgb, var(--steel) 12%, transparent)" }}>
          <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--faint)", marginBottom: 3 }}>{t.avgPompes}</div>
          <div style={{ fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)", fontSize: "0.95rem", color: badgeColor }}>{champ.avgPompes}</div>
          <div style={{ fontSize: "0.65rem", color: "var(--faint)" }}>{t.perGame}</div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--faint)", marginBottom: 3 }}>{t.games}</div>
          <div style={{ fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)", fontSize: "0.95rem", color: "var(--bone)" }}>{champ.games}</div>
          <div style={{ fontSize: "0.65rem", color: "var(--faint)" }}>{t.played}</div>
        </div>
      </div>
    </div>
  );
}
