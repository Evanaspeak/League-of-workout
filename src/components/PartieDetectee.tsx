"use client";
import { useEffect } from "react";
import type { ScoreDirect } from "@/types/electron";

/** Rôle retenu quand le jeu ne le dit pas : celui de la dernière saisie. */
const ROLE_DEFAUT = "Jungle";

/**
 * Enregistre une partie de League à partir de ce que l'application desktop a vu,
 * sans passer par l'API développeur de Riot.
 *
 * L'API locale du jeu — celle qui alimente déjà l'overlay — donne le score, le
 * champion et l'issue. Elle tourne sur la machine du joueur et ne demande
 * aucune clé. L'API publique, elle, en exige une : tant qu'elle manque, rien ne
 * s'enregistrait, et une partie terminée disparaissait sans laisser de trace.
 *
 * Le rôle est la seule information absente du relevé : on reprend celui de la
 * dernière saisie manuelle, faute de mieux.
 */
export function PartieDetectee() {
  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.onPartieTerminee) return;

    return pont.onPartieTerminee(async ({ score, resultat, dureeSec }) => {
      // Sans score, il n'y a rien à enregistrer : mieux vaut ne rien écrire
      // qu'inventer une partie à zéro partout.
      if (!score) return;

      const role = (typeof localStorage !== "undefined" && localStorage.getItem("lastRole")) || ROLE_DEFAUT;
      try {
        const res = await fetch("/api/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jeu: "League of Legends",
            typeJeu: "parties",
            role,
            champion: score.champion ?? undefined,
            kills: score.kills,
            deaths: score.deaths,
            assists: score.assists,
            // Sans événement de fin lisible, on retient la défaite : c'est le
            // cas coûteux, et se tromper en sa défaveur vaut mieux que de
            // laisser croire à une victoire.
            result: resultat ?? "D",
            dureeSec,
            source: "live_client",
          }),
        });
        // La pastille de dette et le tableau de bord écoutent cet événement :
        // la partie apparaît sans qu'on ait à recharger quoi que ce soit.
        if (res.ok) window.dispatchEvent(new Event("wow-dette-changee"));
      } catch {
        /* Le suivi de session reste le filet de sécurité. */
      }
    });
  }, []);

  return null;
}

export type { ScoreDirect };
