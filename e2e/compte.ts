import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { purgerTentatives } from "./limiteur";

/**
 * Ouvre un compte neuf et rend son état de session.
 *
 * Cinq fichiers de parcours recopiaient les mêmes vingt lignes, et le même
 * défaut avec : `fill()` arrivée AVANT l'hydratation pose la valeur dans le
 * DOM sans que React la voie. Le bouton reste alors désactivé pour toujours,
 * et l'échec ne ressemble pas à sa cause — « element is not enabled » sur un
 * champ pourtant rempli, visible dans la capture. La saisie est donc reprise
 * tant que le bouton ne s'active pas.
 */
export async function ouvrirCompte(
  browser: Browser,
  prefixe: string,
  options: { consentement?: boolean } = {},
): Promise<{ etat: Awaited<ReturnType<BrowserContext["storageState"]>>; compte: { pseudo: string; email: string } }> {
  const marque = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  const compte = { pseudo: `${prefixe}${marque}`, email: `${prefixe.toLowerCase()}-${marque}@example.test` };

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { sessionStorage.setItem("splash", "1"); } catch { /* stockage refusé */ }
  });
  await purgerTentatives();

  await page.goto("/beta");
  const envoyer = page.getByRole("button", { name: /rejoindre|obtenir|valider|envoyer|join/i }).first();
  await remplirJusquACeQueCaPrenne(page, envoyer, compte);
  await envoyer.click();

  const bloc = page.locator(".mono-num").first();
  await bloc.waitFor({ timeout: 20_000 });
  const code = (await bloc.innerText()).trim();

  await page.goto("/login");
  const pseudo = page.getByPlaceholder(/ton pseudo|your username/i);
  const secret = page.getByPlaceholder(/ton code|your code/i);
  const connecter = page.getByRole("button", { name: /^se connecter$|^sign in$/i });
  await pseudo.fill(compte.pseudo);
  await secret.fill(code);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 }),
    connecter.click(),
  ]);

  // La demande de consentement santé est modale et recouvre la page : rien ne
  // se clique derrière. Elle se traverse par l'API, comme dans les cinq autres
  // fichiers qui sont tombés dessus avant celui-ci.
  if (options.consentement !== false) {
    await ctx.request.post("/api/consentement", { data: { accepte: true } });
  }

  const etat = await ctx.storageState();
  await ctx.close();
  return { etat, compte };
}

async function remplirJusquACeQueCaPrenne(
  page: Page,
  envoyer: ReturnType<Page["getByRole"]>,
  compte: { pseudo: string; email: string },
) {
  await expect.poll(async () => {
    await page.getByPlaceholder(/pseudo/i).first().fill(compte.pseudo);
    await page.locator('input[type="email"]').first().fill(compte.email);
    return envoyer.isEnabled();
  }, { timeout: 30_000, intervals: [500, 1_000, 2_000] }).toBe(true);
}
