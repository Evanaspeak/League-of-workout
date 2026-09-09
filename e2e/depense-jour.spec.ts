import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { viderLesFenetres } from "./intro";
import { compter } from "./base";

/**
 * La dépense relevée sur une montre (ligne 040 du plan).
 *
 * Réponse 040 : « Oui, commence par ça. » Réponse 041 : « Elle nourrit
 * l'objectif », et non « elle reste un simple journal ». C'est cette seconde
 * réponse qui rend un parcours nécessaire, et il éprouve deux choses qu'aucun
 * test unitaire ne peut voir :
 *
 *  - **le BRANCHEMENT.** La route est juste dans les deux cas : elle range un
 *    chiffre. C'est le COMPOSANT qui choisit entre l'estimation d'activité et
 *    la mesure du jour, et il pourrait choisir toujours la même — c'est le
 *    défaut « le profil d'un ami restait sur la semaine sous l'onglet du
 *    cumul », mot pour mot ;
 *  - **le MESSAGE du refus.** Une montre affiche deux chiffres qui vont du
 *    simple au triple, et celui qui se trompe doit apprendre lequel on
 *    attend. Un « erreur lors de la sauvegarde » générique enverrait retaper
 *    le même nombre.
 */

const DEPENSES = `SELECT count(*)::text AS n FROM "DepenseJour" d
  JOIN "User" u ON u.id = d."userId" WHERE u.pseudo = $1`;

/**
 * Le profil complet, et les chiffres qui en découlent.
 *
 * 80 kg, 180 cm, 30 ans, variante « h » : métabolisme de base 1780 kcal.
 * Activité modérée (×1,55) → 2759 estimés, moins vingt pour cent de perte
 * → **2207**. Une dépense MESURÉE de 3000 donne, elle, 3000 moins vingt pour
 * cent → **2400**. Les deux nombres sont volontairement éloignés : un écran
 * qui ignorerait la mesure afficherait encore 2207, et l'écart ne se confond
 * avec aucun arrondi.
 */
async function profilComplet(page: import("@playwright/test").Page) {
  const profil = await page.request.put("/api/settings", {
    data: { userPrefs: { poids: 80, taille: 180, age: 30 } },
  });
  expect(profil.status(), await profil.text()).toBe(200);

  await page.goto("/settings#corps");
  await viderLesFenetres(page);
  await page.goto("/settings#corps");

  await page.getByRole("button", { name: /^perdre$|^lose$/i }).click();
  await page.getByRole("button", { name: /variante « homme »|male variant/i }).click();
  await page.getByLabel(/niveau d'activité|activity level/i).selectOption("modere");
}

/**
 * Le champ de la dépense, et le bouton qui est À CÔTÉ de lui.
 *
 * `.first()` sur « Enregistrer » désignerait le premier de la rubrique, qui
 * change dès qu'un panneau se glisse au-dessus — c'est exactement ce que ce
 * chantier vient de faire au parcours de la pesée. On passe donc par le champ,
 * qui est le seul nom stable, et on prend le bouton de sa rangée.
 */
function champDepense(page: import("@playwright/test").Page) {
  return page.getByLabel(/dépense de la journée en kcal|whole-day expenditure/i);
}

function enregistrerDepense(page: import("@playwright/test").Page) {
  return champDepense(page).locator("..").getByRole("button");
}

/** Les chiffres de la ligne d'objectif, sans sa typographie. */
async function objectifAffiche(page: import("@playwright/test").Page) {
  const ligne = page.getByText(/kcal par jour|kcal per day/).first();
  await expect(ligne).toBeVisible({ timeout: 10_000 });
  return ((await ligne.textContent()) ?? "").replace(/\D/g, "");
}

test("la dépense mesurée remplace l'estimation dans l'objectif", async ({ browser }) => {
  const { etat, compte } = await ouvrirCompte(browser, "Depense", { consentement: true });
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  await profilComplet(page);

  // L'état d'avant, et il fait la moitié du travail : sans lui, un écran figé
  // sur 2400 pour une tout autre raison passerait le contrôle suivant.
  await expect.poll(() => objectifAffiche(page)).toBe("2207");

  expect(await compter(DEPENSES, [compte.pseudo])).toBe(0);

  await champDepense(page).fill("3000");
  await enregistrerDepense(page).click();

  // La ligne arrive en base : sans ce contrôle, un écran qui recalcule chez lui
  // ce qu'on vient de taper passerait sans que rien ne soit enregistré.
  await expect.poll(() => compter(DEPENSES, [compte.pseudo]), { timeout: 10_000 }).toBe(1);

  // Le branchement : l'objectif suit la MESURE.
  await expect.poll(() => objectifAffiche(page), { timeout: 10_000 }).toBe("2400");

  // Et l'écran dit d'où vient le chiffre. Sans cette ligne, l'objectif change
  // d'un jour à l'autre sans que rien ne l'explique.
  await expect(page.getByText(/dépense mesurée aujourd'hui|expenditure you measured today/i))
    .toBeVisible();

  /**
   * Le rechargement, et il n'est pas décoratif : il prouve que la valeur vient
   * de la BASE et non d'un état de React qui aurait survécu au clic.
   */
  await page.reload();
  await expect.poll(() => objectifAffiche(page), { timeout: 10_000 }).toBe("2400");

  await ctx.close();
});

test("les calories actives sont refusées en disant lesquelles on attend", async ({ browser }) => {
  const { etat, compte } = await ouvrirCompte(browser, "Actives", { consentement: true });
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  await profilComplet(page);

  /**
   * Six cents kilocalories, c'est-à-dire les calories ACTIVES d'une bonne
   * séance — et une dépense de journée impossible, puisqu'un corps dépense
   * ses 1780 kcal de métabolisme rien qu'en restant couché.
   */
  await champDepense(page).fill("600");
  await enregistrerDepense(page).click();

  // Le message DIT ce qu'on attend, et ce n'est pas « erreur lors de la
  // sauvegarde » : c'est toute la raison pour laquelle la route distingue deux
  // refus au lieu d'un.
  const alerte = page.getByRole("alert")
    .filter({ hasText: /journée entière|whole day/i });
  await expect(alerte).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/erreur lors de la sauvegarde|error while saving/i))
    .toHaveCount(0);

  // Et rien n'est entré en base. Un écran qui annonce l'échec en gardant la
  // valeur chez lui est le défaut que ce projet corrige en boucle.
  expect(await compter(DEPENSES, [compte.pseudo])).toBe(0);

  // L'objectif n'a pas bougé : il retombe sur l'estimation.
  await expect.poll(() => objectifAffiche(page)).toBe("2207");

  await ctx.close();
});
