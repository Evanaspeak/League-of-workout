import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { viderLesFenetres } from "./intro";
import { compter } from "./base";

/**
 * « Ton corps » : l'objectif calorique, la pesée, le mètre-ruban.
 *
 * Étape 05 du plan. Ce qu'aucun test unitaire ne peut voir, et qui fait tout
 * l'objet de ce fichier :
 *
 *  - que la fonctionnalité est bien ÉTEINTE sur un compte neuf (réponse 013) ;
 *  - que le chiffre calculé arrive à l'écran, et pas seulement dans la réponse
 *    d'une route — c'est le défaut « un champ renommé vidait un panneau
 *    entier », qu'un type optionnel ne peut pas attraper ;
 *  - qu'une pesée saisie ici atterrit en base.
 */

const PESEES = `SELECT count(*)::text AS n FROM "Pesee" p
  JOIN "User" u ON u.id = p."userId" WHERE u.pseudo = $1`;

test("le corps est éteint au départ, et s'allume avec un objectif chiffré", async ({ browser }) => {
  const { etat } = await ouvrirCompte(browser, "Corps", { consentement: true });
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  /**
   * Le poids, la taille et l'âge viennent du compte, pas de cet écran : sans
   * eux, aucun objectif n'est calculable et le parcours n'éprouverait que le
   * message « il manque quelque chose ».
   */
  const profil = await page.request.put("/api/settings", {
    data: { userPrefs: { poids: 80, taille: 180, age: 30 } },
  });
  expect(profil.status(), await profil.text()).toBe(200);

  await page.goto("/settings#corps");
  await viderLesFenetres(page);
  await page.goto("/settings#corps");

  // Réponse 013 : rien ne s'allume tant qu'on ne le demande pas.
  await expect(page.getByRole("button", { name: /rien pour l'instant|nothing for now/i }))
    .toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /^perdre$|^lose$/i }).click();
  await page.getByRole("button", { name: /variante « homme »|male variant/i }).click();
  await page.getByLabel(/niveau d'activité|activity level/i).selectOption("modere");

  /**
   * Le contrôle qui décide de tout : le chiffre est À L'ÉCRAN.
   *
   * 80 kg, 180 cm, 30 ans, variante « h », activité modérée → 1780 kcal de
   * métabolisme de base, ×1,55 = 2759, moins vingt pour cent = 2207. Le
   * calculer ici plutôt que de chercher « kcal » distingue « le panneau
   * s'affiche » de « le panneau dit la bonne chose ».
   */
  await expect(page.getByText(/2207 kcal/)).toBeVisible({ timeout: 10_000 });

  // Réponse 016 : aucune date n'est promise, et l'écran dit pourquoi.
  await expect(page.getByText(/7 700|7,700/)).toBeVisible();

  await ctx.close();
});

test("une pesée saisie arrive en base", async ({ browser }) => {
  const { etat, compte } = await ouvrirCompte(browser, "Pesee", { consentement: true });
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.goto("/settings#corps");
  await viderLesFenetres(page);
  await page.goto("/settings#corps");

  expect(await compter(PESEES, [compte.pseudo])).toBe(0);

  await page.getByLabel(/poids en kilos|weight in kilos/i).fill("78.4");
  await page.getByRole("button", { name: /^enregistrer$|^save$/i }).first().click();

  /**
   * Le contrôle qui compte : la ligne existe. Sans lui, un écran qui se
   * contente d'afficher « Enregistré » passerait — et c'est exactement ce que
   * ce projet a corrigé plusieurs fois.
   */
  await expect.poll(() => compter(PESEES, [compte.pseudo]), { timeout: 10_000 }).toBe(1);

  await ctx.close();
});
