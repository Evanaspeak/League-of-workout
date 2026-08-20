import { TelechargementClient } from "./TelechargementClient";
import { dernierInstalleur, PAGE_RELEASES } from "@/lib/release";

export const metadata = {
  title: "Télécharger l'app Windows",
  description: "L'application desktop Win or Workout pour Windows : détection automatique de tes games et compteur de pompes en temps réel.",
  alternates: { canonical: "/telechargement" },
};

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
