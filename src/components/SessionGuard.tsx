"use client";
import { useEffect } from "react";
import { useChemin } from "@/lib/i18n/useChemin";
import { signOut } from "next-auth/react";
import { estPagePublique } from "@/lib/pagesPubliques";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { avecLocale } from "@/lib/i18n/cheminLocalise";
import { ecrireSession, lire, lireSession } from "@/lib/stockage";
import { SESSION_MORTE } from "@/lib/chargerContexte";

export function SessionGuard() {
  const path = useChemin();
  const { locale } = useLocale();

  useEffect(() => {
    // La liste des pages publiques est commune au rail, à la visite, au
    // compteur et à l'accueil. Celle qui était recopiée ici ne connaissait ni
    // les CGU ni la politique de confidentialité : quelqu'un qui avait décoché
    // « rester connecté » et qui ouvrait les conditions dans une nouvelle
    // session de navigateur se faisait renvoyer vers la page de connexion, au
    // lieu de lire le texte qu'il était venu lire.
    if (estPagePublique(path)) return;
    if (typeof window === "undefined") return;
    if (window.electronLOL?.isDesktop) return;

    /**
     * La session peut mourir SOUS la page, et une page cliente ne le voit pas.
     *
     * Les quatre écrans connectés rendus au serveur redirigent d'eux-mêmes :
     * ils appellent `getCurrentUser()`, qui lit la base. `/settings` est
     * cliente de bout en bout — elle restait donc affichée, chacun de ses
     * panneaux annonçant son échec avec « Rien n'est perdu : recharge la
     * page », alors que recharger ne répare rien. On enfermait quelqu'un dans
     * un écran qui ne peut plus rien faire, sur le seul écran d'où il ne
     * pouvait pas sortir.
     *
     * Ça arrive pour de vrai : un compte supprimé depuis un autre appareil, ou
     * une base restaurée. Le commentaire de `ContexteConnecte` affirmait que
     * « SessionGuard s'occupe de la session elle-même » — il ne s'occupait que
     * du cas « rester connecté décoché », et une garantie décrite qui n'existe
     * pas fait cesser de vérifier.
     *
     * Il traite aussi ce qu'une redirection serveur ne peut pas voir : un
     * onglet laissé ouvert dont le jeton expire pendant la nuit.
     */
    const surSessionMorte = () => {
      void signOut({ redirect: false }).then(() => {
        window.location.href = avecLocale("/login", locale);
      });
    };
    window.addEventListener(SESSION_MORTE, surSessionMorte);
    const nettoyer = () => window.removeEventListener(SESSION_MORTE, surSessionMorte);

    const params = new URLSearchParams(window.location.search);
    if (params.get("li") === "1") {
      // Première arrivée après connexion → marque la session navigateur comme active
      ecrireSession("low_alive", "1");

      // Les connexions OAuth repartent par une redirection : impossible de
      // demander un cookie volatile depuis la page de connexion, qu'on a déjà
      // quittée. On le fait ici, au premier atterrissage, sinon la case
      // décochée ne changerait rien pour Google et Discord.
      if (lire("low_rm") === "false") {
        fetch("/api/auth/session-volatile", { method: "POST" }).catch(() => {});
      }

      params.delete("li");
      const clean = window.location.pathname + (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState({}, "", clean);
      return nettoyer;
    }

    // Si "Rester connecté" est actif (ou jamais configuré), pas de déconnexion auto
    const rm = lire("low_rm");
    if (rm !== "false") return nettoyer;

    // "Rester connecté" désactivé : la session n'est valide que tant que l'onglet reste ouvert
    const alive = lireSession("low_alive");
    if (alive) return nettoyer;

    // sessionStorage vide = le navigateur a été fermé et rouvert → déconnexion
    signOut({ redirect: false }).then(() => {
      // Dans la langue qu'on était en train de lire : se faire déconnecter ne
      // doit pas changer la langue au passage.
      window.location.href = avecLocale("/login", locale);
    });
    return nettoyer;
  }, [path, locale]);

  return null;
}
