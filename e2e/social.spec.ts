import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { viderLesFenetres } from "./intro";
import { compter, requeteSql } from "./base";

/**
 * Les amis et les groupes, de bout en bout.
 *
 * Les tests unitaires disent ce que chaque route décide. Ils ne peuvent rien
 * dire de ce qui se joue ENTRE DEUX COMPTES : que la demande arrive vraiment
 * chez l'autre, qu'elle disparaisse de chez soi quand il accepte, et qu'un
 * code tiré par l'un ouvre le groupe de l'autre. C'est la seule chose qu'un
 * seul contexte de navigateur ne sait pas éprouver.
 *
 * Chaque contrôle regarde l'ÉCRAN et la BASE. Sans le second, un écran qui se
 * contente d'afficher ce qu'on vient de taper passerait le test.
 */

const LIEN = `
  SELECT a.id, a.etat, a."accepteeLe" FROM "Amitie" a
  JOIN "User" d ON d.id = a."demandeurId"
  JOIN "User" r ON r.id = a."receveurId"
  WHERE d.pseudo = $1 AND r.pseudo = $2`;

/**
 * La visite guidée NAVIGUE d'une page à l'autre : on vide les fenêtres depuis
 * la page d'arrivée, puis on va où l'on va. Traversée depuis `/amis`, elle
 * renverrait sur le tableau de bord et le test expirerait sur une page
 * parfaitement normale.
 */
async function ouvrirEcranAmis(
  browser: import("@playwright/test").Browser,
  etat: Awaited<ReturnType<import("@playwright/test").BrowserContext["storageState"]>>,
) {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  await viderLesFenetres(page);
  await page.goto("/amis");
  await expect(page.getByRole("heading", { name: /tes amis|your friends/i })).toBeVisible();
  return { ctx, page };
}

