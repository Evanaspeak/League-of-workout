import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";

/**
 * La source de diffusion, de bout en bout.
 *
 * C'est la seule surface du produit que des inconnus regardent : elle
 * s'affiche par-dessus un stream, devant le public de quelqu'un d'autre. Elle
 * n'avait aucun parcours à elle — `refus-silencieux.spec.ts` éprouve le refus
 * de régénérer le jeton, pas la page.
 *
 * Trois choses, et ce sont les trois qui peuvent casser sans qu'on le voie :
 *
 * - **elle se lit sans session.** C'est tout son intérêt : un logiciel de
 *   diffusion n'a pas de cookie. Une régression qui la rendrait protégée
 *   afficherait un écran de connexion sur le stream, et personne côté
 *   application n'en saurait rien ;
 * - **elle n'existe pas avant d'avoir été demandée.** Une adresse publique qui
 *   montre quelque chose de vous ne doit pas exister par défaut ;
 * - **un jeton faux ne montre RIEN.** Pas la dette de quelqu'un d'autre, pas
 *   une page d'erreur du serveur : trois mots, et rien du compte.
 */
test.describe.configure({ mode: "serial" });

let etat: Awaited<ReturnType<import("@playwright/test").BrowserContext["storageState"]>>;
let jeton = "";

test("ouvrir un compte avec une dette à montrer", async ({ browser }) => {
  const ouvert = await ouvrirCompte(browser, "Obs");
  etat = ouvert.etat;

  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  // La boxe se compte en minutes : sans elle, il n'y a rien à afficher — les
  // pompes se font dans la foulée et n'entrent jamais au compteur.
  const r = await page.request.put("/api/settings", {
    data: { userPrefs: { exercices: ["boxe"] } },
  });
  expect(r.status(), await r.text()).toBe(200);
  const partie = await page.request.post("/api/games", {
    data: { jeu: "League of Legends", role: "Mid", champion: "Ahri",
            kills: 1, deaths: 9, assists: 2, result: "D", exercice: "boxe" },
  });
  expect(partie.status(), await partie.text()).toBe(200);
  await ctx.close();
});

test("le lien n'existe pas tant qu'on ne l'a pas demandé", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  const avant = await (await page.request.get("/api/obs")).json();
  expect(avant.jeton).toBeNull();

  const cree = await (await page.request.post("/api/obs")).json();
  expect(typeof cree.jeton).toBe("string");
  expect(cree.jeton.length).toBeGreaterThan(20);
  jeton = cree.jeton;
  await ctx.close();
});

test("la page se lit sans session et montre la dette", async ({ browser }) => {
  // Un contexte NEUF, sans état : c'est le logiciel de diffusion.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const r = await page.goto(`/obs/${jeton}`);
  expect(r?.status()).toBe(200);

  // Le libellé vient de la langue du COMPTE, pas de l'adresse : la page n'en a
  // pas, et pour cause — elle est ouverte avec un jeton pour toute identité.
  await expect(page.getByText(/à faire|to do/i)).toBeVisible({ timeout: 15_000 });
  // Et un temps d'effort, puisqu'il y a une défaite au compteur.
  await expect(page.getByText(/\d+\s*(min|s)\b/)).toBeVisible({ timeout: 15_000 });

  // Rien du compte ne doit paraître : la politique de confidentialité promet
  // que ce lien ne révèle ni le nom ni les parties.
  const texte = await page.evaluate(() => document.body.innerText);
  expect(texte).not.toMatch(/Ahri/i);
  expect(texte).not.toMatch(/@example\.test/i);
  await ctx.close();
});

test("un jeton faux ne montre rien du tout", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/obs/pasunjetonvalide");
  await expect(page.getByText(/lien invalide|invalid link/i)).toBeVisible({ timeout: 15_000 });
  const texte = await page.evaluate(() => document.body.innerText);
  expect(texte).not.toMatch(/à faire|to do/i);
  await ctx.close();
});

test("régénérer le lien coupe l'ancien", async ({ browser }) => {
  /**
   * C'est la seule façon de révoquer une adresse déjà collée dans un logiciel
   * de diffusion. Si l'ancien jeton continuait de marcher, le bouton
   * « régénérer » ne servirait à rien — et il est là précisément pour reprendre
   * la main sur un lien qui a fuité.
   */
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  const neuf = await (await page.request.post("/api/obs")).json();
  expect(neuf.jeton).not.toBe(jeton);

  const anonyme = await browser.newContext();
  const vue = await anonyme.newPage();
  await vue.goto(`/obs/${jeton}`);
  await expect(vue.getByText(/lien invalide|invalid link/i)).toBeVisible({ timeout: 15_000 });
  await anonyme.close();
  await ctx.close();
});
