import { test, expect, type Page } from "@playwright/test";
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

/**
 * Retarder la RÉPONSE, jamais la REQUÊTE — et c'est toute la différence.
 *
 * Dormir puis laisser partir la requête ferait interroger le serveur APRÈS le
 * geste, donc il répondrait la valeur qu'on vient d'écrire : la réponse ne
 * contredirait plus rien, et le contrôle passerait avec ou sans la fusion.
 * Éprouvé — c'est exactement ce qu'un sabotage resté vert a montré.
 *
 * Le défaut réel est l'inverse : le serveur a répondu l'état d'AVANT, et sa
 * réponse arrive après le geste. On va donc la chercher tout de suite, et on
 * ne la remet qu'une seconde et demie plus tard.
 *
 * Le témoin est le couple des deux compteurs : une lecture DEMANDÉE et pas
 * encore RENDUE au moment du geste, c'est-à-dire une course réellement en
 * cours. Compter les lectures retardées ne dirait que « le détournement a
 * pris », ce qui reste vrai quand la réponse est déjà arrivée.
 */
type Retard = { demandees: number; rendues: number };

async function retarderLaLecture(page: Page, retard: Retard) {
  await page.route("**/api/settings", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    retard.demandees += 1;
    const reponse = await route.fetch();
    await new Promise((r) => setTimeout(r, 1500));
    retard.rendues += 1;
    await route.fulfill({ response: reponse });
  });
}

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
  const retard: Retard = { demandees: 0, rendues: 0 };
  await retarderLaLecture(page, retard);

  await page.goto("/settings#corps");
  await viderLesFenetres(page);
  await page.goto("/settings#corps");

  const champ = page.getByLabel(/tour de taille|waist/i);
  await champ.waitFor({ state: "visible", timeout: 10_000 });
  await champ.fill("82");

  // Le témoin : une lecture partie et pas encore revenue, donc une course
  // réellement en cours. Sans elle, le contrôle qui suit ne prouve rien.
  expect(retard.demandees).toBeGreaterThan(retard.rendues);

  // La réponse arrive maintenant. Elle ne doit pas emporter la saisie.
  await page.waitForTimeout(2500);
  await expect(champ).toHaveValue("82");

  await ctx.close();
});

/**
 * Le même écrasement, sur un réglage qui n'est pas un champ de texte.
 *
 * Le seuil de rappel est un nombre et la sélection d'exercices un tableau :
 * ni l'un ni l'autre ne se compare clé par clé, donc ni l'un ni l'autre
 * n'était couvert par la fusion des objets. Les deux s'enregistrent AU CLIC —
 * un geste, une écriture — et sont donc exposés au même défaut, en pire : la
 * valeur est déjà en base quand la réponse plus ancienne vient la contredire à
 * l'écran.
 */
test("un exercice coché avant la fin de la lecture reste coché", async ({ browser }) => {
  const { etat } = await ouvrirCompte(browser, "Coche", { consentement: true });
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  const retard: Retard = { demandees: 0, rendues: 0 };
  await retarderLaLecture(page, retard);

  await page.goto("/settings");
  await viderLesFenetres(page);
  await page.goto("/settings");
  // La rubrique s'OUVRE : l'adresse nue ne rend que la liste des rubriques,
  // et la liste des exercices vit dedans. C'est le piège déjà écrit au journal.
  await page.getByRole("button", { name: /ton effort|your effort/i }).first().click();

  // La boxe : elle n'est pas l'exercice par défaut, donc la cocher fait bien
  // quitter la valeur de départ — sans quoi la fusion reprendrait le serveur
  // et le test passerait sans rien éprouver.
  const boxe = page.getByText(/^boxe$|^boxing$/i).first();
  await boxe.waitFor({ state: "visible", timeout: 10_000 });
  await boxe.click();
  expect(retard.demandees).toBeGreaterThan(retard.rendues);

  const case_ = page.getByRole("checkbox", { name: /boxe|boxing/i }).first();
  await page.waitForTimeout(2500);
  await expect(case_).toHaveAttribute("aria-checked", "true");

  await ctx.close();
});

/**
 * Le seul trou que la comparaison à la valeur par défaut ne peut pas voir :
 * un réglage remis à sa valeur d'origine.
 *
 * On change d'avis. Le compte est en mode fantôme ; la lecture traîne, donc
 * l'écran montre encore « Visible », qui est le défaut. On clique
 * « Invisible », puis on se ravise et on reclique « Visible ». L'état final est
 * identique au défaut : « pas touché » pour une fusion qui ne regarde que les
 * valeurs, alors que DEUX écritures sont parties. La réponse périmée remettait
 * donc le mode fantôme que l'on venait d'annuler — et un réglage de
 * confidentialité qui se rallume tout seul est le seul refus qu'on ne vérifie
 * jamais.
 *
 * C'est le registre des clés ÉCRITES qui le tient, pas la comparaison.
 */
test("un réglage annulé ne se rallume pas quand la lecture arrive", async ({ browser }) => {
  const { etat } = await ouvrirCompte(browser, "Annule", { consentement: true });
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  // Le serveur porte l'INVERSE du défaut : sans cet écart, la réponse périmée
  // dirait la même chose que l'écran et le contrôle passerait sans rien voir.
  const pose = await page.request.put("/api/settings", {
    data: { userPrefs: { fantome: true } },
  });
  expect(pose.status(), await pose.text()).toBe(200);

  const retard: Retard = { demandees: 0, rendues: 0 };
  await retarderLaLecture(page, retard);

  await page.goto("/settings");
  await viderLesFenetres(page);
  await page.goto("/settings");
  await page.getByRole("button", { name: /ton effort|your effort/i }).first().click();

  const invisible = page.getByRole("button", { name: /^invisible$|^hidden$/i }).first();
  const visible = page.getByRole("button", { name: /^visible$/i }).first();
  await invisible.waitFor({ state: "visible", timeout: 10_000 });
  await invisible.click();
  await visible.click();

  expect(retard.demandees).toBeGreaterThan(retard.rendues);

  await page.waitForTimeout(2500);
  await expect(visible).toHaveAttribute("aria-pressed", "true");
  await expect(invisible).toHaveAttribute("aria-pressed", "false");

  await ctx.close();
});
