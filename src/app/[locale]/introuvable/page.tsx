import type { Metadata } from "next";
import { CorpsIntrouvable } from "@/components/CorpsIntrouvable";
import { toLocale } from "@/lib/i18n/langues";
import { layout } from "@/lib/i18n/dictionaries/layout";
import { textes } from "@/lib/i18n/textes";

/**
 * La 404 du site, dans la langue de l'adresse.
 *
 * **Pourquoi une PAGE et non la frontière `not-found` de Next.** Celle-ci vit
 * à la racine — sans mise en page racine, aucune frontière posée sous
 * `[locale]` n'est consultée — donc elle n'a pas de paramètre de route et
 * devait lire la langue dans un en-tête posé par le middleware. Or `headers()`
 * dans la frontière `not-found` rend DYNAMIQUE toute route de l'application :
 * elle fait partie de l'arbre de chaque page. Mesuré : 144 pages statiques
 * redeviennent dynamiques à cause de cette seule ligne, dont les 96 pages du
 * calculateur, qui n'existent que pour être trouvées par un moteur.
 *
 * Ici la langue vient du paramètre de route. La page est donc prérendue une
 * fois par langue, et le middleware y renvoie les adresses inconnues par une
 * réécriture qui porte le code 404 — l'adresse demandée reste affichée, et le
 * code de réponse est celui qui fait sortir une adresse d'un index.
 *
 * **Hors des moteurs.** Une page 404 indexée est une page de résultat qui ne
 * répond à rien. C'est la balise qui l'en sort, pas `robots.txt` : la leçon
 * est écrite dans `robots.ts` depuis le départ de `/waitlist`.
 */
/**
 * Le titre suit la langue de l'adresse, comme le corps.
 *
 * Il ne sert qu'à l'onglet du navigateur — la page refuse l'indexation — mais
 * un « 404 » nu dans un onglet japonais est exactement le défaut que le
 * préfixe de langue existe pour corriger.
 */
export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: textes(layout, toLocale(locale)).introuvableTitre,
    robots: { index: false, follow: false },
  };
}

export default async function PageIntrouvable(
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  return <CorpsIntrouvable locale={toLocale(locale)} />;
}
