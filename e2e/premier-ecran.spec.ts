import { test, expect } from "@playwright/test";
import { purgerTentatives } from "./limiteur";
import { passerIntro } from "./intro";
import { sansLangue } from "./chemin";

/**
 * Le premier écran du tableau de bord part dans le HTML de la réponse.
 *
 * La page est cliente et lit tout après montage : tant que `/api/dashboard`
 * n'avait pas répondu, il n'y avait qu'un squelette à l'écran. Sur téléphone
 * bridé, le plus grand élément — le rappel du test de force — paraissait à
 * 3456 ms, le seul des neuf écrans au-dessus du seuil de 2500. Le titre et ce
 * rappel sont maintenant rendus au serveur, à partir de trois valeurs lues en
 * base.
 *
 * Le test regarde le HTML brut, pas la page rendue : une fois hydratée, elle
 * afficherait le rappel dans les deux cas, et le défaut ne se verrait pas.
 */
test.describe.configure({ mode: "serial" });

const marque = Date.now().toString(36);
const COMPTE = { pseudo: `Prem${marque}`, email: `prem-${marque}@example.test` };
let etat: import("@playwright/test").BrowserContextOptions["storageState"];

test("ouvrir un compte", async ({ browser }) => {
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
  etat = await ctx.storageState();
  await ctx.close();
});

test("le rappel du test de force est déjà dans la réponse du serveur", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat });
  // L'adresse porte la langue : une requête d'API n'envoie pas d'en-tête de
  // langue, la négociation rendrait donc l'anglais et on chercherait un texte
  // français dans une page anglaise.
  const reponse = await ctx.request.get("/fr/dashboard");
  expect(reponse.status()).toBe(200);
  const html = await reponse.text();

  // Le compte vient d'ouvrir : son test de force n'est pas fait, donc le
  // rappel doit paraître. C'est aussi le plus grand élément de la page.
  expect(html).toContain("Un seul chiffre fixe ton niveau");
  await ctx.close();
});

test("le rappel disparaît quand le test est fait, sans attendre l'API", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat });
  const enregistre = await ctx.request.put("/api/settings", {
    data: { userPrefs: { pompesMax: 30 } },
  });
  expect(enregistre.status(), await enregistre.text()).toBe(200);

  const html = await (await ctx.request.get("/fr/dashboard")).text();
  expect(html).not.toContain("Un seul chiffre fixe ton niveau");
  await ctx.close();
});

/**
 * Les deux panneaux d'un compte vide mènent au geste, pas à une autre page.
 *
 * L'étape 3 des premiers pas et le panneau « aucune partie » renvoyaient tous
 * deux vers `/history`, qui ne porte aucun formulaire d'ajout : le seul est la
 * fenêtre du tableau de bord. Depuis que l'historique dit à son tour que
 * l'enregistrement se fait au tableau de bord, les deux écrans se renvoyaient
 * l'un à l'autre et le compte neuf tournait en rond.
 *
 * Le test clique et attend la fenêtre : redevenu un lien vers `/history`, il
 * partirait sur l'autre page et ne trouverait rien.
 */
test("un compte vide peut enregistrer sa première partie depuis le tableau de bord", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  await passerIntro(page);

  for (const declencheur of [
    page.getByRole("button", { name: /enregistrer votre première partie/i }),
    page.getByRole("button", { name: /^ajouter une partie$/i }).last(),
  ]) {
    await declencheur.click();
    const fenetre = page.getByRole("dialog");
    await expect(fenetre).toBeVisible();
    await expect(fenetre).toContainText(/ajouter une partie/i);
    // On repart de l'écran vide pour éprouver le second déclencheur.
    await page.keyboard.press("Escape");
    await expect(fenetre).toBeHidden();
  }

  expect(page.url()).toContain("/dashboard");
  await ctx.close();
});

/**
 * Le même écran vide sur un téléphone.
 *
 * Le bouton d'ajout vit dans le rail latéral, qui ne se déplie pas de la même
 * façon sur un petit écran : un compte neuf pouvait n'avoir aucune commande
 * d'ajout visible, alors que la saisie manuelle est le seul moyen d'employer
 * le produit sans clé Riot. Les deux déclencheurs des panneaux vides valent
 * donc autant que le rail, et c'est à cette largeur que ça compte.
 */
test("les deux déclencheurs valent aussi sur un téléphone", async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: etat, viewport: { width: 390, height: 844 }, hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  await passerIntro(page);

  for (const declencheur of [
    page.getByRole("button", { name: /enregistrer votre première partie/i }),
    page.getByRole("button", { name: /^ajouter une partie$/i }).last(),
  ]) {
    await expect(declencheur).toBeVisible();
    await declencheur.click();
    const fenetre = page.getByRole("dialog");
    await expect(fenetre).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(fenetre).toBeHidden();
  }
  await ctx.close();
});

/**
 * L'objectif de première semaine se félicite au lieu de s'évanouir.
 *
 * Il s'effaçait à la seconde où on l'atteignait : réussir et ignorer
 * produisaient exactement le même écran, c'est-à-dire rien. Quelqu'un qui
 * enregistre ses cinq parties le premier soir voyait sa récompense disparaître
 * sans un mot.
 *
 * Le test enregistre les cinq parties par l'API — ce qui compte ici est l'état
 * de l'écran, pas le geste de saisie, déjà couvert ailleurs.
 */
test("atteindre l'objectif de la première semaine se voit", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  for (let i = 0; i < 5; i++) {
    const r = await ctx.request.post("/api/games", {
      data: {
        jeu: "League of Legends", exercice: "pompes", role: "ARAM",
        champion: "Ashe", kills: 1, deaths: 1, assists: 1, result: "D",
      },
    });
    expect(r.status(), await r.text()).toBe(200);
  }

  await page.addInitScript(() => {
    try { sessionStorage.setItem("splash", "1"); } catch { /* stockage refusé */ }
  });
  // On attend ce qu'on vient chercher, pas le silence du réseau : il n'arrive
  // jamais franchement sur une page qui continue de parler.
  await page.goto("/fr/dashboard", { waitUntil: "domcontentloaded" });
  await passerIntro(page);

  // Le bloc est toujours là, et il dit que c'est fait.
  await expect(page.getByText(/objectif atteint|goal reached/i)).toBeVisible({ timeout: 15_000 });
  // Et il ne demande plus rien : le décompte de jours restants a disparu.
  await expect(page.getByText(/il te reste|days left|jours? restants?/i)).toHaveCount(0);
  await ctx.close();
});
