import type { Metadata } from "next";
import { metadonneesPage } from "@/lib/i18n/metadonnees";
import { toLocale } from "@/lib/i18n/langues";

/**
 * L'écran ne s'indexe pas, mais son onglet se lit.
 *
 * Le titre était écrit en français en dur : quelqu'un qui a perdu son accès
 * arrivait, dans les six langues, sur un onglet français. C'est le pire moment
 * pour ne pas comprendre où l'on est.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  return {
    ...metadonneesPage("recuperation", toLocale(locale), "/recuperation"),
    robots: { index: false },
  };
}

export default function RecuperationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
