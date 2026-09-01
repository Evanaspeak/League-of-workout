import { test, expect } from "@playwright/test";
import { purgerTentatives } from "./limiteur";
import { ouvrirCompte } from "./compte";
import { sansLangue } from "./chemin";

/**
 * Ce que l'écran dit quand le serveur répond mal.
 *
 * Deux comportements ont été trouvés en coupant les réponses à la main, et le
 * second est le pire défaut de la soirée :
 *
 * - le tableau de bord gardait son squelette **pour toujours**. Une panne
 *   ressemblait exactement à une page lente : on attend, on recharge, on
 *   attend encore ;
 * - l'historique annonçait « aucune game à afficher » — c'est-à-dire qu'il
 *   affirmait quelque chose de FAUX sur les données de la personne. Quelqu'un
 *   dont la requête échoue croit que son historique a été effacé.
 *
 * Un échec doit se dire, et dire que rien n'est perdu.
 */
test.describe.configure({ mode: "serial" });

const marque = Date.now().toString(36);
const COMPTE = { pseudo: `Pann${marque}`, email: `pann-${marque}@example.test` };
let etat: import("@playwright/test").BrowserContextOptions["storageState"];
let uid: string;

test("ouvrir un compte avec une partie", async ({ browser }) => {
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
  // La demande de consentement santé est modale et recouvre le rail : sans
  // réponse, aucun clic ne passe. C'est le cinquième fichier de parcours qui
  // tombe dessus. Elle se traverse par l'API, comme partout ailleurs.
  const consenti = await page.request.post("/api/consentement", { data: { accepte: true } });
  expect(consenti.status(), await consenti.text()).toBe(200);
  const r = await page.request.post("/api/games", {
    data: { jeu: "League of Legends", role: "Mid", champion: "Ahri",
            kills: 1, deaths: 8, assists: 2, result: "D", exercice: "pompes" },
  });
  expect(r.status(), await r.text()).toBe(200);
  etat = await ctx.storageState();
  await ctx.close();
});

/** Ouvre un écran en faisant échouer une route. */
async function avecPanne(
  browser: import("@playwright/test").Browser, motif: string, chemin: string,
) {
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
  await page.route(motif, (r) => r.fulfill({
    status: 500, contentType: "application/json", body: '{"error":"Erreur serveur"}',
  }));
  await page.goto(chemin, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  return { ctx, page };
}

test("le tableau de bord dit qu'il n'a pas pu charger, au lieu d'attendre sans fin", async ({ browser }) => {
  const { ctx, page } = await avecPanne(browser, "**/api/dashboard*", "/dashboard");
  const texte = await page.evaluate(() => document.body.innerText);
  expect(texte).toContain("n'ont pas pu être chargées");
  await expect(page.getByRole("button", { name: /réessayer/i })).toBeVisible();
  await ctx.close();
});

test("l'historique ne prétend pas que le compte est vide", async ({ browser }) => {
  const { ctx, page } = await avecPanne(browser, "**/api/games*", "/history");
  const texte = await page.evaluate(() => document.body.innerText);
  // Le message d'échec doit être là…
  expect(texte).toContain("n'ont pas pu être chargées");
  // …et surtout, celui qui affirme le contraire ne doit pas y être.
  expect(texte).not.toContain("Aucune game à afficher");
  await ctx.close();
});

test("le bilan de saison le dit aussi", async ({ browser }) => {
  const { ctx, page } = await avecPanne(browser, "**/api/bilan", "/bilan");
  expect(await page.evaluate(() => document.body.innerText)).toContain("n'a pas pu être calculé");
  await ctx.close();
});

test("un historique vide dit où enregistrer une activité", async ({ browser }) => {
  /**
   * L'ajout d'activité vit dans le rail du tableau de bord, et nulle part
   * dans l'historique. Quelqu'un qui vient chercher « où j'enregistre ma
   * partie » à l'endroit le plus évident ne trouvait que « aucune game à
   * afficher » : un écran vide qui ne dit pas quoi faire est un cul-de-sac.
   *
   * On ne déplace pas le bouton — c'est une décision de produit — on dit où
   * il est.
   */
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
  // Une réponse vide : le compte de ce fichier a une partie, on la retire.
  await page.route("**/api/games", (r) => r.fulfill({
    status: 200, contentType: "application/json", body: "[]",
  }));
  await page.goto("/history", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  const lien = page.getByRole("link", { name: /tableau de bord/i });
  await expect(lien).toBeVisible();
  // Le lien porte la langue de la page : c'est `Lien` qui la pose, et sans
  // elle on changerait de langue au clic.
  expect(await lien.getAttribute("href")).toBe("/fr/dashboard");
  await ctx.close();
});

/**
 * Un ajout depuis la liste Riot qui échoue le dit.
 *
 * La liste des vingt dernières parties propose un bouton par ligne. Un refus
 * du serveur ne disait rien du tout : la ligne redevenait normale, on
 * recliquait, sans savoir ce qui s'était passé. Et l'envoi n'était pas protégé
 * — sans réseau, la ligne restait en « ajout… » pour toujours.
 *
 * La liste Riot est fabriquée ici : la clé de production n'est pas encore
 * arrivée, et ce qu'on éprouve est la réaction de l'écran, pas Riot.
 */
test("un ajout Riot refusé le dit, sans faire disparaître la liste", async ({ browser }) => {
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

  await page.route("**/api/riot/match-history*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{
        matchId: "EUW1_FAUX_1", champion: "Ahri", role: "MID",
        kills: 2, deaths: 9, assists: 4, result: "D",
        date: new Date().toISOString(), alreadyLogged: false,
      }]),
    }));
  await page.route("**/api/games", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Erreur serveur" }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/dashboard", { waitUntil: "networkidle" });
  expect(sansLangue(new URL(page.url()).pathname)).toBe("/dashboard");
  await page.locator('[data-visite="rail-bascule"]').click({ timeout: 2_000 }).catch(() => {});
  await page.locator('[data-visite="rail-ajout"]').click();

  const ligne = page.getByText("Ahri").first();
  await ligne.waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: /^ajouter$|^add$/i }).first().click();

  // Le message paraît, et la liste est toujours là : la signaler en réemployant
  // l'erreur de chargement ferait disparaître les vingt parties d'un coup.
  // Le message est celui que la route a rendu, traduit : le repli
  // « erreur lors du log » ne sert que si la réponse n'en porte aucun.
  await expect(page.getByText(/erreur serveur|server error|erreur lors du log|error while logging/i).first())
    .toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Ahri").first()).toBeVisible();
  await ctx.close();
});

