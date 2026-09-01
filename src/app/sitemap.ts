import type { MetadataRoute } from "next";
import { tousLesSlugs } from "@/lib/slugJeu";
import { LANGUES } from "@/lib/i18n/langues";
import { avecLocale, languesAlternatives } from "@/lib/i18n/cheminLocalise";

const BASE = "https://winorworkout.com";

/**
 * Le plan du site, une entrée par page ET par langue.
 *
 * Depuis que la langue est dans l'adresse, une page publique n'existe plus à
 * une adresse mais à six. N'en déclarer qu'une reviendrait à écrire cinq
 * versions pour rien : elles seraient trouvées par hasard ou pas du tout.
 *
 * Chaque entrée porte ses `alternates` : c'est ce qui dit à un moteur que les
 * six adresses sont la même page dans six langues. Sans ça, elles se font
 * concurrence entre elles au lieu de s'additionner, et c'est la plus ancienne
 * qui gagne partout.
 */
const PAGES: { chemin: string; changeFrequency: "weekly" | "monthly" | "yearly"; priority: number }[] = [
  { chemin: "/", changeFrequency: "weekly", priority: 1 },
  { chemin: "/beta", changeFrequency: "weekly", priority: 0.9 },
  { chemin: "/telechargement", changeFrequency: "monthly", priority: 0.6 },
  { chemin: "/calculateur", changeFrequency: "monthly", priority: 0.8 },
  // Une page par jeu : c'est là que les recherches atterrissent, pas sur
  // l'accueil. Les laisser hors du plan reviendrait à les écrire pour rien.
  ...tousLesSlugs().map(({ slug }) => ({
    chemin: `/calculateur/${slug}`,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  })),
  { chemin: "/cgu", changeFrequency: "yearly", priority: 0.2 },
  { chemin: "/confidentialite", changeFrequency: "yearly", priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.flatMap(({ chemin, changeFrequency, priority }) => {
    const alternates = { languages: languesAlternatives(chemin, BASE) };
    return LANGUES.map((locale) => ({
      url: `${BASE}${avecLocale(chemin, locale)}`,
      changeFrequency,
      priority,
      alternates,
    }));
  });
}
