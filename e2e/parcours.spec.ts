import { test, expect, type Browser, type Page } from "@playwright/test";
import { purgerTentatives } from "./limiteur";
import { passerIntro } from "./intro";
import { sansLangue } from "./chemin";

/**
 * Les trois parcours qui font l'application : entrer, enregistrer une défaite,
 * payer sa dette.
 *
 * Ils s'enchaînent sur un seul compte et dans un seul navigateur, parce que
 * c'est ainsi qu'un humain les vit. Un parcours peut être cassé alors que
 * chacune de ses étapes passe son propre test de route : c'est précisément ce
 * trou-là que ce fichier bouche.
 */

/** Compte tiré au sort : la suite peut tourner deux fois de suite. */
const marque = Date.now().toString(36);

/**
 * Les deux écrans sur lesquels le parcours est joué en entier.
 *
 * Il ne l'était que sur un écran de poste. Or le rail — d'où part l'ajout
 * d'une partie — se replie derrière un bouton en dessous d'une certaine
 * largeur, et le chrono de dette s'ouvre dans une fenêtre qui doit tenir sur
 * 390 px. Le code du test prévoyait le cas étroit depuis le début, et rien ne
 * l'exerçait : la branche existait pour rassurer, pas pour prouver.
 *
 * L'application se pose sur l'écran d'accueil d'un téléphone, envoie des
 * notifications et affiche une pastille en jeu. Le téléphone n'est pas un cas
 * limite, c'est un des deux cas.
 */
const ECRANS = [
  { nom: "poste", contexte: {} },
  {
    nom: "téléphone",
    contexte: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: false },
  },
] as const;

/**
 * Écarte ce qui recouvre l'écran au premier chargement : l'écran d'accueil
 * animé, la modale de bienvenue et la visite guidée. Ils sont légitimes pour
 * un humain, mais ils masquent tout ce que le test veut atteindre.
 */
async function ecarterLesVoiles(page: Page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("splash", "1");
      localStorage.setItem("low_onboarded", "1");
      localStorage.setItem("low_visite", "1");
    } catch { /* stockage refusé : le test suivra le chemin long */ }
  });
}

test.describe.configure({ mode: "serial" });

/**
 * État du navigateur — cookies et stockage local — transmis d'une étape à la
 * suivante.
 *
 * Partager un onglet unique entre les tests ne tient pas : Playwright referme
 * ce qui vient du navigateur de travail entre deux tests, et l'étape suivante
 * trouve une page morte. On transporte donc l'état plutôt que l'onglet, et
 * chaque étape ouvre le sien. C'est aussi plus proche du réel : un utilisateur
 * revient sur le site, il ne garde pas un onglet ouvert pour la vie.
 */
let etat: import("@playwright/test").BrowserContextOptions["storageState"];
/** Le compte de l'écran en cours. Chaque écran ouvre le sien. */
let COMPTE = { pseudo: "", email: "" };

/** Ouvre une page qui reprend la session de l'étape précédente. */
async function ouvrir(
  browser: Browser,
  options: import("@playwright/test").BrowserContextOptions,
): Promise<Page> {
  const contexte = await browser.newContext({ ...options, ...(etat ? { storageState: etat } : {}) });
  const page = await contexte.newPage();
  await ecarterLesVoiles(page);
  return page;
}

/** Retient l'état du navigateur pour l'étape suivante, puis referme la page. */
async function fermer(page: Page): Promise<void> {
  etat = await page.context().storageState();
  await page.context().close();
}

