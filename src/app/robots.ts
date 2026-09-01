import type { MetadataRoute } from "next";
import { LANGUES } from "@/lib/i18n/langues";

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
      //
      // Une page publique existe maintenant à six adresses, et une page privée
      // aussi : la liste se décline donc par langue. Écrite en clair plutôt
      // qu'avec des jokers — tous les explorateurs ne les comprennent pas, et
      // ce fichier est engendré, donc sa longueur ne coûte rien à personne.
      disallow: [
        "/api/",
        ...LANGUES.flatMap((l) =>
          ["/dashboard", "/history", "/settings", "/admin", "/bilan"].map((c) => `/${l}${c}`)),
      ],
    },
    sitemap: "https://winorworkout.com/sitemap.xml",
  };
}
