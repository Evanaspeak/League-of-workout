import { requete, corps } from "@/test/api";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    paiement: { findMany: jest.fn() },
  },
}));
jest.mock("@/lib/exercicesConfig", () => ({ chargerRatios: jest.fn() }));

import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { appliquerRatios, RATIOS_DEFAUT } from "@/lib/exercices";

const p = prisma as unknown as Record<string, Record<string, jest.Mock>>;
const JETON = "a".repeat(43);

const lire = (jeton: string) =>
  GET(requete(`/api/obs/${jeton}`), { params: Promise.resolve({ jeton }) });

beforeEach(() => {
  jest.clearAllMocks();
  appliquerRatios(RATIOS_DEFAUT);
  p.user.findUnique.mockResolvedValue({
    id: "u1", dettePointsDus: 120, detteDepuis: null, exercices: ["boxe"],
  });
  p.paiement.findMany.mockResolvedValue([]);
});

describe("le lien secret", () => {
  it("rend 404 sur un jeton inconnu", async () => {
    p.user.findUnique.mockResolvedValue(null);
    expect((await lire(JETON)).status).toBe(404);
  });

  it("n'interroge même pas la base pour un jeton trop court", async () => {
    // Une adresse à trois caractères ne peut appartenir à personne : la
    // refuser avant la requête évite d'ouvrir la base à qui essaie au hasard.
    expect((await lire("court")).status).toBe(404);
    expect(p.user.findUnique).not.toHaveBeenCalled();
  });

  it("cherche par le jeton, jamais par autre chose", async () => {
    await lire(JETON);
    expect(p.user.findUnique.mock.calls[0][0].where).toEqual({ jetonObs: JETON });
  });
});

describe("ce qui sort, et ce qui ne sort pas", () => {
  it("ne laisse fuir ni identité ni statistiques", async () => {
    // Un lien collé dans un logiciel de diffusion finit par circuler, et
    // personne ne se souvient de ce qu'il ouvre.
    const texte = JSON.stringify(await corps(await lire(JETON)));
    for (const interdit of ["email", "pseudo", "riot", "userId", "u1"]) {
      expect(texte.toLowerCase()).not.toContain(interdit.toLowerCase());
    }
    // La demande elle-même ne doit pas réclamer ces colonnes.
    const select = JSON.stringify(p.user.findUnique.mock.calls[0][0].select);
    expect(select).not.toMatch(/email|pseudo|riot|password/i);
  });

  it("rend la dette dans l'unité de l'exercice choisi", async () => {
    const r = await corps(await lire(JETON));
    expect((r.lignes as string[]).length).toBeGreaterThan(0);
    expect(r.points).toBe(120);
  });

  it("rend la série DÉJÀ composée, dans la langue du compte", async () => {
    /**
     * Le composant écrivait `{serie} {jours}`, et le JSX pose une espace
     * entre deux expressions : « 3 日 » là où le japonais écrit « 3日 ». Le
     * dictionnaire traverse le réseau en JSON, où une fonction ne survit pas,
     * donc c'est la route qui compose — et sans ce contrôle, la retirer de la
     * réponse ne fait tomber aucun test : le composant a un repli, et il
     * réécrirait l'ancienne forme en silence.
     */
    const jours = ["2026-09-05", "2026-09-04", "2026-09-03"];
    p.paiement.findMany.mockResolvedValue(jours.map((jour) => ({ jour })));
    p.user.findUnique.mockResolvedValue({
      id: "u1", dettePointsDus: 120, detteDepuis: null, exercices: ["boxe"], langue: "ja",
    });
    const r = await corps(await lire(JETON)) as { serie: number; serieTexte: string };
    expect(r.serieTexte).toBe(`${r.serie}日`);
  });

  it("ne rend rien à payer quand aucun exercice ne s'accumule", async () => {
    // Les pompes se font dans la foulée : elles ne s'accumulent pas, et un
    // compteur qui monterait sans fin sur un stream serait faux.
    p.user.findUnique.mockResolvedValue({
      id: "u1", dettePointsDus: 200, detteDepuis: null, exercices: ["pompes"],
    });
    const r = await corps(await lire(JETON));
    expect(r.points).toBe(0);
    expect(r.lignes).toEqual([]);
  });
});
