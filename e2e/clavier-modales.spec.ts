import { test, expect, type Locator, type Page } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { viderLesFenetres } from "./intro";

/**
 * Au clavier, une fenêtre modale doit retenir, et laisser sortir.
 *
 * `src/modalesAnnoncees.test.ts` refuse une fenêtre qui ne s'annonce pas, et
 * refuse maintenant une fenêtre qui s'annonce sans employer le piège commun.
 * Il est statique : il voit l'appel, pas ce que l'appel fait. Or ce qu'on veut
 * savoir tient en trois gestes qui ne s'éprouvent qu'en les faisant — le focus
 * entre-t-il, tourne-t-il, revient-il.
 *
 * Deux fenêtres suffisent à couvrir les deux façons d'appeler le hook :
 * l'accueil, qui ne se monte que lorsqu'elle s'ouvre, et la suppression de
 * compte, rendue sous condition par une page qui reste montée.
 */

/**
 * Le focus est-il à l'intérieur de CETTE fenêtre ?
 *
 * La fenêtre se désigne par son nom, jamais par « la première ouverte ».
 * Fermer l'accueil fait paraître la visite guidée, qui est modale elle aussi :
 * un sélecteur générique passait alors de l'une à l'autre sans le dire, et le
 * test attendait la disparition d'une fenêtre qui venait de s'ouvrir.
 */
async function focusDansLaFenetre(fenetre: Locator): Promise<boolean> {
  return fenetre.evaluate((el) => !!document.activeElement && el.contains(document.activeElement));
}

/**
 * Tabule assez pour faire le tour, et vérifie qu'on n'est jamais sorti.
 *
 * Un seul Tab ne prouve rien : le défaut n'apparaît qu'au moment où l'on
 * dépasse le dernier élément de la fenêtre. C'est précisément là que la
 * tabulation partait dans la page derrière.
 */
async function tourneEnRond(page: Page, fenetre: Locator, coups = 14) {
  for (let i = 0; i < coups; i++) {
    await page.keyboard.press("Tab");
    expect(await focusDansLaFenetre(fenetre), `sorti de la fenêtre au ${i + 1}e Tab`).toBe(true);
  }
}

test.describe.configure({ mode: "serial" });

test.describe("le clavier dans les fenêtres modales", () => {
  test("la modale d'accueil retient le focus et se ferme par Échap", async ({ browser }) => {
    // Sans passer l'intro : c'est elle qu'on vient éprouver.
    const { etat } = await ouvrirCompte(browser, "clavAcc");
    const ctx = await browser.newContext({ storageState: etat });
    const page = await ctx.newPage();
    await page.goto("/dashboard");

    const fenetre = page.getByRole("dialog", { name: /bienvenue|welcome/i });
    await fenetre.waitFor({ state: "visible", timeout: 20_000 });

    expect(await focusDansLaFenetre(fenetre)).toBe(true);
    await tourneEnRond(page, fenetre);

    await page.keyboard.press("Escape");
    await expect(fenetre).toBeHidden({ timeout: 10_000 });
    await ctx.close();
  });

  test("la suppression de compte retient le focus et rend la place", async ({ browser }) => {
    const { etat } = await ouvrirCompte(browser, "clavSup");
    const ctx = await browser.newContext({ storageState: etat });
    const page = await ctx.newPage();
    /**
     * Les fenêtres d'accueil se traversent AVANT d'aller où l'on va.
     *
     * La visite guidée navigue d'une page à l'autre au fil de ses douze
     * étapes : la traverser depuis les réglages nous laissait sur le tableau
     * de bord, et le bouton cherché n'y existe pas. L'échec ne ressemblait pas
     * à sa cause — un délai dépassé sur une page parfaitement normale.
     */
    await page.goto("/dashboard");
    await viderLesFenetres(page);
    await page.goto("/settings");

    /**
     * La rubrique s'OUVRE, elle ne se demande pas par l'adresse.
     *
     * `?rubrique=donnees` ne déplie rien — le piège est déjà écrit dans le
     * journal pour `?rubrique=effort`, et il se retombe dedans. Le nom
     * accessible de l'en-tête contient celui de ses enfants, d'où le motif qui
     * ne s'ancre pas sur la fin.
     */
    await page.getByRole("button", { name: /tes données|your data/i }).click();

    const ouvrir = page.getByRole("button", { name: /supprimer mon compte|delete my account/i });
    await ouvrir.click();

    const fenetre = page.getByRole("dialog", { name: /supprimer d|delete perman|endgültig|eliminar definit/i });
    await fenetre.waitFor({ state: "visible", timeout: 10_000 });
    expect(await focusDansLaFenetre(fenetre)).toBe(true);
    await tourneEnRond(page, fenetre, 10);

    await page.keyboard.press("Escape");
    await expect(fenetre).toBeHidden({ timeout: 10_000 });

    /**
     * Le focus revient d'où il venait.
     *
     * C'est la moitié qu'on oublie : sans elle, refermer une fenêtre renvoie
     * au tout début du document, et il faut retraverser la page entière pour
     * revenir là où l'on était. Sur cette page-ci, « là où l'on était » est le
     * bouton qui ouvre la suppression de compte.
     */
    await expect(ouvrir).toBeFocused();
    await ctx.close();
  });
});
