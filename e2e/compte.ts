import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { purgerTentatives } from "./limiteur";
import { sansLangue } from "./chemin";

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
  options: { consentement?: boolean; parrain?: string } = {},
): Promise<{ etat: Awaited<ReturnType<BrowserContext["storageState"]>>; compte: { pseudo: string; email: string } }> {
  const marque = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  const compte = { pseudo: `${prefixe}${marque}`, email: `${prefixe.toLowerCase()}-${marque}@example.test` };

  /**
   * Une adresse par worker, pour le limiteur d'inscription.
   *
   * Il autorise cinq inscriptions par quart d'heure et par ADRESSE IP. Tous
   * les workers sortent de la même machine : à quatre en parallèle, ils se
   * bloquaient les uns les autres, et le symptôme — « le compte ne s'ouvre
   * pas » — ne ressemble pas à sa cause. `getClientIp` lit `x-forwarded-for`
   * quand l'en-tête de plateforme est absent, ce qui est le cas en local.
   *
   * Lue à l'exécution et non au chargement de la configuration : c'est
   * Playwright qui pose cette variable dans chaque worker.
   */
  const worker = process.env.TEST_PARALLEL_INDEX ?? "0";
  const ctx = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": `10.0.0.${Number(worker) + 1}` },
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { sessionStorage.setItem("splash", "1"); } catch { /* stockage refusé */ }
  });
  await purgerTentatives();

  /**
   * Le code de parrainage passe par l'ADRESSE, comme pour quelqu'un qui suit
   * un lien reçu. Le poser dans le corps de la requête éprouverait la route et
   * non le chemin : c'est la traversée du formulaire qui peut se perdre.
   */
  await page.goto(options.parrain ? `/beta?p=${options.parrain}` : "/beta");
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
    page.waitForURL((u) => !sansLangue(u.pathname).startsWith("/login"), { timeout: 30_000 }),
    connecter.click(),
  ]);

  // La demande de consentement santé est modale et recouvre la page : rien ne
  // se clique derrière. Elle se traverse par l'API, comme dans les cinq autres
  // fichiers qui sont tombés dessus avant celui-ci.
  if (options.consentement !== false) {
    await ctx.request.post("/api/consentement", { data: { accepte: true } });
  }

  /**
   * La session est vérifiée AVANT de rendre l'état.
   *
   * Sans ce contrôle, un compte dont la connexion a échoué rend un état sans
   * cookie, et tous les tests qui s'en servent échouent bien plus loin, sur
   * « élément introuvable » — un symptôme qui ne ressemble en rien à sa cause.
   * C'est ce qui vient d'arriver deux fois : une session morte, et neuf
   * minutes passées à chercher ailleurs.
   */
  const sonde = await ctx.request.get("/api/user");
  if (!sonde.ok()) {
    throw new Error(
      `ouvrirCompte(${prefixe}) : la session n'est pas établie — /api/user rend ${sonde.status()}. `
      + "Le compte a peut-être été refusé (limiteur, pseudo pris) ou la connexion n'a pas abouti.",
    );
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
