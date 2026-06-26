"use client";
import { useEffect } from "react";

// Détecte ?_desktop=1 sur la page login (posé par Electron via shell.openExternal)
// et sauvegarde un flag localStorage pour que DesktopAuthHandler sache qu'il doit
// transférer la session à l'app Electron après l'OAuth.
export function DesktopModeDetector() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("_desktop") === "1") {
      localStorage.setItem("low_desktop_handoff", "1");
    }
  }, []);
  return null;
}
