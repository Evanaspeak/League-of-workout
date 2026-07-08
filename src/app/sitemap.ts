import type { MetadataRoute } from "next";

const BASE = "https://winorworkout.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/beta`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/telechargement`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/cgu`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/confidentialite`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
