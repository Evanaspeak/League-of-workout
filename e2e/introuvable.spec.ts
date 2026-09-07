import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";

/**
 * Une adresse qui n'existe pas le dit, dans la langue de l'adresse.
 *
 * Elle ne le disait pour personne : le middleware traitait toute adresse
 * inconnue comme une adresse protégée, et renvoyait vers la connexion. La page
 * 404 du site, traduite en six langues, était donc inatteignable — et un
 * moteur qui suit un lien mort ne recevait jamais 404, donc ne retirait jamais
 * l'adresse de son index.
 *
 * Ces tests portent sur le CODE DE RÉPONSE autant que sur le texte : c'est le
 * code que lit un moteur, et c'est lui qui manquait.
 *
 * Et ils lisent le HTML **SERVI**, pas la page rendue. La première version
 * lisait le DOM vivant et passait, alors que la réponse contenait la 404
 * intégrée de Next — `<html>` sans langue, texte anglais. Après hydratation,
 * React finissait par afficher la bonne chose ; un moteur de recherche, lui,
 * ne va jamais jusque-là. C'est le piège déjà écrit dans le journal pour le
 * premier écran du tableau de bord : sur ce qui doit exister DANS la réponse,
 * on lit la réponse.
 */

/** La langue déclarée dans le HTML tel qu'il arrive, avant tout JavaScript. */
function langueServie(html: string): string | null {
  return html.match(/<html[^>]*\slang="([a-z-]+)"/)?.[1] ?? null;
}

test("une adresse inventée rend 404, pas la connexion", async ({ page }) => {
  const reponse = await page.goto("/fr/nimportequoi");
  expect(reponse?.status()).toBe(404);
  // Et surtout : on est resté où l'on avait demandé à aller.
  expect(new URL(page.url()).pathname).toBe("/fr/nimportequoi");
  expect(langueServie(await reponse!.text())).toBe("fr");
});

test("la 404 parle la langue de l'adresse, dans le HTML servi", async ({ page }) => {
  const titres = new Set<string>();
  for (const langue of ["fr", "en", "es", "de", "zh", "ja"]) {
    const reponse = await page.goto(`/${langue}/nimportequoi`);
    expect(reponse?.status(), langue).toBe(404);
    const html = await reponse!.text();
    expect(langueServie(html), langue).toBe(langue);
    // Le texte doit être là AVANT le JavaScript : c'est ce qu'indexe un moteur.
    const titre = html.match(/<h1[^>]*>([^<]+)/)?.[1] ?? "";
    expect(titre.length, langue).toBeGreaterThan(0);
    titres.add(titre);
  }
  // Six langues, six textes : six copies du français seraient pires que rien.
  expect(titres.size).toBe(6);
});

/**
 * Le cas qui résistait, et qui ne résiste plus.
 *
 * Un jeu de calculateur inventé est refusé par le ROUTEUR — le catalogue est
 * fermé par `dynamicParams = false` — et un refus du routeur ne consulte pas
 * la frontière `not-found` : Next rendait sa propre page, sans langue et en
 * anglais. Trois contournements avaient été essayés et mesurés, dont une
 * réécriture dans le middleware, écartée à l'époque parce qu'elle cassait les
 * cas qui marchaient.
 *
 * Ce qui manquait à cette réécriture était son STATUT : `NextResponse.rewrite`
 * accepte `{ status: 404 }`, donc l'adresse demandée reste affichée ET la
 * réponse porte le code qui fait sortir une adresse d'un index. Le middleware
 * connaît déjà le catalogue — un jeu inventé n'est pas une page connue — donc
 * il traite ce cas comme les autres, et la langue arrive avec.
 */
test("un jeu de calculateur inventé rend 404, dans la langue de l'adresse", async ({ page }) => {
  const reponse = await page.goto("/de/calculateur/jeu-invente");
  expect(reponse?.status()).toBe(404);
  expect(langueServie(await reponse!.text())).toBe("de");
});

test("une langue inventée ne mène pas à la connexion", async ({ page }) => {
  const reponse = await page.goto("/xx/cgu");
  expect(reponse?.status()).toBe(404);
  expect(new URL(page.url()).pathname).not.toContain("/login");
});

test("connecté, une adresse inventée rend la même 404", async ({ browser }) => {
  const { etat } = await ouvrirCompte(browser, "q404");
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  /**
   * Le cas qu'on oublie de vérifier : avant, une session valide faisait passer
   * l'adresse inconnue jusqu'à Next, qui rendait bien 404. Le défaut ne se
   * voyait donc que déconnecté — c'est-à-dire pour les visiteurs et pour les
   * moteurs, les deux publics qui comptent ici.
   */
  const reponse = await page.goto("/fr/nimportequoi");
  expect(reponse?.status()).toBe(404);
  expect(langueServie(await reponse!.text())).toBe("fr");
  await ctx.close();
});

test("les pages qui existent continuent d'exiger une session", async ({ page }) => {
  // Le garde du garde : la chute dans le 404 ne doit pas avoir ouvert les
  // pages connues au passage.
  const reponse = await page.goto("/fr/dashboard");
  expect(new URL(page.url()).pathname).toBe("/fr/login");
  expect(reponse?.status()).toBe(200);
});
