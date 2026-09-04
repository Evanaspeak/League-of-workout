"use client";
import { useEffect } from "react";
import { ventiler } from "@/lib/exercices";
import { notifierSysteme } from "@/lib/notifier";
import { useT, useDateLocale } from "@/lib/i18n/LocaleContext";
import { enJeu } from "@/lib/i18n/dictionaries/enJeu";
import type { ScoreDirect } from "@/types/electron";
import { ecrire, lire } from "@/lib/stockage";
import { estSansEnjeu, oublierSansEnjeu } from "@/lib/sansEnjeu";

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
  const etiquette = useDateLocale();

  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.onPartieTerminee) return;

    return pont.onPartieTerminee(async ({ score, resultat, motifSansResultat, dureeSec, contexte }) => {
      // Sans score, il n'y a rien à enregistrer : mieux vaut ne rien écrire
      // qu'inventer une partie à zéro partout. Mais se taire n'est pas non
      // plus une réponse : la partie a bien été jouée, elle n'entre pas, et
      // personne ne l'apprend. C'est exactement le défaut corrigé juste en
      // dessous pour l'issue, laissé ouvert un cran plus haut.
      //
      // Le cas est atteignable : la boucle passe « en partie » dès la première
      // lecture réussie, et ne garde un relevé que s'il porte un score. Un
      // joueur que l'API locale ne sait pas identifier dans sa propre partie
      // finit donc ici.
      if (!score) {
        notifierSysteme(t.partieNonLue, t.partieNonLueCorps, "wow-partie");
        return;
      }

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
      // exacte. Sinon le dernier rôle connu, puis une valeur de repli.
      //
      // « Dernier rôle connu » n'était alimenté que par la saisie manuelle :
      // quelqu'un qui ne joue qu'avec la détection automatique retombait donc
      // toujours sur la constante. Or le rôle pèse sur le calcul — un support
      // compté comme jungler paie ses morts trois points au lieu de deux et
      // deux dixièmes, et ses assists lui rapportent moins. Le lanceur donne le
      // rôle sur les files qui en attribuent un : on le retient pour les
      // parties où il ne le dira pas.
      // `lire` et `ecrire` rendent déjà `null` et `false` quand le stockage
      // est indisponible : le garde `typeof localStorage` qui était ici
      // regardait un objet global que le module ne lit plus.
      const role = contexte?.role || lire("lastRole") || ROLE_DEFAUT;
      if (contexte?.role) ecrire("lastRole", contexte.role);
      /**
       * La partie avait-elle été refusée à l'écran de chargement ?
       *
       * Lu ici et pas à l'envoi : le souvenir est consommé par CETTE partie,
       * et le laisser traîner ferait passer la suivante pour refusée si un
       * démarrage se perdait. Il s'efface donc dans la foulée, avant même de
       * savoir si l'enregistrement aboutit — une partie refusée reste refusée
       * même quand le serveur ne répond pas.
       */
      const sansEnjeu = estSansEnjeu();
      oublierSansEnjeu();
      try {
        const res = await fetch("/api/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jeu: "League of Legends",
            typeJeu: "parties",
            sansEnjeu,
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
        if (!res.ok) {
          // Un refus était muet, et la partie perdue avec. C'est le chemin
          // principal du produit : une session expirée, une valeur hors
          // bornes, une configuration absente, et la soirée ne compte pas
          // sans que rien ne le dise.
          const corps = await res.json().catch(() => null);
          notifierSysteme(
            t.nonEnregistree,
            t.refuse(String(corps?.error ?? res.status)),
            "wow-partie",
          );
          return;
        }
        // La pastille de dette et le tableau de bord écoutent cet événement :
        // la partie apparaît sans qu'on ait à recharger quoi que ce soit.
        window.dispatchEvent(new Event("wow-dette-changee"));

        // Le moment que décrivaient les testeurs : on sort de partie, on
        // apprend ce qu'on doit, on le fait dans la file d'attente suivante.
        // Encore fallait-il le dire — jusqu'ici il fallait rouvrir la fenêtre
        // pour le savoir.
        const { repartition } = await res.json();
        const quantite = ventiler(repartition ?? {}, null, etiquette).map((v) => `${v.valeur} ${t.noms[v.id]}`).join(" · ");
        if (quantite) notifierSysteme(t.partieTerminee, t.aFaire(quantite), "wow-partie");
      } catch {
        // Sans clé Riot de production, le suivi de session n'a rien à
        // rattraper : ce chemin-ci est le seul. Une coupure réseau doit donc se
        // dire, sinon la partie disparaît sans témoin.
        notifierSysteme(t.nonEnregistree, t.horsLigne, "wow-partie");
      }
    });
  }, [t]);

  return null;
}

export type { ScoreDirect };
