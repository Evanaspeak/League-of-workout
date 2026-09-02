import { test, expect } from "@playwright/test";
import { enLangue } from "./chemin";

/**
 * Ce qu'un moteur de recherche et un salon Discord voient des pages publiques.
 *
 * Le calculateur par jeu est le seul canal d'acquisition qui travaille sans
 * qu'on s'en occupe : « combien de pompes pour une défaite sur League of
 * Legends » est une question que des gens tapent déjà. Une balise qui
 * disparaît ne casse rien, ne fait échouer aucun test, et se paie six mois
 * plus tard en trafic qu'on n'a jamais eu.
 *
 * Deux défauts trouvés en écrivant ces contrôles, tous deux invisibles à
 * l'écran : le titre des pages par jeu atteignait 75 caractères avec le
 * suffixe du gabarit — Google le coupait au milieu du nom du jeu, c'est-à-dire
 * au mot qui prouvait qu'on répondait à la question — et ces mêmes pages
 * partaient sans vignette, parce que Next.js remplace le bloc `openGraph` du
 * parent au lieu de le compléter.
 */

/** Les pages ouvertes à tous, hors calculateur par jeu. */
const PUBLIQUES = ["/", "/beta", "/telechargement", "/calculateur", "/cgu", "/confidentialite"];

/**
 * Les contrôles de longueur se font en français, et seulement là.
 *
 * Un minimum de soixante-dix caractères n'a pas de sens en japonais, où la
 * même phrase en occupe la moitié : l'imposer forcerait à délayer le texte
 * pour satisfaire un test. Ce qui vaut pour les six langues — les alternatives
 * déclarées, et six textes réellement différents — est éprouvé à part.
 */
const MESURE = "fr";

async function metadonnees(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const meta = (n: string) =>
      document.querySelector<HTMLMetaElement>(`meta[name="${n}"]`)?.content ?? null;
    const prop = (p: string) =>
      document.querySelector<HTMLMetaElement>(`meta[property="${p}"]`)?.content ?? null;
    return {
      titre: document.title,
      description: meta("description"),
      robots: meta("robots"),
      canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? null,
      ogTitre: prop("og:title"), ogDesc: prop("og:description"),
      ogImage: prop("og:image"), ogUrl: prop("og:url"), ogType: prop("og:type"),
      twitter: meta("twitter:card"),
      lang: document.documentElement.lang,
      h1: document.querySelectorAll("h1").length,
    };
  });
}

for (const chemin of PUBLIQUES) {
  test(`${chemin} se présente correctement aux moteurs`, async ({ page }) => {
    await page.addInitScript(() => {
      try { sessionStorage.setItem("splash", "1"); } catch { /* stockage refusé */ }
    });
    await page.goto(enLangue(MESURE, chemin), { waitUntil: "domcontentloaded" });
    const m = await metadonnees(page);

    expect(m.titre.length).toBeGreaterThanOrEqual(15);
    expect(m.titre.length).toBeLessThanOrEqual(70);
    // Une description trop courte est remplacée par un extrait choisi par le
    // moteur ; trop longue, elle est coupée. Les deux gâchent la seule phrase
    // qu'on contrôle dans un résultat de recherche.
    expect(m.description?.length ?? 0).toBeGreaterThanOrEqual(70);
    expect(m.description?.length ?? 0).toBeLessThanOrEqual(160);
    expect(m.canonical).toBeTruthy();
    expect(m.lang).toBeTruthy();
    expect(m.h1).toBe(1);
    for (const v of [m.ogTitre, m.ogDesc, m.ogImage, m.ogUrl, m.ogType, m.twitter]) {
      expect(v).toBeTruthy();
    }
  });
}

test("les pages par jeu gardent leur vignette et leur adresse", async ({ page }) => {
  // C'est le bloc `openGraph` redéclaré dans la page qui les efface : Next.js
  // remplace celui du parent au lieu de le compléter.
  for (const slug of ["league-of-legends", "valorant", "apex-legends"]) {
    await page.goto(enLangue(MESURE, `/calculateur/${slug}`), { waitUntil: "domcontentloaded" });
    const m = await metadonnees(page);
    expect(m.ogImage, slug).toBeTruthy();
    expect(m.ogUrl, slug).toContain(slug);
    expect(m.canonical, slug).toContain(slug);
    expect(m.h1, slug).toBe(1);
  }
});

test("le titre d'une page par jeu tient dans un résultat de recherche", async ({ page }) => {
  // Le titre EST la question qu'on a tapée : coupé, il perd le nom du jeu,
  // c'est-à-dire le mot qui prouve qu'on répond à celle-ci.
  for (const slug of ["league-of-legends", "teamfight-tactics", "world-of-warcraft"]) {
    await page.goto(enLangue(MESURE, `/calculateur/${slug}`), { waitUntil: "domcontentloaded" });
    expect((await metadonnees(page)).titre.length, slug).toBeLessThanOrEqual(60);
  }
});

