import { test, expect } from "@playwright/test";
import { remplirInscription, seConnecter } from "./compte";
import { purgerTentatives } from "./limiteur";
import { sansLangue } from "./chemin";

/**
 * La section « Tes jeux », vue depuis un navigateur.
 *
 * Elle annonce « chaque jeu a ses réglages », puis n'en montre qu'un. C'est
 * exact — sans l'application Windows il n'y a ni pastille en jeu ni détection
 * automatique — mais rien ne le disait, et on cherchait où étaient passés les
 * autres jeux. Une section qui promet plus qu'elle ne donne doit au moins dire
 * pourquoi.
 */
test.describe.configure({ mode: "serial" });

const marque = Date.now().toString(36);
const COMPTE = { pseudo: `Regl${marque}`, email: `regl-${marque}@example.test` };
let etat: import("@playwright/test").BrowserContextOptions["storageState"];
let uid: string;

test("ouvrir un compte", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { sessionStorage.setItem("splash", "1"); } catch { /* stockage refusé */ }
  });
  await purgerTentatives();
  await page.goto("/beta");
  await remplirInscription(page, { pseudo: COMPTE.pseudo, email: COMPTE.email });
  await page.getByRole("button", { name: /rejoindre|obtenir|valider|envoyer|join/i }).first().click();
  const bloc = page.locator(".mono-num").first();
  await bloc.waitFor({ timeout: 20_000 });
  const code = (await bloc.innerText()).trim();

  await seConnecter(page, COMPTE.pseudo, code);
  uid = (await (await page.request.get("/api/user")).json()).id as string;
  // La demande de consentement santé est modale et recouvre la page : sans
  // réponse, aucun clic ne passe. C'est le quatrième fichier de parcours qui
  // tombe dessus. Le compte vient de donner ses mesures à l'inscription,
  // accepter est le chemin qu'il suit réellement.
  const consenti = await page.request.post("/api/consentement", { data: { accepte: true } });
  expect(consenti.status(), await consenti.text()).toBe(200);
  etat = await ctx.storageState();
  await ctx.close();
});

test("dit pourquoi il n'y a qu'un jeu, et où sont les autres", async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: etat, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true,
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
  // On attend ce qu'on vient chercher, pas le silence du réseau : celui-ci
  // n'arrive jamais franchement sur une page qui continue de parler, et il
  // coûtait plus de temps à lui seul que tout le reste du fichier.
  await page.goto("/settings#jeux", { waitUntil: "domcontentloaded" });

  // Le jeu est bien là, et l'explication aussi.
  await expect(page.getByText("League of Legends").first()).toBeVisible();
  const lien = page.getByRole("link", { name: /installer l.application|install the app/i });
  await expect(lien).toBeVisible();
  await expect(lien).toHaveAttribute("href", "/fr/telechargement");

  // Et rien ne déborde de l'écran au passage.
  const deborde = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(deborde).toBe(false);
  await ctx.close();
});

/**
 * Un réglage refusé par le serveur ne reste pas affiché comme s'il était pris.
 *
 * Les cinq réglages de « Ton effort » posaient la nouvelle valeur à l'écran
 * AVANT de l'envoyer, et ne faisaient rien du refus : l'écran montrait donc un
 * réglage que le serveur n'avait pas. On s'en apercevait au rechargement
 * suivant, sans savoir pourquoi — et ici, un exercice ou un plafond mal
 * enregistré change ce qu'on doit.
 *
 * Le `fetch` n'était pas protégé non plus : sans réseau, la promesse partait
 * en erreur et « Enregistrement… » restait à l'écran pour toujours.
 */
test("un réglage que le serveur refuse revient en arrière, et le dit", async ({ browser }) => {
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
  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /ton effort|your effort/i }).first()
    .waitFor({ state: "visible", timeout: 20_000 });
  // On est bien sur les réglages : sans session on atterrirait sur la
  // connexion, et le test mesurerait une page qui n'a aucun réglage.
  expect(sansLangue(new URL(page.url()).pathname)).toBe("/settings");
  // Les réglages sont rangés en rubriques repliées : il faut ouvrir « Ton
  // effort » avant de voir la liste des exercices.
  await page.getByRole("button", { name: /ton effort|your effort/i }).first().click();
  await page.waitForTimeout(600);

  // Seul l'enregistrement tombe en panne ; la lecture continue de répondre.
  await page.route("**/api/settings", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ error: "Erreur serveur" }),
      });
      return;
    }
    await route.continue();
  });

  // La boxe au sac n'est pas cochée sur un compte neuf : on la coche, le
  // serveur refuse, elle doit se décocher. Le libellé nomme le SAC depuis la
  // séparation du shadow (réponse 078).
  const boxe = page.getByText(/^boxe au sac$|^bag boxing$/i).first();
  await boxe.waitFor({ timeout: 10_000 });
  await boxe.click();

  await expect(page.getByText(/erreur lors de la sauvegarde|error while saving/i))
    .toBeVisible({ timeout: 10_000 });

  // Et le serveur n'a rien retenu : c'est lui qui tranche, pas l'écran.
  const apres = await (await page.request.get("/api/settings")).json();
  expect(apres?.user?.exercices ?? []).not.toContain("boxe");
  await ctx.close();
});

