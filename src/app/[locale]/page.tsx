import type { Metadata } from "next";
import { descriptionPage, metadonneesPage } from "@/lib/i18n/metadonnees";
import { LANGUES, toLocale, type Locale } from "@/lib/i18n/langues";
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
  /**
   * Plus AUCUNE lecture de session ici, et c'est ce qui rend la page statique.
   *
   * Elle lisait `auth()` pour choisir entre « Créer mon compte » et « Mon
   * espace » sur trois boutons. Une lecture de session est une lecture de la
   * requête : la page la plus visitée du produit était donc la seule page
   * publique rendue à la demande, et elle payait des démarrages à froid
   * mesurés à 1,42 s et 2,11 s là où une page prérendue n'a jamais dépassé
   * 0,28 s.
   *
   * Les deux gros boutons pointent maintenant sur `/commencer`, qui aiguille
   * au CLIC ; le lien discret de la barre se résout au navigateur, comme
   * `Nav` le fait partout ailleurs. `dernierInstalleur`, lui, ne lit pas la
   * requête : il lit l'API GitHub avec `revalidate: 300`, ce qui est
   * exactement ce qu'une page prérendue sait faire.
   */
  const installeur = await dernierInstalleur();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(locale)) }}
      />
      <LandingClient locale={locale}
        telechargement={installeur?.url ?? PAGE_RELEASES}
        version={installeur?.version ?? null}
        logosJeux={logosDisponibles()}
        video={videoBoucle()}
      />
    </>
  );
}
