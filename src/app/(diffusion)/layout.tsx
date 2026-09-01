import type { Metadata } from "next";
import "../globals.css";

/**
 * La coquille de la source de diffusion, et rien d'autre.
 *
 * Elle a sa propre mise en page racine parce que son adresse ne porte pas de
 * langue : `/obs/<jeton>` est un laissez-passer collé dans un logiciel de
 * streaming, et lui ajouter un préfixe casserait tous les liens déjà posés
 * chez les gens. Un logiciel de diffusion ne lit rien non plus, donc il n'y a
 * aucune langue à choisir.
 *
 * Elle y gagne au passage ce qu'elle aurait dû avoir depuis le début : ni
 * navigation, ni pied de page, ni police à télécharger, ni pont vers
 * l'application de bureau. OBS superpose cette page au jeu, et tout ce qui
 * n'est pas le compteur devient un rectangle au milieu de l'écran.
 */
export const metadata: Metadata = {
  // Redit ici : une mise en page racine n'hérite de rien, et sans base les
  // adresses d'images se résolvent sur localhost au moment de la construction.
  metadataBase: new URL("https://winorworkout.com"),
  robots: { index: false, follow: false },
};

export default function MiseEnPageDiffusion({ children }: { children: React.ReactNode }) {
  return (
    // La langue reste annoncée : un document sans `lang` est un défaut
    // d'accessibilité même quand personne n'est censé le lire. L'anglais, pour
    // la même raison que partout ailleurs — le français par défaut est le
    // réflexe de celui qui écrit l'application.
    <html lang="en" className="h-full">
      <body style={{ margin: 0, background: "transparent" }}>{children}</body>
    </html>
  );
}
