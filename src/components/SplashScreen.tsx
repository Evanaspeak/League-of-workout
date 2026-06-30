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
    const t1 = setTimeout(() => setOut(true), 2000);
    const t2 = setTimeout(() => setState("gone"), 2650);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (state === "gone") return null;

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "column",
      background: "#040810",
      backgroundImage: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(200,170,110,0.07) 0%, transparent 70%)",
      opacity: state === "animating" && out ? 0 : 1,
      transition: state === "animating" ? "opacity 0.65s ease" : "none",
      pointerEvents: out ? "none" : "all",
    }}>
      {state === "animating" && (
        <>
          <div style={{
            fontSize: "4rem",
            color: "#C8AA6E",
            animation: "splashSword 1.1s cubic-bezier(0.34,1.56,0.64,1) forwards, splashGlow 1.8s ease-in-out 1.1s infinite",
            marginBottom: "1.1rem",
            lineHeight: 1,
          }}>⚔</div>

          <div style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "1.25rem",
            letterSpacing: "0.28em",
            color: "#C8AA6E",
            textShadow: "0 0 24px rgba(200,170,110,0.45)",
            animation: "splashTitle 1.4s ease forwards",
            marginBottom: "0.5rem",
          }}>
            LEAGUE OF WORKOUTS
          </div>

          <div style={{
            fontSize: "0.65rem",
            letterSpacing: "0.22em",
            color: "rgba(200,170,110,0.3)",
            animation: "splashTitle 1.6s ease 0.2s forwards",
            opacity: 0,
          }}>
            VIA RIOT GAMES API
          </div>

          <div style={{
            position: "absolute",
            bottom: "2.5rem",
            width: 60,
            height: 1,
            background: "linear-gradient(to right, transparent, rgba(200,170,110,0.4), transparent)",
            animation: "splashTitle 1.6s ease 0.4s forwards",
            opacity: 0,
          }} />
        </>
      )}
    </div>
  );
}
