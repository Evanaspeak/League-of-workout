import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * La vidéo de démonstration, si elle a été déposée.
 *
 * Le rapport du designer demandait une vidéo courte montrant la boucle : un
 * joueur perd, l'application lui réclame ses pompes, il les fait à côté de sa
 * chaise. Tant qu'elle n'existe pas, la page joue la version dessinée, en
 * trois temps. Le jour où le fichier arrive, il prend sa place.
 *
 * La présence est constatée sur le disque au rendu serveur : pas de balise qui
 * pointe dans le vide, pas de lecteur vide, pas de requête pour rien.
 */
export type VideoBoucle = {
  /** Chemins publics des sources trouvées, du format le plus léger au plus sûr. */
  sources: { src: string; type: string }[];
  /** L'image affichée avant le premier octet de vidéo. */
  affiche: string | null;
};

const DOSSIER = ["public", "videos"];

function present(nom: string): boolean {
  return existsSync(join(process.cwd(), ...DOSSIER, nom));
}

export function videoBoucle(): VideoBoucle | null {
  const sources: VideoBoucle["sources"] = [];
  // WebM d'abord : à qualité égale il pèse nettement moins. Le MP4 reste le
  // format que tout lit, il ferme la marche.
  if (present("boucle.webm")) sources.push({ src: "/videos/boucle.webm", type: "video/webm" });
  if (present("boucle.mp4")) sources.push({ src: "/videos/boucle.mp4", type: "video/mp4" });
  if (sources.length === 0) return null;

  const affiche = ["boucle.jpg", "boucle.png", "boucle.webp"].find(present);
  return { sources, affiche: affiche ? `/videos/${affiche}` : null };
}
