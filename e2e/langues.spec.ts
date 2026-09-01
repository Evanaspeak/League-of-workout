import { test, expect, type Page } from "@playwright/test";
import { purgerTentatives } from "./limiteur";
import { LANGUES } from "../src/lib/i18n/LocaleContext";
import { enLangue, sansLangue } from "./chemin";

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

/**
 * Les pages ouvertes à tous.
 *
 * Quatre manquaient, et ce sont celles qu'on trouve par une recherche ou qu'on
 * lit avant de s'engager : le calculateur, une de ses pages par jeu, les CGU et
 * la politique de confidentialité. Un mot allemand trop long dans un texte
 * juridique ne casse rien de visible, mais il pousse la page hors de l'écran —
 * et c'est ce qu'on regarde ici.
 */
const PAGES = [
  "/", "/beta", "/login", "/telechargement", "/recuperation",
  "/calculateur", "/calculateur/league-of-legends", "/cgu", "/confidentialite",
  // La liste d'attente y entre en même temps qu'elle devient atteignable.
  // C'est une page qu'on ne voit qu'une fois, au pire moment, et son texte est
  // le plus long des six langues confondues.
];

/**
 * Ouvre une page dans une langue donnée, écrans d'accueil écartés.
 *
 * La langue se demande par l'ADRESSE, plus par le stockage : c'est tout
 * l'objet du changement, et poser `low_locale` ne changerait plus rien à ce
 * qui s'affiche. Le test le prouve à sa façon — il ne pose que les clés
 * d'écrans vus, et vérifie ensuite que `<html lang>` porte la bonne valeur.
 */
async function ouvrirEn(page: Page, langue: string, chemin: string) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("splash", "1");
      localStorage.setItem("low_visite", "1");
      localStorage.setItem("low_onboarded", "1");
    } catch { /* stockage refusé : les écrans d'accueil s'afficheront, c'est tout */ }
  });
  await page.goto(enLangue(langue, chemin), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
}


/**
 * Aucune page ne doit défiler horizontalement, à aucune des largeurs qui
 * comptent.
 *
 * C'est ainsi qu'un mot allemand trop long se signale — et il ne se signalait
 * pas : le contrôle ne tournait qu'à 1280 px, où tout tient. Il ne mordait
 * donc jamais là où il sert. On repasse au téléphone courant et au plus
 * étroit qu'on rencontre encore, sans recharger la page : c'est la mise en
 * page qu'on éprouve, pas le rendu serveur.
 *
 * Et le rapport nomme le coupable. « La page déborde » ne se corrige pas ;
 * « ce libellé finit à 412 px » se corrige.
 */
async function refuserDebordement(page: Page, contexte: Record<string, string>) {
  for (const largeur of [1280, 390, 320]) {
    if (largeur !== 1280) {
      await page.setViewportSize({ width: largeur, height: 844 });
      // Les graphiques se redessinent à la redimension : sans ce délai on
      // mesure la mise en page d'avant.
      await page.waitForTimeout(450);
    }
    const trop = await page.evaluate(() => {
      const doc = document.documentElement;
      if (doc.scrollWidth <= doc.clientWidth + 1) return null;
      let pire: { droite: number; quoi: string; texte: string } | null = null;
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.right <= doc.clientWidth + 1) continue;
        // On veut la feuille qui déborde, pas la chaîne de ses ancêtres.
        if (el.querySelector("*")) continue;
        if (!pire || r.right > pire.droite) {
          pire = {
            droite: Math.round(r.right),
            quoi: `${el.tagName.toLowerCase()}.${String(el.className).split(/\s+/)[0]}`,
            texte: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
          };
        }
      }
      return { largeurPage: doc.scrollWidth, pire };
    });
    expect({ ...contexte, largeur, trop }).toEqual({ ...contexte, largeur, trop: null });
  }
  // La suite se lit à la largeur d'origine.
  await page.setViewportSize({ width: 1280, height: 720 });
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

        await refuserDebordement(page, { chemin, langue });

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

/**
 * Les écrans qui demandent un compte, dans les six langues.
 *
 * Ils portent l'essentiel du texte de l'application, et rien ne les couvrait :
 * les contrôles ci-dessus s'arrêtent aux pages publiques. Un compte est créé
 * une fois, par le même chemin qu'un vrai visiteur, puis son état de
 * navigateur sert aux dix-huit visites.
 */
