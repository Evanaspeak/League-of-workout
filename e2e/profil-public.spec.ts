import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { requeteSql } from "./base";

/**
 * Le profil public, à adresse partageable (réponse 121, « au choix »).
 *
 * Quatre choses, et ce sont celles qui cassent sans qu'on le voie :
 *
 * - **il n'existe pas avant d'avoir été demandé.** Une page qui montre
 *   quelque chose de vous ne doit pas exister par défaut ;
 * - **il se lit SANS session.** C'est tout son objet : le lien se partage à
 *   des gens qui n'ont pas de compte ;
 * - **il ne montre ni la dette ni le retard.** C'est une fierté qu'on
 *   partage, pas un pilori — et cette page-là peut finir n'importe où ;
 * - **le fermer coupe le lien pour de bon.** Un lien qu'on croyait avoir
 *   révoqué et qui ouvre encore serait le pire des défauts possibles ici.
 */
test.describe.configure({ mode: "serial" });

let etat: Awaited<ReturnType<import("@playwright/test").BrowserContext["storageState"]>>;
let pseudo = "";
let jeton = "";

test("un compte neuf n'a pas de profil public", async ({ browser }) => {
  const ouvert = await ouvrirCompte(browser, "Prof");
  etat = ouvert.etat;
  pseudo = ouvert.compte.pseudo;

  const [enBase] = await requeteSql<{ jetonProfil: string | null }>(
    'SELECT "jetonProfil" FROM "User" WHERE pseudo = $1', [pseudo]);
  expect(enBase.jetonProfil).toBeNull();
});

test("l'ouvrir donne un lien, qui montre l'effort et jamais la dette", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  const r = await page.request.put("/api/settings", {
    data: { userPrefs: { profilPublic: true } },
  });
  expect(r.status(), await r.text()).toBe(200);
  jeton = (await r.json()).jetonProfil;
  expect(typeof jeton).toBe("string");

  // Une dette bien visible, pour que son absence sur la page veuille dire
  // quelque chose : sans elle, le contrôle passerait sur une page qui n'a
  // simplement rien à montrer.
  await requeteSql('UPDATE "User" SET "dettePointsDus" = 4242 WHERE pseudo = $1', [pseudo]);

  // Sans session : c'est tout l'objet du lien.
  const anonyme = await browser.newContext();
  const vue = await anonyme.newPage();
  await vue.goto(`/p/${jeton}`);

  await expect(vue.getByRole("heading", { name: pseudo })).toBeVisible();
  expect(await vue.content()).not.toContain("4242");

  await anonyme.close();
  await ctx.close();
});

test("le fermer coupe le lien, et le rouvrir en donne un autre", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  const ferme = await page.request.put("/api/settings", {
    data: { userPrefs: { profilPublic: false } },
  });
  expect(ferme.status()).toBe(200);

  const anonyme = await browser.newContext();
  const vue = await anonyme.newPage();
  await vue.goto(`/p/${jeton}`);
  // La page existe toujours — elle dit « lien inconnu ». Rendre 404 ne serait
  // pas pire, mais dire « ce profil a été fermé » apprendrait qu'il a existé.
  await expect(vue.getByRole("heading", { name: pseudo })).toBeHidden();

  const rouvert = await page.request.put("/api/settings", {
    data: { userPrefs: { profilPublic: true } },
  });
  const nouveau = (await rouvert.json()).jetonProfil;
  expect(nouveau).not.toBe(jeton);

  await anonyme.close();
  await ctx.close();
});