test("les écrans privés disent de ne pas les indexer", async ({ page }) => {
  // Les interdire dans robots.txt ne suffit pas : une adresse interdite
  // d'exploration peut être indexée depuis un lien, et paraît alors sans titre
  // ni description. Un moteur ne lit « noindex » que s'il ouvre la page.
  for (const chemin of ["/login", "/recuperation"]) {
    await page.goto(enLangue(MESURE, chemin), { waitUntil: "domcontentloaded" });
    expect((await metadonnees(page)).robots, chemin).toContain("noindex");
  }
});

test("le plan du site liste les pages par jeu", async ({ request }) => {
  // Elles existent pour être trouvées : hors du plan, elles sont écrites pour
  // rien.
  const xml = await (await request.get("/sitemap.xml")).text();
  for (const slug of ["league-of-legends", "valorant", "apex-legends"]) {
    expect(xml, slug).toContain(`/calculateur/${slug}`);
  }
});

test("robots.txt n'interdit pas ce qui porte une balise noindex", async ({ request }) => {
  // La règle vient de `/waitlist`, supprimée depuis avec le plafond de cent :
  // interdire l'exploration n'empêche pas l'indexation, et la page paraît
  // alors sans titre ni description. Elle vaut pour les écrans privés, qui
  // sont les seuls à porter encore les deux.
  const txt = await (await request.get("/robots.txt")).text();
  for (const chemin of ["/login", "/recuperation"]) {
    expect(txt, chemin).not.toContain(chemin);
  }
  expect(txt).toContain("Sitemap");
});

/**
 * La page d'accueil se lit encore quand le script ne s'exécute pas.
 *
 * Les sections sous le héros portent `.reveal` : la feuille de style les pose
 * à `opacity: 0`, et seul l'IntersectionObserver installé après l'hydratation
 * les rend visibles. Le HTML était complet, le serveur faisait son travail —
 * et la page se réduisait au premier écran pour qui a coupé le script ou le
 * fait bloquer par une extension. Mesuré avant correction : 19 sections sur
 * 19 invisibles après avoir descendu toute la page. Elles ne sont plus que
 * trois depuis l'allègement de l'accueil ; la règle, elle, n'a pas changé.
 *
 * Le test descend comme un lecteur, puis compte ce qui est resté caché.
 */
test("sans JavaScript, la page d'accueil ne se réduit pas au premier écran", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, locale: "fr-FR" });
  const page = await ctx.newPage();
  await page.goto(enLangue(MESURE, "/"), { waitUntil: "load" });

  // Les sections ne se révèlent qu'au passage : on descend la page.
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(120);
  }

  const bilan = await page.evaluate(() => {
    const sections = [...document.querySelectorAll(".reveal")];
    const caches = sections.filter((el) => Number(getComputedStyle(el).opacity) < 0.05);
    return {
      total: sections.length,
      caches: caches.length,
      exemple: caches[0]
        ? (caches[0].textContent || "").trim().replace(/\s+/g, " ").slice(0, 60)
        : "",
    };
  });

  // Le compte total sert de garde : si la classe disparaissait, le test
  // passerait sur une page qui n'a plus rien à révéler, et ne prouverait rien.
  expect(bilan.total).toBeGreaterThan(2);
  expect(bilan, "des sections restent invisibles sans script").toMatchObject({ caches: 0 });
  await ctx.close();
});

/**
 * Les six langues existent pour un moteur, et elles se déclarent l'une l'autre.
 *
 * C'est tout l'objet du préfixe de langue dans l'adresse. Tant qu'elle vivait
 * dans le stockage du navigateur, une seule version pouvait partir — le
 * français — et les cinq autres n'existaient pas aux yeux d'un moteur. Le
 * défaut ne cassait rien et ne se voyait nulle part : la page s'affichait
 * parfaitement dans la bonne langue une fois le script exécuté.
 *
 * Deux choses se vérifient, et il faut les deux. Que chaque version se
 * déclare — sans `hreflang`, les six adresses se font concurrence au lieu de
 * s'additionner, et c'est la plus ancienne qui gagne partout. Et que les
 * textes soient réellement différents : six adresses qui rendent le même
 * titre français seraient pires que rien, un moteur y verrait du contenu
 * dupliqué.
 */
const LANGUES_SEO = ["fr", "en", "es", "de", "zh", "ja"];

