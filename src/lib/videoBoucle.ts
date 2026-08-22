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

/**
 * Présence constatée une seule fois, au chargement du module.
 *
 * Le chemin se composait d'abord d'un tableau étalé et d'un paramètre, puis
 * d'un paramètre seul : dans les deux cas Turbopack renonce à l'analyser et
 * annonce « Dynamic filesystem access causes tracing of the whole project » —
 * il embarque alors tout le dépôt dans la fonction, faute de savoir ce qui
 * sera lu.
 *
 * Écrire chaque appel en toutes lettres, à la racine du module, rend la
 * lecture analysable. C'est aussi plus juste : la page d'accueil est rendue à
 * la construction, donc ces fichiers sont constatés une fois pour toutes, et
 * non à chaque rendu.
 */
const A_WEBM = existsSync(join(process.cwd(), "public/videos/boucle.webm"));
const A_MP4 = existsSync(join(process.cwd(), "public/videos/boucle.mp4"));
const AFFICHES = [
  ["boucle.jpg", existsSync(join(process.cwd(), "public/videos/boucle.jpg"))],
  ["boucle.png", existsSync(join(process.cwd(), "public/videos/boucle.png"))],
  ["boucle.webp", existsSync(join(process.cwd(), "public/videos/boucle.webp"))],
] as const;

export function videoBoucle(): VideoBoucle | null {
  const sources: VideoBoucle["sources"] = [];
  // WebM d'abord : à qualité égale il pèse nettement moins. Le MP4 reste le
  // format que tout lit, il ferme la marche.
  if (A_WEBM) sources.push({ src: "/videos/boucle.webm", type: "video/webm" });
  if (A_MP4) sources.push({ src: "/videos/boucle.mp4", type: "video/mp4" });
  if (sources.length === 0) return null;

  const affiche = AFFICHES.find(([, present]) => present)?.[0] ?? null;
  return { sources, affiche: affiche ? `/videos/${affiche}` : null };
}
