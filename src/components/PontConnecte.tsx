"use client";
import dynamic from "next/dynamic";
import { useChemin } from "@/lib/i18n/useChemin";
import { estPagePublique } from "@/lib/pagesPubliques";

/**
 * Ce qui ne s'adresse qu'à un compte connecté.
 *
 * Sept composants montés par la mise en page racine ne font rien sur une page
 * publique : chacun commence par `if (estPagePublique(chemin)) return`. Ils
 * étaient chargés quand même — l'accueil, les CGU, le calculateur et la page
 * de connexion emportaient la modale d'accueil, la visite guidée, la demande
 * de consentement santé et leurs dictionnaires en six langues, pour ne rien
 * en montrer. Ce sont précisément les pages qu'un visiteur voit en premier.
 *
 * La décision se prend au rendu, sans requête : `useChemin` est connu tout
 * de suite, et `dynamic` ne va chercher un module qu'au moment où le composant
 * se rend vraiment.
 *
 * Trois pièces restent dans la mise en page et n'ont rien à faire ici :
 * `ServiceWorkerActif`, qui doit s'enregistrer pour tout le monde y compris
 * hors ligne ; `Nav` et `Footer`, qui s'affichent partout ; et `RailLateral`,
 * qui rend du vrai balisage — le différer ferait sauter la page au moment où
 * il se pose.
 */
const OnboardingModal = dynamic(
  () => import("./OnboardingModal").then((m) => ({ default: m.OnboardingModal })), { ssr: false });
const VisiteGuidee = dynamic(
  () => import("./VisiteGuidee").then((m) => ({ default: m.VisiteGuidee })), { ssr: false });
const ConsentementSante = dynamic(
  () => import("./ConsentementSante").then((m) => ({ default: m.ConsentementSante })), { ssr: false });
const SessionGuard = dynamic(
  () => import("./SessionGuard").then((m) => ({ default: m.SessionGuard })), { ssr: false });
const TitreAvecDette = dynamic(
  () => import("./TitreAvecDette").then((m) => ({ default: m.TitreAvecDette })), { ssr: false });
const ContexteNavigateur = dynamic(
  () => import("./ContexteNavigateur").then((m) => ({ default: m.ContexteNavigateur })), { ssr: false });
const InvitationInstallation = dynamic(
  () => import("./InvitationInstallation").then((m) => ({ default: m.InvitationInstallation })), { ssr: false });

export function PontConnecte() {
  if (estPagePublique(useChemin())) return null;
  return (
    <>
      {/* Sort quand la session a expiré. */}
      <SessionGuard />
      {/* Le compteur de dette dans le titre de l'onglet : le rappel le moins
          coûteux qui existe, et le seul visible pendant qu'on joue. */}
      <TitreAvecDette />
      {/* Passe avant l'accueil et la visite : tant que la question du
          consentement n'a pas de réponse, l'application détient des données
          qu'elle n'a pas le droit de traiter. */}
      <ConsentementSante />
      <OnboardingModal />
      {/* Prend le relais de la modale : elle explique le produit, la visite
          montre où sont les choses. */}
      <VisiteGuidee />
      {/* Fait connaître langue et fuseau au serveur, qui écrit les
          notifications et choisit l'heure de les envoyer. */}
      <ContexteNavigateur />
      {/* Propose l'écran d'accueil à la troisième visite, sur téléphone. */}
      <InvitationInstallation />
    </>
  );
}
