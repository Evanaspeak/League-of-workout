"use client";
import dynamic from "next/dynamic";
import { useValeurClient } from "@/lib/valeurClient";

/**
 * Les six pièces qui ne servent que dans l'application Windows.
 *
 * Elles étaient montées par la mise en page racine, donc sur chaque page, donc
 * pour tout le monde : quelqu'un qui ouvre les CGU depuis un téléphone
 * téléchargeait le cadre de fenêtre, le suivi de mise à jour, la détection de
 * partie, la lecture d'écran d'Apex et le calcul de dette en direct — six
 * composants dont aucun ne peut rien faire sans le pont `electronLOL`.
 *
 * Elles sont maintenant chargées à la demande. Dans un navigateur, leur code
 * n'est jamais demandé : `dynamic` ne va chercher le module qu'au moment où le
 * composant se rend vraiment, et il ne se rend que si le pont existe.
 *
 * `ssr: false` n'est pas un détail : le serveur n'a pas de `window`, et rendre
 * ces composants à vide dans le HTML pour les remplacer ensuite ferait
 * exactement le travail qu'on cherche à éviter.
 */
const CadreDesktop = dynamic(
  () => import("./CadreDesktop").then((m) => ({ default: m.CadreDesktop })), { ssr: false });
const MajDesktop = dynamic(
  () => import("./MajDesktop").then((m) => ({ default: m.MajDesktop })), { ssr: false });
const DetectionSession = dynamic(
  () => import("./DetectionSession").then((m) => ({ default: m.DetectionSession })), { ssr: false });
const PartieDetectee = dynamic(
  () => import("./PartieDetectee").then((m) => ({ default: m.PartieDetectee })), { ssr: false });
const DetteDirecte = dynamic(
  () => import("./DetteDirecte").then((m) => ({ default: m.DetteDirecte })), { ssr: false });
const PartieApexLue = dynamic(
  () => import("./PartieApexLue").then((m) => ({ default: m.PartieApexLue })), { ssr: false });

export function PontDesktop() {
  // Le pont est posé par le préchargement d'Electron, avant que la page ne
  // s'exécute : au premier rendu client, il est là ou il ne sera jamais là.
  const surLApplication = useValeurClient(() => Boolean(window.electronLOL), false);
  if (!surLApplication) return null;
  return (
    <>
      {/* Marque la racine : c'est ce repère qui fait de la barre de navigation
          la barre de titre de la fenêtre. */}
      <CadreDesktop />
      {/* Mise à jour prête à installer. */}
      <MajDesktop />
      {/* Écoute les jeux détectés par l'application. */}
      <DetectionSession />
      {/* Enregistre les parties qu'elle a vues. */}
      <PartieDetectee />
      {/* Calcule ce que la partie en cours coûte, pour la pastille en jeu. */}
      <DetteDirecte />
      <PartieApexLue />
    </>
  );
}
