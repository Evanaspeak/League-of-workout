import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Espace perso et API : aucune valeur SEO, on économise le crawl.
      disallow: ["/api/", "/dashboard", "/history", "/settings", "/admin", "/waitlist"],
    },
    sitemap: "https://winorworkout.com/sitemap.xml",
  };
}
