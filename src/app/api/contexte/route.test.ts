import { corps, utilisateur } from "@/test/api";

jest.mock("@/lib/prisma", () => ({ prisma: { user: { update: jest.fn(), updateMany: jest.fn() } } }));
jest.mock("@/lib/auth-helpers", () => ({ getCurrentUser: jest.fn() }));
jest.mock("@/lib/seed-defaults", () => ({ seedDefaults: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/exercicesConfig", () => ({ chargerRatios: jest.fn().mockResolvedValue({}) }));

import { GET } from "./route";
import { GET as GET_USER } from "../user/route";
import { GET as GET_DETTE } from "../dette/route";
import { GET as GET_CONSENTEMENT } from "../consentement/route";
import { getCurrentUser } from "@/lib/auth-helpers";
import { seedDefaults } from "@/lib/seed-defaults";
import { chargerRatios } from "@/lib/exercicesConfig";

const session = getCurrentUser as jest.Mock;

const compte = () => utilisateur({
  dettePointsDus: 42,
  rappelSeuilSec: 300,
  exercices: ["boxe"],
  santeConsentiLe: new Date("2026-01-02T03:04:05Z"),
  santeRefuseLe: null,
  poids: 78,
});

beforeEach(() => {
  jest.clearAllMocks();
  session.mockResolvedValue(compte());
});

describe("sans session", () => {
  it("refuse", async () => {
    session.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
  });

  /**
   * Et ne fait rien avant de refuser.
   *
   * Le semis du barème et le chargement des ratios partaient d'abord : une
   * requête sans session faisait travailler la base avant de se faire
   * éconduire. Le middleware n'ouvre pas cette adresse aux anonymes, donc ce
   * n'était pas une porte — mais une route qui agit avant de savoir à qui elle
   * parle est une mauvaise habitude, et le contrôle du code de réponse ne dit
   * rien de ce qu'elle a fait en chemin.
   */
  it("ne touche à rien avant d'avoir refusé", async () => {
    session.mockResolvedValue(null);
    await GET();
    expect(seedDefaults).not.toHaveBeenCalled();
    expect(chargerRatios).not.toHaveBeenCalled();
  });

  // Sans ce témoin, un module qu'on cesserait d'appeler DES DEUX CÔTÉS rendrait
  // le contrôle ci-dessus vrai en ne prouvant plus rien.
  it("les appelle bien une fois la session connue", async () => {
    await GET();
    expect(seedDefaults).toHaveBeenCalled();
    expect(chargerRatios).toHaveBeenCalled();
  });
});

describe("le contexte d'un écran connecté", () => {
  it("rend les trois blocs d'un coup", async () => {
    const c = await corps(await GET()) as Record<string, Record<string, unknown>>;
    expect(Object.keys(c).sort()).toEqual(["consentement", "dette", "user"]);
    expect(c.dette.points).toBe(42);
    expect(c.consentement.etat).toBe("accepte");
    expect(c.user.pseudo).toBeDefined();
  });

  /**
   * Le contrôle qui fait exister ce test.
   *
   * `/api/contexte` n'a d'intérêt que si elle rend EXACTEMENT ce que rendaient
   * les trois routes : sinon on n'a pas économisé deux allers-retours, on a
   * créé une quatrième vérité. La mise en forme vit dans un module commun, et
   * ce test le vérifie sur les réponses elles-mêmes plutôt que sur l'intention.
   */
  it("rend mot pour mot ce que rendaient les trois routes", async () => {
    const [ctx, user, dette, consentement] = await Promise.all([
      corps(await GET()), corps(await GET_USER()),
      corps(await GET_DETTE()), corps(await GET_CONSENTEMENT()),
    ]);
    expect(ctx.user).toEqual(user);
    expect(ctx.dette).toEqual(dette);
    expect(ctx.consentement).toEqual(consentement);
  });

  it("ne laisse pas sortir le jeton de diffusion", async () => {
    /**
     * Cette réponse part à CHAQUE chargement de page : elle finit dans le cache
     * du navigateur et dans l'onglet réseau. `jetonObs` est un laissez-passer
     * qui montre la dette en direct sans session — il était déjà sorti une fois
     * par `/api/user`, avant que `comptePublic` ne soit posé.
     */
    const c = await corps(await GET()) as Record<string, Record<string, unknown>>;
    expect(c.user.jetonObs).toBeUndefined();
    expect(c.user.passwordHash).toBeUndefined();
    expect(JSON.stringify(c)).not.toContain("jetonObs");
  });
});
