import { test, expect } from "@playwright/test";
import { purgerTentatives } from "./limiteur";
import { sansLangue } from "./chemin";

/**
 * Une séance payée sans réseau ne se perd pas.
 *
 * La file a ses tests unitaires — ce qu'elle garde, ce qu'elle jette, ce
 * qu'elle renvoie. Ils ne disent rien de l'assemblage : que le composant
 * appelle bien la mise en file quand l'envoi échoue, que la pastille annonce
 * ce qui attend, et que le retour du réseau déclenche vraiment le renvoi. Ce
 * sont trois branchements, et un branchement se vérifie en marchant dessus.
 *
 * Le parcours est celui d'une vraie soirée : une défaite qui crée une dette,
 * le réseau coupé, le chrono lancé et terminé, puis le réseau qui revient.
 */
test.describe.configure({ mode: "serial" });

const marque = Date.now().toString(36);
const COMPTE = { pseudo: `Hors${marque}`, email: `hors-${marque}@example.test` };
let etat: import("@playwright/test").BrowserContextOptions["storageState"];
let uid: string;

test("ouvrir un compte, choisir la boxe, et se faire une dette", async ({ browser }) => {
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
    page.waitForURL((u) => !sansLangue(u.pathname).startsWith("/login"), { timeout: 30_000 }),
    page.getByRole("button", { name: /^se connecter$|^sign in$/i }).click(),
  ]);
  uid = (await (await page.request.get("/api/user")).json()).id as string;

  // Seuls les exercices comptés en temps alimentent le compteur : des pompes
  // se font tout de suite après la partie, un round de boxe attend d'avoir de
  // quoi faire une vraie série.
  const r = await page.request.put("/api/settings", { data: { userPrefs: { exercices: ["boxe"] } } });
  expect(r.status(), await r.text()).toBe(200);

  const partie = await page.request.post("/api/games", {
    data: { jeu: "League of Legends", role: "Mid", champion: "Ahri",
            kills: 0, deaths: 12, assists: 1, result: "D", exercice: "boxe" },
  });
  expect(partie.status(), await partie.text()).toBe(200);

  // La demande de consentement santé est modale et recouvre la pastille de
  // dette : sans réponse, aucun clic ne passe. Elle se traverse ici plutôt
  // qu'à chaque écran ouvert plus bas.
  const consenti = await page.request.post("/api/consentement", { data: { accepte: true } });
  expect(consenti.status(), await consenti.text()).toBe(200);

  const dette = await (await page.request.get("/api/dette")).json();
  expect(dette.points, "la partie doit avoir créé une dette").toBeGreaterThan(0);

  etat = await ctx.storageState();
  await ctx.close();
});

/** Ouvre le tableau de bord, intro et visite déjà écartées. */
async function ouvrir(browser: import("@playwright/test").Browser) {
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
  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  return { ctx, page };
}

test("sans réseau, la séance est gardée au lieu d'être perdue", async ({ browser }) => {
  const { ctx, page } = await ouvrir(browser);

  await page.getByRole("button", { name: /lancer le chrono|en attente/i }).first()
    .or(page.locator(".pastille-dette")).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Le réseau tombe pendant la séance : c'est le cas d'une salle en sous-sol.
  await ctx.setOffline(true);
  await page.getByRole("button", { name: /plus tard|j'ai fini/i }).first().click();

  // La fenêtre se referme — on a demandé à fermer — mais l'effort est gardé.
  await expect(page.getByRole("dialog")).toBeHidden();
  const file = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("low_file_paiements") ?? "[]"));
  expect(file, "la séance doit être mise de côté").toHaveLength(1);
  expect(typeof file[0].jeton).toBe("string");

  // Et la pastille le dit : sans ça, la dette paraît intacte et on la refait.
  await expect(page.getByText(/hors réseau/i)).toBeVisible();

  await ctx.setOffline(false);
  await ctx.close();
});

