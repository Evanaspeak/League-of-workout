/**
 * Wordmark "WIN//WORKOUT" — le double slash incarne le "or" de la marque
 * (le `//` du code), en dégradé de feu : braise → ambre.
 * Purement présentational : à envelopper dans un <Link> si besoin.
 */
export function Wordmark({
  fontSize = "1.05rem",
  muted = false,
}: {
  fontSize?: string;
  muted?: boolean;
}) {
  const bar = (color: string): React.CSSProperties => ({
    width: "0.13em",
    height: "0.98em",
    background: color,
    transform: "skewX(-18deg)",
    borderRadius: "0.04em",
    flexShrink: 0,
  });

  return (
    <span
      aria-label="Win or Workout"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.3em",
        fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
        fontWeight: 700,
        fontSize,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: muted ? "var(--faint)" : "var(--bone)",
        lineHeight: 1,
        whiteSpace: "nowrap",
      }}
    >
      <span aria-hidden>Win</span>
      <span aria-hidden style={{ display: "inline-flex", gap: "0.09em" }}>
        <span style={bar("var(--ember)")} />
        <span style={bar("var(--amber)")} />
      </span>
      <span aria-hidden>Workout</span>
    </span>
  );
}
