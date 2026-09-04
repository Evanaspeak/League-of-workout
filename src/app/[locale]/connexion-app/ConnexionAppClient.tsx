"use client";
import { useEffect, useRef, useState } from "react";
import { signInWithGoogle, signInWithDiscord } from "@/lib/auth-actions";
import { Wordmark } from "@/components/Wordmark";
import { ecrire, effacer } from "@/lib/stockage";
import { useT } from "@/lib/i18n/LocaleContext";
import { connexionApp } from "@/lib/i18n/dictionaries/connexionApp";

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
  const t = useT(connexionApp);
  const formulaire = useRef<HTMLFormElement>(null);
  // Sans aléa, la page n'a pas été ouverte par l'application : on montre le
  // bouton tout de suite. Calculé au rendu, jamais posé depuis l'effet — un
  // état initial décidé dans un effet impose un second rendu pour rien.
  const [manuel, setManuel] = useState(!nonce);

  useEffect(() => {
    if (!nonce) return;
    ecrire("low_desktop_handoff", "1");
    ecrire("low_desktop_nonce", nonce);
    effacer("low_desktop_arme");

    let vivant = true;
    // On ouvre le tour AVANT de partir, et dans sa propre requête. C'est lui
    // qui ferme la session déjà présente — laisser ce soin à l'action serveur
    // revenait à effacer et à reposer des cookies dans une seule réponse, au
    // milieu du départ chez le fournisseur — et qui date la demande avec
    // l'horloge qui la relira.
    //
    // Une seconde et demie au maximum : le tour est une précaution, pas une
    // condition. Un réseau qui traîne ne doit pas laisser l'écran figé.
    const limite = new Promise((r) => setTimeout(r, 1500));
    Promise.race([fetch("/api/auth/desktop-round", { method: "POST" }).catch(() => {}), limite])
      .then(() => { if (vivant) formulaire.current?.requestSubmit(); });

    const secours = setTimeout(() => setManuel(true), 3000);
    return () => { vivant = false; clearTimeout(secours); };
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
        {nonce ? t.ouverture(nom) : t.horsApplication(nom)}
      </p>

      <form ref={formulaire} action={action}>
        <button
          type="submit"
          className="lol-btn"
          style={{ opacity: manuel ? 1 : 0, pointerEvents: manuel ? "auto" : "none", transition: "opacity 0.3s" }}
        >
          {t.continuer(nom)}
        </button>
      </form>
    </div>
  );
}
