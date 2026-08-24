import { test, expect } from "@playwright/test";
import { purgerTentatives } from "./limiteur";

/**
 * Ce que l'écran dit quand le serveur répond mal.
 *
 * Deux comportements ont été trouvés en coupant les réponses à la main, et le
 * second est le pire défaut de la soirée :
 *
 * - le tableau de bord gardait son squelette **pour toujours**. Une panne
 *   ressemblait exactement à une page lente : on attend, on recharge, on
 *   attend encore ;
 * - l'historique annonçait « aucune game à afficher » — c'est-à-dire qu'il
 *   affirmait quelque chose de FAUX sur les données de la personne. Quelqu'un
 *   dont la requête échoue croit que son historique a été effacé.
 *
 * Un échec doit se dire, et dire que rien n'est perdu.
 */
test.describe.configure({ mode: "serial" });

const marque = Date.now().toString(36);
const COMPTE = { pseudo: `Pann${marque}`, email: `pann-${marque}@example.test` };
let etat: import("@playwright/test").BrowserContextOptions["storageState"];
let uid: string;

test("ouvrir un compte avec une partie", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { sessionStorage.setItem("splash", "1"); } catch { /* stockage refusé */ }
  });
  await purgerTentatives();
  await page.goto("/beta");
  await page.getByPlaceholder(/pseudo/i).first().fill(COMPTE.pseudo);
  await page.locator('input[type="email"]').first().fill(COMPTE.email);
  await page.getByRole("button", { name: /rejoindre|obtenir|valider|envoyer|join/i }).first().click();
  const bloc = page.locator(".mono-num").first();
  await bloc.waitFor({ timeout: 20_000 });
  const code = (await bloc.innerText()).trim();

  await page.goto("/login");
  await page.getByPlaceholder(/ton pseudo|your username/i).fill(COMPTE.pseudo);
  await page.getByPlaceholder(/ton code|your code/i).fill(code);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 }),
    page.getByRole("button", { name: /^se connecter$|^sign in$/i }).click(),
  ]);
  uid = (await (await page.request.get("/api/user")).json()).id as string;
  const r = await page.request.post("/api/games", {
    data: { jeu: "League of Legends", role: "Mid", champion: "Ahri",
            kills: 1, deaths: 8, assists: 2, result: "D", exercice: "pompes" },
  });
  expect(r.status(), await r.text()).toBe(200);
  etat = await ctx.storageState();
  await ctx.close();
});

/** Ouvre un écran en faisant échouer une route. */
async function avecPanne(
  browser: import("@playwright/test").Browser, motif: string, chemin: string,
) {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.addInitScript((u) => {
    try {
      sessionStorage.setItem("splash", "1");
      for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
        localStorage.setItem(c, "1");
      }
    } catch { /* stockage refusé */ }
  }, uid);
  await page.route(motif, (r) => r.fulfill({
    status: 500, contentType: "application/json", body: '{"error":"Erreur serveur"}',
  }));
  await page.goto(chemin, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  return { ctx, page };
}

test("le tableau de bord dit qu'il n'a pas pu charger, au lieu d'attendre sans fin", async ({ browser }) => {
  const { ctx, page } = await avecPanne(browser, "**/api/dashboard*", "/dashboard");
  const texte = await page.evaluate(() => document.body.innerText);
  expect(texte).toContain("n'ont pas pu être chargées");
  await expect(page.getByRole("button", { name: /réessayer/i })).toBeVisible();
  await ctx.close();
});

test("l'historique ne prétend pas que le compte est vide", async ({ browser }) => {
  const { ctx, page } = await avecPanne(browser, "**/api/games*", "/history");
  const texte = await page.evaluate(() => document.body.innerText);
  // Le message d'échec doit être là…
  expect(texte).toContain("n'ont pas pu être chargées");
  // …et surtout, celui qui affirme le contraire ne doit pas y être.
  expect(texte).not.toContain("Aucune game à afficher");
  await ctx.close();
});

test("le bilan de saison le dit aussi", async ({ browser }) => {
  const { ctx, page } = await avecPanne(browser, "**/api/bilan", "/bilan");
  expect(await page.evaluate(() => document.body.innerText)).toContain("n'a pas pu être calculé");
  await ctx.close();
});

test("un historique vide dit où enregistrer une activité", async ({ browser }) => {
  /**
   * L'ajout d'activité vit dans le rail du tableau de bord, et nulle part
   * dans l'historique. Quelqu'un qui vient chercher « où j'enregistre ma
   * partie » à l'endroit le plus évident ne trouvait que « aucune game à
   * afficher » : un écran vide qui ne dit pas quoi faire est un cul-de-sac.
   *
   * On ne déplace pas le bouton — c'est une décision de produit — on dit où
   * il est.
   */
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.addInitScript((u) => {
    try {
      sessionStorage.setItem("splash", "1");
      for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
        localStorage.setItem(c, "1");
      }
    } catch { /* stockage refusé */ }
  }, uid);
  // Une réponse vide : le compte de ce fichier a une partie, on la retire.
  await page.route("**/api/games", (r) => r.fulfill({
    status: 200, contentType: "application/json", body: "[]",
  }));
  await page.goto("/history", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  const lien = page.getByRole("link", { name: /tableau de bord/i });
  await expect(lien).toBeVisible();
  expect(await lien.getAttribute("href")).toBe("/dashboard");
  await ctx.close();
});
