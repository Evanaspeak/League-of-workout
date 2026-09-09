import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { viderLesFenetres } from "./intro";
import { compter, requeteSql } from "./base";

/**
 * La courbe de force (ligne 152 du plan).
 *
 * `User.pompesMax` ne gardait que la valeur COURANTE : il n'y avait
 * littéralement aucune histoire à tracer, et c'est ce qui a bloqué cette ligne
 * pendant des mois. `TestForce` est l'histoire.
 *
 * Ce qu'aucun test unitaire ne peut voir, et qui fait tout l'objet de ce
 * fichier :
 *
 *  - qu'un test saisi ici atterrit vraiment en base, dans la table de
 *    l'HISTOIRE et pas seulement dans la colonne du compte ;
 *  - que la courbe arrive à l'ÉCRAN. Le composant déclare `historique?` —
 *    optionnel — donc un champ renommé côté route ne fait échouer ni la
 *    compilation ni une lecture d'API : la section disparaît, sans erreur et
 *    sans test rouge. C'est le défaut « un champ renommé vidait un panneau
 *    entier », et c'est exactement ce que le sabotage de la section a montré,
 *    en restant vert sur toute la suite unitaire.
 */

const TESTS = `SELECT count(*)::text AS n FROM "TestForce" t
  JOIN "User" u ON u.id = t."userId" WHERE u.pseudo = $1`;

test.describe.configure({ mode: "serial" });

test("un test saisi entre dans l'histoire, et la courbe le montre", async ({ browser }) => {
  const { etat, compte } = await ouvrirCompte(browser, "Force");
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  const pseudo = compte.pseudo;

  await page.goto("/settings#effort");
  await viderLesFenetres(page);
  await page.goto("/settings#effort");

  /**
   * Un compte neuf n'a rien fait : ni point, ni courbe, ni phrase de courbe.
   *
   * Le bouton d'abord, et ce n'est pas une politesse : `toHaveCount(0)` est
   * vrai TOUT DE SUITE, donc il passe avant que le panneau soit rendu et ne
   * prouve alors rien. Mesuré — avec la courbe rendue dès zéro point, ce
   * contrôle tombe quand la lecture en base le précède (elle laisse à l'API
   * le temps de répondre) et PASSE quand elle le suit. Il ne tenait que par
   * l'ordonnancement. Le bouton vient du même composant et de la même
   * réponse que la courbe : une fois qu'il est là, son absence dit quelque
   * chose.
   */
  await page.getByRole("button", { name: /^faire le test$|^take the test$/i })
    .waitFor({ state: "visible", timeout: 20_000 });
  expect(await compter(TESTS, [pseudo])).toBe(0);
  await expect(page.getByRole("heading", { name: /ta progression|your progress/i }))
    .toHaveCount(0);

  await page.getByRole("button", { name: /^faire le test$|^take the test$/i }).click();
  await page.getByLabel(/pompes réussies|push-ups completed/i).fill("24");
  await page.getByRole("button", { name: /^enregistrer$|^save$/i }).click();

  // Le point est en base. Sans ce contrôle, un écran qui se contente
  // d'afficher ce qu'on vient de taper passerait le test.
  await expect.poll(() => compter(TESTS, [pseudo])).toBe(1);

  /**
   * Un seul point n'est pas une courbe, et l'écran le dit plutôt que de
   * tracer un trait entre un point et lui-même.
   */
  await expect(page.getByText(/un seul test pour l'instant|only one test so far/i))
    .toBeVisible();

  /**
   * Le second point se sème en SQL, et il le faut.
   *
   * L'unicité est posée en base sur `(userId, jour)` : refaire le test dans la
   * même journée corrige le point du jour au lieu d'en ajouter un second —
   * c'est la règle, et elle est bonne. Un parcours ne peut donc pas fabriquer
   * deux abscisses en passant deux fois par l'écran, et attendre demain n'est
   * pas une option.
   */
  await requeteSql(
    `INSERT INTO "TestForce" ("id", "userId", "jour", "pompes", "createdAt")
     SELECT md5(random()::text), id, to_char(now() - interval '30 days', 'YYYY-MM-DD'), 12, now()
     FROM "User" WHERE pseudo = $1`,
    [pseudo],
  );

  await page.goto("/settings#effort");
  await expect(page.getByRole("heading", { name: /ta progression|your progress/i }))
    .toBeVisible();

  /**
   * Et la courbe est DESSINÉE, pas seulement titrée.
   *
   * `recharts` arrive à la demande : un import qui casse laisserait le titre
   * sans rien dessous, ce qui ressemble beaucoup à une section vide.
   */
  await expect(page.locator(".recharts-line").first()).toBeVisible({ timeout: 15_000 });

  await ctx.close();
});
