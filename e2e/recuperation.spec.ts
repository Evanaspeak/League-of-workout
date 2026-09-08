import { test, expect } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { ouvrirCompte } from "./compte";
import { requeteSql } from "./base";
import { sansLangue } from "./chemin";
import { PREFIXE_RESET, VALIDITE_MS, empreinte } from "../src/lib/recuperation";

/**
 * La dernière étape de la SEULE porte de secours du produit.
 *
 * Quelqu'un qui a perdu son code n'a pas d'autre chemin : il demande un lien,
 * il l'ouvre, et c'est là — et nulle part ailleurs — que l'ancien code cesse
 * de valoir. Le module est éprouvé unitairement depuis longtemps ; la PAGE qui
 * consomme le lien ne l'était par rien, et un recensement des pages du produit
 * contre celles qu'un parcours ouvre l'a nommée avec `/connexion-app`.
 *
 * Ce que ça coûterait de ne pas la couvrir : une régression y est invisible
 * jusqu'au jour où quelqu'un en a besoin, c'est-à-dire au pire moment — et il
 * n'a alors aucun recours, puisque c'est le recours.
 *
 * **Le jeton est fabriqué avec la fonction du PRODUIT**, `empreinte`, et non
 * avec une copie de son hachage. Un test écrit contre le même motif que le
 * code éprouve le motif et non la règle : c'est le piège que ce journal a payé
 * sur la forme des dates. La base ne porte que l'empreinte — c'est la décision
 * écrite dans le module — donc le clair ne peut venir que d'ici.
 */

/** Pose un lien de récupération valide pour cette adresse, et rend le jeton clair. */
async function poserLien(email: string, quand = Date.now() + VALIDITE_MS): Promise<string> {
  const jeton = randomBytes(32).toString("hex");
  await requeteSql(
    'INSERT INTO "VerificationToken" (identifier, token, expires) VALUES ($1, $2, $3)',
    [`${PREFIXE_RESET}${email}`, empreinte(jeton), new Date(quand)],
  );
  return jeton;
}

/**
 * L'échec se lit sur un texte PRÉSENT, jamais sur un code ABSENT.
 *
 * `toHaveCount(0)` est vrai tout de suite : il passe avant même que la
 * requête soit partie, donc il n'attend rien et ne distingue rien. Éprouvé —
 * avec le contrôle d'expiration débranché dans la route, la version qui
 * lisait une absence passait au vert, et c'est le titre d'échec qui l'a fait
 * tomber. C'est le piège écrit au journal pour la correction de résultat :
 * « un test qui attend quelque chose de déjà vrai n'attend rien ».
 */
async function attendreEchec(page: import("@playwright/test").Page) {
  await expect(page.getByText(/lien invalide ou expiré/i).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".mono-num")).toHaveCount(0);
}

test.describe.configure({ mode: "serial" });

test("le lien rend un code neuf, et l'ancien ne vaut plus", async ({ browser }) => {
  const { compte, code: ancien } = await ouvrirCompte(browser, "Recup");
  const jeton = await poserLien(compte.email);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/fr/recuperation/valider?t=${jeton}`);

  // Le code neuf s'affiche : c'est tout ce que la page a à donner, et sans lui
  // la personne repart sans rien.
  const bloc = page.locator(".mono-num").first();
  await bloc.waitFor({ timeout: 20_000 });
  const neuf = (await bloc.innerText()).trim();
  expect(neuf).not.toBe("");
  expect(neuf).not.toBe(ancien);
  await expect(page.getByText(compte.pseudo, { exact: false }).first()).toBeVisible();

  // Et il OUVRE : un code affiché qui ne connecte pas serait pire que pas de
  // page du tout.
  await page.goto("/fr/login");
  await page.getByPlaceholder(/ton pseudo|your username/i).fill(compte.pseudo);
  await page.getByPlaceholder(/ton code|your code/i).fill(neuf);
  await Promise.all([
    page.waitForURL((u) => !sansLangue(u.pathname).startsWith("/login"), { timeout: 30_000 }),
    page.getByRole("button", { name: /^se connecter$|^sign in$/i }).click(),
  ]);

  await ctx.close();
});

test("le même lien ne se rejoue pas", async ({ browser }) => {
  /**
   * L'usage unique est ce qui empêche un lien retrouvé dans une boîte, des
   * mois plus tard, de rouvrir un compte. La page le dit en échouant ; la
   * ligne, elle, doit avoir disparu de la base — c'est la seule preuve que le
   * jeton est consommé et pas seulement refusé à l'affichage.
   */
  const { compte } = await ouvrirCompte(browser, "Rejeu");
  const jeton = await poserLien(compte.email);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/fr/recuperation/valider?t=${jeton}`);
  await page.locator(".mono-num").first().waitFor({ timeout: 20_000 });

  const restes = await requeteSql(
    'SELECT 1 FROM "VerificationToken" WHERE identifier = $1',
    [`${PREFIXE_RESET}${compte.email}`],
  );
  expect(restes).toHaveLength(0);

  await page.goto(`/fr/recuperation/valider?t=${jeton}`);
  await attendreEchec(page);

  await ctx.close();
});

test("un lien expiré ne donne rien", async ({ browser }) => {
  // Une heure, écrite dans le module. Un lien d'hier retrouvé dans une boîte
  // ne doit pas ouvrir un compte, et c'est la borne qui le tient.
  const { compte } = await ouvrirCompte(browser, "Expire");
  const jeton = await poserLien(compte.email, Date.now() - 60_000);

  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`/fr/recuperation/valider?t=${jeton}`);
  await attendreEchec(page);
  await ctx.close();
});

test("sans jeton, la page le dit tout de suite", async ({ browser }) => {
  // L'issue est connue dès le rendu : c'est écrit dans la page, et un état
  // « en attente » qui ne finirait jamais est ce qu'elle existe pour éviter.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto("/fr/recuperation/valider");
  await attendreEchec(page);
  await ctx.close();
});
