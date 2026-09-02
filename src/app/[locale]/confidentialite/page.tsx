import type { Metadata } from "next";
import { metadonneesPage } from "@/lib/i18n/metadonnees";
import { toLocale } from "@/lib/i18n/langues";
import ConfidentialiteClient from "./ConfidentialiteClient";

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  return metadonneesPage("confidentialite", toLocale(locale), "/confidentialite");
}

export default async function ConfidentialitePage(
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  return <ConfidentialiteClient locale={locale} />;
}
