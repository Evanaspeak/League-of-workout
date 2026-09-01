"use client";
import { useEffect, useRef } from "react";
import { useChemin } from "@/lib/i18n/useChemin";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { estPagePublique } from "@/lib/pagesPubliques";
import { ecrireSession, lireSession } from "@/lib/stockage";

/**
 * Remonte vers le compte les deux choses que seul le navigateur connaît : la
 * langue affichée et le fuseau horaire.
 *
 * Elles vivaient uniquement côté navigateur, que le serveur ne voit pas. Les
 * notifications push partaient donc en français pour tout le monde, y compris
 * pour quelqu'un qui n'a jamais vu un écran français — et rien ne le
 * signalait, puisque celui qui écrit l'application la lit en français. Le
 * fuseau, lui, décide de l'heure à laquelle il est acceptable d'envoyer
 * quelque chose : sans lui, un rappel du matin réveille la moitié du monde.
 *
 * L'envoi ne part qu'une fois par valeur et par session : ni la langue ni le
 * fuseau ne changent souvent, et réécrire la même valeur à chaque page est
 * une requête de plus sur chaque chargement, pour rien.
 */
function fuseauDuNavigateur(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Ce qui a déjà été remonté pendant cette ouverture de l'application. */
const CLE_ENVOYE = "low_contexte_envoye";

export function ContexteNavigateur() {
  const { locale } = useLocale();
  const pathname = useChemin();
  const envoye = useRef<string | null>(null);

  useEffect(() => {
    // Pas de compte sur une page publique : la route répondrait 401.
    if (estPagePublique(pathname)) return;
    const fuseau = fuseauDuNavigateur();
    const cle = `${locale}|${fuseau ?? ""}`;
    if (envoye.current === cle) return;

    // Une seule écriture par ouverture de l'application, et non une par page.
    // La première version se contentait du garde en mémoire, qui repart à zéro
    // à chaque chargement : chaque navigation déclenchait donc une écriture en
    // base pour une valeur inchangée. Mesuré avant et après : ça ne change
    // rien au temps d'affichage — l'écriture ne bloquait pas le rendu. C'est
    // une requête de moins, pas une page plus rapide, et il ne faut pas se
    // raconter le contraire.
    try {
      if (lireSession(CLE_ENVOYE) === cle) { envoye.current = cle; return; }
    } catch { /* stockage refusé : on écrira, ce qui reste correct */ }
    envoye.current = cle;

    // Après le chargement : rien ici n'est urgent, et le faire pendant que la
    // page se monte revient à retarder ce que l'utilisateur attend.
    const poser = () => {
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPrefs: { langue: locale, ...(fuseau ? { fuseau } : {}) },
        }),
      }).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        try { ecrireSession(CLE_ENVOYE, cle); } catch { /* sans mémoire */ }
      }).catch(() => {
        // Hors ligne, ou session expirée : on retentera au prochain changement.
        envoye.current = null;
      });
    };
    if (document.readyState === "complete") { poser(); return; }
    window.addEventListener("load", poser);
    return () => window.removeEventListener("load", poser);
  }, [locale, pathname]);

  return null;
}
