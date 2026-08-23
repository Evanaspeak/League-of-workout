import { test, expect, type Browser } from "@playwright/test";

/**
 * L'historique sur téléphone.
 *
 * Le tableau réclame 760 px et compte jusqu'à neuf colonnes. Sous cette
 * largeur il défilait horizontalement : on voyait la date OU le résultat,
 * jamais l'activité entière, et le KDA se coupait au milieu d'un chiffre.
 *
 * Rien ne l'attrapait. Les tests de langue vérifient qu'aucune PAGE ne
 * déborde, et celle-ci ne débordait pas : c'est un conteneur intérieur qui
 * défilait, ce qui est même la bonne façon de faire déborder un tableau. Le
 * défaut n'était donc pas un défaut de mise en page, mais de choix de
 * présentation, et ça ne se voit qu'en regardant.
 */
const IPHONE = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
};

test.describe.configure({ mode: "serial" });

const marque = Date.now().toString(36);
const COMPTE = { pseudo: `Histo${marque}`, email: `histo-${marque}@example.test` };
let etat: import("@playwright/test").BrowserContextOptions["storageState"];
let uid: string;

test("ouvrir un compte et enregistrer des parties", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { sessionStorage.setItem("splash", "1"); } catch { /* stockage refusé */ }
  });
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
    page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 }),
    page.getByRole("button", { name: /^se connecter$|^sign in$/i }).click(),
  ]);
  uid = (await (await page.request.get("/api/user")).json()).id as string;

  // Le nom de champion le plus long du jeu, et des KDA à deux chiffres : c'est
  // là que la mise en page casse, pas sur un cas idéal.
  const parties = [
    { champion: "Aurelion Sol", role: "ARAM", kills: 20, deaths: 14, assists: 8, result: "V" },
    { champion: "Kog'Maw", role: "ARAM", kills: 12, deaths: 16, assists: 9, result: "D" },
    { champion: "Maître Yi", role: "Jungle", kills: 17, deaths: 20, assists: 4, result: "D" },
  ];
  for (const p of parties) {
    const r = await page.request.post("/api/games", {
      data: { jeu: "League of Legends", exercice: "pompes", ...p },
    });
    // Une partie qui ne s'enregistre pas rendrait tous les cas suivants
    // silencieusement vides : ils passeraient en ne regardant rien.
    expect(r.status(), await r.text()).toBe(200);
  }

  await page.evaluate((u) => {
    try {
      for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
        localStorage.setItem(c, "1");
      }
    } catch { /* stockage refusé */ }
  }, uid);
  // Le consentement santé est modal : sans réponse, c'est lui qu'on mesure.
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  const accepter = page.getByRole("button", { name: /^j.accepte$/i }).first();
  if (await accepter.isVisible().catch(() => false)) {
    await accepter.click();
    await accepter.waitFor({ state: "hidden", timeout: 10_000 });
  }
  etat = await ctx.storageState();
  await ctx.close();
});

/** Ouvre l'historique à une largeur donnée, intro déjà écartée. */
async function historique(browser: Browser, largeur: number) {
  const ctx = await browser.newContext({
    storageState: etat,
    ...(largeur < 760 ? IPHONE : { viewport: { width: largeur, height: 900 } }),
  });
  const page = await ctx.newPage();
  await page.addInitScript((u) => {
    try {
      sessionStorage.setItem("splash", "1");
      for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
        localStorage.setItem(c, "1");
      }
    } catch { /* stockage refusé */ }
  }, uid);
  await page.goto("/history", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  return { ctx, page };
}

test("sur téléphone : des cartes, pas un tableau à faire défiler", async ({ browser }) => {
  const { ctx, page } = await historique(browser, 390);
  await expect(page.locator(".carte-activite").first()).toBeVisible();
  await expect(page.locator(".historique-tableau")).toBeHidden();

  /**
   * Aucun conteneur ne doit défiler horizontalement : c'était tout le défaut.
   *
   * On ne retient que les VRAIS conteneurs défilants, ceux dont `overflow-x`
   * vaut `auto` ou `scroll`. La première version prenait tout élément dont le
   * contenu dépasse, et signalait donc les libellés coupés par une ellipse —
   * qui débordent par construction et ne se font jamais défiler.
   */
  const quiDefile = await page.evaluate(() =>
    [...document.querySelectorAll("*")]
      .filter((e) => {
        const o = getComputedStyle(e).overflowX;
        return (o === "auto" || o === "scroll")
          && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0;
      })
      .map((e) => e.className?.toString?.() || e.tagName));
  expect(quiDefile).toEqual([]);
  await ctx.close();
});

test("chaque activité tient d'un seul tenant", async ({ browser }) => {
  const { ctx, page } = await historique(browser, 390);
  const carte = page.locator(".carte-activite").first();

  // Ce qu'on vient chercher : le nom, le résultat et ce que ça coûte, ensemble.
  await expect(carte).toContainText(/Victoire|Défaite/);
  await expect(carte).toContainText(/pompes/);
  await expect(carte.locator(".carte-activite-nom")).toContainText(/\S/);

  // Et le nom le plus long du jeu ne pousse rien hors de la carte.
  const debordeDedans = await carte.evaluate((e) => e.scrollWidth > e.clientWidth + 1);
  expect(debordeDedans).toBe(false);
  await ctx.close();
});

test("toutes les commandes se touchent au doigt", async ({ browser }) => {
  const { ctx, page } = await historique(browser, 390);
  const petites = await page.evaluate(() =>
    [...document.querySelectorAll(".carte-activite button")]
      .map((b) => {
        const r = b.getBoundingClientRect();
        return { nom: b.getAttribute("aria-label"), l: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((b) => b.l < 44 || b.h < 44));
  expect(petites).toEqual([]);
  await ctx.close();
});

test("sur un écran large : le tableau reprend sa place", async ({ browser }) => {
  // Les cartes n'ont pas à remplacer le tableau partout : à cette largeur, il
  // montre plus de choses d'un coup d'œil, et c'est pour ça qu'il existe.
  const { ctx, page } = await historique(browser, 1280);
  await expect(page.locator(".historique-tableau")).toBeVisible();
  await expect(page.locator(".carte-activite").first()).toBeHidden();
  await ctx.close();
});
