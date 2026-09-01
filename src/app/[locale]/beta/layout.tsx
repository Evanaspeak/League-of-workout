import type { Metadata } from "next";
import { metadonneesPage } from "@/lib/i18n/metadonnees";
import { toLocale } from "@/lib/i18n/langues";

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  return metadonneesPage("beta", toLocale(locale), "/beta");
}

export default function BetaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
