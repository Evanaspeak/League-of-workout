import { test, expect } from "@playwright/test";

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
    await page.goto(chemin, { waitUntil: "domcontentloaded" });
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
    await page.goto(`/calculateur/${slug}`, { waitUntil: "domcontentloaded" });
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
    await page.goto(`/calculateur/${slug}`, { waitUntil: "domcontentloaded" });
    expect((await metadonnees(page)).titre.length, slug).toBeLessThanOrEqual(60);
  }
});

test("les écrans privés disent de ne pas les indexer", async ({ page }) => {
  // Les interdire dans robots.txt ne suffit pas : une adresse interdite
  // d'exploration peut être indexée depuis un lien, et paraît alors sans titre
  // ni description. Un moteur ne lit « noindex » que s'il ouvre la page.
  for (const chemin of ["/login", "/recuperation"]) {
    await page.goto(chemin, { waitUntil: "domcontentloaded" });
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
 * Les dix-neuf sections sous le héros portent `.reveal` : la feuille de style
 * les pose à `opacity: 0`, et seul l'IntersectionObserver installé après
 * l'hydratation les rend visibles. Le HTML était complet, le serveur faisait
 * son travail — et la page se réduisait au premier écran pour qui a coupé le
 * script ou le fait bloquer par une extension. Mesuré avant correction :
 * 19 sections sur 19 invisibles après avoir descendu toute la page.
 *
 * Le test descend comme un lecteur, puis compte ce qui est resté caché.
 */
test("sans JavaScript, la page d'accueil ne se réduit pas au premier écran", async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false, locale: "fr-FR" });
  const page = await ctx.newPage();
  await page.goto("/", { waitUntil: "load" });

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
  expect(bilan.total).toBeGreaterThan(5);
  expect(bilan, "des sections restent invisibles sans script").toMatchObject({ caches: 0 });
  await ctx.close();
});
