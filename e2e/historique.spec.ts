import { test, expect, type Browser } from "@playwright/test";
import { purgerTentatives } from "./limiteur";

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
  await purgerTentatives();
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
    /**
     * La largeur demandée est celle qu'on obtient.
     *
     * La version précédente écrivait `largeur < 760 ? IPHONE : …`, et IPHONE
     * impose son propre gabarit de 390 px : demander 768 rendait donc une page
     * de 390. Les contrôles ajoutés autour du seuil mesuraient une largeur
     * qu'ils n'avaient jamais demandée — et le sabotage du seuil passait au
     * vert. Le tactile se garde pour les vraies largeurs de téléphone, la
     * largeur, elle, est toujours celle qu'on a dite.
     */
    viewport: { width: largeur, height: largeur < 500 ? 844 : 900 },
    ...(largeur < 500 ? { hasTouch: true, isMobile: true } : {}),
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

test("juste sous le seuil, ce sont encore des cartes qui ne défilent pas", async ({ browser }) => {
  /**
   * Le seuil doit être celui où le tableau TIENT, pas celui où il entre.
   *
   * Il réclame 760 px et la page lui retire 32 de marges : posé à 760, il
   * paraissait dès 760 px de fenêtre et se remettait à défiler jusqu'à 792.
   * Une bande de trente-deux pixels, assez étroite pour qu'on n'y tombe
   * jamais en testant à la main — et c'est précisément la largeur d'une
   * tablette en portrait.
   */
  for (const largeur of [768, 800, 819]) {
    const { ctx, page } = await historique(browser, largeur);
    await expect(page.locator(".historique-tableau"), String(largeur)).toBeHidden();
    const quiDefile = await page.evaluate(() =>
      [...document.querySelectorAll("*")]
        .filter((e) => {
          const o = getComputedStyle(e).overflowX;
          return (o === "auto" || o === "scroll")
            && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0;
        })
        .map((e) => e.className?.toString?.() || e.tagName));
    expect(quiDefile, String(largeur)).toEqual([]);
    await ctx.close();
  }
});

test("dès que le tableau tient, il ne défile pas non plus", async ({ browser }) => {
  const { ctx, page } = await historique(browser, 820);
  await expect(page.locator(".historique-tableau")).toBeVisible();
  const defile = await page.evaluate(() => {
    const t = document.querySelector(".historique-tableau");
    return t ? t.scrollWidth > t.clientWidth + 1 : false;
  });
  expect(defile).toBe(false);
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

test("une icône de champion qui ne charge pas laisse la lettre, pas un trou", async ({ browser }) => {
  // Les icônes viennent d'un domaine tiers (Data Dragon) : une coupure chez
  // eux, un bloqueur, un patch qui déplace un fichier, et elles manquent.
  //
  // Ce que ce test couvre, et ce qu'il ne couvre pas : il éprouve le repli
  // ORDINAIRE, celui d'une image qui échoue après l'hydratation. C'est le cas
  // courant, et rien ne le couvrait.
  //
  // Il ne prouve PAS le contrôle ajouté au montage (`complete` et
  // `naturalWidth`), qui vise l'échec survenu AVANT l'hydratation : ici
  // l'interception réseau tombe forcément après. Sabotage fait, ce contrôle
  // retiré : le test passe quand même. Le cas d'avant hydratation n'est
  // éprouvé que sur l'image du bilan, où elle part avec le HTML.
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.addInitScript((u) => {
    try {
      sessionStorage.setItem("splash", "1");
      for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
        localStorage.setItem(c, "1");
      }
    } catch { /* stockage refusé */ }
  }, uid);

  await page.route("https://ddragon.leagueoflegends.com/**", (route) =>
    route.fulfill({ status: 404, body: "" }));

  await page.goto("/history", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // Plus aucune image de champion à l'écran, et la lettre est là à la place.
  await expect(page.locator('img[src*="ddragon"]')).toHaveCount(0);
  // Les deux présentations sont rendues, et c'est la feuille de style qui
  // choisit : sans filtre de visibilité, `.first()` tombe sur la carte que
  // l'écran de poste masque.
  await expect(page.getByText("A", { exact: true }).locator("visible=true").first())
    .toBeVisible();
  await ctx.close();
});
