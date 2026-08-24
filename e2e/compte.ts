import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { purgerTentatives } from "./limiteur";

/**
 * Ouvre un compte neuf et rend son état de session.
 *
 * Les huit autres fichiers de parcours recopient les mêmes vingt lignes. Ils
 * n'ont pas été convertis, et la raison est écrite dans CLAUDE.md : le défaut
 * qui aurait justifié d'y toucher n'existait pas.
 *
 * La saisie est reprise tant que le bouton ne s'active pas. C'est une
 * précaution, pas la correction d'un défaut constaté : quand le bouton reste
 * désactivé, c'est en général qu'il n'y a pas de JavaScript du tout, et
 * reprendre la saisie n'y peut rien. La reprise ne coûte qu'un tour de boucle
 * dans le cas normal.
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
