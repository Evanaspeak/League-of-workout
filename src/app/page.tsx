import { auth } from "@/auth";
import LandingClient from "./LandingClient";
import { dernierInstalleur, PAGE_RELEASES } from "@/lib/release";

export const metadata = {
  title: "Win or Workout — Gagne ta game, ou paie en sueur",
  description: "Win or Workout suit tes parties et calcule ta dette de pompes après chaque game, selon ta performance. League of Legends aujourd'hui — d'autres jeux bientôt.",
  alternates: { canonical: "/" },
};

// Données structurées : aide Google à comprendre ce qu'est le site.
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Win or Workout",
  url: "https://winorworkout.com",
  description:
    "Application qui convertit les parties de jeux vidéo en pompes : chaque game génère une dette d'exercice calculée selon la performance.",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web, Windows",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  inLanguage: ["fr", "en"],
};

export default async function LandingPage() {
  // On lit la session pour adapter le bouton de la nav, mais on NE redirige plus :
  // la page d'accueil reste accessible même connecté.
  // Le bouton principal de la page est un bouton de téléchargement : il doit
  // pointer sur l'installeur réel et dire quelle version il livre. Les deux
  // appels sont indépendants, donc simultanés.
  const [session, installeur] = await Promise.all([auth(), dernierInstalleur()]);
  const isLoggedIn = !!session?.user;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />
      <LandingClient
        isLoggedIn={isLoggedIn}
        telechargement={installeur?.url ?? PAGE_RELEASES}
        version={installeur?.version ?? null}
      />
    </>
  );
}
