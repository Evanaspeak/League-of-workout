import type { Metadata } from "next";
import { VueDiffusion } from "./VueDiffusion";

/**
 * La page que le logiciel de diffusion ouvre.
 *
 * Elle ne ressemble à aucune autre : fond transparent, un seul chiffre, aucune
 * navigation. OBS la superpose au jeu, et tout ce qui n'est pas le compteur
 * devient un rectangle opaque au milieu de l'écran.
 *
 * Hors du plan du site et hors des moteurs : l'adresse est un secret, et un
 * secret indexé n'en est plus un.
 */
export const metadata: Metadata = {
  title: "Compteur en direct",
  robots: { index: false, follow: false },
};

export default async function PageDiffusion(
  { params }: { params: Promise<{ jeton: string }> },
) {
  const { jeton } = await params;
  return <VueDiffusion jeton={jeton} />;
}
