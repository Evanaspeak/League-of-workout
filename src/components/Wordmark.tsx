/**
 * Wordmark "WIN/WORKOUT" — le slash ember incarne le "or" de la marque.
 * Purement présentational : à envelopper dans un <Link> si besoin.
 */
export function Wordmark({
  fontSize = "1.05rem",
  muted = false,
}: {
  fontSize?: string;
  muted?: boolean;
}) {
  return (
    <span
      aria-label="Win or Workout"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.32em",
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
      <span
        aria-hidden
        style={{
          width: "0.16em",
          height: "0.98em",
          background: "var(--ember)",
          transform: "skewX(-18deg)",
          borderRadius: "0.04em",
          flexShrink: 0,
        }}
      />
      <span aria-hidden>Workout</span>
    </span>
  );
}
