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
 */

test("une adresse inventée rend 404, pas la connexion", async ({ page }) => {
  const reponse = await page.goto("/fr/nimportequoi");
  expect(reponse?.status()).toBe(404);
  // Et surtout : on est resté où l'on avait demandé à aller.
  expect(new URL(page.url()).pathname).toBe("/fr/nimportequoi");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});

test("la 404 parle la langue de l'adresse", async ({ page }) => {
  const reponse = await page.goto("/de/nimportequoi");
  expect(reponse?.status()).toBe(404);
  await expect(page.locator("html")).toHaveAttribute("lang", "de");

  // Six langues, six textes : celui-ci ne doit pas être le français.
  const de = await page.locator("h1").first().innerText();
  await page.goto("/fr/nimportequoi");
  const fr = await page.locator("h1").first().innerText();
  expect(de).not.toBe(fr);
});

test("un jeu de calculateur inventé rend la 404 du site, pas celle de Next", async ({ page }) => {
  const reponse = await page.goto("/de/calculateur/jeu-invente");
  expect(reponse?.status()).toBe(404);
  // Le 404 par défaut de Next rend `<html>` sans langue et un texte anglais.
  await expect(page.locator("html")).toHaveAttribute("lang", "de");
  await expect(page.getByText(/This page could not be found/i)).toHaveCount(0);
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
  await ctx.close();
});

test("les pages qui existent continuent d'exiger une session", async ({ page }) => {
  // Le garde du garde : la chute dans le 404 ne doit pas avoir ouvert les
  // pages connues au passage.
  const reponse = await page.goto("/fr/dashboard");
  expect(new URL(page.url()).pathname).toBe("/fr/login");
  expect(reponse?.status()).toBe(200);
});
