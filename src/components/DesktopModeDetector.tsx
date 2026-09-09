"use client";
import { fetchBorne } from "@/lib/reseau";
import { useEffect } from "react";
import { ecrire, effacer } from "@/lib/stockage";

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
    ecrire("low_desktop_handoff", "1");
    ecrire("low_desktop_nonce", nonce);
    // Le tour est ouvert côté serveur : il ferme la session en cours et date la
    // demande. Le transfert ne portera que sur une session ouverte APRÈS lui —
    // sans cette borne, arriver ici en étant déjà connecté suffisait à expédier
    // cette session-là vers l'application, sans que personne ne se soit
    // authentifié. L'horodatage vivait ici, dans le navigateur ; il vit
    // désormais là où on le relira, ce qui évite de comparer deux horloges.
    //
    // L'effacement qui suit ne sert donc plus qu'à NETTOYER l'ancienne clé
    // chez qui la porte encore. Plus rien ne l'écrit ni ne la lit : sans cette
    // phrase, la ligne se relit comme du code vivant, et on va chercher qui
    // l'alimente. C'est la même raison que les anciens noms sans compte
    // qu'efface `oublierPremiereVisite`.
    effacer("low_desktop_arme");
    fetchBorne("/api/auth/desktop-round", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
