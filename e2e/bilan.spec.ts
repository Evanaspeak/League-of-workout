import { test, expect } from "@playwright/test";
import { purgerTentatives } from "./limiteur";

/**
 * Le bilan de saison, et son image.
 *
 * L'image est la raison d'être de l'écran : une page ne se poste pas sur
 * Discord, elle demande à celui d'en face de cliquer, et il ne clique pas. Le
 * test vérifie donc qu'elle sort vraiment de la route, en PNG, et qu'elle
 * refuse de sortir sans session.
 */
test.describe.configure({ mode: "serial" });

const marque = Date.now().toString(36);
const COMPTE = { pseudo: `Bila${marque}`, email: `bila-${marque}@example.test` };
let etat: import("@playwright/test").BrowserContextOptions["storageState"];

test("ouvrir un compte et enregistrer des parties", async ({ browser }) => {
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

  for (const [k, d, a, r] of [[2, 9, 4, "D"], [7, 3, 8, "V"], [0, 11, 2, "D"]] as const) {
    const rep = await page.request.post("/api/games", {
      data: { jeu: "League of Legends", role: "Mid", champion: "Ahri",
              kills: k, deaths: d, assists: a, result: r, exercice: "pompes" },
    });
    // Sans ce contrôle, un refus silencieux laisserait les assertions
    // suivantes porter sur un compte vide, et elles passeraient.
    expect(rep.status(), await rep.text()).toBe(200);
  }
  etat = await ctx.storageState();
  await ctx.close();
});

test("la page montre les chiffres de la période", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { sessionStorage.setItem("splash", "1"); } catch { /* stockage refusé */ }
  });
  await page.goto("/bilan", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // Trois parties enregistrées, une victoire sur trois.
  await expect(page.getByText("33 %", { exact: false })).toBeVisible();
  await expect(page.getByText("League of Legends").first()).toBeVisible();
  await ctx.close();
});

test("l'image sort en PNG, avec la session", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat });
  const r = await ctx.request.get("/api/bilan/image");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("image/png");
  const octets = await r.body();
  // Un PNG commence par cette signature. Une page d'erreur rendue en 200
  // passerait un simple contrôle de taille.
  expect(octets.subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  expect(octets.length).toBeGreaterThan(5_000);
  await ctx.close();
});

test("l'image ne sort pas sans session", async ({ browser }) => {
  // C'est une donnée de compte, même si elle est faite pour être montrée.
  const ctx = await browser.newContext();
  const r = await ctx.request.get("/api/bilan/image", { maxRedirects: 0 });
  expect(r.status()).not.toBe(200);
  await ctx.close();
});
