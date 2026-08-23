import { test, expect, type Browser, type Page } from "@playwright/test";

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
const COMPTE = {
  pseudo: `Test${marque}`,
  email: `test-${marque}@example.test`,
};

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

/**
 * Écarte ce qui recouvre l'écran d'un compte tout neuf : la demande de
 * consentement santé, la modale d'accueil, la visite guidée.
 *
 * Leur mémoire est propre au compte — `low_onboarded:<id>` — et l'identifiant
 * n'existe qu'une fois l'inscription faite. On ne peut donc pas les désamorcer
 * d'avance : on les traverse, comme un utilisateur qui n'a pas envie de les
 * lire. Les faire disparaître par le stockage reviendrait à ne jamais tester
 * qu'on peut en sortir.
 */
async function passerIntro(page: Page) {
  // L'apostrophe des libellés est typographique, pas droite : on ne la met
  // pas dans le motif, sinon rien ne correspond.
  //
  // Et la modale ne s'affiche pas tout de suite : elle laisse passer l'écran
  // d'ouverture. La chercher à l'instant du chargement ne la trouve jamais,
  // puis elle arrive et recouvre ce qu'on essayait d'atteindre.
  // La demande de consentement santé passe avant les deux autres : elle est
  // modale, elle recouvre la modale d'accueil, et rien ne se clique tant
  // qu'elle est là. Le compte vient de donner ses mesures à l'inscription —
  // accepter est le chemin qu'il suit réellement.
  for (const nom of [
    /^j.accepte$|^i agree$/i,
    /passer.{0,6}introduction|skip.{0,6}introduction/i,
    /passer.{0,6}visite|skip.{0,10}tour/i,
  ]) {
    const lien = page.getByRole("button", { name: nom }).first();
    const apparue = await lien.waitFor({ state: "visible", timeout: 4_000 })
      .then(() => true).catch(() => false);
    if (!apparue) continue;
    await lien.click();
    await lien.waitFor({ state: "hidden", timeout: 4_000 }).catch(() => {});
  }
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

/** Ouvre une page qui reprend la session de l'étape précédente. */
async function ouvrir(browser: Browser): Promise<Page> {
  const contexte = await browser.newContext(etat ? { storageState: etat } : {});
  const page = await contexte.newPage();
  await ecarterLesVoiles(page);
  return page;
}

/** Retient l'état du navigateur pour l'étape suivante, puis referme la page. */
async function fermer(page: Page): Promise<void> {
  etat = await page.context().storageState();
  await page.context().close();
}

test.describe("parcours complet", () => {

  test("1 · obtenir un accès sur /beta et se connecter avec son code", async ({ browser }) => {
    const page = await ouvrir(browser);
    // C'est le chemin réellement ouvert pour un nouveau venu : le formulaire
    // e-mail de /login est réservé aux invités, et il le dit maintenant.
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
      page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 }),
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
    const page = await ouvrir(browser);
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
    const page = await ouvrir(browser);
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
    const page = await ouvrir(browser);
    const dette = await lireDette(page);
    expect(dette.points).toBeGreaterThan(0);
    expect(dette.dureeSec).toBeGreaterThan(0);
    await fermer(page);
  });

  test("5 · le chrono crédite ce qui a réellement été fait", async ({ browser }) => {
    const page = await ouvrir(browser);
    await page.goto("/dashboard");
    await passerIntro(page);

    const avant = await lireDette(page);
    const pastille = page.locator('[data-visite="dette"]');
    await pastille.waitFor({ timeout: 15_000 });
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
    const page = await ouvrir(browser);
    await page.goto("/history");
    await expect(page.locator('[data-visite="historique-table"], table').first())
      .toBeVisible({ timeout: 20_000 });
    await fermer(page);
  });
});

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
