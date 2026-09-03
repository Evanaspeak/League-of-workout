/**
 * La dernière version publiée de l'application desktop.
 *
 * La résolution vivait dans la page de téléchargement. La page d'accueil en a
 * désormais besoin elle aussi — son bouton principal est un bouton de
 * téléchargement, et un bouton de téléchargement doit dire ce qu'il télécharge.
 * Recopier la fonction, c'était accepter qu'un jour les deux ne pointent plus
 * au même endroit.
 */
const DEPOT = "Evanaspeak/League-of-workout";

/** Toujours valable : GitHub y redirige vers la release la plus récente. */
export const PAGE_RELEASES = `https://github.com/${DEPOT}/releases/latest`;

export type Installeur = { url: string; version: string | null };

export async function dernierInstalleur(): Promise<Installeur | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${DEPOT}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      /**
       * Cinq minutes, et pas une heure.
       *
       * La release ne change qu'à une publication — mais depuis qu'on publie
       * l'application dès qu'elle est modifiée, une heure de retard veut dire
       * une heure pendant laquelle le bouton offre l'installeur PRÉCÉDENT. Ce
       * n'est pas dramatique, les copies installées se mettant à jour toutes
       * seules par `latest.yml` ; ça l'est pour qui installe pour la première
       * fois dans cette fenêtre-là.
       *
       * Douze appels à l'API GitHub par heure au pire : très loin de la limite
       * de soixante par heure et par adresse, et la page reste statique.
       */
      next: { revalidate: 300 },
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
