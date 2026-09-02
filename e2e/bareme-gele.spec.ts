import { test, expect, type Page } from "@playwright/test";
import { Client } from "pg";
import { purgerTentatives } from "./limiteur";
import { sansLangue } from "./chemin";
import { viderLesFenetres } from "./intro";

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

/**
 * La pastille et le décompte disent le même nombre.
 *
 * Ils sortaient de deux conversions différentes : la pastille convertissait
 * les points DANS LE NAVIGATEUR, le décompte affichait la durée calculée AU
 * SERVEUR. Tant que les deux avaient les mêmes ratios, l'écart se limitait à
 * l'arrondi au pas de l'exercice — cinq secondes pour la boxe. Après un
 * changement de barème, la route publique servait l'ancienne valeur depuis le
 * cache du navigateur, et les deux nombres se contredisaient franchement :
 * « 6 min 05 » sur la pastille, « 2 min 41 » dans le chrono.
 *
 * Le test compare les deux à l'écran, ce qu'aucun test unitaire ne peut faire :
 * la divergence naît précisément de ce que les deux côtés ne partagent pas.
 */
test("la pastille de dette et son décompte annoncent le même nombre", async ({ browser }) => {
  test.skip(!process.env.DATABASE_URL, "la base est nécessaire pour changer le barème");
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const compte = { pseudo: `Pas${Date.now().toString(36)}`, email: `pas-${Date.now().toString(36)}@example.test` };

  await purgerTentatives();
  await page.goto("/beta");
  await page.getByPlaceholder(/pseudo/i).first().fill(compte.pseudo);
  await page.locator('input[type="email"]').first().fill(compte.email);
  await page.getByRole("button", { name: /rejoindre|obtenir|valider|envoyer|join/i }).first().click();
  const bloc = page.locator(".mono-num").first();
  await bloc.waitFor({ timeout: 20_000 });
  const code = (await bloc.innerText()).trim();

  await page.goto("/login");
  await page.getByPlaceholder(/ton pseudo|your username/i).fill(compte.pseudo);
  await page.getByPlaceholder(/ton code|your code/i).fill(code);
  await Promise.all([
    page.waitForURL((u) => !sansLangue(u.pathname).startsWith("/login"), { timeout: 30_000 }),
    page.getByRole("button", { name: /^se connecter$|^sign in$/i }).click(),
  ]);
  const uid = (await (await page.request.get("/api/user")).json()).id as string;
  await page.request.post("/api/consentement", { data: { accepte: true } });
  // La boxe seule : c'est le seul exercice compté en temps du catalogue par
  // défaut, et il faut que pastille et chrono parlent du même.
  await page.request.put("/api/settings", { data: { userPrefs: { exercices: ["boxe"] } } });

  const admin = (process.env.ADMIN_EMAILS || "evantocquet@gmail.com").split(",")[0].trim();
  await avecBase(async (c) => {
    await c.query(`UPDATE "User" SET email = NULL WHERE email = $1`, [admin]);
    await c.query(`UPDATE "User" SET email = $1 WHERE id = $2`, [admin, uid]);
  });

  // Une première visite AVANT le changement : c'est elle qui remplissait le
  // cache du navigateur, et donc elle qui rendait le défaut atteignable.
  await page.request.put("/api/admin/config/exercices", { data: { ratios: { boxe: 7 } } });
  await page.goto("/dashboard", { waitUntil: "load" });
  // Les fenêtres d'un compte neuf se traversent AVANT de chercher quoi que ce
  // soit : elles portent `aria-modal`, comme le décompte, et le sélecteur en
  // trouverait deux. Le fichier passait seul parce que le compte n'en était
  // pas au même point ; c'est le huitième fichier de parcours à tomber dessus.
  await viderLesFenetres(page);
  await page.locator("[data-visite='dette']").first()
    .waitFor({ state: "attached", timeout: 20_000 }).catch(() => {});

  await page.request.put("/api/admin/config/exercices", { data: { ratios: { boxe: 3.09 } } });
  expect((await page.request.post("/api/games", {
    data: { jeu: "League of Legends", role: "Mid", champion: "Ahri", kills: 2,
            deaths: 9, assists: 4, result: "D", gainageSec: 30, exercice: "boxe" },
  })).status()).toBe(200);

  await page.goto("/dashboard", { waitUntil: "load" });
  await viderLesFenetres(page);
  const pastille = page.locator("[data-visite='dette']").first();
  await pastille.waitFor({ timeout: 20_000 });
  const annonce = enSecondes((await pastille.innerText()));

  await pastille.click();
  const chrono = page.locator('[aria-modal="true"]');
  await chrono.waitFor({ timeout: 10_000 });
  // On met en pause tout de suite : le décompte tourne, et comparer une valeur
  // qui bouge à une valeur figée ferait échouer le test une fois sur deux.
  await page.getByRole("button", { name: /^pause$/i }).click().catch(() => {});
  const depart = enSecondes(await chrono.innerText());

  // Une seconde de tolérance : le tic peut tomber entre le clic et la lecture.
  expect(Math.abs(depart - annonce),
    `la pastille annonce ${annonce} s et le chrono démarre à ${depart} s`).toBeLessThanOrEqual(1);

  /**
   * Et le même nombre que le SERVEUR.
   *
   * C'est ce contrôle-là qui manquait. Le seuil d'alerte et la notification
   * système lisent `dureeSec` ; la pastille affichait sa propre conversion.
   * Elle passait donc en alerte à 3 min 35 sous un seuil de 5 min, et la
   * notification annonçait 8 min 06 — un chiffre que rien à l'écran ne
   * montrait.
   */
  const dette = await (await page.request.get("/api/dette")).json();
  expect(Math.abs(dette.dureeSec - annonce),
    `la pastille annonce ${annonce} s et le serveur ${dette.dureeSec} s`).toBeLessThanOrEqual(1);
  expect(dette.dureeSec < dette.seuilSec, "la pastille ne doit pas être en alerte sous son seuil")
    .toBe(true);
  await ctx.close();
});

/** « 2 min 41 » ou « 2:41 » → 161. Le premier nombre lisible de ce texte. */
function enSecondes(texte: string): number {
  const horloge = texte.match(/(\d+):(\d{2})/);
  if (horloge) return Number(horloge[1]) * 60 + Number(horloge[2]);
  const min = texte.match(/(\d+)\s*min(?:\s*(\d+))?/);
  if (min) return Number(min[1]) * 60 + Number(min[2] ?? 0);
  const sec = texte.match(/\b(\d+)\s*s\b/);
  return sec ? Number(sec[1]) : NaN;
}
