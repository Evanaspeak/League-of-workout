"use client";
import { useEffect } from "react";

/**
 * Détecte l'ouverture faite par l'application desktop et mémorise le transfert
 * à venir, ainsi que l'aléa qui l'autorisera.
 *
 * Le drapeau seul ne prouvait rien : n'importe quel site pouvait ouvrir
 * `/login?_desktop=1` chez la victime pour l'armer, et le tableau de bord
 * mettait ensuite son jeton de session dans une adresse — donc dans
 * l'historique du navigateur. L'aléa vient de l'application elle-même : sans
 * lui, le canal local refuse le transfert.
 */
export function DesktopModeDetector() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("_desktop") !== "1") return;
    const nonce = params.get("n");
    // Pas d'aléa, pas de transfert : un drapeau posé par un tiers ne mène nulle
    // part, et c'est exactement ce qu'on veut.
    if (!nonce) return;
    localStorage.setItem("low_desktop_handoff", "1");
    localStorage.setItem("low_desktop_nonce", nonce);
    // L'instant de la demande. Le transfert ne portera que sur une session
    // ouverte APRÈS lui : sans cette borne, arriver ici en étant déjà connecté
    // suffisait à expédier cette session-là vers l'application, sans que
    // personne ne se soit authentifié — on repartait donc systématiquement
    // avec le compte déjà ouvert dans le navigateur.
    localStorage.setItem("low_desktop_arme", String(Date.now()));
  }, []);
  return null;
}
