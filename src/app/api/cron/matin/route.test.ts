/**
 * L'aiguilleur du matin.
 *
 * Ce qu'il fait tient en trois lignes, et chacune se trompe en silence si elle
 * lâche : refuser sans secret, appeler les DEUX envois, et ne pas laisser
 * l'échec de l'un emporter l'autre. Aucune de ces trois erreurs ne produit
 * d'alerte en production — le travail programmé note un code inattendu et
 * passe, par conception, pour ne pas envoyer vingt-quatre courriels par jour.
 */
import { requete } from "@/test/api";

const rappels = jest.fn();
const bilan = jest.fn();

jest.mock("@/app/api/push/programme/route", () => ({ POST: (r: Request) => rappels(r) }));
jest.mock("@/app/api/mail/hebdo/route", () => ({ POST: (r: Request) => bilan(r) }));

import { GET } from "./route";

const SECRET = "secret-de-test";

function reponse(corps: unknown) {
  return new Response(JSON.stringify(corps), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/cron/matin", () => {
  const avant = process.env.RAPPEL_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RAPPEL_SECRET = SECRET;
    rappels.mockResolvedValue(reponse({ examines: 3, envoyes: 1 }));
    bilan.mockResolvedValue(reponse({ examines: 3, envoyes: 0 }));
  });

  afterAll(() => {
    if (avant === undefined) delete process.env.RAPPEL_SECRET;
    else process.env.RAPPEL_SECRET = avant;
  });

  it("refuse sans secret, et n'appelle rien", async () => {
    const res = await GET(requete("/api/cron/matin"));
    expect(res.status).toBe(401);
    // Le second contrôle est le vrai : une route qui refuse APRÈS avoir
    // parcouru la base a déjà fait le travail qu'on voulait empêcher.
    expect(rappels).not.toHaveBeenCalled();
    expect(bilan).not.toHaveBeenCalled();
  });

  it("accepte l'en-tête de Vercel comme celui de GitHub", async () => {
    const parVercel = await GET(
      requete("/api/cron/matin", { headers: { authorization: `Bearer ${SECRET}` } }),
    );
    expect(parVercel.status).toBe(200);
    const parGithub = await GET(
      requete("/api/cron/matin", { headers: { "x-rappel-secret": SECRET } }),
    );
    expect(parGithub.status).toBe(200);
  });

  /**
   * Les deux, et pas un seul. C'est toute la raison d'être de cette route :
   * le plan Hobby n'autorise que deux tâches planifiées, donc un cron par
   * envoi ne donnerait qu'une chance à chacun.
   */
  it("appelle les deux envois", async () => {
    const res = await GET(
      requete("/api/cron/matin", { headers: { authorization: `Bearer ${SECRET}` } }),
    );
    expect(rappels).toHaveBeenCalledTimes(1);
    expect(bilan).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({
      push: { examines: 3, envoyes: 1 },
      mail: { examines: 3, envoyes: 0 },
    });
  });

  /**
   * Et il leur passe le secret qu'elles attendent. Sans ça les deux routes
   * répondraient 401 et l'aiguilleur rendrait 200 par-dessus : le déclencheur
   * paraîtrait sain pendant que rien ne partirait, ce qui est exactement le
   * symptôme qui a coûté des semaines d'envois muets.
   */
  it("leur passe une requête qu'elles acceptent", async () => {
    await GET(requete("/api/cron/matin", { headers: { authorization: `Bearer ${SECRET}` } }));
    for (const appelee of [rappels, bilan]) {
      const req: Request = appelee.mock.calls[0][0];
      expect(req.method).toBe("POST");
      expect(req.headers.get("x-rappel-secret")).toBe(SECRET);
    }
  });

  /**
   * L'échec de l'un n'emporte pas l'autre. Le bilan du lundi n'a pas à sauter
   * parce qu'un service de notification est en panne — et il ne se rattrape
   * pas : la marque est posée par jour local, donc une semaine manquée est
   * manquée.
   */
  it("envoie le bilan même si les rappels tombent", async () => {
    rappels.mockRejectedValue(new Error("service de notification en panne"));
    const res = await GET(
      requete("/api/cron/matin", { headers: { authorization: `Bearer ${SECRET}` } }),
    );
    expect(res.status).toBe(200);
    expect(bilan).toHaveBeenCalledTimes(1);
    expect(await res.json()).toEqual({
      push: { erreur: true },
      mail: { examines: 3, envoyes: 0 },
    });
  });

  it("survit à une réponse qui n'est pas du JSON", async () => {
    bilan.mockResolvedValue(new Response("<html>erreur</html>", { status: 500 }));
    const res = await GET(
      requete("/api/cron/matin", { headers: { authorization: `Bearer ${SECRET}` } }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).mail).toEqual({ erreur: true });
  });
});
