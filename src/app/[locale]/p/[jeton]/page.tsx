import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { jetonPlausible } from "@/lib/profilPublic";
import { longueurSerie, meilleureSerie } from "@/lib/serie";
import { textes } from "@/lib/i18n/textes";
import { profilPublic as dict } from "@/lib/i18n/dictionaries/profilPublic";
import { estLocale, type Locale } from "@/lib/i18n/langues";
import { etiquetteLocale } from "@/lib/i18n/langues";

/**
 * Le profil public, à l'adresse que son propriétaire partage (réponse 121).
 *
 * **Hors des moteurs.** L'adresse est un secret partagé par la personne
 * elle-même ; un secret indexé n'en est plus un, et une page de profil
 * indexée survit à la décision de la refermer. C'est la leçon déjà écrite
 * dans `robots.ts` au départ de `/waitlist` : interdire l'exploration
 * n'empêche pas l'indexation, seule la balise le fait.
 */
export const metadata: Metadata = {
  title: "Profil",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  // Aucune : les jetons ne se connaissent pas à la construction, et une page
  // engendrée pour un jeton serait un jeton publié.
  return [];
}

export default async function PageProfilPublic(
  { params }: { params: Promise<{ locale: string; jeton: string }> },
) {
  const { locale: brut, jeton } = await params;
  const locale: Locale = estLocale(brut) ? brut : "en";
  const t = textes(dict, locale);

  const compte = jetonPlausible(jeton)
    ? await prisma.user.findUnique({
        where: { jetonProfil: jeton },
        select: { id: true, pseudo: true },
      })
    : null;

  if (!compte) {
    // Trois mots, et rien d'autre. Dire « ce profil a été fermé » plutôt que
    // « lien inconnu » apprendrait qu'il a existé.
    return (
      <main className="lol-panel" style={{ maxWidth: 560, margin: "10vh auto", padding: 24 }}>
        <h1 className="titre-page" style={{ fontSize: "1.4rem" }}>{t.inconnu}</h1>
      </main>
    );
  }

  const [paiements, parties] = await Promise.all([
    prisma.paiement.findMany({
      where: { userId: compte.id },
      select: { points: true, jour: true },
      orderBy: { jour: "desc" },
      take: 800,
    }),
    prisma.game.findMany({
      // Les parties sans enjeu sont hors de TOUTE statistique : une soirée
      // refusée ne gonfle pas un profil qu'on partage.
      where: { userId: compte.id, sansEnjeu: false },
      select: { jeu: true },
    }),
  ]);

  const points = paiements.reduce((somme, p) => somme + p.points, 0);
  const jours = paiements.map((p) => p.jour);
  const compteJeux = new Map<string, number>();
  for (const g of parties) {
    if (!g.jeu) continue;
    compteJeux.set(g.jeu, (compteJeux.get(g.jeu) ?? 0) + 1);
  }
  const jeuFavori = [...compteJeux.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const nombre = new Intl.NumberFormat(etiquetteLocale(locale));

  return (
    <main className="lol-panel space-y-4" style={{ maxWidth: 560, margin: "8vh auto", padding: 24 }}>
      <h1 className="titre-page" style={{ fontSize: "1.6rem", overflowWrap: "anywhere" }}>
        {compte.pseudo}
      </h1>
      <p style={{ color: "var(--steel)", maxWidth: "55ch" }}>{t.sousTitre}</p>

      <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 16 }}>
        <div>
          <dt style={{ color: "var(--steel)", fontSize: ".85rem" }}>{t.effort}</dt>
          <dd className="mono-num" style={{ fontSize: "1.6rem", margin: 0 }}>{nombre.format(points)}</dd>
        </div>
        <div>
          <dt style={{ color: "var(--steel)", fontSize: ".85rem" }}>{t.serie}</dt>
          <dd className="mono-num" style={{ fontSize: "1.6rem", margin: 0 }}>
            {nombre.format(longueurSerie(jours))}
          </dd>
        </div>
        <div>
          <dt style={{ color: "var(--steel)", fontSize: ".85rem" }}>{t.meilleure}</dt>
          <dd className="mono-num" style={{ fontSize: "1.6rem", margin: 0 }}>
            {nombre.format(meilleureSerie(jours))}
          </dd>
        </div>
        <div>
          <dt style={{ color: "var(--steel)", fontSize: ".85rem" }}>{t.parties}</dt>
          <dd className="mono-num" style={{ fontSize: "1.6rem", margin: 0 }}>{nombre.format(parties.length)}</dd>
        </div>
      </dl>

      {jeuFavori && (
        <p style={{ color: "var(--steel)" }}>
          {t.jeuFavori} <strong style={{ color: "var(--gold)" }}>{jeuFavori}</strong>
        </p>
      )}
    </main>
  );
}
