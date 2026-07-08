import { TelechargementClient } from "./TelechargementClient";

export const metadata = {
  title: "Télécharger l'app Windows",
  description: "L'application desktop Win or Workout pour Windows : détection automatique de tes games et compteur de pompes en temps réel.",
  alternates: { canonical: "/telechargement" },
};

const DOWNLOAD_URL = process.env.NEXT_PUBLIC_DOWNLOAD_URL ?? null;

export default function TelechargementPage() {
  return <TelechargementClient downloadUrl={DOWNLOAD_URL} />;
}
