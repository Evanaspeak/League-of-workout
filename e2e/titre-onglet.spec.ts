import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { viderLesFenetres } from "./intro";

/**
 * Le compteur de dette dans le titre de l'onglet.
 *
 * C'est le rappel le moins coûteux du produit — il se voit dans la barre
 * d'onglets pendant qu'on joue — et il n'était couvert par RIEN. Il
 * disparaissait quatre chargements sur cinq : l'effet ne passe qu'une fois, à
 * l'arrivée de la dette, et Next écrit `document.title` de son côté à un
 * instant qu'on ne commande pas. Quand cette écriture tombait après la nôtre,
 * le compteur était perdu jusqu'à la navigation suivante.
 *
 * Ce fichier tient les DEUX moitiés, et la seconde porte autant que la
 * première : sans elle, la course décide, et un test qui passe une fois sur
 * cinq n'éprouve rien.
 */
test("le compteur de dette tient dans le titre de l'onglet", async ({ browser }) => {
  const { etat } = await ouvrirCompte(browser, "Onglet", { consentement: true });
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  await page.goto("/dashboard");
  await viderLesFenetres(page);

  const partie = await page.request.post("/api/games", {
    data: {
      jeu: "League of Legends", role: "Mid", champion: "Ahri",
      kills: 0, deaths: 12, assists: 1, result: "D",
    },
  });
  expect(partie.status(), await partie.text()).toBe(200);

  await page.goto("/dashboard");
  await viderLesFenetres(page);

  // Première moitié : le compteur est là, et il porte un NOMBRE — pas un
  // libellé qui aurait l'air d'un compteur.
  await expect.poll(() => page.title(), { timeout: 15_000 }).toMatch(/^\(\d[\d\s.,]*\)\s/);

  /**
   * Seconde moitié, et c'est elle qui éprouve la correction : on rejoue
   * l'écriture de Next à la main. Sans l'observateur qui repose le compteur,
   * le titre reste nu — c'est exactement l'état dans lequel quatre
   * chargements sur cinq se terminaient.
   */
  await page.evaluate(() => { document.title = "Win or Workout"; });
  await expect.poll(() => page.title(), { timeout: 5_000 }).toMatch(/^\(\d[\d\s.,]*\)\s/);

  await ctx.close();
});
