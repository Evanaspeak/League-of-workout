import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";
import { purgerTentatives } from "./limiteur";
import { sansLangue } from "./chemin";

/**
 * Un barème s'applique à partir du moment où on le change, jamais en arrière.
 *
 * Le propriétaire du produit a changé le prix d'une seconde de boxe dans le
 * panneau d'administration, et **tout l'historique s'est réécrit** : une
 * soirée qui avait coûté 4 min 25 en affichait 8 min 50. L'effort déjà fourni
 * ne correspondait plus à ce qu'on avait payé.
 *
 * La cause : `pompesCalculees` est un coût en POINTS, qui ne dépend d'aucun
 * ratio — le ratio ne sert qu'à dire ce que ça fait en secondes de boxe, et il
 * était lu au moment de l'AFFICHAGE. `Game.ratios` le gèle, exactement comme
 * `exercice` et `variante` l'étaient déjà.
 *
 * Le test tient les DEUX moitiés, et il faut les deux : l'ancienne partie ne
 * bouge pas, ET la suivante suit le nouveau barème. Ne vérifier que la
 * première laisserait passer un gel complet, qui rendrait le réglage inutile.
 */
const marque = Date.now().toString(36);
const COMPTE = { pseudo: `Bar${marque}`, email: `bar-${marque}@example.test` };

async function avecBase<T>(action: (c: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try { return await action(client); } finally { await client.end().catch(() => {}); }
}

/** Le coût affiché sur la première ligne du tableau, quelle que soit l'unité. */
async function coutPremiereLigne(page: Page) {
  await page.goto("/history", { waitUntil: "load" });
  await page.locator("table tbody tr").first().waitFor({ timeout: 20_000 });
  const texte = await page.locator("table tbody tr").first().innerText();
  const trouve = texte.match(/\d+\s*min(\s*\d+)?|\b\d+\s*s\b/);
  expect(trouve, `aucune durée lisible dans « ${texte.replace(/\s+/g, " ")} »`).not.toBeNull();
  return trouve![0];
}

test("changer un ratio ne réécrit pas ce que les parties passées ont coûté", async ({ browser }) => {
  test.skip(!process.env.DATABASE_URL, "la base est nécessaire pour changer le barème");
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

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
  const uid = (await (await page.request.get("/api/user")).json()).id as string;
  await page.request.post("/api/consentement", { data: { accepte: true } });

  /**
   * Le compte devient administrateur pour toute la durée du test.
   *
   * Le barème se change par la ROUTE et non par la base : c'est elle qui purge
   * le cache mémoire, et sans cette purge on mesurerait l'ancienne valeur
   * pendant une minute sans savoir pourquoi. C'est aussi ce qui rend le test
   * indépendant de son état de départ — une exécution précédente, ou un essai
   * à la main, a pu laisser n'importe quel barème derrière lui.
   */
  const admin = (process.env.ADMIN_EMAILS || "evantocquet@gmail.com").split(",")[0].trim();
  await avecBase(async (c) => {
    await c.query(`UPDATE "User" SET email = NULL WHERE email = $1`, [admin]);
    await c.query(`UPDATE "User" SET email = $1 WHERE id = $2`, [admin, uid]);
  });
  const poserBareme = async (boxe: number) => {
    const r = await page.request.put("/api/admin/config/exercices", { data: { ratios: { boxe } } });
    expect(r.status(), await r.text()).toBe(200);
  };

  await poserBareme(6.9);

  const partie = {
    jeu: "League of Legends", role: "Mid", champion: "Ahri",
    kills: 2, deaths: 9, assists: 4, result: "D", gainageSec: 30, exercice: "boxe",
  };
  expect((await page.request.post("/api/games", { data: partie })).status()).toBe(200);

  const avant = await coutPremiereLigne(page);

  await poserBareme(13.8);

  // Moitié 1 : le passé ne bouge pas.
  expect(await coutPremiereLigne(page), "l'historique s'est réécrit").toBe(avant);

  // Moitié 2 : la partie suivante suit le nouveau barème.
  expect((await page.request.post("/api/games", {
    data: { ...partie, champion: "Zed" },
  })).status()).toBe(200);
  expect(await coutPremiereLigne(page), "le nouveau barème ne s'applique pas").not.toBe(avant);

  // On rend son adresse au compte et on remet le barème d'origine : les autres
  // fichiers de parcours partagent cette base.
  await avecBase(async (c) => {
    await c.query(`UPDATE "User" SET email = $1 WHERE id = $2`, [COMPTE.email, uid]);
    await c.query(`DELETE FROM "SystemConfig" WHERE key = 'exercices'`);
  });
  await ctx.close();
});
