"use client";

import { useEffect, useState } from "react";
import { Lien } from "@/components/Lien";
import { textes } from "@/lib/i18n/textes";
import { toLocale } from "@/lib/i18n/langues";
import { landing } from "@/lib/i18n/dictionaries/landing";
import { chargerCompte } from "@/lib/useIdCompte";

/**
 * Le lien discret de la barre, sur la page d'accueil.
 *
 * **Pourquoi lui seul est client.** La page d'accueil lisait la session au
 * SERVEUR pour choisir entre trois couples de libellé et d'adresse, ce qui la
 * rendait dynamique — la page la plus visitée du produit, et la seule page
 * publique qui ne fût pas prérendue. Les deux gros boutons n'en ont plus
 * besoin : ils pointent sur `/commencer`, qui aiguille au clic. Reste ce
 * lien-ci, et il se résout comme `Nav` le fait partout ailleurs sur le site.
 *
 * **Ce que ça coûte, écrit plutôt que tu** : quelqu'un de connecté qui atterrit
 * sur la page d'accueil voit « Se connecter » pendant le temps d'un
 * aller-retour, puis « Mon espace ». C'est exactement ce que fait la barre du
 * site, avec sa raison déjà écrite — « sur une page publique on ne sait pas
 * encore, et on ne promet rien avant de savoir ». Un lien de vingt pixels en
 * haut à droite ne se compare pas au bouton principal du héros, qui, lui, ne
 * bouge plus.
 *
 * L'état d'attente est celui du visiteur ANONYME, et pas l'inverse : c'est le
 * cas de l'immense majorité de qui arrive sur une page d'accueil, et le seul
 * qui ne promette rien de faux à quelqu'un qui n'a pas de compte.
 */
export function LienEspace({ locale }: { locale: string }) {
  const t = textes(landing, toLocale(locale));
  const [connecte, setConnecte] = useState(false);

  useEffect(() => {
    // La réponse est partagée avec les autres composants qui posent la même
    // question : `chargerCompte` la mémorise, donc elle ne part qu'une fois.
    let obsolete = false;
    chargerCompte().then((u) => {
      if (!obsolete && u) setConnecte(true);
    });
    return () => { obsolete = true; };
  }, []);

  return (
    <Lien href={connecte ? "/dashboard" : "/login"} className="wow-ghost wow-ghost-nav">
      {connecte ? t.navLoggedIn : t.navLoggedOut}
    </Lien>
  );
}
