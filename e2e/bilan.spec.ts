import { test, expect } from "@playwright/test";
import { purgerTentatives } from "./limiteur";
import { sansLangue } from "./chemin";

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
    page.waitForURL((u) => !sansLangue(u.pathname).startsWith("/login"), { timeout: 30_000 }),
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
  // On attend ce qu'on vient chercher, pas le silence du réseau : il n'arrive
  // jamais franchement sur une page qui continue de parler.
  await page.goto("/bilan", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
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

test("l'image est demandée dès le HTML, pas après l'hydratation", async ({ browser }) => {
  /**
   * C'est ce qui sépare 3628 ms de 2100 ms sur téléphone bridé.
   *
   * La page est cliente : la balise n'existait qu'après le téléchargement du
   * JavaScript, l'hydratation et un aller-retour vers `/api/bilan`. Quatre
   * étapes en série pour une ressource qui ne dépend d'aucune d'elles — et
   * c'est le plus grand élément de la page.
   *
   * Deux choses la font partir tôt, et toutes deux vivent dans le HTML de la
   * réponse : la balise elle-même, et un `preload` que la page serveur pose
   * quand le compte a des parties. On les lit donc dans le HTML brut : une
   * fois la page hydratée, les deux existent de toute façon.
   */
  const ctx = await browser.newContext({ storageState: etat });
  const html = await (await ctx.request.get("/bilan")).text();

  expect(html, "la balise doit être dans la réponse du serveur")
    .toContain('src="/api/bilan/image"');
  expect(html, "le préchargement doit partir avec le HTML")
    .toMatch(/<link[^>]+rel="preload"[^>]+\/api\/bilan\/image/);
  await ctx.close();
});

test("un compte sans partie ne précharge pas d'image", async ({ browser }) => {
  // La dessiner pour un bilan vide serait la payer pour rien, côté serveur
  // comme côté réseau. Un comptage sur un index, lui, ne coûte rien.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { sessionStorage.setItem("splash", "1"); } catch { /* stockage refusé */ }
  });
  await purgerTentatives();
  const neuf = `Vide${Date.now().toString(36)}`;
  await page.goto("/beta");
  await page.getByPlaceholder(/pseudo/i).first().fill(neuf);
  await page.locator('input[type="email"]').first().fill(`${neuf.toLowerCase()}@example.test`);
  await page.getByRole("button", { name: /rejoindre|obtenir|valider|envoyer|join/i }).first().click();
  const bloc = page.locator(".mono-num").first();
  await bloc.waitFor({ timeout: 20_000 });
  const code = (await bloc.innerText()).trim();
  await page.goto("/login");
  await page.getByPlaceholder(/ton pseudo|your username/i).fill(neuf);
  await page.getByPlaceholder(/ton code|your code/i).fill(code);
  await Promise.all([
    page.waitForURL((u) => !sansLangue(u.pathname).startsWith("/login"), { timeout: 30_000 }),
    page.getByRole("button", { name: /^se connecter$|^sign in$/i }).click(),
  ]);

  const html = await (await ctx.request.get("/bilan")).text();
  expect(html).not.toMatch(/<link[^>]+rel="preload"[^>]+\/api\/bilan\/image/);
  await ctx.close();
});

test("l'image ne sort pas sans session", async ({ browser }) => {
  // C'est une donnée de compte, même si elle est faite pour être montrée.
  const ctx = await browser.newContext();
  const r = await ctx.request.get("/api/bilan/image", { maxRedirects: 0 });
  expect(r.status()).not.toBe(200);
  await ctx.close();
});

test("une image qui ne se dessine pas le dit, au lieu d'une icône cassée", async ({ browser }) => {
  // Ce qui a échoué n'est pas le bilan : les chiffres sont là, à côté. La page
  // montrait l'icône de fichier cassé du navigateur, et le bouton « ouvrir »
  // emmenait sur une page d'erreur brute.
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { sessionStorage.setItem("splash", "1"); } catch { /* stockage refusé */ }
  });

  // La modale de consentement santé recouvre la page et rien ne se lit
  // derrière. Septième fichier de parcours à tomber dessus ; elle se traverse
  // par l'API, comme dans les six autres.
  await ctx.request.post("/api/consentement", { data: { accepte: true } });

  await page.route("**/api/bilan/image", (route) => route.fulfill({ status: 500, body: "boum" }));
  await page.goto("/bilan", { waitUntil: "domcontentloaded" });
  expect(sansLangue(new URL(page.url()).pathname)).toBe("/bilan");

  await expect(page.getByText(/n.a pas pu être dessinée|could not be drawn/i))
    .toBeVisible({ timeout: 15_000 });
  // Et le bouton a disparu avec elle : il ouvrirait la même erreur, en pleine
  // page cette fois.
  await expect(page.getByRole("link", { name: /ouvrir|open/i })).toHaveCount(0);
  await ctx.close();
});
