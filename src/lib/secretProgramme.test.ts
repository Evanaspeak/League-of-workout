/**
 * Le verrou des déclencheurs programmés, éprouvé pour lui-même.
 *
 * Il était couvert INDIRECTEMENT — les tests des deux routes vérifient qu'un
 * appel sans secret rend 401 — et cette couverture-là ne dit rien de la
 * branche que la PRODUCTION emprunte. Les tâches planifiées de Vercel n'ont
 * pas le choix de leur en-tête : elles posent `Authorization: Bearer`, et
 * personne d'ici ne peut voir si cette branche marche. Une erreur y a
 * exactement deux formes possibles, et les deux sont muettes : le déclencheur
 * est refusé en 401 tous les matins sans que rien ne crie — le travail
 * programmé note et passe, par conception — ou bien la comparaison est trop
 * lâche et la porte est ouverte.
 */
import { secretProgrammeValide } from "./secretProgramme";

const SECRET = "un-secret-de-test";

function requete(entetes: Record<string, string>): Request {
  return new Request("https://exemple.test/api/cron/matin", { headers: entetes });
}

describe("le secret des déclencheurs programmés", () => {
  const avant = process.env.RAPPEL_SECRET;
  afterEach(() => {
    if (avant === undefined) delete process.env.RAPPEL_SECRET;
    else process.env.RAPPEL_SECRET = avant;
  });

  /**
   * Le défaut le plus sûr, et celui qui compte le plus : une variable oubliée
   * ne doit pas transformer un déclencheur en porte ouverte.
   */
  it("refuse tout le monde quand aucun secret n'est configuré", () => {
    delete process.env.RAPPEL_SECRET;
    expect(secretProgrammeValide(requete({}))).toBe(false);
    expect(secretProgrammeValide(requete({ "x-rappel-secret": "" }))).toBe(false);
    expect(secretProgrammeValide(requete({ authorization: "Bearer " }))).toBe(false);
    expect(secretProgrammeValide(requete({ authorization: "Bearer undefined" }))).toBe(false);
  });

  describe("avec un secret configuré", () => {
    beforeEach(() => {
      process.env.RAPPEL_SECRET = SECRET;
    });

    it("accepte l'en-tête que GitHub Actions envoie", () => {
      expect(secretProgrammeValide(requete({ "x-rappel-secret": SECRET }))).toBe(true);
    });

    it("accepte l'en-tête que Vercel pose, et qui ne se choisit pas", () => {
      expect(secretProgrammeValide(requete({ authorization: `Bearer ${SECRET}` }))).toBe(true);
    });

    it("refuse une valeur qui n'est pas la bonne, sur l'un comme sur l'autre", () => {
      expect(secretProgrammeValide(requete({ "x-rappel-secret": "autre" }))).toBe(false);
      expect(secretProgrammeValide(requete({ authorization: "Bearer autre" }))).toBe(false);
      expect(secretProgrammeValide(requete({}))).toBe(false);
    });

    /**
     * Le préfixe fait partie de la comparaison. Sans lui, une valeur passée
     * nue dans `Authorization` — ce que fait un client mal écrit — serait
     * acceptée, et la porte s'élargirait sans que personne l'ait décidé.
     */
    it("exige le préfixe Bearer", () => {
      expect(secretProgrammeValide(requete({ authorization: SECRET }))).toBe(false);
      expect(secretProgrammeValide(requete({ authorization: `bearer ${SECRET}` }))).toBe(false);
      expect(secretProgrammeValide(requete({ authorization: `Basic ${SECRET}` }))).toBe(false);
    });

    /**
     * Un secret juste sur l'un des deux en-têtes suffit : les deux
     * déclencheurs n'envoient pas la même chose, et ils ne s'additionnent
     * jamais.
     */
    it("suffit d'un en-tête juste", () => {
      expect(
        secretProgrammeValide(
          requete({ "x-rappel-secret": "faux", authorization: `Bearer ${SECRET}` }),
        ),
      ).toBe(true);
      expect(
        secretProgrammeValide(
          requete({ "x-rappel-secret": SECRET, authorization: "Bearer faux" }),
        ),
      ).toBe(true);
    });
  });
});