test("une amitié se demande, arrive chez l'autre, et s'accepte", async ({ browser }) => {
  const a = await ouvrirCompte(browser, "Ami");
  const b = await ouvrirCompte(browser, "Pote");

  const { ctx: ctxA, page: pageA } = await ouvrirEcranAmis(browser, a.etat);

  await pageA.getByLabel(/son pseudo|their display name/i).fill(b.compte.pseudo);
  await pageA.getByRole("button", { name: /envoyer la demande|send request/i }).click();

  // L'écran le dit…
  await expect(pageA.getByText(/en attente de sa réponse|waiting for their answer/i)).toBeVisible();

  // …et la base l'a gardé, dans le bon sens.
  const [enBase] = await requeteSql<{ id: string; etat: string }>(LIEN, [a.compte.pseudo, b.compte.pseudo]);
  expect(enBase?.etat).toBe("attente");

  // Chez l'autre, c'est une demande REÇUE : c'est lui, et lui seul, qui répond.
  const { ctx: ctxB, page: pageB } = await ouvrirEcranAmis(browser, b.etat);
  const recues = pageB.getByRole("heading", { name: /demandes reçues|requests received/i });
  await expect(recues).toBeVisible();
  await pageB.getByRole("button", { name: /^accepter$|^accept$/i }).click();
  await expect(recues).toBeHidden();

  const [apres] = await requeteSql<{ etat: string; accepteeLe: Date | null }>(
    LIEN, [a.compte.pseudo, b.compte.pseudo]);
  expect(apres?.etat).toBe("acceptee");
  expect(apres?.accepteeLe).not.toBeNull();

  // Et de l'autre côté, la demande envoyée est devenue un ami.
  await pageA.reload();
  await expect(pageA.getByText(/en attente de sa réponse|waiting for their answer/i)).toBeHidden();
  await expect(pageA.getByText(new RegExp(b.compte.pseudo, "i")).first()).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

test("retirer un ami demande deux gestes, et efface la ligne", async ({ browser }) => {
  const a = await ouvrirCompte(browser, "Reti");
  const b = await ouvrirCompte(browser, "Rete");

  // L'amitié est posée par les routes : ce qu'on éprouve ici est le retrait.
  const ctxPoseA = await browser.newContext({ storageState: a.etat });
  await ctxPoseA.request.post("/api/amis", { data: { pseudo: b.compte.pseudo } });
  const [lien] = await requeteSql<{ id: string }>(LIEN, [a.compte.pseudo, b.compte.pseudo]);
  const ctxPoseB = await browser.newContext({ storageState: b.etat });
  await ctxPoseB.request.patch(`/api/amis/${lien.id}`);
  await ctxPoseA.close();
  await ctxPoseB.close();

  const { ctx, page } = await ouvrirEcranAmis(browser, a.etat);
  await expect(page.getByText(new RegExp(b.compte.pseudo, "i")).first()).toBeVisible();

  /**
   * Le premier clic ne retire rien.
   *
   * Deux gestes, pas une bascule : une frappe malheureuse sur la ligne d'à
   * côté ne doit pas défaire une amitié qu'il faudra redemander. C'est la
   * règle déjà posée pour la correction d'un résultat de partie.
   */
  await page.getByRole("button", { name: /^retirer$|^remove$/i }).click();
  await expect(page.getByText(/de tes amis \?|from your friends\?/i)).toBeVisible();
  expect(await compter('SELECT count(*) AS n FROM "Amitie" WHERE id = $1', [lien.id])).toBe(1);

  await page.getByRole("button", { name: /^retirer$|^remove$/i }).click();

  await expect(page.getByText(/personne pour l.instant|nobody yet/i)).toBeVisible();
  expect(await compter('SELECT count(*) AS n FROM "Amitie" WHERE id = $1', [lien.id])).toBe(0);

  await ctx.close();
});

test("un groupe créé par l'un se rejoint par son code chez l'autre", async ({ browser }) => {
  const a = await ouvrirCompte(browser, "Chef");
  const b = await ouvrirCompte(browser, "Memb");
  const nom = `Bras ${Date.now().toString(36)}`;

  const { ctx: ctxA, page: pageA } = await ouvrirEcranAmis(browser, a.etat);
  await pageA.getByLabel(/nom du groupe|group name/i).fill(nom);
  await pageA.getByRole("button", { name: /^créer$|^create$/i }).click();

  await expect(pageA.getByText(nom)).toBeVisible();
  await expect(pageA.getByText(/tu l.as créé|you created it/i)).toBeVisible();

  const [groupe] = await requeteSql<{ id: string; code: string }>(
    'SELECT id, code FROM "Groupe" WHERE nom = $1', [nom]);
  const seul = await requeteSql<{ role: string }>(
    'SELECT role FROM "MembreGroupe" WHERE "groupeId" = $1', [groupe.id]);
  expect(seul.map((m) => m.role)).toEqual(["proprietaire"]);

  /**
   * Le code se retape comme on l'a lu : en minuscules, avec un tiret.
   *
   * C'est la seule porte du groupe. La refuser pour une question de
   * présentation, c'est la fermer.
   */
  const { ctx: ctxB, page: pageB } = await ouvrirEcranAmis(browser, b.etat);
  const tapeALaMain = `${groupe.code.slice(0, 4).toLowerCase()}-${groupe.code.slice(4)}`;
  await pageB.getByLabel(/code d.invitation|invite code/i).fill(tapeALaMain);
  await pageB.getByRole("button", { name: /^rejoindre$|^join$/i }).click();

  await expect(pageB.getByText(nom)).toBeVisible();
  await expect(pageB.getByText(/tu l.as créé|you created it/i)).toBeHidden();

  const membres = await requeteSql<{ role: string }>(
    'SELECT role FROM "MembreGroupe" WHERE "groupeId" = $1', [groupe.id]);
  expect(membres).toHaveLength(2);
  expect(membres.filter((m) => m.role === "proprietaire")).toHaveLength(1);

  await ctxA.close();
  await ctxB.close();
});

test("un code refusé ne change rien, et l'écran le dit", async ({ browser }) => {
  const a = await ouvrirCompte(browser, "Faux");
  const { ctx, page } = await ouvrirEcranAmis(browser, a.etat);

  // Huit caractères de l'alphabet, donc un code de la bonne FORME : c'est le
  // serveur qui refuse, pas la saisie.
  await page.getByLabel(/code d.invitation|invite code/i).fill("ZZZZZZZZ");
  await page.getByRole("button", { name: /^rejoindre$|^join$/i }).click();

  await expect(page.getByText(/aucun groupe pour ce code|no group for that code/i)).toBeVisible();
  await expect(page.getByText(/aucun groupe\.|no groups\./i)).toBeVisible();
  expect(await compter(
    'SELECT count(*) AS n FROM "MembreGroupe" m JOIN "User" u ON u.id = m."userId" WHERE u.pseudo = $1',
    [a.compte.pseudo],
  )).toBe(0);

  await ctx.close();
});
