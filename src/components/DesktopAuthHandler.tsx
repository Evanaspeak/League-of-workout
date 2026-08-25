"use client";
import { useEffect } from "react";
import { effacer, lire } from "@/lib/stockage";

/**
 * Un seul transfert par chargement de page.
 *
 * Le composant est monté des deux côtés du retour anticipé du tableau de bord,
 * si bien que le passage de « en chargement » à « chargé » le démonte puis le
 * remonte. Sans ce verrou, un deuxième transfert pouvait partir pendant que le
 * premier était encore en vol — et l'aléa étant à usage unique, le second se
 * faisait refuser.
 *
 * Hors du composant : une ref serait remise à zéro par ce même remontage.
 */
let transfertLance = false;

// Exécuté dans Chrome après un OAuth réussi, uniquement si Electron a ouvert
// Chrome avec ?_desktop=1 (flag sauvegardé en localStorage par DesktopModeDetector).
// Transfère le JWT à l'app Electron via navigation localhost:3099.
export function DesktopAuthHandler() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    // Ne s'exécute pas dans l'app Electron elle-même.
    if (window.electronLOL?.isDesktop) return;
    // Ne s'exécute que si Electron a ouvert Chrome avec ?_desktop=1 ET son aléa.
    if (!lire("low_desktop_handoff")) return;
    const nonce = lire("low_desktop_nonce");
    if (!nonce) return;
    if (transfertLance) return;
    transfertLance = true;

    // Un échec ici laissait l'utilisateur sur un dashboard d'apparence normale
    // pendant que l'application restait déconnectée, sans rien pour le dire.
    // On le nomme, sinon la panne est indiscernable d'une réussite.
    const oublier = () => {
      effacer("low_desktop_handoff");
      effacer("low_desktop_nonce");
    };
    const echouer = (raison: string) => {
      oublier();
      window.location.assign(`/login?transfer_error=${raison}`);
    };

    (async () => {
      const reponse = await fetch("/api/auth/desktop-token", { method: "POST" });

      // 409 : le serveur a jugé que cette session n'est pas celle que
      // l'application a demandée. La comparaison des instants se fait chez lui,
      // sur une seule horloge — elle se faisait ici, entre l'heure du poste et
      // celle du serveur, et un poste en avance de quelques secondes suffisait
      // à faire refuser une connexion valide, donc à en imposer une seconde.
      if (reponse.status === 409) {
        const corps = await reponse.json().catch(() => null);
        oublier();
        // L'aléa repart avec : c'est lui qui ré-armera le transfert au retour,
        // sinon la connexion qui suit ne mènerait nulle part. `reconnexion` et
        // non `transfer_error` : le second remplace tout le formulaire par une
        // carte d'échec, alors qu'ici il faut justement pouvoir choisir un
        // compte. Le code accompagne la bannière : sans lui, deux pannes très
        // différentes présentent exactement le même écran.
        const code = typeof corps?.raison === "string" ? corps.raison : "inconnue";
        window.location.assign(
          `/login?_desktop=1&n=${encodeURIComponent(nonce)}&reconnexion=1`
          + `&code=${encodeURIComponent(code)}`
        );
        return;
      }

      const data = reponse.ok ? await reponse.json().catch(() => null) : null;
      if (!data?.jwt) return echouer("token");

      // Nettoie le flag avant de naviguer pour éviter toute boucle.
      oublier();
      // Navigation plutôt que fetch : contourne les restrictions CORS et
      // Private Network Access de Chrome sur HTTPS→HTTP localhost. C'est
      // aussi ce qui rendait le canal atteignable depuis n'importe quel site,
      // d'où l'aléa qui accompagne désormais le jeton.
      //
      // L'adresse est écrite en clair plutôt que `localhost` : sous Windows ce
      // nom se résout d'abord en `::1`, et Chromium ne se rabat pas sur IPv4 si
      // rien n'écoute là. L'application écoute bien les deux, mais autant ne
      // pas faire dépendre le transfert d'une résolution de nom.
      window.location.assign(
        `http://127.0.0.1:3099/set-session?t=${encodeURIComponent(data.jwt)}`
        + `&n=${encodeURIComponent(nonce)}`
      );
    })().catch(() => echouer("reseau"));
  }, []);

  return null;
}
