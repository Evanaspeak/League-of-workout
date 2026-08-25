/**
 * Un appel à Riot, avec des reprises bornées dans le TEMPS.
 *
 * Les deux routes portaient la même fonction, recopiée, et donc le même
 * défaut :
 *
 * ```ts
 * const retryAfter = Number(res.headers.get("Retry-After")) || (attempt + 1);
 * await sleep(retryAfter * 1000);
 * ```
 *
 * `Retry-After` vient de Riot et vaut couramment 120 secondes sur un 429.
 * Trois reprises, et la fonction dort six minutes — dans un environnement où
 * une requête doit répondre en quelques dizaines de secondes. Elle ne rend
 * alors ni 429 ni erreur : elle est coupée par la plateforme, et l'appelant
 * reçoit une panne sans message, pour une situation parfaitement normale que
 * la route sait pourtant expliquer.
 *
 * On garde donc un budget d'attente total. Quand Riot demande plus que ce
 * qu'il reste, on renonce et on rend SA réponse : la route la traduit en un
 * refus lisible, ce qui vaut infiniment mieux qu'un silence de six minutes.
 *
 * Écrite une fois, parce que la même fonction en deux exemplaires portait deux
 * fois le même défaut. C'est le troisième cas de la nuit.
 */

/** Ce qu'on s'autorise à attendre, toutes reprises confondues. */
export const BUDGET_ATTENTE_MS = 4000;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type OptionsRiotFetch = {
  /** Nombre total de tentatives, la première comprise. */
  tentatives?: number;
  /** Injecté par les tests : la vraie attente rendrait la suite inutilisable. */
  attendre?: (ms: number) => Promise<unknown>;
  /** Injecté par les tests. */
  requete?: typeof fetch;
  budgetMs?: number;
};

export async function riotFetch(
  url: string,
  apiKey: string,
  options: OptionsRiotFetch = {},
): Promise<Response> {
  const tentatives = options.tentatives ?? 4;
  const attendre = options.attendre ?? dormir;
  const requete = options.requete ?? fetch;
  let budget = options.budgetMs ?? BUDGET_ATTENTE_MS;

  let res: Response = new Response(null, { status: 500 });
  for (let essai = 0; essai < tentatives; essai += 1) {
    res = await requete(url, { headers: { "X-Riot-Token": apiKey }, cache: "no-store" });
    if (res.status !== 429 && res.status < 500) return res;
    if (essai === tentatives - 1) return res;

    // Sans en-tête, on monte doucement : une seconde, deux, trois.
    const demandeSec = Number(res.headers.get("Retry-After"));
    const attenteMs = (Number.isFinite(demandeSec) && demandeSec > 0 ? demandeSec : essai + 1) * 1000;
    // Riot demande plus que ce qu'il nous reste : on rend sa réponse plutôt
    // que de se faire couper en route.
    if (attenteMs > budget) return res;
    budget -= attenteMs;
    await attendre(attenteMs);
  }
  return res;
}
