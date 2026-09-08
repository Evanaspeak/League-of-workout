import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { sansLangue } from "./chemin";

/**
 * Le bouton principal de la page d'accueil, et ce qu'il a cessé de savoir.
 *
 * La page lisait la session au SERVEUR pour choisir entre « Créer mon compte »
 * et « Mon espace » sur trois boutons. Une lecture de session est une lecture
 * de la requête : la page la plus visitée du produit était donc la seule page
 * publique rendue à la demande, et elle payait des démarrages à froid mesurés
 * en production à **1,42 s et 2,11 s** là où une page prérendue n'a jamais
 * dépassé 0,28 s. Un démarrage à froid tombe exactement sur qui arrive de
 * loin, c'est-à-dire sur le premier visiteur.
 *
 * Le bouton ne décide plus, il DEMANDE : il pointe sur `/commencer`, qui
 * aiguille au clic. Ce que ces parcours prouvent est la seule chose qu'aucun
 * test unitaire ne peut voir — que le même HTML, servi à tout le monde, emmène
 * chacun là où il doit aller.
 */

test.describe.configure({ mode: "parallel" });

test("le bouton du héros emmène un visiteur sans compte vers l'inscription", async ({ page }) => {
  await page.goto("/fr");
  const bouton = page.getByRole("link", { name: /^créer mon compte$/i }).first();
  await expect(bouton).toBeVisible();
  // L'adresse est FIGÉE dans le HTML : c'est ce qui rend la page prérendable.
  await expect(bouton).toHaveAttribute("href", "/fr/commencer");
  await bouton.click();
  await page.waitForURL((u) => sansLangue(u.pathname) === "/beta", { timeout: 15_000 });
});

test("le même bouton emmène un compte connecté sur son tableau de bord", async ({ browser }) => {
  const { etat } = await ouvrirCompte(browser, "Accueil");
  const contexte = await browser.newContext({ storageState: etat });
  const page = await contexte.newPage();

  await page.goto("/fr");
  const bouton = page.getByRole("link", { name: /^créer mon compte$/i }).first();
  await expect(bouton).toHaveAttribute("href", "/fr/commencer");
  await bouton.click();
  await page.waitForURL((u) => sansLangue(u.pathname) === "/dashboard", { timeout: 15_000 });

  await contexte.close();
});

/**
 * Le témoin de la promesse : le HTML est le MÊME pour les deux.
 *
 * Sans lui, les deux parcours ci-dessus passeraient aussi bien sur une page
 * qui lit la session au serveur — c'est-à-dire sur l'état d'avant. Ce qui
 * distingue les deux n'est pas où l'on atterrit, c'est ce qui est servi.
 */
test("la page servie ne dépend pas de qui la demande", async ({ browser, request }) => {
  const anonyme = await request.get("/fr");
  const { etat } = await ouvrirCompte(browser, "AccueilB");
  const contexte = await browser.newContext({ storageState: etat });
  const connecte = await contexte.request.get("/fr");

  const extrait = (html: string) => {
    const m = /<a[^>]*href="\/fr\/commencer"[\s\S]{0,200}?<\/a>/.exec(html);
    expect(m).not.toBeNull();
    return m![0];
  };
  expect(extrait(await connecte.text())).toBe(extrait(await anonyme.text()));

  await contexte.close();
});

/**
 * Le lien discret de la barre, lui, connaît la session — au navigateur.
 *
 * C'est le prix assumé : un aller-retour pendant lequel il dit « Se
 * connecter », puis « Mon espace ». C'est exactement ce que fait la barre du
 * site sur toutes les autres pages publiques. Le vérifier ici évite de croire
 * qu'on a rendu la page statique en perdant le lien.
 */
test("le lien de la barre finit par dire « Mon espace » à qui est connecté", async ({ browser }) => {
  const { etat } = await ouvrirCompte(browser, "AccueilC");
  const contexte = await browser.newContext({ storageState: etat });
  const page = await contexte.newPage();

  await page.goto("/fr");
  await expect(page.getByRole("link", { name: /^mon espace$/i })).toBeVisible({ timeout: 15_000 });

  await contexte.close();
});
