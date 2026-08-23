import type { MetadataRoute } from "next";
import { tousLesSlugs } from "@/lib/slugJeu";

const BASE = "https://winorworkout.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/beta`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/telechargement`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/calculateur`, changeFrequency: "monthly", priority: 0.8 },
    // Une page par jeu : c'est là que les recherches atterrissent, pas sur
    // l'accueil. Les laisser hors du plan reviendrait à les écrire pour rien.
    ...tousLesSlugs().map(({ slug }) => ({
      url: `${BASE}/calculateur/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: `${BASE}/cgu`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/confidentialite`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
