"use client";
import { useEffect, useRef, useState } from "react";
import { signInWithGoogle, signInWithDiscord } from "@/lib/auth-actions";
import { Wordmark } from "@/components/Wordmark";

/**
 * Arme le transfert, puis part chez le fournisseur.
 *
 * Le départ est déclenché en soumettant le VRAI formulaire d'action serveur —
 * le même que celui de la page de connexion. On ne duplique donc pas le flux
 * OAuth : la fermeture de session préalable, le choix explicite du compte et la
 * destination de retour restent définis à un seul endroit.
 *
 * Un bouton apparaît si le départ automatique n'a pas eu lieu au bout de trois
 * secondes : sans lui, un navigateur qui bloque la soumission laisserait une
 * page blanche et aucune issue.
 */
export function ConnexionAppClient({
  nonce,
  fournisseur,
}: {
  nonce: string;
  fournisseur: "google" | "discord";
}) {
  const formulaire = useRef<HTMLFormElement>(null);
  // Sans aléa, la page n'a pas été ouverte par l'application : on montre le
  // bouton tout de suite. Calculé au rendu, jamais posé depuis l'effet — un
  // état initial décidé dans un effet impose un second rendu pour rien.
  const [manuel, setManuel] = useState(!nonce);

  useEffect(() => {
    if (!nonce) return;
    localStorage.setItem("low_desktop_handoff", "1");
    localStorage.setItem("low_desktop_nonce", nonce);
    // L'instant de la demande : le transfert refusera une session ouverte avant.
    localStorage.setItem("low_desktop_arme", String(Date.now()));
    // Un cran après la peinture, pour que les marques soient bien écrites avant
    // de quitter la page.
    const depart = setTimeout(() => formulaire.current?.requestSubmit(), 60);
    const secours = setTimeout(() => setManuel(true), 3000);
    return () => { clearTimeout(depart); clearTimeout(secours); };
  }, [nonce]);

  const action = fournisseur === "discord" ? signInWithDiscord : signInWithGoogle;
  const nom = fournisseur === "discord" ? "Discord" : "Google";

  return (
    <div style={{
      minHeight: "76vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 18, textAlign: "center", padding: 24,
    }}>
      <Wordmark fontSize="1.35rem" />
      <p style={{ fontSize: "0.86rem", color: "var(--muted)", lineHeight: 1.6, maxWidth: 360 }}>
        {nonce
          ? `Ouverture de ${nom}…`
          : `Cette page se lance depuis l'application. Continue avec ${nom} si tu es arrivé ici autrement.`}
      </p>

      <form ref={formulaire} action={action}>
        <button
          type="submit"
          className="lol-btn"
          style={{ opacity: manuel ? 1 : 0, pointerEvents: manuel ? "auto" : "none", transition: "opacity 0.3s" }}
        >
          Continuer avec {nom}
        </button>
      </form>
    </div>
  );
}