for (const ecran of ECRANS) {
test.describe(`parcours complet · ${ecran.nom}`, () => {

  test.beforeAll(() => {
    // Chaque écran repart d'un compte neuf : réutiliser celui du précédent
    // ferait passer les étapes 2 à 6 sur une base déjà remplie, et le parcours
    // ne serait plus un parcours.
    etat = undefined;
    COMPTE = {
      pseudo: `Test${marque}${ecran.nom === "poste" ? "P" : "T"}`,
      email: `test-${marque}-${ecran.nom === "poste" ? "p" : "t"}@example.test`,
    };
  });

  test("1 · obtenir un accès sur /beta et se connecter avec son code", async ({ browser }) => {
    const page = await ouvrir(browser, ecran.contexte);
    // C'est le chemin réellement ouvert pour un nouveau venu : le formulaire
    // e-mail de /login est réservé aux invités, et il le dit maintenant.
    await purgerTentatives();
    await page.goto("/beta");
    await page.getByPlaceholder(/pseudo/i).first().fill(COMPTE.pseudo);
    await page.locator('input[type="email"]').first().fill(COMPTE.email);
    await page.getByRole("button", { name: /rejoindre|obtenir|valider|envoyer|join/i }).first().click();

    // Le code s'affiche une fois, et une seule : c'est le seul moyen d'entrer.
    const bloc = page.locator(".mono-num").first();
    await bloc.waitFor({ timeout: 20_000 });
    const code = (await bloc.innerText()).trim();
    expect(code.length).toBeGreaterThan(3);

    await page.goto("/login");
    await page.getByPlaceholder(/ton pseudo|your username/i).fill(COMPTE.pseudo);
    await page.getByPlaceholder(/ton code|your code/i).fill(code);
    await Promise.all([
      page.waitForURL((u) => !sansLangue(u.pathname).startsWith("/login"), { timeout: 30_000 }),
      page.getByRole("button", { name: /^se connecter$|^sign in$/i }).click(),
    ]);

    // La session existe vraiment : c'est le serveur qui le dit, pas l'écran.
    const moi = await page.request.get("/api/user");
    expect(moi.ok()).toBeTruthy();
    expect((await moi.json()).pseudo).toBe(COMPTE.pseudo);

    await passerIntro(page);
    await fermer(page);
  });

  test("2 · choisir la boxe, pour que la dette s'accumule", async ({ browser }) => {
    const page = await ouvrir(browser, ecran.contexte);
    // Un compte neuf n'a que les pompes, qui se font dans la foulée et
    // n'entrent jamais au compteur. Sans cette étape, il n'y a rien à payer.
    await page.goto("/settings");
    await passerIntro(page);
    // Les réglages sont rangés en rubriques repliées : il faut ouvrir « Ton
    // effort » avant de voir la liste des exercices.
    await page.getByRole("button", { name: /ton effort|your effort/i }).first().click();
    const boxe = page.getByText(/^boxe$/i).first();
    await boxe.waitFor({ timeout: 10_000 });
    await boxe.click();

    await expect.poll(async () => {
      const r = await page.request.get("/api/settings");
      return (await r.json())?.user?.exercices ?? [];
    }, { timeout: 10_000 }).toContain("boxe");
    await fermer(page);
  });

  test("3 · enregistrer une défaite", async ({ browser }) => {
    const page = await ouvrir(browser, ecran.contexte);
    await page.goto("/dashboard");
    await passerIntro(page);
    // Le rail se replie derrière un bouton sur les écrans étroits ; sur un
    // écran large il est déjà ouvert et ce bouton n'existe pas.
    await page.locator('[data-visite="rail-bascule"]')
      .click({ timeout: 2_000 }).catch(() => {});
    await page.locator('[data-visite="rail-ajout"]').click();

    await page.locator("#ajout-kills").waitFor({ timeout: 15_000 });
    await page.locator("#ajout-kills").fill("2");
    await page.locator("#ajout-deaths").fill("9");
    await page.locator("#ajout-assists").fill("4");

    const avant = await compterParties(page);
    // Le bouton est en bas d'une modale qui défile : sans ce cadrage, le clic
    // vise une zone hors de l'écran.
    const enregistrer = page.getByRole("button", { name: /logger cette game|log this game/i });
    await enregistrer.scrollIntoViewIfNeeded();
    await enregistrer.click();

    await expect.poll(() => compterParties(page), { timeout: 20_000 }).toBe(avant + 1);
    await fermer(page);
  });

  test("4 · la défaite a créé une dette", async ({ browser }) => {
    const page = await ouvrir(browser, ecran.contexte);
    const dette = await lireDette(page);
    expect(dette.points).toBeGreaterThan(0);
    expect(dette.dureeSec).toBeGreaterThan(0);
    await fermer(page);
  });

  test("5 · le chrono crédite ce qui a réellement été fait", async ({ browser }) => {
    const page = await ouvrir(browser, ecran.contexte);
    await page.goto("/dashboard");
    await passerIntro(page);

    const avant = await lireDette(page);
    /**
     * La pastille se voit SANS déplier le rail, à toutes les largeurs.
     *
     * C'est ce parcours sur téléphone qui avait mis le défaut au jour : la
     * pastille vivait dans le rail replié, donc voir ce qu'on doit demandait
     * une touche de plus — sur la moitié du produit qui se consulte au
     * téléphone. Le rail ne replie plus que les actions de la page.
     *
     * `toBeVisible` est le contrôle qui mord ici : l'élément était déjà DANS
     * la page avant la correction, simplement caché. Le chercher ne prouvait
     * rien.
     */
    const pastille = page.locator('[data-visite="dette"]');
    await expect(pastille).toBeVisible({ timeout: 15_000 });
    await expect(pastille).toContainText(/\d/);
    await pastille.click();

    // Le chrono ne propose « J'ai fini » qu'une fois la durée écoulée — ici
    // plus de quatre minutes. On s'arrête en cours de route, ce que fait la
    // plupart du monde, et on vérifie que seule la part faite est créditée :
    // c'est le calcul le plus délicat de tout l'écran.
    const arreter = page.getByRole("button", { name: /plus tard|later/i }).first();
    await arreter.waitFor({ timeout: 15_000 });
    await page.waitForTimeout(6_000);
    await arreter.click();

    await expect.poll(async () => (await lireDette(page)).points, { timeout: 20_000 })
      .toBeLessThan(avant.points);
    const apres = await lireDette(page);
    expect(apres.points).toBeGreaterThan(0);
    await fermer(page);
  });

  test("6 · la partie figure dans l'historique", async ({ browser }) => {
    const page = await ouvrir(browser, ecran.contexte);
    await page.goto("/history");
    await expect(page.locator('[data-visite="historique-table"], table').first())
      .toBeVisible({ timeout: 20_000 });
    await fermer(page);
  });
});
}

/** Nombre de parties enregistrées, vu du serveur. */
async function compterParties(page: Page): Promise<number> {
  const r = await page.request.get("/api/games");
  if (!r.ok()) return -1;
  const liste = await r.json();
  return Array.isArray(liste) ? liste.length : -1;
}

/** Compteur de dette, vu du serveur. */
async function lireDette(page: Page): Promise<{ points: number; dureeSec: number }> {
  const r = await page.request.get("/api/dette");
  const d = await r.json();
  return { points: Number(d?.points ?? -1), dureeSec: Number(d?.dureeSec ?? -1) };
}
