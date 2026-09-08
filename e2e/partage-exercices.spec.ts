import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { requeteSql } from "./base";
import { sansLangue } from "./chemin";
import { viderLesFenetres } from "./intro";

/**
 * Le partage entre exercices au choix (réponse 068).
 *
 * Ce qu'aucun test unitaire ne peut voir, c'est la CHAÎNE : un poids réglé à
 * l'écran doit arriver jusqu'à la ventilation écrite en base pour une partie
 * enregistrée ensuite. Le module est éprouvé de son côté, la route du sien, et
 * le garde de branchement compte les arguments ; aucun des trois ne dit que
 * l'écran envoie ce qu'on vient de cliquer.
 *
 * Le contrôle porte sur la BASE et pas seulement sur l'écran : un panneau qui
 * se contenterait d'afficher ce qu'on vient de taper passerait tout le reste.
 *
 * **Ce qu'il ne couvre PAS, dit plutôt que laissé à découvrir.** Il lit la
 * ventilation ÉCRITE, donc l'appel qui la sérialise. Débrancher les poids des
 * deux autres appels de la même route — celui qui alimente la dette et celui
 * qui remplit la réponse — le laisse au vert : la somme reste exacte dans les
 * deux cas, donc la dette totale ne bouge pas. Ces deux-là sont tenus par
 * `src/partageBranche.test.ts`, qui compte les arguments. Il fallait le
 * sabotage pour le savoir, et sans lui ce commentaire aurait promis plus que
 * le test ne prouve.
 */
test.describe.configure({ mode: "serial" });

let etat: import("@playwright/test").BrowserContextOptions["storageState"];
let uid: string;

test("ouvrir un compte", async ({ browser }) => {
  const ouvert = await ouvrirCompte(browser, "Part");
  etat = ouvert.etat;
  const ctx = await browser.newContext({ storageState: etat });
  uid = (await (await ctx.request.get("/api/user")).json()).id as string;
  await ctx.close();
  expect(uid).toBeTruthy();
});

test("un poids réglé à l'écran décide de la ventilation écrite en base", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  // La modale d'accueil recouvre la page et rien ne se clique derrière : le
  // premier clic passait, le second tombait dessus. C'est le septième fichier
  // de parcours à s'y heurter, et on la traverse depuis la page d'arrivée.
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await viderLesFenetres(page);

  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  const rubrique = page.getByRole("button", { name: /ton effort|your effort/i }).first();
  await rubrique.waitFor({ state: "visible", timeout: 20_000 });
  // On est bien sur les réglages : sans session on atterrirait sur la
  // connexion, et le test cliquerait dans une page qui n'a aucun réglage.
  expect(sansLangue(new URL(page.url()).pathname)).toBe("/settings");
  await rubrique.click();

  // Un seul exercice coché : il n'y a rien à partager, donc rien à proposer.
  const panneau = page.getByRole("group", { name: /le partage|the split/i });
  await expect(panneau).toHaveCount(0);

  // On coche les squats : le partage devient une question, donc il paraît.
  await page.getByRole("checkbox", { name: /squats/i }).first().click();
  await expect(panneau).toBeVisible({ timeout: 20_000 });

  // Deux clics sur « Plus de pompes » : poids 3 contre 1.
  const plus = page.getByRole("button", { name: /plus de pompes|more push-ups/i }).first();
  await plus.click();
  await plus.click();

  await expect.poll(async () => {
    const [l] = await requeteSql<{ partsExercices: string | null }>(
      'SELECT "partsExercices" FROM "User" WHERE id = $1', [uid],
    );
    return l?.partsExercices ?? "";
  }, { timeout: 20_000 }).toContain('"pompes":3');

  /**
   * Et maintenant la moitié qui compte : une partie enregistrée APRÈS doit
   * porter cette proportion. Elle passe par la route, comme n'importe quelle
   * saisie — c'est la couture entre le réglage et le calcul qu'on éprouve, pas
   * le formulaire, qui a ses propres parcours.
   */
  const r = await ctx.request.post("/api/games", {
    data: {
      jeu: "League of Legends", typeJeu: "parties", role: "Mid",
      champion: "Ahri", kills: 2, deaths: 9, assists: 4,
      result: "D", date: new Date().toISOString(),
    },
  });
  expect(r.ok()).toBeTruthy();

  const [game] = await requeteSql<{ repartition: string | null; pompesCalculees: number }>(
    'SELECT repartition, "pompesCalculees" FROM "Game" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT 1',
    [uid],
  );
  expect(game?.repartition).toBeTruthy();
  const parts = JSON.parse(String(game.repartition)) as Record<string, number>;
  const total = Number(game.pompesCalculees);

  // La somme reste exacte : un point perdu ici est une pompe que personne ne
  // fera, un point inventé une pompe qu'on n'a pas méritée.
  expect(parts.pompes + parts.squats).toBe(total);
  // Et la proportion est celle qu'on vient de régler, à l'arrondi près.
  expect(parts.pompes).toBe(Math.round((total * 3) / 4));
  expect(parts.pompes).toBeGreaterThan(parts.squats);

  /**
   * Et revenir en arrière, sur le MÊME écran : un nouveau contexte rouvrirait
   * la modale d'accueil et referait toute la traversée, ce qui a fait déborder
   * ce test de son budget d'une minute. Ce qu'on éprouve ici est un bouton,
   * pas une ouverture de session.
   */
  await page.reload({ waitUntil: "domcontentloaded" });
  // Le fragment `#effort` survit au rechargement, donc la rubrique s'ouvre
  // seule : « Ton effort » n'est alors plus un bouton mais le TITRE de la
  // page, et le chercher comme bouton attend indéfiniment. C'est ce qui a
  // fait déborder ce test la première fois — l'échec disait « Test ended »,
  // pas « bouton introuvable ».
  await page.getByRole("button", { name: /parts égales|equal parts/i }).first()
    .click({ timeout: 20_000 });

  await expect.poll(async () => {
    const [l] = await requeteSql<{ partsExercices: string | null }>(
      'SELECT "partsExercices" FROM "User" WHERE id = $1', [uid],
    );
    return l?.partsExercices;
  }, { timeout: 20_000 }).toBeNull();

  await ctx.close();
});