test("au retour du réseau, elle part toute seule", async ({ browser }) => {
  const { ctx, page } = await ouvrir(browser);

  // On remet une séance en attente à la main : ce test-ci éprouve le renvoi,
  // pas la mise en file, et les deux doivent pouvoir échouer séparément.
  const avant = await (await page.request.get("/api/dette")).json();
  expect(avant.points).toBeGreaterThan(0);

  await page.evaluate(() => {
    localStorage.setItem("low_file_paiements", JSON.stringify([{
      jeton: `essai-${Date.now()}`,
      jour: new Date().toISOString().slice(0, 10),
      tout: true,
      quand: Date.now(),
    }]));
  });

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const file = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("low_file_paiements") ?? "[]"));
  expect(file, "la file doit être vide une fois envoyée").toHaveLength(0);

  const apres = await (await page.request.get("/api/dette")).json();
  expect(apres.points, "la dette doit être soldée").toBe(0);
  await ctx.close();
});

test("un renvoi en double ne paie pas deux fois", async ({ browser }) => {
  const { ctx, page } = await ouvrir(browser);

  // Une dette neuve, puis deux envois du MÊME jeton : c'est exactement ce que
  // fait un téléphone dont la réponse s'est perdue en chemin.
  const partie = await page.request.post("/api/games", {
    data: { jeu: "League of Legends", role: "Mid", champion: "Ahri",
            kills: 0, deaths: 14, assists: 0, result: "D", exercice: "boxe" },
  });
  expect(partie.status(), await partie.text()).toBe(200);
  const due = (await (await page.request.get("/api/dette")).json()).points as number;
  expect(due).toBeGreaterThan(0);

  const jeton = `double-${Date.now()}`;
  const jour = new Date().toISOString().slice(0, 10);
  const payer = () => page.request.patch("/api/dette", {
    data: { jeton, jour, secondes: 1 },
  });
  const premier = await (await payer()).json();
  const second = await (await payer()).json();

  // Le second ne doit RIEN retirer de plus : sans jeton, il effacerait une
  // dette qu'on n'a pas faite.
  expect(second.points).toBe(premier.points);
  await ctx.close();
});

/**
 * Le serveur répond, mais mal : la séance est gardée aussi.
 *
 * Le `catch` du composant ne rattrape que l'absence de réseau. Une réponse 500
 * ou une session expirée traversaient le `if (res.ok)` sans rien faire : la
 * fenêtre se refermait, la dette restait entière, et la séance qu'on venait de
 * faire disparaissait sans un mot. C'est le défaut même que la file existe
 * pour empêcher, laissé ouvert sur le seul chemin où le serveur est joignable.
 *
 * Le réseau reste branché ici : c'est ce qui distingue ce test du premier.
 */
test("quand le serveur répond 500, la séance est gardée aussi", async ({ browser }) => {
  const { ctx, page } = await ouvrir(browser);

  // Une dette neuve : les tests précédents ont soldé la première.
  const partie = await page.request.post("/api/games", {
    data: { jeu: "League of Legends", role: "Mid", champion: "Ahri",
            kills: 1, deaths: 11, assists: 2, result: "D", exercice: "boxe" },
  });
  expect(partie.status(), await partie.text()).toBe(200);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => localStorage.removeItem("low_file_paiements"));

  // Seul l'acquittement tombe en panne. La lecture continue de répondre, sans
  // quoi la pastille n'aurait rien à ouvrir.
  await page.route("**/api/dette", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Erreur serveur" }),
      });
      return;
    }
    await route.continue();
  });

  await page.getByRole("button", { name: /lancer le chrono|en attente/i }).first()
    .or(page.locator(".pastille-dette")).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: /plus tard|j'ai fini/i }).first().click();
  await expect(page.getByRole("dialog")).toBeHidden();

  const file = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("low_file_paiements") ?? "[]"));
  expect(file, "un 500 ne doit pas faire disparaître la séance").toHaveLength(1);
  await ctx.close();
});
