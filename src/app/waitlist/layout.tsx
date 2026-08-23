import type { Metadata } from "next";

/**
 * La liste d'attente n'a rien à faire dans un index de recherche.
 *
 * Elle y était interdite par `robots.txt`, ce qui ne suffit pas : une adresse
 * interdite d'exploration peut tout de même être indexée depuis un lien, et
 * elle paraît alors sans titre ni description — le pire des deux mondes. Un
 * moteur ne peut lire « ne m'indexe pas » que s'il a le droit d'ouvrir la
 * page ; l'interdiction d'exploration a donc été levée en même temps que
 * cette balise a été posée.
 */
export const metadata: Metadata = {
  title: "Liste d'attente",
  robots: { index: false, follow: true },
};

export default function WaitlistLayout({ children }: { children: React.ReactNode }) {
  return children;
}