test("un consentement refusé le dit, au lieu d'enfermer dans la fenêtre", async ({ browser }) => {
  // Cette fenêtre-là ne se ferme pas : sans message, la personne clique
  // « J'accepte », le bouton redevient cliquable, rien ne bouge, et il n'y a
  // aucun autre chemin. C'est le seul écran où un échec muet enferme.
  //
  // Le compte est neuf et n'a pas encore répondu : c'est la seule façon de
  // faire paraître la fenêtre. `ouvrirCompte` ne pose donc pas le
  // consentement.
  const { etat: neuf } = await ouvrirCompte(browser, "Cons", { consentement: false });
  const ctx = await browser.newContext({ storageState: neuf });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { sessionStorage.setItem("splash", "1"); } catch { /* stockage refusé */ }
  });

  await page.route("**/api/consentement", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Erreur serveur" }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/dashboard");
  const accepter = page.getByRole("button", { name: /^j.accepte$|^i agree$/i }).first();
  await accepter.waitFor({ timeout: 20_000 });
  await accepter.click();

  // Le rôle seul ne prouve rien : d'autres éléments de la page le portent, et
  // le sabotage passait au vert. C'est le texte qu'on cherche, dans un
  // élément qui l'annonce.
  await expect(page.getByRole("alert").filter({ hasText: /n.a pas pu être enregistrée|could not be saved/i }))
    .toBeVisible({ timeout: 10_000 });
  // Et la fenêtre est toujours là : la question n'a pas été prise pour
  // répondue. Sans ce second contrôle, un écran qui se ferme sur un échec
  // passerait le premier.
  await expect(accepter).toBeVisible();
  await ctx.close();
});

test("sans réseau, l'enregistrement d'une partie rend la main et le dit", async ({ browser }) => {
  // C'est l'action la plus utilisée de l'application, et elle n'avait pas de
  // `try` : une coupure réseau faisait rejeter la promesse, la ligne qui rend
  // la main au bouton n'était jamais atteinte, et « Enregistrement… » restait
  // à l'écran pour toujours.
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
  await page.locator('[data-visite="rail-bascule"]').click({ timeout: 2_000 }).catch(() => {});
  await page.locator('[data-visite="rail-ajout"]').click();

  // Le formulaire est ouvert : on coupe seulement l'envoi, pas le chargement.
  await page.route("**/api/games", async (route) => {
    if (route.request().method() === "POST") return route.abort("failed");
    await route.continue();
  });

  // Les identifiants plutôt que les rôles : c'est ce que fait le parcours
  // complet, et ces champs n'ont pas de nom accessible stable.
  await page.locator("#ajout-kills").waitFor({ timeout: 15_000 });
  await page.locator("#ajout-kills").fill("2");
  await page.locator("#ajout-deaths").fill("9");
  await page.locator("#ajout-assists").fill("4");

  const envoyer = page.getByRole("button", { name: /logger cette game|log this game/i });
  await envoyer.scrollIntoViewIfNeeded();
  await envoyer.click();

  // Le message paraît, et le bouton est revenu : il ne tourne pas dans le vide.
  await expect(page.getByText(/erreur lors du log|error while logging/i).first())
    .toBeVisible({ timeout: 15_000 });
  await expect(envoyer).toBeEnabled();
  await ctx.close();
});

test("un test de force refusé garde la saisie et le dit", async ({ browser }) => {
  // C'est ce test qui fixe le niveau, donc toute la dette. Sur le tableau de
  // bord, l'échec était avalé : le panneau se fermait, la saisie s'effaçait, et
  // rien n'était enregistré.
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

  await page.route("**/api/settings", async (route) => {
    if (route.request().method() === "PUT") {
      return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    }
    await route.continue();
  });

  await page.goto("/dashboard", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /faire le test|refaire le test|take the test|retake/i })
    .first().click();

  const champ = page.getByRole("spinbutton").first();
  await champ.fill("30");
  await page.getByRole("button", { name: /^enregistrer$|^save$/i }).first().click();

  await expect(page.getByRole("alert").filter({ hasText: /n.a pas été enregistré|was not saved/i }))
    .toBeVisible({ timeout: 10_000 });
  // Et la saisie est toujours là : refermer sur un échec efface ce qu'on vient
  // de taper, et il faut alors refaire le test pour de vrai.
  await expect(champ).toHaveValue("30");
  await ctx.close();
});
