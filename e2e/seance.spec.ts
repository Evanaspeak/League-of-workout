import { test, expect, type Browser } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { viderLesFenetres } from "./intro";

/**
 * Le mode séance (ligne 205 du plan, renversée le 8 septembre : « fais-le »).
 *
 * Ce qu'aucun test unitaire ne peut voir, et qui fait tout l'objet de ce
 * fichier : ce qui est PAYÉ, et quand.
 *
 * Le défaut d'origine se mesure. Le chrono démarrait à l'ouverture de la
 * fenêtre, sur le même écran que les consignes d'exécution : sur un téléphone
 * de 390 px et une dette de boxe de 1 min 15, quinze secondes passées à LIRE —
 * sans un seul coup de poing — ramenaient la dette à une minute. Un cinquième
 * payé pour avoir lu, sur un produit dont tout le sujet est que la dette est
 * réelle.
 */

const TELEPHONE = { width: 390, height: 844 } as const;

async function compteAvecDette(
  browser: Browser,
  prefixe: string,
  exercice: string,
) {
  const { etat } = await ouvrirCompte(browser, prefixe);
  const ctx = await browser.newContext({
    storageState: etat, viewport: TELEPHONE, isMobile: true, hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto("/settings#effort");
  await viderLesFenetres(page);

  // Un seul exercice : c'est ce qui donne une cible au compteur.
  const r = await page.request.put("/api/settings", {
    data: { userPrefs: { exercices: [exercice], rappelSeuilSec: 0 } },
  });
  expect(r.status(), await r.text()).toBe(200);

  // Une défaite, donc une dette.
  const g = await page.request.post("/api/games", {
    data: {
      jeu: "League of Legends", role: "Mid", champion: "Ahri",
      kills: 2, deaths: 9, assists: 4, result: "D", date: new Date().toISOString(),
    },
  });
  expect(g.status(), await g.text()).toBe(200);

  const du = async () => {
    const d = await (await page.request.get("/api/dette")).json();
    return Number(d.points);
  };

  await page.goto("/dashboard");
  await page.getByRole("button", { name: /en attente|pending/i }).first().click();
  return { ctx, page, du };
}

test.describe.configure({ mode: "serial" });

test("lire les consignes ne paie rien", async ({ browser }) => {
  const { ctx, page, du } = await compteAvecDette(browser, "SeanceT", "boxe");
  const avant = await du();
  expect(avant).toBeGreaterThan(0);

  // La préparation porte les consignes et le bouton, et rien ne tourne.
  await expect(page.getByRole("button", { name: /^commencer$|^start$/i })).toBeVisible();

  /**
   * Le contrôle qui distingue, et il a demandé un sabotage pour être écrit.
   *
   * Ma première version lisait la DETTE après dix secondes de préparation, et
   * elle passait avec le défaut remis : rien n'est jamais payé pendant qu'on
   * lit, dans les deux cas. Le paiement n'a lieu qu'à la FERMETURE, et il
   * porte sur ce que le chrono a décompté — c'est donc le chrono qu'il faut
   * regarder, pas la dette.
   *
   * On lit dix secondes, on commence, et le décompte doit partir du total
   * ENTIER. Avec l'ancien code il serait déjà à dix secondes de moins.
   */
  const modale = page.locator('[role="dialog"]');
  await page.waitForTimeout(10_000);
  await page.getByRole("button", { name: /^commencer$|^start$/i }).click();

  // Le décompte affiche le total, pas le total moins ce qu'on a mis à lire.
  const chrono = await modale.locator(".mono-num").first().innerText();
  const [m, sec] = chrono.split(":").map(Number);
  expect(m * 60 + sec).toBeGreaterThanOrEqual(73);

  /**
   * Et le chiffre a l'écran pour lui.
   *
   * Soixante-treize mots entouraient le chrono pendant la séance : les
   * consignes d'exécution, la prudence, et les dix boutons de conversion. Ils
   * ont été lus à la préparation, et on regarde ce compteur à bout de bras.
   */
  await expect(modale).not.toContainText(/coudes rentrés|elbows/i);
  const mots = (await modale.innerText()).split(/\s+/).filter(Boolean).length;
  expect(mots).toBeLessThan(20);

  // Maintenant, ça compte.
  await page.waitForTimeout(4_000);
  await page.getByRole("button", { name: /plus tard|later/i }).first().click();
  await expect.poll(du).toBeLessThan(avant);
  await ctx.close();
});

test("une dette en répétitions se compte, et se paie en partie", async ({ browser }) => {
  const { ctx, page, du } = await compteAvecDette(browser, "SeanceR", "pompes");
  const avant = await du();

  /**
   * Le compteur n'existait que pour les CONVERSIONS : une dette en pompes
   * n'avait que « c'est fait » ou « plus tard », c'est-à-dire tout ou rien,
   * alors qu'une série ne suffit pas à solder trente-huit pompes.
   */
  await page.getByRole("button", { name: /^commencer$|^start$/i }).click();
  const compteur = page.locator('input[type="number"]');
  await expect(compteur).toBeVisible();
  await expect(compteur).toHaveValue("0");

  const plus = page.getByRole("button", { name: /ajouter|add one/i }).first();
  for (let n = 0; n < 5; n++) await plus.click();
  await expect(compteur).toHaveValue("5");

  await page.getByRole("button", { name: /fini|done|termin/i }).first().click();

  /**
   * Les deux moitiés, et il faut les deux : la dette a BAISSÉ — les cinq
   * pompes comptent — et elle n'est PAS soldée, ce qui distingue le paiement
   * partiel du « c'est fait » d'avant.
   */
  await expect.poll(du).toBeLessThan(avant);
  expect(await du()).toBeGreaterThan(0);
  await ctx.close();
});
