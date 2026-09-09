import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { requeteSql } from "./base";

/**
 * Le barème d'exercices, réglé par COMPTE (réponse 047, « Oui, par
 * utilisateur »).
 *
 * Les tests unitaires disent ce que la fusion rend et ce que la route refuse.
 * Ils ne disent rien de la chaîne, et c'est elle qui porte le risque : le
 * réglage part de l'écran, se range en base, revient par deux routes
 * différentes — celle du serveur qui compte la dette, celle du navigateur qui
 * l'affiche — et les deux doivent tomber sur le MÊME nombre.
 *
 * C'est le défaut que ce projet a déjà payé une fois, à l'identique : la
 * pastille convertissait avec les ratios du navigateur pendant que le décompte
 * lisait ceux du serveur, « 6 min 05 » sur l'une et « 2 min 41 » dans l'autre.
 * Un barème par compte rouvre exactement cette porte.
 */
test.describe.configure({ mode: "serial" });

let etat: Awaited<ReturnType<typeof ouvrirCompte>>["etat"];
let uid: string;

test("ouvrir un compte, choisir la boxe, et se faire une dette", async ({ browser }) => {
  const ouvert = await ouvrirCompte(browser, "Bareme", { consentement: true });
  etat = ouvert.etat;

  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  uid = (await (await page.request.get("/api/user")).json()).id as string;

  // La boxe se compte au TEMPS : c'est ce qui rend la conversion visible. Une
  // dette en pompes s'affiche en répétitions, où le barème vaut un par
  // définition et où rien ne pourrait bouger.
  const r = await page.request.put("/api/settings", {
    data: { userPrefs: { exercices: ["boxe"] } },
  });
  expect(r.status(), await r.text()).toBe(200);

  const partie = await page.request.post("/api/games", {
    data: { jeu: "League of Legends", role: "Mid", champion: "Ahri",
            kills: 0, deaths: 10, assists: 2, result: "D", exercice: "boxe" },
  });
  expect(partie.status(), await partie.text()).toBe(200);

  const dette = await (await page.request.get("/api/dette")).json();
  expect(dette.points, "la partie doit avoir créé une dette").toBeGreaterThan(0);
  await ctx.close();
});

test("régler le barème change la dette, et la remise le rend", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  /**
   * Les marques d'intro sont posées AVANT toute navigation.
   *
   * Les traverser à l'écran ne marche pas ici : la visite guidée NAVIGUE, donc
   * la traverser depuis les réglages laisse le test sur le tableau de bord —
   * et l'échec dit « bouton introuvable » sur une page parfaitement normale.
   * C'est écrit au journal, et ce parcours l'a payé une exécution.
   */
  await page.addInitScript((u) => {
    try {
      sessionStorage.setItem("splash", "1");
      for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
        localStorage.setItem(c, "1");
      }
    } catch { /* stockage refusé */ }
  }, uid);

  const dureeDe = async () =>
    (await (await page.request.get("/api/dette")).json()).dureeSec as number;
  const commun = await dureeDe();
  expect(commun).toBeGreaterThan(0);

  await page.goto("/settings#effort", { waitUntil: "domcontentloaded" });

  /**
   * Les TROIS écritures sont attendues, et c'est ce qui manquait.
   *
   * Trois tapes envoient trois requêtes — la file les met en série, elle ne les
   * fusionne pas. Le contrôle d'après n'attendait que la colonne NON NULLE,
   * c'est-à-dire la PREMIÈRE : la durée était lue après un ou deux clics,
   * pendant que le troisième continuait d'arriver, et le tableau de bord chargé
   * ensuite montrait la valeur des trois. C'est le « attendu 2, reçu 3 min »
   * que ce fichier a rendu en intégration continue et en suite locale, jamais
   * seul — il faut une machine assez chargée pour que la file traîne.
   *
   * On compte les écritures qui portent RÉELLEMENT le barème, pas les requêtes
   * vers `/api/settings` : `ContexteNavigateur` en envoie une par ouverture
   * pour la langue et le fuseau, et elle croise légitimement la première. Ce
   * piège est déjà écrit au journal pour ce fichier ; compter les requêtes
   * plutôt que les clés est ce qui l'y avait fait tomber.
   *
   * Et on compte plutôt que de recalculer la valeur attendue : une seconde
   * arithmétique aurait l'air juste et divergerait au premier arrondi.
   */
  let baremesEcrits = 0;
  page.on("response", (r) => {
    const req = r.request();
    if (req.method() !== "PUT") return;
    if (new URL(r.url()).pathname !== "/api/settings") return;
    if (!(req.postData() ?? "").includes("ratiosExercices")) return;
    baremesEcrits += 1;
  });

  // Trois tapes sur « plus » : le pas vaut un quart du barème commun, donc la
  // boxe devient à peu près deux fois plus longue pour la même dette.
  const plus = page.getByRole("button", { name: /plus de .*boxe|more .*box/i }).first();
  await plus.waitFor({ timeout: 15_000 });
  for (let i = 0; i < 3; i += 1) await plus.click();

  await expect
    .poll(() => baremesEcrits, { timeout: 20_000 })
    .toBeGreaterThanOrEqual(3);

  // La base, et pas seulement l'écran : un panneau qui se contenterait
  // d'afficher ce qu'on vient de taper passerait le contrôle suivant.
  await expect.poll(async () => {
    const [l] = await requeteSql<{ r: string | null }>(
      'SELECT "ratiosExercices" AS r FROM "User" WHERE id = $1', [uid],
    );
    return l?.r ?? null;
  }, { timeout: 15_000 }).not.toBeNull();

  const perso = await dureeDe();
  expect(perso, "le barème personnel doit changer ce que la dette coûte")
    .toBeGreaterThan(commun);

  /**
   * Les deux conversions doivent tomber sur le MÊME nombre.
   *
   * Le serveur compte `dureeSec` ; le navigateur affiche la pastille avec les
   * ratios qu'il a installés. Ce sont deux chemins distincts pour une seule
   * dette, et c'est le seul contrôle qui les compare.
   */
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  const pastille = page.locator(".pastille-dette").first();
  await pastille.waitFor({ timeout: 20_000 });
  const minutes = Math.floor(perso / 60);
  await expect(pastille).toContainText(String(minutes), { timeout: 20_000 });

  // Et le retour en arrière rend le barème commun. Sans ce second sens, un
  // écran bloqué sur le barème personnel passerait la première moitié.
  await page.goto("/settings#effort", { waitUntil: "domcontentloaded" });
  const remise = page.getByRole("button", { name: /barème commun|shared rate/i }).first();
  await remise.waitFor({ timeout: 20_000 });
  await remise.click();
  await expect.poll(dureeDe, { timeout: 15_000 }).toBe(commun);
  await ctx.close();
});
