import { test, expect, type Page } from "@playwright/test";
import { requeteSql } from "./base";
import { purgerTentatives } from "./limiteur";

/**
 * « Portes-tu une montre connectée ? » — réponse 035, ligne 035 du plan.
 *
 * Ce que ce parcours éprouve, et qu'aucun test unitaire ne peut voir : le
 * BRANCHEMENT. La route est juste dans les deux cas — elle range ce qu'on lui
 * donne — c'est le FORMULAIRE qui peut ne rien lui donner du tout, et la
 * question serait alors posée pour rien.
 *
 * **Trois états, et c'est le troisième qui distingue.** Un booléen à défaut
 * faux ferait passer tous les comptes d'avant cette colonne pour des gens qui
 * ont dit non, alors qu'on ne leur a jamais posé la question. Un test écrit
 * sur « oui » et « non » seulement passerait avec ce défaut-là : il faut le
 * compte qui n'a PAS répondu, et il faut qu'il rende `null` et non `false`.
 *
 * Et il traverse le BLOC REPLIÉ, qui est l'autre moitié du sujet : les six
 * champs facultatifs de `/beta` ne se rendent que si l'on ouvre la rubrique.
 * C'est ce repli qui les a laissés six semaines hors de portée de l'audit
 * d'accessibilité, et un parcours qui ne déplie pas ne les verrait pas non
 * plus.
 */

async function inscrire(page: Page, montre: "oui" | "non" | null) {
  const marque = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  const compte = { pseudo: `mtr${marque}`, email: `mtr-${marque}@example.test` };

  await purgerTentatives();
  await page.goto("/beta");
  const envoyer = page.getByRole("button", { name: /rejoindre|obtenir|valider|envoyer|join/i }).first();

  await expect.poll(async () => {
    await page.getByPlaceholder(/pseudo/i).first().fill(compte.pseudo);
    await page.locator('input[type="email"]').first().fill(compte.email);
    return envoyer.isEnabled();
  }, { timeout: 30_000, intervals: [500, 1_000, 2_000] }).toBe(true);

  if (montre !== null) {
    // Le bloc facultatif est REPLIÉ : sans ce geste, le champ n'existe pas.
    const replie = page.locator('[aria-expanded="false"]').first();
    await replie.click();
    const champ = page.locator("#beta-montre");
    await expect(champ).toBeVisible();
    await champ.selectOption(montre);
  }

  await envoyer.click();
  await page.locator(".mono-num").first().waitFor({ timeout: 20_000 });
  return compte;
}

async function montreEnBase(pseudo: string) {
  const lignes = await requeteSql<{ montre: boolean | null }>(
    'SELECT "montre" FROM "User" WHERE pseudo = $1',
    [pseudo],
  );
  expect(lignes, `le compte ${pseudo} n'existe pas en base`).toHaveLength(1);
  return lignes[0].montre;
}

test.describe.configure({ mode: "serial" });

test("« oui » traverse le bloc replié et atteint la base", async ({ page }) => {
  const { pseudo } = await inscrire(page, "oui");
  expect(await montreEnBase(pseudo)).toBe(true);
});

test("« non » n'est pas la même chose que rien", async ({ page }) => {
  const { pseudo } = await inscrire(page, "non");
  expect(await montreEnBase(pseudo)).toBe(false);
});

test("ne pas répondre laisse la colonne NULLE, jamais fausse", async ({ page }) => {
  // Le contrôle qui distingue vraiment. Un `Boolean(...)` posé à la légère, ou
  // un défaut `false` au schéma, rendrait « n'en porte pas » pour quelqu'un à
  // qui on n'a rien demandé — et le compte au panneau d'administration
  // fausserait la proportion dans le sens qu'on aurait choisi.
  const { pseudo } = await inscrire(page, null);
  expect(await montreEnBase(pseudo)).toBeNull();
});
