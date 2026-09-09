import { fetchBorne, DELAI_RESEAU_MS } from "./reseau";

/**
 * Ce que ce fichier éprouve, et ce qu'il n'éprouve PAS.
 *
 * Il tient le CONTRAT de l'enveloppe : une échéance posée quand l'appelant n'en
 * a pas, la sienne gardée quand il en a une, et le reste de la requête intact.
 *
 * Il ne prouve pas qu'une requête réellement retenue rend la main au bout de
 * quinze secondes — ça demande un serveur qui accepte et n'honore pas, donc un
 * navigateur. C'est `e2e/panne-serveur.spec.ts` qui le tient, et c'est là que
 * le défaut a été démontré avant d'être corrigé.
 */

const origTimeout = AbortSignal.timeout;

describe("fetchBorne", () => {
  let appels: number[];
  let recu: { url: string; init?: RequestInit }[];

  beforeEach(() => {
    appels = [];
    recu = [];
    AbortSignal.timeout = ((ms: number) => {
      appels.push(ms);
      return origTimeout.call(AbortSignal, ms);
    }) as typeof AbortSignal.timeout;
    globalThis.fetch = ((url: string, init?: RequestInit) => {
      recu.push({ url, init });
      return Promise.resolve(new Response("{}"));
    }) as typeof fetch;
  });

  afterEach(() => { AbortSignal.timeout = origTimeout; });

  it("pose une échéance quand l'appelant n'en a pas", async () => {
    await fetchBorne("/api/settings", { method: "PUT" });
    expect(appels).toEqual([DELAI_RESEAU_MS]);
    expect(recu[0].init?.signal).toBeInstanceOf(AbortSignal);
    expect(recu[0].init?.signal?.aborted).toBe(false);
  });

  it("pose une échéance même sans options du tout", async () => {
    await fetchBorne("/api/user");
    expect(appels).toEqual([DELAI_RESEAU_MS]);
    expect(recu[0].init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("combine le signal de l'appelant avec l'échéance, au lieu de choisir", async () => {
    // Garder le sien SEUL laisserait l'aperçu de partie sans borne ; le
    // remplacer casserait l'annulation qu'il a posée. Les deux, donc — c'est
    // ce qui permet à la règle de n'avoir aucune exemption.
    const sien = new AbortController();
    await fetchBorne("/api/games/preview", { method: "POST", signal: sien.signal });
    expect(appels).toEqual([DELAI_RESEAU_MS]);
    const combine = recu[0].init?.signal as AbortSignal;
    expect(combine).not.toBe(sien.signal);
    expect(combine.aborted).toBe(false);
    // L'annulation de l'appelant passe toujours.
    sien.abort();
    expect(combine.aborted).toBe(true);
  });

  it("laisse la requête intacte", async () => {
    await fetchBorne("/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jeu: "League of Legends" }),
    });
    expect(recu[0].url).toBe("/api/games");
    expect(recu[0].init?.method).toBe("POST");
    expect(recu[0].init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(recu[0].init?.body).toBe(JSON.stringify({ jeu: "League of Legends" }));
  });

  it("emploie une échéance qui abandonne pour de vrai", async () => {
    // Le témoin du MÉCANISME : sans lui, tout ce qui précède se satisferait
    // d'un signal qui ne se déclenche jamais. Une milliseconde ici, quinze
    // secondes en vrai — c'est la même fonction.
    AbortSignal.timeout = origTimeout;
    const sig = AbortSignal.timeout(1);
    expect(sig.aborted).toBe(false);
    await new Promise((r) => setTimeout(r, 30));
    expect(sig.aborted).toBe(true);
  });

  it("épingle l'échéance, parce qu'un délai ne change pas en silence", () => {
    // Un délai qu'on allonge « pour être sûr » reconstruit le défaut qu'on
    // corrige ; un délai qu'on raccourcit abandonne des requêtes qui allaient
    // aboutir. Le changer se discute, donc il se voit.
    expect(DELAI_RESEAU_MS).toBe(15_000);
  });
});
