import type { Locale } from "./langues";

/**
 * Les textes d'un dictionnaire, au SERVEUR.
 *
 * `useT` est un hook : une page rendue au serveur ne peut pas s'en servir, et
 * c'est comme ça que deux pages du calculateur se sont retrouvées avec leur
 * titre écrit en français dans le JSX. Les traductions existaient pourtant,
 * dans les six langues, depuis le premier jour — personne ne les lisait.
 *
 * Le défaut n'était attrapé par rien. Le garde des textes en dur ne regarde
 * que `src/components`, et le recensement des clés mortes cherche `t.titre`
 * dans tout le code : d'autres écrans en emploient un, donc la clé passait
 * pour vivante. Il a fallu mesurer la page pour le voir — le rapport de
 * performance nomme le plus grand élément, et il l'a nommé en français sur
 * une page allemande.
 *
 * Même règle de repli que `useT` : ce qui n'est pas traduit retombe sur
 * l'anglais, jamais sur du vide.
 */
export function textes<T extends { fr: Record<string, unknown> }>(
  dict: T & { en: T["fr"] } & Partial<Record<Locale, T["fr"]>>,
  locale: Locale,
): T["fr"] {
  return (dict as Partial<Record<Locale, T["fr"]>>)[locale] ?? dict.en;
}
