import { test, expect, type Page } from "@playwright/test";
import { ouvrirCompte } from "./compte";

/**
 * Ce que la barre de navigation montre, et à qui.
 *
 * Elle est sur toutes les pages et n'avait aucun parcours à elle. Elle portait
 * sa PROPRE liste de pages publiques — deux entrées — alors que
 * `routesPubliques.ts` en compte dix. Sur les huit autres, un visiteur sans
 * compte voyait « Dashboard · Historique · Amis · Ta saison · Réglages » :
 * cinq liens qui le renvoient tous à un écran de connexion.
 *
 * Le pire endroit possible : les quinze pages du CALCULATEUR existent pour
 * être trouvées par une recherche. Le défaut tombait donc exactement sur les
 * gens qui arrivent, et sur eux seuls.
 */

/** Les libellés des liens de la barre, dans l'ordre où elle les rend. */
async function liensNav(page: Page): Promise<string[]> {
  return (await page.locator("nav a").allTextContents())
    .map((t) => t.trim()).filter(Boolean);
}

const APPLICATION = /dashboard|historique|amis|ta saison|réglages/i;

test("sans compte, les pages publiques ne proposent pas les écrans connectés", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  for (const chemin of ["/telechargement", "/cgu", "/confidentialite",
                        "/calculateur", "/calculateur/league-of-legends"]) {
    await page.goto(chemin, { waitUntil: "domcontentloaded" });
    // La barre lit la session avant de décider : on lui laisse le temps de
    // répondre, sinon on éprouverait seulement le premier rendu.
    await page.waitForTimeout(2500);
    const liens = await liensNav(page);
    expect(liens.filter((l) => APPLICATION.test(l)), `${chemin} : ${liens.join(" · ")}`)
      .toEqual([]);
  }
  await ctx.close();
});

test("avec un compte, les liens sont là — y compris sur une page publique", async ({ browser }) => {
  /**
   * L'autre moitié, et elle porte autant : la barre ne décide plus sur le
   * CHEMIN mais sur la session. Sans ce contrôle, la retirer partout
   * satisferait le test précédent — quelqu'un de connecté perdrait sa
   * navigation sur les CGU et sur la page de téléchargement, et rien ne le
   * dirait.
   */
  const { etat } = await ouvrirCompte(browser, "Nav", { consentement: true });
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  for (const chemin of ["/dashboard", "/cgu", "/telechargement"]) {
    await page.goto(chemin, { waitUntil: "domcontentloaded" });
    await expect
      .poll(async () => (await liensNav(page)).filter((l) => APPLICATION.test(l)).length,
        { timeout: 20_000, message: `${chemin} : la barre ne montre pas les écrans connectés` })
      .toBe(5);
  }
  await ctx.close();
});
