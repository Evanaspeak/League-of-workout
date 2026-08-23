import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Est-ce que le site répond, et est-ce que la base répond derrière lui ?
 *
 * Deux pannes se ressemblent de l'extérieur et se corrigent différemment : un
 * déploiement cassé rend une page d'erreur, une base endormie rend une page qui
 * s'affiche et une application qui ne sait rien. Sans cette route, la seule
 * façon de le savoir était d'aller cliquer.
 *
 * Publique, et il le faut : une sonde qui exige une session ne dit rien le jour
 * où c'est l'authentification qui est tombée. Elle ne rend donc que ce qu'on
 * accepte de crier sur la place publique — un état, une durée, rien d'autre.
 * Pas de version, pas de nom de base, pas de message d'erreur brut : un
 * message de PostgreSQL nomme volontiers son hôte et son utilisateur.
 */

/**
 * Au-delà de ce seuil, la base n'est pas lente : elle se réveille.
 *
 * Neon suspend une base gratuite après quelques minutes sans requête. La
 * première requête suivante la rallume, ce qui prend plusieurs secondes. C'est
 * normal et sans gravité — mais c'est aussi ce qu'un visiteur rencontre, et il
 * faut pouvoir distinguer « ça a mis six secondes parce qu'elle dormait » de
 * « ça met six secondes tout le temps ».
 */
const SEUIL_REVEIL_MS = 2000;

/**
 * Réponse gardée en mémoire un court instant.
 *
 * L'adresse est publique et sans session : sans ce cache, n'importe qui peut
 * transformer une boucle de requêtes en charge sur la base. Trente secondes
 * suffisent à une supervision qui interroge tous les quarts d'heure, et
 * ramènent le coût d'un déluge à celui d'une seule requête.
 */
let cache: { quand: number; corps: Record<string, unknown>; statut: number } | null = null;
const CACHE_MS = 30_000;

export async function GET() {
  if (cache && Date.now() - cache.quand < CACHE_MS) {
    return NextResponse.json({ ...cache.corps, cache: true }, { status: cache.statut });
  }

  const debut = Date.now();
  let base: "ok" | "injoignable" = "injoignable";
  try {
    // La requête la moins chère qui prouve vraiment que la connexion vit :
    // un `SELECT 1` traverse le réseau, le pool et le moteur.
    await prisma.$queryRaw`SELECT 1`;
    base = "ok";
  } catch {
    // L'erreur ne sort pas : PostgreSQL nomme son hôte et son utilisateur dans
    // ses messages, et cette route est ouverte à tous.
    base = "injoignable";
  }
  const ms = Date.now() - debut;

  const corps = {
    ok: base === "ok",
    base,
    ms,
    /** Vrai quand la lenteur ressemble à un réveil de base suspendue. */
    reveil: base === "ok" && ms >= SEUIL_REVEIL_MS,
    quand: new Date().toISOString(),
  };
  const statut = base === "ok" ? 200 : 503;
  cache = { quand: Date.now(), corps, statut };
  return NextResponse.json(corps, { status: statut });
}
