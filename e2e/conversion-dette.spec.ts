import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { viderLesFenetres } from "./intro";
import { compter } from "./base";

/**
 * « Convertir en », et le compteur qui accepte un paiement partiel.
 *
 * Demandé par le propriétaire en deux temps : d'abord le bouton — « il
 * faudrait un bouton convertir en quand on clique sur le rappel de la boxe » —
 * puis la forme du contrôle, qui est ce qui compte : « si on sélectionne les
 * pompes, on met un cliqueur qu'on peut éditer manuellement aussi pour dire le
 * nombre de pompes qu'on a pu faire, si on convertit 10 min de boxe ça peut
 * faire beaucoup de pompes à faire en une fois ».
 *
 * Ce qu'aucun test unitaire ne peut voir, et qui fait tout l'objet de ce
 * fichier : que la quantité affichée vient du SERVEUR, que ce qu'on compte à
 * l'écran arrive vraiment sur la dette, et qu'un paiement partiel en laisse
 * une partie due. Les trois se jouent entre l'écran, le réseau et la base.
 */

const POINTS_DUS = `SELECT "dettePointsDus"::text AS n FROM "User" WHERE pseudo = $1`;
const PAIEMENTS = `SELECT count(*)::text AS n FROM "Paiement" p
  JOIN "User" u ON u.id = p."userId" WHERE u.pseudo = $1 AND p.points > 0`;

test("convertir sa dette et n'en payer qu'une partie au compteur", async ({ browser }) => {
  const { etat, compte } = await ouvrirCompte(browser, "Conv", { consentement: true });
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  await viderLesFenetres(page);

  expect(await compter(PAIEMENTS, [compte.pseudo])).toBe(0);

  // Une défaite franche, pour une dette qui ne tienne pas en un seul geste.
  const partie = await page.request.post("/api/games", {
    data: {
      jeu: "League of Legends", role: "Mid", champion: "Ahri",
      kills: 0, deaths: 12, assists: 1, result: "D",
    },
  });
  expect(partie.status(), await partie.text()).toBe(200);

  /**
   * Les quantités converties viennent du SERVEUR, et c'est la décision de fond.
   *
   * Les calculer au navigateur aurait rouvert le défaut déjà payé : la
   * pastille convertissait les points chez le client pendant que le décompte
   * lisait la durée calculée au serveur, et les deux annonçaient deux nombres
   * différents pour la même dette. Sans ce contrôle, un composant qui
   * recalculerait de son côté passerait tout le reste du parcours.
   */
  const dette = await (await page.request.get("/api/dette")).json() as {
    points: number; conversions: Record<string, number>;
  };
  expect(dette.points).toBeGreaterThan(20);
  expect(dette.conversions?.squats, "le serveur doit convertir lui-même").toBeGreaterThan(0);
  // L'exercice qu'on doit déjà n'est pas proposé : le bouton ne ferait rien.
  expect(dette.conversions?.pompes).toBeUndefined();

  await page.reload();
  const pastille = page.getByRole("button", { name: /marquer comme fait|en attente|mark as done/i })
    .or(page.locator(".pastille-dette")).first();
  await expect(pastille).toBeVisible({ timeout: 15_000 });
  await pastille.click();
  await expect(page.getByRole("dialog")).toBeVisible();

  // Convertir en squats : la fenêtre doit annoncer ce que le SERVEUR a calculé.
  await page.getByRole("button", { name: /^squats$/i }).click();
  await expect(page.getByRole("dialog"))
    .toContainText(String(dette.conversions.squats));

  /**
   * Le compteur : on tape trois fois sur le plus, puis on corrige à la main.
   *
   * Les deux gestes comptent, et c'est ce que le propriétaire a demandé — on
   * tape pendant la série, on corrige quand on a compté dans sa tête.
   */
  const plus = page.getByRole("button", { name: /^ajouter$|^add$/i });
  await plus.click();
  await plus.click();
  await plus.click();
  const champ = page.getByRole("spinbutton", { name: /nombre fait|amount done/i });
  await expect(champ).toHaveValue("3");

  const faits = Math.max(1, Math.floor(dette.conversions.squats / 3));
  await champ.fill(String(faits));

  await page.getByRole("button", { name: /j'ai fini|i'm done/i }).first().click();

  /**
   * Le contrôle qui décide de tout, et il a DEUX moitiés.
   *
   * Une ligne de paiement doit exister — sans elle, l'écran s'est contenté de
   * refermer sa fenêtre. Et il doit RESTER de la dette : c'est ce qui distingue
   * un paiement partiel d'un « c'est fait » déguisé, et c'est précisément la
   * raison pour laquelle le compteur existe.
   */
  await expect
    .poll(() => compter(PAIEMENTS, [compte.pseudo]), { timeout: 10_000 })
    .toBe(1);
  const restant = await compter(POINTS_DUS, [compte.pseudo]);
  expect(restant, "un tiers payé doit laisser le reste dû").toBeGreaterThan(0);
  expect(restant).toBeLessThan(dette.points);

  await ctx.close();
});
