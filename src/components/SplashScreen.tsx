"use client";
import { useEffect, useState } from "react";

type State = "blocking" | "animating" | "gone";

export function SplashScreen() {
  const [state, setState] = useState<State>("blocking");
  const [out, setOut] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("splash")) {
      setState("gone");
      return;
    }
    sessionStorage.setItem("splash", "1");
    setState("animating");
    const t1 = setTimeout(() => setOut(true), 1700);
    const t2 = setTimeout(() => setState("gone"), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (state === "gone") return null;

  const word: React.CSSProperties = {
    fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
    fontWeight: 700,
    fontSize: "clamp(2.2rem, 7vw, 3.4rem)",
    letterSpacing: "0.08em",
    color: "var(--bone)",
    lineHeight: 1,
  };

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      background: "var(--ink)",
      opacity: state === "animating" && out ? 0 : 1,
      transition: state === "animating" ? "opacity 0.5s ease" : "none",
      pointerEvents: out ? "none" : "all",
    }}>
      {state === "animating" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: "clamp(14px, 2.5vw, 22px)", overflow: "hidden", padding: "0.5rem 0" }}>
            <span style={{ ...word, animation: "splashWord 0.5s ease 0.1s both" }}>WIN</span>
            <span style={{ display: "flex", gap: "clamp(4px, 0.7vw, 7px)" }}>
              <span style={{
                width: "clamp(7px, 1.2vw, 10px)",
                height: "clamp(2.4rem, 7.5vw, 3.7rem)",
                background: "var(--ember)",
                borderRadius: 2,
                animation: "splashSlash 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
              }} />
              <span style={{
                width: "clamp(7px, 1.2vw, 10px)",
                height: "clamp(2.4rem, 7.5vw, 3.7rem)",
                background: "var(--amber)",
                borderRadius: 2,
                animation: "splashSlash 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both",
              }} />
            </span>
            <span style={{ ...word, animation: "splashWord 0.5s ease 0.34s both" }}>WORKOUT</span>
          </div>

          <div style={{
            fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
            fontSize: "0.62rem",
            letterSpacing: "0.34em",
            textTransform: "uppercase",
            color: "var(--faint)",
            marginTop: "1.1rem",
            animation: "splashWord 0.6s ease 0.55s both",
          }}>
            Beta
          </div>
        </>
      )}
    </div>
  );
}