/**
 * Une suppression de compte qui échoue ne laisse pas le bouton tourner.
 *
 * `deleteAccount` est une action serveur : si la base ne répond pas, la
 * promesse part en erreur et « Suppression en cours… » reste à l'écran pour
 * toujours. La personne croit que son compte s'efface, et il n'en est rien.
 *
 * L'action se détourne par son en-tête `Next-Action`, que Next pose sur
 * l'appel : c'est ce qui la distingue d'une navigation ordinaire vers la même
 * adresse.
 */
test("une suppression de compte qui échoue le dit, au lieu de tourner sans fin", async ({ browser }) => {
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

  await page.route("**/api/user", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({
        status: 500, contentType: "application/json",
        body: JSON.stringify({ error: "Erreur serveur" }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/settings", { waitUntil: "domcontentloaded" });
  expect(sansLangue(new URL(page.url()).pathname)).toBe("/settings");
  const rubriqueDonnees = page.getByRole("button", { name: /données|data/i }).first();
  await rubriqueDonnees.waitFor({ state: "visible", timeout: 20_000 });
  await rubriqueDonnees.click();
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: /supprimer mon compte|delete my account/i })
    .first().click();
  const fenetre = page.getByRole("dialog");
  await expect(fenetre).toBeVisible();
  await fenetre.getByRole("textbox").fill("SUPPRIMER");
  await fenetre.getByRole("button", { name: /supprimer définitivement|delete permanently/i })
    .click();

  // Le message paraît, et le compte est toujours là : c'est le serveur qui
  // tranche, pas l'écran.
  await expect(page.getByText(/erreur lors de la sauvegarde|error while saving/i))
    .toBeVisible({ timeout: 15_000 });
  // Et le bouton est revenu : il ne tourne pas dans le vide.
  await expect(fenetre.getByRole("button", { name: /supprimer définitivement|delete permanently/i }))
    .toBeEnabled();
  const moi = await page.request.get("/api/user");
  expect(moi.ok()).toBeTruthy();
  await ctx.close();
});

test("un réglage de jeu que l'application refuse revient en arrière, et le dit", async ({ browser }) => {
  // « Tes jeux » posait la nouvelle valeur AVANT de la faire enregistrer, et ne
  // faisait rien de l'échec. Le commentaire du `catch` annonçait pourtant que
  // « l'état précédent reste affiché » : c'était l'inverse.
  //
  // Le pont Electron se simule, comme dans e2e/detection-partie.spec.ts : ce
  // qu'on éprouve est la réaction de l'écran, pas Electron.
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.addInitScript((u) => {
    try {
      sessionStorage.setItem("splash", "1");
      for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
        localStorage.setItem(c, "1");
      }
    } catch { /* stockage refusé */ }
    const etatJeux = {
      jeux: ["League of Legends"],
      coins: ["haut-gauche"],
      raccourcis: { bascule: null, coin: null },
      placement: false,
      config: { "League of Legends": { actif: true, coin: "haut-gauche", position: null } },
    };
    // Le pont porte tout ce que les composants de réglages lisent : il en manque
    // un, et c'est toute la rubrique qui ne se rend pas — le bouton cherché
    // n'existe alors pas, et l'échec ne ressemble pas à sa cause.
    (window as unknown as { electronLOL?: unknown }).electronLOL = {
      isDesktop: true,
      version: async () => "0.9.6",
      overlayJeuxLire: async () => etatJeux,
      overlayActif: async () => ({ actif: true }),
      overlayCoinLire: async () => ({ coin: "haut-gauche", placement: false }),
      demarrageLire: async () => ({ actif: false }),
      majEtat: async () => ({ statut: "a-jour", version: "0.9.6", erreur: null, progression: 0 }),
      onMajEtat: () => () => {},
      detectionLire: async () => ({
        disponible: ["League of Legends"], surveilles: [],
        actions: { session: true, overlay: true, fenetre: false },
      }),
      // Le refus : c'est tout ce que le test fabrique.
      overlayJeuEcrire: async () => { throw new Error("refus"); },
      detectionEcrire: async () => { throw new Error("refus"); },
    };
  }, uid);

  await page.goto("/settings#jeux", { waitUntil: "domcontentloaded" });
  // Le bouton porte l'état COURANT : « Pastille affichée » quand elle l'est.
  // Le cliquer demande donc de la masquer.
  //
  // Le nom est ancré : l'en-tête dépliable du jeu contient le même libellé, et
  // son nom accessible vaut « League of Legends Pastille affichée ». Sans
  // ancres, `.first()` renvoyait l'en-tête, qui ne porte pas `aria-pressed`.
  const bascule = page.getByRole("button", { name: /^pastille affichée$|^panel shown$/i }).first();
  await bascule.waitFor({ timeout: 20_000 });
  await expect(bascule).toHaveAttribute("aria-pressed", "true");
  await bascule.click();

  await expect(page.getByText(/n.a pas retenu ce réglage|did not keep that setting/i))
    .toBeVisible({ timeout: 10_000 });

  // Et surtout : l'écran est revenu à ce que l'application a vraiment. Sans ce
  // second contrôle, un message affiché sous un réglage faux passerait — c'est
  // exactement l'état d'avant la correction.
  await expect(page.getByRole("button", { name: /^pastille affichée$|^panel shown$/i }).first())
    .toHaveAttribute("aria-pressed", "true");
  await ctx.close();
});

/**
 * Deux gestes rapides ne partent pas en même temps.
 *
 * Chaque geste pose l'état à l'écran puis envoie un `PUT`. Envoyées en
 * parallèle, deux écritures n'ont aucun ordre d'arrivée garanti : la base
 * pouvait garder la valeur de l'avant-dernier geste pendant que l'écran
 * montrait celle du dernier, et ça ne se voyait qu'au rechargement suivant.
 *
 * Le panneau du barème est fait de boutons « + » : taper plusieurs fois de
 * suite y est l'usage NORMAL, pas un cas de bord. C'est `bareme-personnel`
 * qui l'a fait tomber, sur une suite chargée — la base rendait deux minutes
 * quand la pastille en montrait trois.
 *
 * Ce qu'on mesure ici est la CONCURRENCE, pas l'ordre d'arrivée : celui-ci
 * dépend du réseau et ne se force pas depuis un test. Jamais plus d'une
 * écriture en vol, et la question de l'ordre ne se pose plus.
 */
test("deux réglages tapés coup sur coup partent l'un après l'autre", async ({ browser }) => {
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

  /**
   * La crête se compte par CLÉ, pas par requête.
   *
   * `ContexteNavigateur` écrit la langue et le fuseau une fois par ouverture
   * de l'application, sur d'autres clés : sa requête peut légitimement croiser
   * la première écriture de réglage, et compter les requêtes ferait crier le
   * garde sur ce qui va bien. Ce qui ne doit jamais arriver, c'est que deux
   * écritures de la MÊME clé soient en vol ensemble — c'est là que l'ordre
   * d'arrivée décide de ce que la base garde.
   */
  const enVol = new Map<string, number>();
  let crete = 0;
  let envois = 0;
  await page.route("**/api/settings", async (route) => {
    if (route.request().method() !== "PUT") {
      await route.continue();
      return;
    }
    let cles: string[] = [];
    try {
      cles = Object.keys(JSON.parse(route.request().postData() ?? "{}").userPrefs ?? {});
    } catch { /* un corps illisible ne se compte pas */ }
    if (cles.includes("exercices")) envois += 1;
    for (const c of cles) {
      const n = (enVol.get(c) ?? 0) + 1;
      enVol.set(c, n);
      crete = Math.max(crete, n);
    }
    // Une écriture qui traîne : sans file, la suivante part par-dessus, et
    // c'est exactement ce que la crête compte.
    await new Promise((r) => setTimeout(r, 1200));
    try {
      await route.continue();
    } finally {
      for (const c of cles) enVol.set(c, (enVol.get(c) ?? 1) - 1);
    }
  });

  await page.goto("/settings#effort", { waitUntil: "domcontentloaded" });
  const effort = page.getByRole("button", { name: /ton effort|your effort/i }).first();
  await effort.waitFor({ state: "visible", timeout: 20_000 });
  expect(sansLangue(new URL(page.url()).pathname)).toBe("/settings");

  // Trois cases DIFFÉRENTES, cochées coup sur coup, sans laisser à la
  // première écriture le temps de revenir. Taper trois fois la MÊME case ne
  // marche pas : décocher le dernier exercice est refusé, donc les deux
  // dernières tapes ne partaient pas — et le témoin l'a dit avant moi.
  const cases = page.getByRole("checkbox");
  await cases.first().waitFor({ state: "visible", timeout: 20_000 });
  for (const rang of [1, 2, 3]) await cases.nth(rang).click({ force: true });

  // Le témoin : sans lui, une page qui n'aurait rien envoyé du tout
  // satisferait le contrôle de crête en ne prouvant rien. Il compte les
  // écritures de la clé qu'on tape, pas celles du contexte.
  await expect.poll(() => envois, { timeout: 25_000 }).toBeGreaterThanOrEqual(2);
  expect(crete, "les écritures de réglages doivent partir en file, jamais en parallèle").toBe(1);
  await ctx.close();
});
