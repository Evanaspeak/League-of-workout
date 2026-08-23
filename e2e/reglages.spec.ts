import { test, expect } from "@playwright/test";
import { purgerTentatives } from "./limiteur";

/**
 * La section « Tes jeux », vue depuis un navigateur.
 *
 * Elle annonce « chaque jeu a ses réglages », puis n'en montre qu'un. C'est
 * exact — sans l'application Windows il n'y a ni pastille en jeu ni détection
 * automatique — mais rien ne le disait, et on cherchait où étaient passés les
 * autres jeux. Une section qui promet plus qu'elle ne donne doit au moins dire
 * pourquoi.
 */
test.describe.configure({ mode: "serial" });

const marque = Date.now().toString(36);
const COMPTE = { pseudo: `Regl${marque}`, email: `regl-${marque}@example.test` };
let etat: import("@playwright/test").BrowserContextOptions["storageState"];
let uid: string;

test("ouvrir un compte", async ({ browser }) => {
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
  etat = await ctx.storageState();
  await ctx.close();
});

test("dit pourquoi il n'y a qu'un jeu, et où sont les autres", async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: etat, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
  });
  const page = await ctx.newPage();
  await page.addInitScript((u) => {
    try {
      sessionStorage.setItem("splash", "1");
      for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
        localStorage.setItem(c, "1");
      }
    } catch { /* stockage refusé */ }
  }, uid);
  await page.goto("/settings#jeux", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  // Le jeu est bien là, et l'explication aussi.
  await expect(page.getByText("League of Legends").first()).toBeVisible();
  const lien = page.getByRole("link", { name: /installer l.application|install the app/i });
  await expect(lien).toBeVisible();
  await expect(lien).toHaveAttribute("href", "/telechargement");

  // Et rien ne déborde de l'écran au passage.
  const deborde = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(deborde).toBe(false);
  await ctx.close();
});
