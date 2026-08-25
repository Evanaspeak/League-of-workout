"use client";
import { useEffect } from "react";
import { ventiler } from "@/lib/exercices";
import { notifierSysteme } from "@/lib/notifier";
import { useT } from "@/lib/i18n/LocaleContext";
import { enJeu } from "@/lib/i18n/dictionaries/enJeu";
import type { ScoreDirect } from "@/types/electron";

/** Rôle retenu quand le jeu ne le dit pas : celui de la dernière saisie. */
export const ROLE_DEFAUT = "Jungle";

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
  const t = useT(enJeu);

  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.onPartieTerminee) return;

    return pont.onPartieTerminee(async ({ score, resultat, motifSansResultat, dureeSec, contexte }) => {
      // Sans score, il n'y a rien à enregistrer : mieux vaut ne rien écrire
      // qu'inventer une partie à zéro partout.
      if (!score) return;

      // L'issue ne s'invente pas. Elle se lit dans l'événement de fin de l'API
      // de partie, et cette lecture est une course : l'événement n'est publié
      // que dans les dernières secondes, et l'API se tait dès l'écran de fin.
      // Le repli précédent — « sans lecture, on retient la défaite » — faisait
      // tomber toutes les courses perdues du même côté : une défaite prise
      // pour une défaite ne se voit pas, une victoire prise pour une défaite
      // fait payer une dette qu'on ne doit pas, sans rien qui l'explique.
      // On préfère donc ne pas enregistrer, et le dire.
      if (resultat !== "V" && resultat !== "D") {
        // Une partie annulée n'est ni une victoire ni une défaite, et elle n'a
        // pas à être enregistrée : le lanceur l'a dit, il n'y a rien à
        // signaler. Le silence est la bonne réponse, pas un oubli.
        if (motifSansResultat === "remake") return;
        // Les chiffres partent avec le message : sans eux, « ajoute la partie
        // à la main » demande de se rappeler un KDA qu'on vient de quitter.
        // On les a sous la main, c'est le moment de les donner.
        const minutes = Math.max(1, Math.round((dureeSec ?? 0) / 60));
        const details = [
          score.champion,
          `${score.kills}/${score.deaths}/${score.assists}`,
          `${minutes} min`,
        ].filter(Boolean).join(" · ");
        notifierSysteme(t.issueIllisible, t.issueIllisibleCorps(details), "wow-partie");
        return;
      }

      // Le rôle vient du lanceur quand il a pu être lu — c'est la seule source
      // exacte. Sinon la dernière saisie manuelle, puis une valeur de repli.
      const role =
        contexte?.role
        || (typeof localStorage !== "undefined" && localStorage.getItem("lastRole"))
        || ROLE_DEFAUT;
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
            result: resultat,
            dureeSec,
            // Type de file, quand le lanceur a pu le dire : « Classée Solo/Duo »,
            // « ARAM »… Il distingue des parties que le KDA seul confond.
            fileNom: contexte?.file?.nom ?? undefined,
            fileClassee: contexte?.file?.classee ?? undefined,
            source: "live_client",
          }),
        });
        if (!res.ok) return;
        // La pastille de dette et le tableau de bord écoutent cet événement :
        // la partie apparaît sans qu'on ait à recharger quoi que ce soit.
        window.dispatchEvent(new Event("wow-dette-changee"));

        // Le moment que décrivaient les testeurs : on sort de partie, on
        // apprend ce qu'on doit, on le fait dans la file d'attente suivante.
        // Encore fallait-il le dire — jusqu'ici il fallait rouvrir la fenêtre
        // pour le savoir.
        const { repartition } = await res.json();
        const quantite = ventiler(repartition ?? {}).map((v) => `${v.valeur} ${t.noms[v.id]}`).join(" · ");
        if (quantite) notifierSysteme(t.partieTerminee, t.aFaire(quantite), "wow-partie");
      } catch {
        /* Le suivi de session reste le filet de sécurité. */
      }
    });
  }, [t]);

  return null;
}

export type { ScoreDirect };
