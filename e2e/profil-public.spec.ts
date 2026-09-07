import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { requeteSql } from "./base";

/**
 * Le profil public, à adresse partageable (réponse 121, « au choix »).
 *
 * Quatre choses, et ce sont celles qui cassent sans qu'on le voie :
 *
 * - **il n'existe pas avant d'avoir été demandé.** Une page qui montre
 *   quelque chose de vous ne doit pas exister par défaut ;
 * - **il se lit SANS session.** C'est tout son objet : le lien se partage à
 *   des gens qui n'ont pas de compte ;
 * - **il ne montre ni la dette ni le retard.** C'est une fierté qu'on
 *   partage, pas un pilori — et cette page-là peut finir n'importe où ;
 * - **le fermer coupe le lien pour de bon.** Un lien qu'on croyait avoir
 *   révoqué et qui ouvre encore serait le pire des défauts possibles ici.
 */
test.describe.configure({ mode: "serial" });

let etat: Awaited<ReturnType<import("@playwright/test").BrowserContext["storageState"]>>;
let pseudo = "";
let jeton = "";

test("un compte neuf n'a pas de profil public", async ({ browser }) => {
  const ouvert = await ouvrirCompte(browser, "Prof");
  etat = ouvert.etat;
  pseudo = ouvert.compte.pseudo;

  const [enBase] = await requeteSql<{ jetonProfil: string | null }>(
    'SELECT "jetonProfil" FROM "User" WHERE pseudo = $1', [pseudo]);
  expect(enBase.jetonProfil).toBeNull();
});

test("l'ouvrir donne un lien, qui montre l'effort et jamais la dette", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  const r = await page.request.put("/api/settings", {
    data: { userPrefs: { profilPublic: true } },
  });
  expect(r.status(), await r.text()).toBe(200);
  jeton = (await r.json()).jetonProfil;
  expect(typeof jeton).toBe("string");

  // Une dette bien visible, pour que son absence sur la page veuille dire
  // quelque chose : sans elle, le contrôle passerait sur une page qui n'a
  // simplement rien à montrer.
  //
  // **Sept chiffres, et pas quatre.** Le contrôle d'après cherche ce nombre
  // dans le HTML SERVI, qui porte les noms de fragments et les hachés de
  // construction : une page ordinaire de ce site en contient soixante-dix
  // séquences de quatre chiffres, quarante-quatre valeurs distinctes, et elles
  // changent à chaque construction. « 4242 » était donc à un tirage d'un rouge
  // injustifié — c'est le risque que le journal a nommé le 5 septembre sur un
  // autre fichier, et qui n'avait pas été repris ici. Mesuré sur cinq pages :
  // zéro séquence ISOLÉE de sept chiffres.
  const DETTE = 9_876_543;
  await requeteSql(
    'UPDATE "User" SET "dettePointsDus" = $2 WHERE pseudo = $1',
    [pseudo, DETTE],
  );

  // Sans session : c'est tout l'objet du lien.
  const anonyme = await browser.newContext();
  const vue = await anonyme.newPage();
  await vue.goto(`/p/${jeton}`);

  await expect(vue.getByRole("heading", { name: pseudo })).toBeVisible();

  /**
   * La dette ne fuit ni à l'écran, ni sur le réseau — et ce sont DEUX
   * contrôles, parce que ce sont deux fuites différentes.
   *
   * Le contrôle d'origine ne lisait que le HTML brut, et il était AVEUGLE à la
   * fuite qui compte le plus : une dette affichée passe par `Intl`, donc elle
   * s'écrit « 9 876 543 » et jamais « 9876543 ». Il gardait la moitié
   * invisible du sujet et laissait passer la moitié visible — c'est le motif
   * du garde du pourcentage, qui ne lisait que les gabarits.
   *
   * Les six écritures, et pas seulement celle du français : l'adresse ne porte
   * pas de langue, donc la page NÉGOCIE, et le contrôle ne doit pas dépendre
   * de la langue qu'on obtient.
   */
  const texte = await vue.locator("body").innerText();
  for (const langue of ["fr", "en", "es", "de", "zh", "ja"]) {
    expect(texte).not.toContain(new Intl.NumberFormat(langue).format(DETTE));
  }
  expect(texte).not.toContain(String(DETTE));

  // Et rien dans la charge utile non plus : l'écarter à l'affichage la ferait
  // quand même traverser le réseau, donc elle serait dans l'onglet réseau de
  // qui regarde. C'est le raisonnement déjà tenu pour le mode fantôme.
  expect(await vue.content()).not.toContain(String(DETTE));

  /**
   * Le niveau part du HTML SERVI, pas d'un appel qui suivrait.
   *
   * La page est rendue au serveur et le niveau se déduit de ce qu'elle lit
   * déjà : il n'y a aucune raison qu'il arrive après. Lire la RÉPONSE plutôt
   * que le DOM est ce qui le prouve — une fois hydratée, la page l'afficherait
   * dans les deux cas.
   *
   * L'adresse porte la LANGUE, et pas par confort : sans préfixe, la réponse
   * négocie, et une requête faite hors du navigateur n'emporte pas forcément
   * l'en-tête de langue du contexte. Le premier jet cherchait « Niveau » dans
   * une page rendue en anglais.
   */
  const servi = await (await vue.request.get(`/fr/p/${jeton}`)).text();
  expect(servi).toMatch(/Niveau\s*\d/);

  await anonyme.close();
  await ctx.close();
});

test("le fermer coupe le lien, et le rouvrir en donne un autre", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  const ferme = await page.request.put("/api/settings", {
    data: { userPrefs: { profilPublic: false } },
  });
  expect(ferme.status()).toBe(200);

  const anonyme = await browser.newContext();
  const vue = await anonyme.newPage();
  await vue.goto(`/p/${jeton}`);
  // La page existe toujours — elle dit « lien inconnu ». Rendre 404 ne serait
  // pas pire, mais dire « ce profil a été fermé » apprendrait qu'il a existé.
  await expect(vue.getByRole("heading", { name: pseudo })).toBeHidden();

  const rouvert = await page.request.put("/api/settings", {
    data: { userPrefs: { profilPublic: true } },
  });
  const nouveau = (await rouvert.json()).jetonProfil;
  expect(nouveau).not.toBe(jeton);

  await anonyme.close();
  await ctx.close();
});
