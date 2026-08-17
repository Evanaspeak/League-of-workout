import { TelechargementClient } from "./TelechargementClient";

export const metadata = {
  title: "Télécharger l'app Windows",
  description: "L'application desktop Win or Workout pour Windows : détection automatique de tes games et compteur de pompes en temps réel.",
  alternates: { canonical: "/telechargement" },
};

const DEPOT = "Evanaspeak/League-of-workout";
/** Toujours valable : GitHub y redirige vers la release la plus récente. */
const PAGE_RELEASES = `https://github.com/${DEPOT}/releases/latest`;

/**
 * Installeur de la dernière version publiée.
 *
 * Le lien était auparavant figé dans une variable d'environnement Vercel, qu'il
 * fallait penser à changer à chaque release — et qu'on avait oubliée : la page
 * a servi la version 0.1.0 pendant deux mois et deux versions. On interroge
 * donc GitHub, une fois par heure, pour que le lien ne puisse plus périmer.
 */
async function dernierInstalleur(): Promise<{ url: string; version: string | null } | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${DEPOT}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const release = await res.json();
    const exe = (release?.assets ?? []).find(
      (a: { name?: string; browser_download_url?: string }) => a?.name?.endsWith(".exe")
    );
    if (!exe?.browser_download_url) return null;
    return {
      url: exe.browser_download_url,
      version: typeof release.tag_name === "string"
        ? release.tag_name.replace(/^desktop-v/, "")
        : null,
    };
  } catch {
    return null;
  }
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
