import { test, expect, type BrowserContext } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { viderLesFenetres } from "./intro";

/**
 * Sur téléphone, l'application s'ouvre sur l'ajout de partie (réponse 210).
 *
 * `src/lib/ouvertureTelephone.test.ts` éprouve la DÉCISION ; il ne dit rien du
 * branchement. Trois choses ne se voient qu'ici, et chacune casserait la
 * fonctionnalité en silence :
 *
 * - que le tableau de bord LISE le paramètre que le manifeste pose ;
 * - qu'il le RETIRE, sans quoi un rechargement rouvrirait le formulaire — et
 *   un rechargement n'est pas un lancement d'application ;
 * - qu'une navigation ordinaire n'ouvre rien, ce qui est la condition qui rend
 *   tout le reste supportable.
 */

const IPHONE = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
    + " (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

test.describe.configure({ mode: "serial" });

let etat: import("@playwright/test").BrowserContextOptions["storageState"];
let ctx: BrowserContext;

/** La fenêtre d'ajout, reconnue par son titre plutôt que par sa position. */
const fenetreAjout = (page: import("@playwright/test").Page) =>
  page.locator('[aria-modal="true"]').filter({ hasText: /ajouter une partie|add a game/i });

test("ouvre un compte et passe l'intro", async ({ browser }) => {
  const r = await ouvrirCompte(browser, "Ouv");
  etat = r.etat;
  // L'intro se traverse AVANT de mesurer : la visite guidée navigue, et le
  // tableau de bord ne doit rien ouvrir tant qu'elle n'est pas finie — c'est
  // même l'une des conditions qu'on éprouve plus bas.
  const c = await browser.newContext({ storageState: etat, ...IPHONE });
  const page = await c.newPage();
  await page.goto("/fr/dashboard");
  await viderLesFenetres(page);
  etat = await c.storageState();
  await c.close();
});

test("un compte neuf reçoit son intro, pas un formulaire", async ({ browser }) => {
  /**
   * Le cas qui isole la condition d'intro, et il compte : quelqu'un qui vient
   * d'installer l'application la lance pour la PREMIÈRE fois. Lui poser un
   * formulaire de saisie par-dessus l'accueil empilerait deux fenêtres — le
   * défaut que ce projet a payé trois fois — et lui demanderait d'enregistrer
   * une partie avant de lui avoir dit à quoi sert le produit.
   */
  const r = await ouvrirCompte(browser, "Neuf");
  const c = await browser.newContext({ storageState: r.etat, ...IPHONE });
  const page = await c.newPage();
  await page.goto("/fr/dashboard?ajout=1");
  // Une fenêtre s'ouvre bien — celle de l'intro — et ce n'est pas la nôtre.
  await expect(page.locator('[aria-modal="true"]').first()).toBeVisible({ timeout: 20_000 });
  await expect(fenetreAjout(page)).toHaveCount(0);
  await c.close();
});

test.beforeEach(async ({ browser }) => {
  ctx = await browser.newContext({ storageState: etat, ...IPHONE });
});
test.afterEach(async () => { await ctx?.close(); });

test("le lancement de l'application ouvre l'ajout de partie", async () => {
  const page = await ctx.newPage();
  await page.goto("/fr/dashboard?ajout=1");
  await expect(fenetreAjout(page)).toBeVisible({ timeout: 20_000 });

  // Le paramètre est retiré tout de suite : sans ça, un rechargement — ou un
  // retour arrière — rouvrirait le formulaire, ce qui n'est plus un lancement.
  await expect(page).toHaveURL(/\/fr\/dashboard$/);
});

test("une navigation ordinaire n'ouvre rien", async () => {
  const page = await ctx.newPage();
  await page.goto("/fr/dashboard");
  // On attend que l'écran soit chargé — c'est le moment où l'ouverture se
  // déciderait — puis on constate qu'aucune fenêtre n'est là. Chercher
  // l'absence tout de suite ne prouverait rien : elle est vraie avant même
  // que la page ait eu l'occasion d'ouvrir quoi que ce soit.
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(3_000);
  await expect(fenetreAjout(page)).toHaveCount(0);
});

test("et un rechargement après le lancement non plus", async () => {
  const page = await ctx.newPage();
  await page.goto("/fr/dashboard?ajout=1");
  await expect(fenetreAjout(page)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /^fermer$|^close$/i }).first().click();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(3_000);
  await expect(fenetreAjout(page)).toHaveCount(0);
});

test("sur un écran de poste, le paramètre ne fait rien", async ({ browser }) => {
  /**
   * Le manifeste sert aussi aux installations de bureau. La réponse 210 dit
   * « sur téléphone » — et sur un poste le rail est déplié de toute façon,
   * donc le geste est déjà à une touche.
   */
  const poste = await browser.newContext({ storageState: etat, viewport: { width: 1280, height: 900 } });
  const page = await poste.newPage();
  await page.goto("/fr/dashboard?ajout=1");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(3_000);
  await expect(fenetreAjout(page)).toHaveCount(0);
  await poste.close();
});
