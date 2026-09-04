import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { viderLesFenetres } from "./intro";
import { compter } from "./base";

/**
 * La boucle du produit, sur l'exercice PAR DÉFAUT.
 *
 * C'est le parcours qui manquait, et son absence a coûté cher : tous les
 * parcours qui touchaient à la dette commençaient par choisir la BOXE, avec un
 * commentaire expliquant que seuls les exercices comptés en temps alimentent
 * le compteur. C'était vrai, c'était documenté, et personne n'a demandé ce qui
 * se passait pour les autres.
 *
 * Il ne se passait rien. Avec les pompes — le cas par défaut, celui de presque
 * tout le monde — la dette ne montait jamais, donc rien ne passait par le
 * compteur, donc aucune ligne `Paiement` n'était écrite. Classement, mur des
 * records et niveau de compte restaient vides par construction, quoi qu'on
 * joue : neuf cent soixante parties enregistrées, deux points payés.
 *
 * Ce fichier suit donc le chemin entier sans jamais toucher aux réglages :
 * une défaite, une dette qui monte, une tape pour la solder, et une ligne en
 * base. Le contrôle qui compte est le DERNIER — c'est le seul qui distingue
 * « l'écran a l'air content » de « l'effort est enregistré ».
 */

const PAIEMENTS = `SELECT count(*)::text AS n FROM "Paiement" p
  JOIN "User" u ON u.id = p."userId" WHERE u.pseudo = $1`;

const PAIEMENTS_UTILES = `SELECT count(*)::text AS n FROM "Paiement" p
  JOIN "User" u ON u.id = p."userId" WHERE u.pseudo = $1 AND p.points > 0`;

test("une défaite payée en pompes se solde d'une tape, et s'enregistre", async ({ browser }) => {
  const { etat, compte } = await ouvrirCompte(browser, "Pompes", { consentement: true });
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  await page.goto("/dashboard");
  await viderLesFenetres(page);

  // Rien n'est payé au départ : sans ce point de comparaison, un compte qui
  // aurait déjà une ligne rendrait le contrôle final vrai sans rien prouver.
  expect(await compter(PAIEMENTS, [compte.pseudo])).toBe(0);

  /**
   * La partie part par l'API et non par le formulaire : ce qu'on éprouve ici
   * est la BOUCLE — dette, geste, registre — pas la saisie, qui a son propre
   * parcours. Et surtout : aucun `PUT /api/settings` ne passe, donc le compte
   * reste sur les pompes, exactement comme celui de n'importe qui.
   */
  const partie = await page.request.post("/api/games", {
    data: {
      jeu: "League of Legends", role: "Mid", champion: "Ahri",
      kills: 0, deaths: 12, assists: 1, result: "D",
    },
  });
  expect(partie.status(), await partie.text()).toBe(200);

  /**
   * La dette existe VRAIMENT, et on le demande au serveur.
   *
   * Avant, cette réponse rendait `points: 0` et une liste d'exercices vide
   * pour un compte en pompes, quelle que soit la partie qu'on venait
   * d'enregistrer. C'est le contrôle qui sépare les deux mondes.
   */
  const dette = await (await page.request.get("/api/dette")).json() as {
    points: number; exercices: string[]; quantites: Record<string, number>;
  };
  expect({
    exercices: dette.exercices,
    aDesPoints: dette.points > 0,
    desPompes: (dette.quantites?.pompes ?? 0) > 0,
  }).toEqual({ exercices: ["pompes"], aDesPoints: true, desPompes: true });

  // La pastille paraît — elle n'existait pas non plus, faute de dette.
  await page.reload();
  const pastille = page.getByRole("button", { name: /marquer comme fait|en attente|mark as done/i })
    .or(page.locator(".pastille-dette")).first();
  await expect(pastille).toBeVisible({ timeout: 15_000 });
  await pastille.click();

  /**
   * Et il n'y a PAS de chrono : des pompes se font dans la foulée, on les
   * déclare. Le décompte reste pour la boxe, qui a son propre parcours.
   */
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText(/restant|remaining/i);

  await page.getByRole("button", { name: /j'ai fini|i'm done/i }).first().click();

  /**
   * Le contrôle qui décide de tout : l'effort est en base.
   *
   * Sans lui, un écran qui se contente de refermer sa fenêtre passerait — et
   * c'est exactement ce que le produit faisait pendant des mois.
   */
  await expect.poll(
    () => compter(PAIEMENTS_UTILES, [compte.pseudo]),
    { timeout: 15_000, message: "aucune ligne Paiement écrite après la séance" },
  ).toBe(1);

  await ctx.close();
});
