import type { MetadataRoute } from "next";

/**
 * Manifeste d'application installable.
 *
 * Il ne sert pas qu'au confort : sur iPhone, Safari n'autorise les
 * notifications web que si le site a été ajouté à l'écran d'accueil. Sans ce
 * fichier, aucun utilisateur iOS ne peut recevoir de rappel, quelle que soit
 * la configuration serveur.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Win or Workout",
    short_name: "Win//Workout",
    description:
      "Tes parties de jeu vidéo converties en effort physique. Pompes, squats ou boxe : tu choisis comment tu paies.",
    /**
     * Sans langue, volontairement.
     *
     * Il n'y a qu'un manifeste pour six langues, et il est engendré une fois :
     * il ne peut pas savoir laquelle lit la personne qui installe. Le
     * middleware rattrape l'adresse et la renvoie vers la langue négociée, ce
     * qui coûte un aller-retour au lancement et donne le bon écran. Y figer une
     * langue donnerait le mauvais à cinq personnes sur six.
     */
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0C0E11",
    theme_color: "#0C0E11",
    lang: "fr",
    categories: ["health", "fitness", "games"],
    icons: [
      {
        src: "/api/pwa-icon?taille=192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/pwa-icon?taille=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      // Android rogne les icônes « maskable » en cercle : le sigle est
      // suffisamment centré pour y survivre.
      {
        src: "/api/pwa-icon?taille=512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
