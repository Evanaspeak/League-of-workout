import type { Metadata } from "next";
import { metadonneesPage } from "@/lib/i18n/metadonnees";
import { toLocale } from "@/lib/i18n/langues";
import { auth } from "@/auth";
import LandingClient from "./LandingClient";
import { dernierInstalleur, PAGE_RELEASES } from "@/lib/release";
import { logosDisponibles } from "@/lib/logosJeux";
import { videoBoucle } from "@/lib/videoBoucle";

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  return metadonneesPage("accueil", toLocale(locale), "/");
}

// Données structurées : aide Google à comprendre ce qu'est le site.
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Win or Workout",
  url: "https://winorworkout.com",
  description:
    "Application qui convertit les parties de jeux vidéo en effort physique : chaque partie génère une dette calculée selon la performance, payable en pompes, en squats ou en boxe.",
  applicationCategory: "HealthApplication",
  operatingSystem: "Web, Windows",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  inLanguage: ["fr", "en", "es", "de", "zh", "ja"],
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
        logosJeux={logosDisponibles()}
        video={videoBoucle()}
      />
    </>
  );
}
