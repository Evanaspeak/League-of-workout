import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { requeteSql } from "./base";

/**
 * L'image de partage après une grosse séance (réponse 122).
 *
 * Ce qu'aucun test unitaire ne peut voir : que l'image se DESSINE vraiment.
 * `next/og` rend au serveur, avec son propre moteur de mise en page, et il
 * refuse des choses que React accepte — un `display` implicite, une propriété
 * qu'il ne connaît pas. Un test de route qui doublerait la base ne dirait rien
 * de ça.
 */
test.describe.configure({ mode: "serial" });

let etat: Awaited<ReturnType<import("@playwright/test").BrowserContext["storageState"]>>;
let pseudo = "";

test("ouvrir un compte", async ({ browser }) => {
  const ouvert = await ouvrirCompte(browser, "Seanc");
  etat = ouvert.etat;
  pseudo = ouvert.compte.pseudo;
});

test("sans séance, il n'y a rien à proposer", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  const r = await page.request.get("/api/seance");
  expect(r.status()).toBe(200);
  expect(await r.json()).toMatchObject({ partageable: false });
  await ctx.close();
});

test("une grosse séance se propose, et son image se dessine", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  const [compte] = await requeteSql<{ id: string }>(
    'SELECT id FROM "User" WHERE pseudo = $1', [pseudo]);
  const jour = new Date().toISOString().slice(0, 10);
  await requeteSql(
    `INSERT INTO "Paiement" (id, "userId", points, jour) VALUES ($1, $2, $3, $4)`,
    [`p-seance-${Date.now().toString(36)}`, compte.id, 250, jour]);

  const r = await page.request.get("/api/seance");
  expect(await r.json()).toMatchObject({ partageable: true, points: 250 });

  /**
   * L'image, et son en-tête PNG.
   *
   * On lit la SIGNATURE du fichier et non sa taille : une page d'erreur rendue
   * en 200 passerait un contrôle de taille, et c'est exactement le déguisement
   * qu'on veut refuser.
   */
  const img = await page.request.get("/api/seance/image");
  expect(img.status()).toBe(200);
  const octets = await img.body();
  expect([...octets.subarray(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
  expect(octets.length).toBeGreaterThan(3000);

  await ctx.close();
});

test("elle ne sort pas sans session", async ({ browser }) => {
  const anonyme = await browser.newContext();
  const page = await anonyme.newPage();
  const r = await page.request.get("/api/seance/image");
  /**
   * On regarde ce qui SORT, pas le code de réponse.
   *
   * Playwright suit les redirections : le 307 vers la connexion devient un 200
   * sur la page de connexion, et un contrôle sur le code aurait conclu que
   * l'image est publique. C'est la leçon déjà écrite ici — un code de réponse
   * ne dit rien de ce qui est sorti.
   */
  const octets = await r.body();
  expect([...octets.subarray(0, 4)]).not.toEqual([0x89, 0x50, 0x4e, 0x47]);
  await anonyme.close();
});