test.describe("écrans connectés", () => {
  test.describe.configure({ mode: "serial" });

  const marque = Date.now().toString(36);
  const COMPTE = { pseudo: `Lang${marque}`, email: `lang-${marque}@example.test` };
  let etat: import("@playwright/test").BrowserContextOptions["storageState"];

  test("ouvrir un compte pour la suite", async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      try { sessionStorage.setItem("splash", "1"); } catch { /* stockage refusé */ }
    });
    await purgerTentatives();
    await page.goto("/beta");
    await page.getByPlaceholder(/pseudo/i).first().fill(COMPTE.pseudo);
    await page.locator('input[type="email"]').first().fill(COMPTE.email);
    await page.getByRole("button", { name: /rejoindre|obtenir|valider|envoyer|join/i }).first().click();

    const bloc = page.locator(".mono-num").first();
    await bloc.waitFor({ timeout: 20_000 });
    const code = (await bloc.innerText()).trim();

    await page.goto("/login");
    await page.getByPlaceholder(/ton pseudo|your username/i).fill(COMPTE.pseudo);
    await page.getByPlaceholder(/ton code|your code/i).fill(code);
    await Promise.all([
      page.waitForURL((u) => !sansLangue(u.pathname).startsWith("/login"), { timeout: 30_000 }),
      page.getByRole("button", { name: /^se connecter$|^sign in$/i }).click(),
    ]);
    // L'identifiant sert à désamorcer la modale d'accueil, dont la mémoire est
    // propre au compte : sans lui elle recouvre chaque écran mesuré.
    const moi = await page.request.get("/api/user");
    expect(moi.ok()).toBeTruthy();
    const uid = (await moi.json()).id as string;
    await page.evaluate((u) => {
      try {
        for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
          localStorage.setItem(c, "1");
        }
      } catch { /* stockage refusé */ }
    }, uid);
    etat = await ctx.storageState();
    await ctx.close();
  });

  for (const langue of LANGUES) {
    // « Ta saison » s'y ajoute : c'est le seul écran dont le plus grand
    // élément est une image, et son texte tient dans huit petites cartes où
    // un mot allemand a toute la place de déborder.
    for (const chemin of ["/dashboard", "/history", "/settings", "/bilan"]) {
      test(`${langue} · ${chemin}`, async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: etat });
        const page = await ctx.newPage();
        await ouvrirEn(page, langue, chemin);
        // Les graphiques arrivent à part : on leur laisse le temps de se poser.
        await page.waitForTimeout(1200);

        // On est bien où l'on croit être. Une session absente ou périmée
        // renvoie sur la connexion, qui n'a ni graphique ni carte : le test
        // passerait sur une page qu'il ne mesure pas, et le dirait vert. C'est
        // le premier piège écrit pour les scripts de mesure, et il valait
        // aussi ici — il a suffi de lancer un seul de ces tests à part pour
        // que la préparation ne tourne pas et que la page devienne /login.
        expect({ chemin, langue, arrivee: new URL(page.url()).pathname })
          .toEqual({ chemin, langue, arrivee: enLangue(langue, chemin) });

        const texte = await page.evaluate(() => document.body.innerText);
        expect({ chemin, langue, trous: texte.match(/\bundefined\b|\[object Object\]/g) ?? [] })
          .toEqual({ chemin, langue, trous: [] });

        await refuserDebordement(page, { chemin, langue });

        expect(await page.evaluate(() => document.documentElement.lang)).toBe(langue);
        await ctx.close();
      });
    }
  }
});

/**
 * Le sélecteur de langue emmène VRAIMENT dans l'autre langue.
 *
 * Il n'était plus couvert par rien. Tant que la langue vivait dans le stockage
 * du navigateur, les tests la posaient eux-mêmes et empruntaient le même
 * chemin que le sélecteur ; depuis qu'elle est dans l'adresse, ils naviguent
 * directement, et plus personne ne clique sur ce bouton.
 *
 * Or c'est là que tout se joue maintenant : il écrit le souvenir du choix,
 * puis réécrit l'adresse. Trois choses se vérifient, et il faut les trois —
 * l'adresse, la langue rendue, et le souvenir. Sans le dernier, revenir sur le
 * site par la racine renverrait vers la langue du navigateur, en ignorant le
 * choix qu'on vient de faire.
 */
test("le sélecteur de langue change l'adresse, la page, et s'en souvient", async ({ page }) => {
  await page.addInitScript(() => {
    try { sessionStorage.setItem("splash", "1"); } catch { /* stockage refusé */ }
  });
  await page.goto("/fr/cgu", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: /changer de langue|change language/i }).click();
  await page.getByRole("button", { name: /^DE\s+Deutsch$/ }).click();

  await page.waitForURL(/\/de\/cgu$/, { timeout: 15_000 });
  await expect.poll(() => page.evaluate(() => document.documentElement.lang), { timeout: 15_000 })
    .toBe("de");

  // Le souvenir : c'est lui que le serveur relit pour quelqu'un qui revient
  // sur une adresse sans langue.
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === "low_locale")?.value).toBe("de");

  // Et il tient : une adresse sans langue suit le choix, pas le navigateur.
  await page.goto("/telechargement", { waitUntil: "domcontentloaded" });
  expect(new URL(page.url()).pathname).toBe("/de/telechargement");
});
