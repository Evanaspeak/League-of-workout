/**
 * La sonde de supervision.
 *
 * Ce qu'elle doit faire, et qui n'est pas évident : échouer. Une sonde qui
 * rend 200 quand la base est morte ne supervise rien, elle rassure — c'est le
 * défaut qu'on trouve le jour de la panne, jamais avant.
 */
jest.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: jest.fn() } }));

import { prisma } from "@/lib/prisma";

const requete = prisma.$queryRaw as unknown as jest.Mock;

/** Chaque test recharge le module : la route garde un cache de trente secondes. */
async function sonde() {
  let GET: () => Promise<Response>;
  await jest.isolateModulesAsync(async () => {
    ({ GET } = await import("./route"));
  });
  return GET!;
}

beforeEach(() => {
  jest.clearAllMocks();
  requete.mockResolvedValue([{ "?column?": 1 }]);
});

describe("quand tout va bien", () => {
  it("rend 200 et dit que la base répond", async () => {
    const r = await (await sonde())();
    expect(r.status).toBe(200);
    const c = await r.json();
    expect(c.ok).toBe(true);
    expect(c.base).toBe("ok");
    expect(typeof c.ms).toBe("number");
  });
});

describe("quand la base ne répond pas", () => {
  it("rend 503, pas 200", async () => {
    requete.mockRejectedValue(new Error("connexion refusée"));
    const r = await (await sonde())();
    expect(r.status).toBe(503);
    expect((await r.json()).ok).toBe(false);
  });

  it("ne laisse pas fuir le message de la base", async () => {
    // PostgreSQL nomme volontiers son hôte et son utilisateur dans ses erreurs,
    // et cette adresse est ouverte à tous.
    requete.mockRejectedValue(
      new Error('FATAL: password authentication failed for user "wow" at ep-secret-123.eu-central-1.aws.neon.tech'));
    const texte = await (await (await sonde())()).text();
    expect(texte).not.toMatch(/neon\.tech/);
    expect(texte).not.toMatch(/password/i);
    expect(texte).not.toMatch(/wow/);
  });
});

describe("réveil d'une base suspendue", () => {
  it("le distingue d'une base simplement disponible", async () => {
    // Neon suspend une base gratuite après quelques minutes : la requête
    // suivante la rallume, ce qui prend des secondes. Ce n'est pas une panne,
    // mais c'est ce que le visiteur subit, et il faut pouvoir le nommer.
    requete.mockImplementation(() => new Promise((r) => setTimeout(() => r([]), 2100)));
    const c = await (await (await sonde())()).json();
    expect(c.ok).toBe(true);
    expect(c.reveil).toBe(true);
  }, 10_000);

  it("ne crie pas au réveil pour une réponse immédiate", async () => {
    const c = await (await (await sonde())()).json();
    expect(c.reveil).toBe(false);
  });

  it("ne crie jamais au réveil sur une base MORTE", async () => {
    /**
     * Une base qui dort finit par répondre ; une base morte met le même temps
     * à échouer. Sans la condition sur l'état, la supervision noterait « la
     * base dormait, elle a mis 6000 ms » sur une panne franche — c'est-à-dire
     * le message qui dit « rien de grave » à l'instant où tout est grave.
     *
     * L'horloge est fabriquée plutôt qu'attendue : le seuil se franchit sans
     * faire dormir la suite, et le cas est déterministe.
     */
    const vrai = Date.now;
    let t = 1_000_000;
    Date.now = () => t;
    try {
      requete.mockImplementation(async () => { t += 6000; throw new Error("morte"); });
      const c = await (await (await sonde())()).json();
      expect(c.base).toBe("injoignable");
      expect(c.ms).toBeGreaterThanOrEqual(2000);
      expect(c.reveil).toBe(false);
    } finally {
      Date.now = vrai;
    }
  });
});

describe("cache", () => {
  it("n'interroge la base qu'une fois pour deux appels rapprochés", async () => {
    // L'adresse est publique et sans session : sans cache, une boucle de
    // requêtes devient une charge sur la base.
    const GET = await sonde();
    await GET();
    const second = await GET();
    expect(requete).toHaveBeenCalledTimes(1);
    expect((await second.json()).cache).toBe(true);
  });

  it("garde le statut d'échec pendant la durée du cache", async () => {
    // Un cache qui ne retiendrait que le corps rendrait 200 sur une réponse
    // qui dit « injoignable » : la supervision passerait au vert.
    requete.mockRejectedValue(new Error("morte"));
    const GET = await sonde();
    await GET();
    expect((await GET()).status).toBe(503);
  });
});
