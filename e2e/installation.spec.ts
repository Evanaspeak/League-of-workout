import { test, expect } from "@playwright/test";
import { CLE_REFUS, CLE_VISITES } from "../src/lib/installation";

/**
 * L'invitation à poser l'application sur l'écran d'accueil.
 *
 * Sa logique a ses propres tests, qui décident quand proposer. Ce qu'ils ne
 * peuvent pas dire, c'est si la bannière paraît vraiment : elle dépend d'un
 * pointeur tactile, d'un compteur en stockage local et d'un chemin non
 * public. Trois conditions dont chacune s'écrit en une ligne et se trompe
 * aussi facilement.
 *
 * Le parcours iPhone est celui qu'on éprouve ici : c'est le seul entièrement
 * à notre main. Sur Android, l'invitation dépend d'un événement que le
 * navigateur émet ou non selon ses propres critères — on ne peut pas le
 * provoquer, donc on ne peut pas l'éprouver.
 */
const IPHONE = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15"
    + " (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

test.describe.configure({ mode: "serial" });

const marque = Date.now().toString(36);
const COMPTE = { pseudo: `Inst${marque}`, email: `inst-${marque}@example.test` };
let etat: import("@playwright/test").BrowserContextOptions["storageState"];

test("ouvrir un compte", async ({ browser }) => {
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
  const uid = (await (await page.request.get("/api/user")).json()).id as string;
  await page.evaluate((u) => {
    try {
      for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
        localStorage.setItem(c, "1");
      }
    } catch { /* stockage refusé */ }
  }, uid);
  etat = await ctx.storageState();
  await ctx.close();
});

/** Ouvre le tableau de bord sur un iPhone, avec le stockage local demandé. */
async function surIPhone(
  browser: import("@playwright/test").Browser,
  amorce: Record<string, string>,
) {
  const ctx = await browser.newContext({ storageState: etat, ...IPHONE });
  const page = await ctx.newPage();
  await page.addInitScript((valeurs) => {
    try {
      sessionStorage.setItem("splash", "1");
      for (const [c, v] of Object.entries(valeurs)) localStorage.setItem(c, v);
    } catch { /* stockage refusé */ }
  }, amorce);
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  return { ctx, page };
}

const banniere = (page: import("@playwright/test").Page) =>
  page.getByRole("dialog", { name: /écran d.accueil/i });

test("se tait aux deux premières visites", async ({ browser }) => {
  const { ctx, page } = await surIPhone(browser, {});
  await expect(banniere(page)).toBeHidden();
  await ctx.close();
});

test("propose à la troisième, avec le geste à faire", async ({ browser }) => {
  // Deux visites déjà comptées : celle-ci est la troisième.
  const { ctx, page } = await surIPhone(browser, { [CLE_VISITES]: "2" });
  await expect(banniere(page)).toBeVisible();
  // Sur iPhone il n'y a aucune invite à déclencher : reste le geste, qu'il
  // faut décrire, sinon la moitié du public n'a simplement aucun chemin.
  await expect(banniere(page)).toContainText(/Partager/i);
  await ctx.close();
});

test("ne recouvre pas le compteur de dette", async ({ browser }) => {
  // Le rail se replie en un bouton en bas à droite sous 1180 px, exactement là
  // où la bannière se posait. Elle cachait donc ce que l'application a de plus
  // important à montrer.
  const { ctx, page } = await surIPhone(browser, { [CLE_VISITES]: "2" });
  const banniere = page.getByRole("dialog", { name: /écran d.accueil/i });
  await expect(banniere).toBeVisible();

  const rail = page.locator(".rail-bascule").first();
  if (await rail.count() > 0 && await rail.isVisible()) {
    const a = await banniere.boundingBox();
    const b = await rail.boundingBox();
    const seChevauchent = !!a && !!b
      && a.x < b.x + b.width && b.x < a.x + a.width
      && a.y < b.y + b.height && b.y < a.y + a.height;
    expect({ banniere: a, rail: b, seChevauchent }).toMatchObject({ seChevauchent: false });
  }
  await ctx.close();
});

test("attrape l'invite du navigateur même émise avant le montage", async ({ browser }) => {
  // Le navigateur n'émet `beforeinstallprompt` qu'une fois, et ce moment ne se
  // commande pas. L'écouter depuis un effet revient à parier qu'il n'est pas
  // encore passé — pari perdu de temps en temps, et perdu pour de bon.
  //
  // Chromium ne l'émet pas de lui-même ici : on le simule au plus tôt, avant
  // tout script de la page, pour reproduire exactement le cas manqué.
  const ctx = await browser.newContext({ storageState: etat, ...IPHONE });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("splash", "1");
      localStorage.setItem("low_visites", "2");
      // Le composant écarte iOS avant même de regarder l'invite : on se fait
      // passer pour un navigateur qui, lui, en émet une.
      Object.defineProperty(navigator, "userAgent", {
        get: () => "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile",
      });
    } catch { /* stockage refusé */ }
    // Émise au moment où le document est prêt : après le petit script de la
    // page, qui est là pour ça, et avant que React n'ait monté quoi que ce
    // soit. C'est exactement la fenêtre où l'ancienne version perdait
    // l'événement.
    document.addEventListener("DOMContentLoaded", () => {
      const invite = new Event("beforeinstallprompt") as Event & {
        prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }>;
      };
      invite.prompt = () => Promise.resolve();
      invite.userChoice = Promise.resolve({ outcome: "accepted" });
      window.dispatchEvent(invite);
    });
  });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await expect(page.getByRole("dialog", { name: /écran d.accueil/i })).toBeVisible();
  await ctx.close();
});

test("ne repropose plus après un refus", async ({ browser }) => {
  const { ctx, page } = await surIPhone(browser, { [CLE_VISITES]: "9", [CLE_REFUS]: "1" });
  await expect(banniere(page)).toBeHidden();
  await ctx.close();
});

test("ne propose rien sur un ordinateur", async ({ browser }) => {
  // Une fenêtre étroite sur un ordinateur n'est pas un téléphone : il n'y a
  // pas d'écran d'accueil où poser une icône.
  const ctx = await browser.newContext({ storageState: etat, viewport: { width: 380, height: 800 } });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("splash", "1");
      localStorage.setItem("low_visites", "9");
    } catch { /* stockage refusé */ }
  });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await expect(banniere(page)).toBeHidden();
  await ctx.close();
});

/**
 * La page de secours hors ligne.
 *
 * Son intérêt n'est pas seulement de dire quelque chose de correct quand le
 * réseau tombe : sans elle, Chrome ne considère pas l'application comme
 * installable et n'émet jamais l'invitation d'installation. C'est donc elle
 * qui ouvre le chemin Android, et rien dans le code applicatif ne le montre.
 */
test("sert la page de secours quand le réseau tombe", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });

  // Le service worker doit être actif ET contrôler la page : tant qu'il ne
  // contrôle rien, il ne verra passer aucune navigation.
  await page.waitForFunction(
    () => navigator.serviceWorker.controller !== null,
    undefined,
    { timeout: 20_000 },
  );

  await ctx.setOffline(true);
  await page.goto("/history", { waitUntil: "domcontentloaded" }).catch(() => {});
  await expect(page.locator("body")).toContainText(/Pas de réseau|No connection/);

  await ctx.setOffline(false);
  await ctx.close();
});
