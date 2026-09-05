import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { viderLesFenetres } from "./intro";
import { compter } from "./base";

/**
 * « Ton corps » : l'objectif calorique, la pesée, le mètre-ruban.
 *
 * Étape 05 du plan. Ce qu'aucun test unitaire ne peut voir, et qui fait tout
 * l'objet de ce fichier :
 *
 *  - que la fonctionnalité est bien ÉTEINTE sur un compte neuf (réponse 013) ;
 *  - que le chiffre calculé arrive à l'écran, et pas seulement dans la réponse
 *    d'une route — c'est le défaut « un champ renommé vidait un panneau
 *    entier », qu'un type optionnel ne peut pas attraper ;
 *  - qu'une pesée saisie ici atterrit en base.
 */

const PESEES = `SELECT count(*)::text AS n FROM "Pesee" p
  JOIN "User" u ON u.id = p."userId" WHERE u.pseudo = $1`;

test("le corps est éteint au départ, et s'allume avec un objectif chiffré", async ({ browser }) => {
  const { etat } = await ouvrirCompte(browser, "Corps", { consentement: true });
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  /**
   * Le poids, la taille et l'âge viennent du compte, pas de cet écran : sans
   * eux, aucun objectif n'est calculable et le parcours n'éprouverait que le
   * message « il manque quelque chose ».
   */
  const profil = await page.request.put("/api/settings", {
    data: { userPrefs: { poids: 80, taille: 180, age: 30 } },
  });
  expect(profil.status(), await profil.text()).toBe(200);

  await page.goto("/settings#corps");
  await viderLesFenetres(page);
  await page.goto("/settings#corps");

  // Réponse 013 : rien ne s'allume tant qu'on ne le demande pas.
  await expect(page.getByRole("button", { name: /rien pour l'instant|nothing for now/i }))
    .toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /^perdre$|^lose$/i }).click();
  await page.getByRole("button", { name: /variante « homme »|male variant/i }).click();
  await page.getByLabel(/niveau d'activité|activity level/i).selectOption("modere");

  /**
   * Le contrôle qui décide de tout : le chiffre est À L'ÉCRAN.
   *
   * 80 kg, 180 cm, 30 ans, variante « h », activité modérée → 1780 kcal de
   * métabolisme de base, ×1,55 = 2759, moins vingt pour cent = 2207. Le
   * calculer ici plutôt que de chercher « kcal » distingue « le panneau
   * s'affiche » de « le panneau dit la bonne chose ».
   */
  /**
   * Le nombre se lit en CHIFFRES, pas en chaîne.
   *
   * Il s'écrivait « 2207 » et il s'écrit maintenant « 2 207 » en français,
   * « 2.207 » en allemand — c'est la correction du point décimal et des
   * séparateurs. Un parcours qui compare une chaîne est lié à la typographie
   * de la langue où il a été écrit ; c'est la troisième fois que ce projet le
   * paie, après l'effort du classement et le compte de parties. On retient
   * donc les chiffres de la ligne, ce qui vaut dans les six langues et reste
   * impossible à satisfaire par accident.
   */
  // « kcal » tout court attrape d'abord l'aide qui explique l'écart de 166 kcal
  // entre les deux variantes de formule. C'est la LIGNE DE L'OBJECTIF qu'on
  // veut, et son gabarit la nomme : « X kcal par jour ».
  const ligne = page.getByText(/kcal par jour|kcal per day/).first();
  await expect(ligne).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(async () => ((await ligne.textContent()) ?? "").replace(/\D/g, ""))
    .toBe("2207");

  // Réponse 016 : aucune date n'est promise, et l'écran dit pourquoi.
  await expect(page.getByText(/7 700|7,700/)).toBeVisible();

  await ctx.close();
});

test("une pesée saisie arrive en base", async ({ browser }) => {
  const { etat, compte } = await ouvrirCompte(browser, "Pesee", { consentement: true });
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.goto("/settings#corps");
  await viderLesFenetres(page);
  await page.goto("/settings#corps");

  expect(await compter(PESEES, [compte.pseudo])).toBe(0);

  await page.getByLabel(/poids en kilos|weight in kilos/i).fill("78.4");
  await page.getByRole("button", { name: /^enregistrer$|^save$/i }).first().click();

  /**
   * Le contrôle qui compte : la ligne existe. Sans lui, un écran qui se
   * contente d'afficher « Enregistré » passerait — et c'est exactement ce que
   * ce projet a corrigé plusieurs fois.
   */
  await expect.poll(() => compter(PESEES, [compte.pseudo]), { timeout: 10_000 }).toBe(1);

  await ctx.close();
});

/**
 * Ce qui manque ne se dit qu'à partir du moment où l'on a commencé.
 *
 * Trois champs vides, « il manque une mesure » était le dernier mot du panneau
 * à la PREMIÈRE ouverture — un reproche pour ne pas avoir commencé, à l'instant
 * qui décide si l'on s'en servira. Le contrôle vaut par ses DEUX moitiés : sans
 * la seconde, supprimer la phrase pour de bon passerait aussi, et on aurait
 * remplacé un reproche par un silence sur ce qui bloque vraiment.
 */
test("le mètre-ruban ne reproche rien tant qu'on n'a rien saisi", async ({ browser }) => {
  const { etat } = await ouvrirCompte(browser, "Ruban", { consentement: true });
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  await page.goto("/settings#corps");
  await viderLesFenetres(page);
  await page.goto("/settings#corps");

  const manque = page.getByText(/il manque une mesure|a measurement is missing/i);
  await expect(page.getByText(/tour de taille|waist/i)).toBeVisible({ timeout: 10_000 });
  await expect(manque).toHaveCount(0);

  // Et il revient dès qu'on commence : la phrase dit alors ce qui bloque.
  await page.getByLabel(/tour de taille|waist/i).fill("82");
  await expect(manque).toBeVisible({ timeout: 10_000 });

  await ctx.close();
});

/**
 * Ce qu'on tape avant que la lecture des réglages revienne reste à l'écran.
 *
 * La page lisait `/api/settings` au montage et REMPLAÇAIT chaque objet d'état
 * par la réponse : tout ce qui avait été saisi entre l'affichage et l'arrivée
 * de la réponse disparaissait. Ce n'est pas une hypothèse — le test au-dessus
 * tombait une fois sur huit, en CI comme en local, et le journal le portait
 * depuis des jours comme « cause inconnue ».
 *
 * Ce qui l'a nommé est une sonde qui relève la VALEUR du champ à l'échec :
 * elle est VIDE. Ce n'est donc pas un événement React perdu avant
 * l'hydratation — l'hypothèse de départ, réfutée — c'est la valeur écrasée par
 * la réponse.
 *
 * Le test ci-dessous ne compte pas sur la chance : il RETARDE la réponse d'une
 * seconde et demie, ce qui rend la course certaine. Avec l'écrasement, le
 * champ se vide à tous les coups ; avec la fusion, jamais.
 *
 * Et ce n'est pas qu'une saisie perdue : les réglages du corps s'enregistrent
 * au clic, donc la réponse plus ANCIENNE revenait par-dessus une valeur déjà
 * écrite en base — l'écran montrait le contraire de ce qu'on venait de
 * choisir.
 */
test("une saisie faite avant la fin de la lecture n'est pas effacée", async ({ browser }) => {
  const { etat } = await ouvrirCompte(browser, "Course", { consentement: true });
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  // La réponse arrive APRÈS la saisie, toujours. Sans ce retard, la course se
  // joue en quelques millisecondes et le test ne prouve rien une fois sur huit.
  let retardees = 0;
  await page.route("**/api/settings", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    retardees += 1;
    await new Promise((r) => setTimeout(r, 1500));
    return route.fallback();
  });

  await page.goto("/settings#corps");
  await viderLesFenetres(page);
  await page.goto("/settings#corps");

  const champ = page.getByLabel(/tour de taille|waist/i);
  await champ.waitFor({ state: "visible", timeout: 10_000 });
  await champ.fill("82");

  // Le témoin : sans réponse retardée, la course n'a pas eu lieu et le
  // contrôle qui suit passerait sans rien éprouver.
  expect(retardees).toBeGreaterThan(0);

  // La réponse arrive maintenant. Elle ne doit pas emporter la saisie.
  await page.waitForTimeout(2500);
  await expect(champ).toHaveValue("82");

  await ctx.close();
});
