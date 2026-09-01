import type { Metadata } from "next";
import { descriptionPage, metadonneesPage } from "@/lib/i18n/metadonnees";
import { LANGUES, toLocale, type Locale } from "@/lib/i18n/langues";
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

/**
 * Données structurées : aide Google à comprendre ce qu'est le site.
 *
 * La description suit la langue de la page. Elle était écrite en français en
 * dur et partait telle quelle sur les six adresses, ce qui est exactement le
 * défaut que le préfixe de langue existe pour corriger — au seul endroit où
 * c'est un moteur qui lit.
 */
const jsonLd = (locale: Locale) => ({
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Win or Workout",
  url: `https://winorworkout.com/${locale}`,
  description: descriptionPage("accueil", locale),
  applicationCategory: "HealthApplication",
  operatingSystem: "Web, Windows",
  offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
  inLanguage: LANGUES,
});

export default async function LandingPage(
  { params }: { params: Promise<{ locale: string }> },
) {
  const locale = toLocale((await params).locale);
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(locale)) }}
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
