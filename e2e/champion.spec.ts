import { test, expect, type Browser } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { passerIntro } from "./intro";

/**
 * Le champ de champion, éprouvé au navigateur.
 *
 * Il n'était couvert par AUCUN parcours : les autres fichiers enregistrent
 * leurs parties par l'API. C'est pourtant la seule façon d'employer le produit
 * tant que la clé Riot de production n'est pas arrivée.
 *
 * Ce que le défaut donnait à l'écran : la liste PROPOSE « Cho'Gath » à qui
 * tape « Chogath », et au même instant le champ déclare la saisie non
 * reconnue et le bouton d'enregistrement DISPARAÎT. Deux règles pour une
 * seule question — la liste aplatit les accents et la ponctuation, la
 * validation comparait la chaîne exacte — donc un écran qui se contredit
 * lui-même.
 *
 * Ce qu'aucun test unitaire ne peut voir est le BRANCHEMENT :
 * `resoudreChampion` peut être parfaite et n'être appelée nulle part.
 */
test.describe.configure({ mode: "serial" });

let etat: Awaited<ReturnType<typeof ouvrirCompte>>["etat"];

test("0 · ouvrir le compte", async ({ browser }) => {
  ({ etat } = await ouvrirCompte(browser, "Champ"));
});

/**
 * Ouvre la fenêtre d'ajout, remplit le score, et rend le champ de champion.
 *
 * Le score est rempli d'abord parce que le bouton d'enregistrement n'existe
 * pas tant que la saisie est incomplète : sans lui, son absence ne dirait
 * rien du champion.
 */
async function formulairePret(browser: Browser) {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  await passerIntro(page);
  await page.locator('[data-visite="rail-bascule"]').click({ timeout: 2_000 }).catch(() => {});
  await page.locator('[data-visite="rail-ajout"]').click();

  await page.locator("#ajout-kills").waitFor({ timeout: 15_000 });
  await page.locator("#ajout-kills").fill("2");
  await page.locator("#ajout-deaths").fill("9");
  await page.locator("#ajout-assists").fill("4");

  const champ = page.locator("#ajout-champion");
  const enregistrer = page.getByRole("button", { name: /logger cette game|log this game/i });
  // Le témoin : sans champion, la partie est déjà enregistrable. C'est ce qui
  // rend la disparition du bouton attribuable au champion et à lui seul.
  await expect(enregistrer).toBeVisible({ timeout: 10_000 });
  return { ctx, page, champ, enregistrer };
}

test("1 · un nom aplati se ramène à sa forme canonique", async ({ browser }) => {
  const { ctx, page, champ, enregistrer } = await formulairePret(browser);

  await champ.fill("Chogath");
  // Les deux moitiés de la contradiction, au même instant : la liste propose,
  // et le bouton s'en va.
  await expect(page.getByRole("option", { name: "Cho'Gath" })).toBeVisible({ timeout: 10_000 });
  await expect(enregistrer).toHaveCount(0);

  // On quitte le champ SANS cliquer la suggestion : c'est le geste qui laissait
  // la contradiction à l'écran.
  await page.locator("#ajout-kills").click();
  await expect(champ).toHaveValue("Cho'Gath");
  await expect(enregistrer).toBeVisible();

  await ctx.close();
});

test("2 · un nom français traduit se ramène au nom anglais", async ({ browser }) => {
  const { ctx, page, champ, enregistrer } = await formulairePret(browser);

  // « Maître Yi » ne ressemble à aucun nom anglais : sans la table d'alias, la
  // liste reste muette et rien ne se propose.
  await champ.fill("Maître Yi");
  await expect(page.getByRole("option", { name: "Master Yi" })).toBeVisible({ timeout: 10_000 });

  await page.locator("#ajout-kills").click();
  await expect(champ).toHaveValue("Master Yi");
  await expect(enregistrer).toBeVisible();

  await ctx.close();
});

test("3 · une saisie qui ne désigne personne est laissée telle quelle, et le dit", async ({ browser }) => {
  const { ctx, page, champ, enregistrer } = await formulairePret(browser);

  await champ.fill("Sylas le Grand");
  await page.locator("#ajout-kills").click();

  // Ni corrigée en silence — deviner enregistrerait une partie qu'on n'a pas
  // jouée — ni muette : c'est le message qui explique le bouton absent.
  await expect(champ).toHaveValue("Sylas le Grand");
  await expect(
    page.getByRole("alert").filter({ hasText: /champion|reconnu|recognis/i }).first(),
  ).toBeVisible();
  await expect(enregistrer).toHaveCount(0);

  await ctx.close();
});
