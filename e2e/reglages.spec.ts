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
  // La demande de consentement santé est modale et recouvre la page : sans
  // réponse, aucun clic ne passe. C'est le quatrième fichier de parcours qui
  // tombe dessus. Le compte vient de donner ses mesures à l'inscription,
  // accepter est le chemin qu'il suit réellement.
  const consenti = await page.request.post("/api/consentement", { data: { accepte: true } });
  expect(consenti.status(), await consenti.text()).toBe(200);
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

/**
 * Un réglage refusé par le serveur ne reste pas affiché comme s'il était pris.
 *
 * Les cinq réglages de « Ton effort » posaient la nouvelle valeur à l'écran
 * AVANT de l'envoyer, et ne faisaient rien du refus : l'écran montrait donc un
 * réglage que le serveur n'avait pas. On s'en apercevait au rechargement
 * suivant, sans savoir pourquoi — et ici, un exercice ou un plafond mal
 * enregistré change ce qu'on doit.
 *
 * Le `fetch` n'était pas protégé non plus : sans réseau, la promesse partait
 * en erreur et « Enregistrement… » restait à l'écran pour toujours.
 */
test("un réglage que le serveur refuse revient en arrière, et le dit", async ({ browser }) => {
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
  await page.goto("/settings", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  // On est bien sur les réglages : sans session on atterrirait sur la
  // connexion, et le test mesurerait une page qui n'a aucun réglage.
  expect(new URL(page.url()).pathname).toBe("/settings");
  // Les réglages sont rangés en rubriques repliées : il faut ouvrir « Ton
  // effort » avant de voir la liste des exercices.
  await page.getByRole("button", { name: /ton effort|your effort/i }).first().click();
  await page.waitForTimeout(600);

  // Seul l'enregistrement tombe en panne ; la lecture continue de répondre.
  await page.route("**/api/settings", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Erreur serveur" }),
      });
      return;
    }
    await route.continue();
  });

  // La boxe n'est pas cochée sur un compte neuf : on la coche, le serveur
  // refuse, elle doit se décocher.
  const boxe = page.getByText(/^boxe$/i).first();
  await boxe.waitFor({ timeout: 10_000 });
  await boxe.click();

  await expect(page.getByText(/erreur lors de la sauvegarde|error while saving/i))
    .toBeVisible({ timeout: 10_000 });

  // Et le serveur n'a rien retenu : c'est lui qui tranche, pas l'écran.
  const apres = await (await page.request.get("/api/settings")).json();
  expect(apres?.user?.exercices ?? []).not.toContain("boxe");
  await ctx.close();
});
