import { test, expect, type Page } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { viderLesFenetres } from "./intro";

/**
 * Le message d'échec, cherché par son TEXTE dans un élément qui l'annonce.
 *
 * `getByRole("alert")` seul ne prouve rien : Next pose son annonceur de route
 * avec ce rôle, vide, sur chaque page. Trois de ces quatre tests passaient en
 * le lisant, c'est-à-dire en ne mesurant rien — le piège est écrit dans le
 * journal depuis les tests de réglages, et il se retombe dedans.
 */
async function messageDEchec(page: Page, texte: RegExp) {
  await expect(page.getByRole("alert").filter({ hasText: texte })).toBeVisible();
}

/**
 * Quatre gestes qu'un serveur peut refuser, et qui doivent le dire.
 *
 * `e2e/panne-serveur.spec.ts` couvre l'ajout d'une partie, l'ajout depuis la
 * liste Riot, le consentement, les réglages de jeu, le paiement de dette et
 * l'historique. Restaient quatre routes d'écriture atteintes depuis un écran
 * et qu'aucun test navigateur ne poussait dans le mur.
 *
 * Les quatre écrans traitent DÉJÀ leur échec correctement : ce sont des tests
 * de non-régression sur du code juste, ce qui est le bon moment pour les
 * écrire. Chacun vérifie deux choses, jamais une seule — que l'échec se DIT,
 * et que rien n'a bougé. Sans le second contrôle, un écran qui annonce l'échec
 * tout en gardant la nouvelle valeur chez lui passerait.
 */

async function compteSurEcran(browser: Parameters<typeof ouvrirCompte>[0], prefixe: string) {
  const { etat } = await ouvrirCompte(browser, prefixe);
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  await viderLesFenetres(page);
  return { ctx, page };
}

/** Ouvre une rubrique des réglages : le paramètre d'adresse ne déplie rien. */
async function ouvrirRubrique(page: Page, nom: RegExp) {
  await page.goto("/settings");
  await page.getByRole("button", { name: nom }).click();
}

test.describe.configure({ mode: "serial" });

test("une suppression de compte refusée le dit, et le compte reste", async ({ browser }) => {
  const { ctx, page } = await compteSurEcran(browser, "rSup");
  await ouvrirRubrique(page, /tes données|your data/i);
  await page.route("**/api/user", (r) =>
    r.request().method() === "DELETE" ? r.fulfill({ status: 500, body: "{}" }) : r.continue());

  await page.getByRole("button", { name: /supprimer mon compte|delete my account/i }).click();
  const fenetre = page.getByRole("dialog", { name: /supprimer d|delete perman/i });
  await fenetre.waitFor({ state: "visible" });
  await fenetre.getByRole("textbox").fill("SUPPRIMER");
  await fenetre.getByRole("button", { name: /^supprimer|^delete/i }).last().click();

  // L'échec se dit, et la fenêtre reste ouverte : se refermer laisserait
  // croire que c'est parti.
  await expect(fenetre).toBeVisible();
  await messageDEchec(page, /erreur lors de la sauvegarde|error while saving/i);

  // Et le compte est toujours là : on peut recharger une page connectée.
  await page.unroute("**/api/user");
  const reponse = await page.goto("/settings");
  expect(reponse?.status()).toBe(200);
  expect(new URL(page.url()).pathname).not.toContain("/login");
  await ctx.close();
});

test("un signalement refusé le dit, au lieu de se déclarer envoyé", async ({ browser }) => {
  const { ctx, page } = await compteSurEcran(browser, "rSig");
  await page.route("**/api/signalement", (r) => r.fulfill({ status: 500, body: "{}" }));

  await page.getByRole("button", { name: /signaler un problème|report a problem/i }).click();
  const zone = page.getByRole("textbox").last();
  await zone.fill("Le bouton de paiement ne répond pas après une partie.");
  await page.getByRole("button", { name: /envoyer|send/i }).last().click();

  await messageDEchec(page, /\S/);
  // Le message reste : le retaper après un échec est le meilleur moyen de
  // renoncer à signaler quoi que ce soit.
  await expect(zone).toHaveValue(/paiement/);
  await ctx.close();
});

test("une mise de côté refusée le dit, et l'exercice reste actif", async ({ browser }) => {
  const { ctx, page } = await compteSurEcran(browser, "rSus");
  await ouvrirRubrique(page, /ton effort|your effort/i);
  await page.route("**/api/suspension", (r) =>
    r.request().method() === "GET" ? r.continue() : r.fulfill({ status: 500, body: "{}" }));

  const mettreDeCote = page.getByRole("button", { name: /mettre de côté|set aside|pause/i }).first();
  await mettreDeCote.waitFor({ state: "visible" });
  const avant = await mettreDeCote.innerText();
  await mettreDeCote.click();

  await messageDEchec(page, /\S/);
  // Le libellé n'a pas changé : afficher « remettre » sous un exercice qui
  // n'a jamais été mis de côté serait le défaut qu'on cherche.
  await expect(mettreDeCote).toHaveText(avant);
  await ctx.close();
});

test("un jeton de diffusion non régénéré le dit, et l'adresse ne bouge pas", async ({ browser }) => {
  const { ctx, page } = await compteSurEcran(browser, "rObs");
  await ouvrirRubrique(page, /tes jeux|your games/i);

  /**
   * Un compte neuf n'a pas encore de lien : il faut le créer avant de pouvoir
   * éprouver ce qui se passe quand on le refait. C'est le geste réel, dans
   * l'ordre réel.
   */
  await page.getByRole("button", { name: /créer le lien|create the link/i }).click();

  const champ = page.locator("input[readonly]").first();
  await champ.waitFor({ state: "visible", timeout: 15_000 });
  const avant = await champ.inputValue();
  expect(avant).toContain("/obs/");

  await page.route("**/api/obs", (r) =>
    r.request().method() === "GET" ? r.continue() : r.fulfill({ status: 500, body: "{}" }));
  await page.getByRole("button", { name: /refaire le lien|new link|regenerate/i }).click();

  await messageDEchec(page, /\S/);
  /**
   * Le contrôle qui compte sur cet écran-ci.
   *
   * Régénérer le jeton est la SEULE façon de révoquer une adresse déjà collée
   * dans un logiciel de diffusion. Un échec silencieux ferait croire que le
   * lien d'avant ne vaut plus rien, alors qu'il ouvre toujours la dette en
   * direct — c'est une révocation imaginaire, et c'est pire que pas de bouton.
   */
  await expect(champ).toHaveValue(avant);
  await ctx.close();
});
