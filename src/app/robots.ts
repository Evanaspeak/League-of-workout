import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Espace perso et API : aucune valeur SEO, on économise le crawl.
      //
      // `/waitlist` en est sorti : interdire l'exploration n'empêche pas
      // l'indexation depuis un lien, et la page paraissait alors sans titre ni
      // description. Elle porte maintenant une balise `noindex`, que le moteur
      // ne peut lire que s'il a le droit d'ouvrir la page.
      disallow: ["/api/", "/dashboard", "/history", "/settings", "/admin", "/bilan"],
    },
    sitemap: "https://winorworkout.com/sitemap.xml",
  };
}
