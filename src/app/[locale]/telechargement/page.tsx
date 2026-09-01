import type { Metadata } from "next";
import { metadonneesPage } from "@/lib/i18n/metadonnees";
import { toLocale } from "@/lib/i18n/langues";
import { TelechargementClient } from "./TelechargementClient";
import { dernierInstalleur, PAGE_RELEASES } from "@/lib/release";

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  return metadonneesPage("telechargement", toLocale(locale), "/telechargement");
}

export default async function TelechargementPage() {
  const installeur = await dernierInstalleur();
  // Si GitHub ne répond pas, la page des releases reste un lien utilisable :
  // mieux vaut un clic de plus qu'un bouton absent.
  return (
    <TelechargementClient
      downloadUrl={installeur?.url ?? PAGE_RELEASES}
      version={installeur?.version ?? null}
    />
  );
}
