import { test, expect, type Page } from "@playwright/test";
import { LANGUES } from "../src/lib/i18n/LocaleContext";

/**
 * Les six langues, sur les écrans qu'un visiteur voit avant d'avoir un compte.
 *
 * Les tests de dictionnaire vérifient que les clés se correspondent ; ils ne
 * peuvent rien dire de ce que la page fait de ces clés. Trois défauts trouvés
 * à la main n'auraient pas été vus autrement : une clé oubliée qui affiche
 * « undefined », un mot allemand trop long qui pousse la page hors de l'écran,
 * et une phrase restée en anglais parce qu'un composant décidait lui-même de
 * la langue. Ce fichier refait ce passage à chaque poussée.
 */

const PAGES = ["/", "/beta", "/login", "/telechargement", "/recuperation"];

/** Ouvre une page dans une langue donnée, écrans d'accueil écartés. */
async function ouvrirEn(page: Page, langue: string, chemin: string) {
  await page.addInitScript(([l]) => {
    try {
      localStorage.setItem("low_locale", l);
      sessionStorage.setItem("splash", "1");
      localStorage.setItem("low_visite", "1");
      localStorage.setItem("low_onboarded", "1");
    } catch { /* stockage refusé : la page s'affichera en anglais, c'est tout */ }
  }, [langue]);
  await page.goto(chemin, { waitUntil: "domcontentloaded" });
  // Le temps que la langue soit lue et que le rendu suive.
  await page.waitForTimeout(800);
}

for (const langue of LANGUES) {
  test.describe(`langue ${langue}`, () => {
    for (const chemin of PAGES) {
      test(`${chemin} s'affiche sans trou ni débordement`, async ({ page }) => {
        await ouvrirEn(page, langue, chemin);

        const texte = await page.evaluate(() => document.body.innerText);
        // Une clé absente rend `undefined`, un objet rendu tel quel donne
        // « [object Object] » : deux traces d'un dictionnaire incomplet.
        expect({ chemin, langue, texte: texte.match(/\bundefined\b|\[object Object\]/g) ?? [] })
          .toEqual({ chemin, langue, texte: [] });

        // Aucune page ne doit défiler horizontalement : c'est ainsi qu'un mot
        // allemand trop long se signale.
        const deborde = await page.evaluate(() =>
          document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
        expect({ chemin, langue, deborde }).toEqual({ chemin, langue, deborde: false });

        // La page dit bien dans quelle langue elle est : sans quoi un lecteur
        // d'écran la prononcerait avec le mauvais accent.
        expect(await page.evaluate(() => document.documentElement.lang)).toBe(langue);
      });
    }
  });
}

test("la page d'accueil change vraiment de texte d'une langue à l'autre", async ({ browser }) => {
  // Une langue qui retomberait silencieusement sur l'anglais passerait tous
  // les contrôles ci-dessus. Comparer les textes deux à deux la démasque.
  const textes = new Map<string, string>();
  for (const langue of LANGUES) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await ouvrirEn(page, langue, "/");
    textes.set(langue, await page.evaluate(() => document.body.innerText));
    await ctx.close();
  }
  const identiques: string[] = [];
  for (const [a, texteA] of textes) {
    for (const [b, texteB] of textes) {
      if (a < b && texteA === texteB) identiques.push(`${a} = ${b}`);
    }
  }
  expect(identiques).toEqual([]);
});