test("chaque page publique existe dans les six langues, et le déclare", async ({ page }) => {
  for (const chemin of ["/", "/cgu", "/calculateur/league-of-legends"]) {
    const titres = new Set<string>();
    for (const langue of LANGUES_SEO) {
      await page.goto(enLangue(langue, chemin), { waitUntil: "domcontentloaded" });
      const m = await page.evaluate(() => ({
        lang: document.documentElement.lang,
        titre: document.title,
        canonical: document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? "",
        alternates: [...document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"][hreflang]')]
          .map((l) => l.getAttribute("hreflang")),
        defaut: document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="x-default"]')?.href ?? "",
      }));
      expect({ chemin, langue, lang: m.lang }).toEqual({ chemin, langue, lang: langue });
      expect(m.canonical, `${langue} ${chemin}`).toContain(`/${langue}`);
      /**
       * Les six langues, PLUS `x-default`.
       *
       * `x-default` répond à la question que les six ne couvrent pas : que
       * servir à quelqu'un dont la langue n'est dans aucune d'elles. Sans lui,
       * un moteur choisit seul, et il choisit la version la plus anciennement
       * connue — la française, y compris pour une recherche faite en portugais.
       */
      expect([...m.alternates].sort(), `${langue} ${chemin}`)
        .toEqual([...LANGUES_SEO, "x-default"].sort());
      // Il désigne l'adresse SANS préfixe, celle qui négocie — pas une
      // septième traduction.
      expect(new URL(m.defaut).pathname, `x-default ${langue} ${chemin}`)
        .toBe(chemin === "/" ? "/" : chemin);
      titres.add(m.titre);
    }
    // Six textes réellement différents, pas six copies du français.
    expect({ chemin, distincts: titres.size }).toEqual({ chemin, distincts: LANGUES_SEO.length });
  }
});

test("une adresse sans langue mène à une langue, une fois pour toutes", async ({ page }) => {
  // Toutes les adresses écrites avant le préfixe — un lien partagé, un
  // favori, une notification — doivent continuer de marcher. En 308 et non en
  // 307 : c'est permanent, et un moteur doit reporter le crédit de l'ancienne
  // adresse sur la nouvelle plutôt que de garder les deux.
  const reponse = await page.goto("/cgu", { waitUntil: "domcontentloaded" });
  const chaine = reponse!.request().redirectedFrom();
  expect(chaine, "la page devait être atteinte par une redirection").not.toBeNull();
  expect((await chaine!.response())!.status()).toBe(308);
  expect(new URL(page.url()).pathname).toMatch(/^\/(fr|en|es|de|zh|ja)\/cgu$/);
});

/**
 * `/login` garde son adresse, et c'est voulu.
 *
 * L'application Windows déjà installée ouvre sa fenêtre d'authentification sur
 * `${SITE}/login` et décide « la connexion est finie » en demandant « ce n'est
 * plus /login ? ». Redirigée vers `/fr/login`, elle répondrait oui à la toute
 * première page : elle refermerait la fenêtre avant qu'on ait tapé quoi que ce
 * soit, et chercherait un cookie qui n'existe pas encore.
 *
 * Les copies installées ne se corrigent pas à distance. La réécriture garde
 * l'adresse visible, et la page rendue reste celle de la bonne langue.
 */
test("l'adresse de connexion ne bouge pas, pour l'application déjà installée", async ({ page }) => {
  const reponse = await page.goto("/login", { waitUntil: "domcontentloaded" });
  expect(reponse!.request().redirectedFrom(), "/login ne doit pas rediriger").toBeNull();
  expect(new URL(page.url()).pathname).toBe("/login");
  // Et la page est bien rendue dans une langue, pas dans le vide.
  expect(await page.evaluate(() => document.documentElement.lang)).toMatch(/^(fr|en|es|de|zh|ja)$/);
  expect((await metadonnees(page)).robots).toContain("noindex");
});

/**
 * La carte partagée et l'icône d'onglet répondent, dans les six langues.
 *
 * Elles ont déménagé sous `[locale]` avec les pages, et le motif du middleware
 * ne regarde que le PREMIER segment : `/opengraph-image` y échappait,
 * `/fr/opengraph-image` non. Les deux partaient donc en 307 vers la connexion.
 * Un lien posé sur Discord n'avait plus d'image, et rien ne le disait —
 * personne ne regarde le code de réponse d'une vignette.
 *
 * Le contrôle porte sur la SIGNATURE du fichier, pas sur sa taille : une page
 * de connexion rendue en 200 passerait un contrôle de taille.
 */
test("la carte partagée et l'icône répondent dans les six langues", async ({ request }) => {
  for (const langue of LANGUES_SEO) {
    for (const chemin of ["/opengraph-image", "/icon"]) {
      const r = await request.get(enLangue(langue, chemin), { maxRedirects: 0 });
      expect(r.status(), `${langue}${chemin}`).toBe(200);
      const debut = (await r.body()).subarray(0, 4);
      expect([...debut], `${langue}${chemin}`).toEqual([0x89, 0x50, 0x4e, 0x47]);
    }
  }
});
