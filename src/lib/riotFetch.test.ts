import { BUDGET_ATTENTE_MS, riotFetch } from "./riotFetch";

/**
 * Le défaut que ce module corrige tient en une ligne : l'attente venait de
 * Riot, sans borne. `Retry-After: 120` sur un 429 faisait dormir la fonction
 * deux minutes, trois fois de suite. Six minutes, dans un environnement qui
 * coupe une requête après quelques dizaines de secondes : l'appelant ne
 * recevait ni 429 ni erreur, mais une panne sans message, pour une situation
 * que la route sait pourtant expliquer.
 */

/** Une réponse Riot, avec l'en-tête qui commande l'attente. */
function reponse(status: number, retryAfter?: string) {
  return new Response("{}", {
    status,
    headers: retryAfter ? { "Retry-After": retryAfter } : {},
  });
}

/** Un faux `fetch` qui rend une réponse par appel, et compte les appels. */
function fausseRiot(suite: Response[]) {
  const urls: string[] = [];
  const requete = (async (url: string) => {
    urls.push(String(url));
    return suite[Math.min(urls.length - 1, suite.length - 1)];
  }) as unknown as typeof fetch;
  return { requete, urls };
}

describe("riotFetch", () => {
  it("rend la réponse du premier coup quand tout va bien", async () => {
    const { requete, urls } = fausseRiot([reponse(200)]);
    const r = await riotFetch("https://riot/x", "clé", { requete, attendre: async () => {} });
    expect(r.status).toBe(200);
    expect(urls).toHaveLength(1);
  });

  it("porte la clé, et ne la met pas dans l'adresse", async () => {
    let entetes: HeadersInit | undefined;
    const requete = (async (_u: string, init?: RequestInit) => {
      entetes = init?.headers; return reponse(200);
    }) as unknown as typeof fetch;
    await riotFetch("https://riot/x", "RGAPI-secrète", { requete, attendre: async () => {} });
    expect((entetes as Record<string, string>)["X-Riot-Token"]).toBe("RGAPI-secrète");
  });

  it("reprend sur 429 et sur 5xx, pas sur 404", async () => {
    for (const [code, appels] of [[429, 4], [500, 4], [404, 1], [200, 1]] as const) {
      const { requete, urls } = fausseRiot([reponse(code, "1")]);
      await riotFetch("https://riot/x", "clé", { requete, attendre: async () => {} });
      expect({ code, appels: urls.length }).toEqual({ code, appels });
    }
  });

  it("renonce quand Riot demande plus que le budget, au lieu de dormir", async () => {
    // C'est le défaut : deux minutes demandées, six minutes dormies, et une
    // fonction coupée par la plateforme sans rien dire à personne.
    const attentes: number[] = [];
    const { requete, urls } = fausseRiot([reponse(429, "120")]);
    const r = await riotFetch("https://riot/x", "clé", {
      requete,
      attendre: async (ms) => { attentes.push(ms); },
    });
    expect(attentes).toEqual([]);
    expect(urls).toHaveLength(1);
    // Et c'est bien la réponse de Riot qui repart : la route la traduit.
    expect(r.status).toBe(429);
  });

  it("n'attend jamais plus que son budget, en tout", async () => {
    const attentes: number[] = [];
    const { requete } = fausseRiot([reponse(429, "3")]);
    await riotFetch("https://riot/x", "clé", {
      requete,
      attendre: async (ms) => { attentes.push(ms); },
    });
    const total = attentes.reduce((a, b) => a + b, 0);
    expect(total).toBeLessThanOrEqual(BUDGET_ATTENTE_MS);
  });

  it("monte doucement quand Riot ne dit rien", async () => {
    const attentes: number[] = [];
    const { requete } = fausseRiot([reponse(500)]);
    await riotFetch("https://riot/x", "clé", {
      requete,
      attendre: async (ms) => { attentes.push(ms); },
    });
    expect(attentes).toEqual([1000, 2000]);
  });

  it("ignore un en-tête qui n'est pas un nombre", async () => {
    // Riot n'écrit pas toujours ce qu'on croit. `Number("bientôt")` vaut NaN,
    // et `NaN * 1000` aussi : sans contrôle, l'attente devient indéfinie.
    const attentes: number[] = [];
    const { requete } = fausseRiot([reponse(429, "bientôt")]);
    await riotFetch("https://riot/x", "clé", {
      requete,
      attendre: async (ms) => { attentes.push(ms); },
    });
    expect(attentes.every((n) => Number.isFinite(n) && n > 0)).toBe(true);
  });
});
