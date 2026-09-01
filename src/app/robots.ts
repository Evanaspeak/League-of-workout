import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Espace perso et API : aucune valeur SEO, on économise le crawl.
      //
      // La leçon que `/waitlist` avait laissée ici avant d'être supprimée, et
      // qui vaut pour la prochaine page qu'on voudra cacher : interdire
      // l'exploration n'empêche PAS l'indexation depuis un lien, et la page
      // paraît alors sans titre ni description, ce qui est le pire des deux
      // mondes. Une page qu'on ne veut pas voir sortir porte `noindex`, et
      // reste explorable pour que le moteur puisse le lire.
      disallow: ["/api/", "/dashboard", "/history", "/settings", "/admin", "/bilan"],
    },
    sitemap: "https://winorworkout.com/sitemap.xml",
  };
}
