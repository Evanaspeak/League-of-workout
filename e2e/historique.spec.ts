import { test, expect, type Browser } from "@playwright/test";
import { purgerTentatives } from "./limiteur";
import { sansLangue } from "./chemin";
import { ouvrirCompte } from "./compte";

/**
 * L'historique sur téléphone.
 *
 * Le tableau réclame 760 px et compte jusqu'à neuf colonnes. Sous cette
 * largeur il défilait horizontalement : on voyait la date OU le résultat,
 * jamais l'activité entière, et le KDA se coupait au milieu d'un chiffre.
 *
 * Rien ne l'attrapait. Les tests de langue vérifient qu'aucune PAGE ne
 * déborde, et celle-ci ne débordait pas : c'est un conteneur intérieur qui
 * défilait, ce qui est même la bonne façon de faire déborder un tableau. Le
 * défaut n'était donc pas un défaut de mise en page, mais de choix de
 * présentation, et ça ne se voit qu'en regardant.
 */
test.describe.configure({ mode: "serial" });

const marque = Date.now().toString(36);
const COMPTE = { pseudo: `Histo${marque}`, email: `histo-${marque}@example.test` };
let etat: import("@playwright/test").BrowserContextOptions["storageState"];
let uid: string;

test("ouvrir un compte et enregistrer des parties", async ({ browser }) => {
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
  uid = (await (await page.request.get("/api/user")).json()).id as string;

  // Le nom de champion le plus long du jeu, et des KDA à deux chiffres : c'est
  // là que la mise en page casse, pas sur un cas idéal.
  const parties = [
    { champion: "Aurelion Sol", role: "ARAM", kills: 20, deaths: 14, assists: 8, result: "V" },
    { champion: "Kog'Maw", role: "ARAM", kills: 12, deaths: 16, assists: 9, result: "D" },
    { champion: "Maître Yi", role: "Jungle", kills: 17, deaths: 20, assists: 4, result: "D" },
  ];
  for (const p of parties) {
    const r = await page.request.post("/api/games", {
      data: { jeu: "League of Legends", exercice: "pompes", ...p },
    });
    // Une partie qui ne s'enregistre pas rendrait tous les cas suivants
    // silencieusement vides : ils passeraient en ne regardant rien.
    expect(r.status(), await r.text()).toBe(200);
  }

  await page.evaluate((u) => {
    try {
      for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
        localStorage.setItem(c, "1");
      }
    } catch { /* stockage refusé */ }
  }, uid);
  // Le consentement santé est modal : sans réponse, c'est lui qu'on mesure.
  // On l'attend LUI plutôt que le silence du réseau — c'est la seule chose
  // qu'on vient chercher ici, et il paraît bien avant que la page se taise.
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  const accepter = page.getByRole("button", { name: /^j.accepte$/i }).first();
  await accepter.waitFor({ state: "visible", timeout: 20_000 }).catch(() => {});
  if (await accepter.isVisible().catch(() => false)) {
    await accepter.click();
    await accepter.waitFor({ state: "hidden", timeout: 10_000 });
  }
  etat = await ctx.storageState();
  await ctx.close();
});

/** Ouvre l'historique à une largeur donnée, intro déjà écartée. */
async function historique(browser: Browser, largeur: number) {
  const ctx = await browser.newContext({
    storageState: etat,
    /**
     * La largeur demandée est celle qu'on obtient.
     *
     * La version précédente écrivait `largeur < 760 ? IPHONE : …`, et IPHONE
     * impose son propre gabarit de 390 px : demander 768 rendait donc une page
     * de 390. Les contrôles ajoutés autour du seuil mesuraient une largeur
     * qu'ils n'avaient jamais demandée — et le sabotage du seuil passait au
     * vert. Le tactile se garde pour les vraies largeurs de téléphone, la
     * largeur, elle, est toujours celle qu'on a dite.
     */
    viewport: { width: largeur, height: largeur < 500 ? 844 : 900 },
    ...(largeur < 500 ? { hasTouch: true, isMobile: true } : {}),
  });
  const page = await ctx.newPage();
  await page.addInitScript((u) => {
    try {
      sessionStorage.setItem("splash", "1");
      for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
        localStorage.setItem(c, "1");
      }
    } catch { /* stockage refusé */ }
  }, uid);
  /**
   * On attend la LISTE, pas le silence du réseau.
   *
   * `networkidle` guettait cinq cents millisecondes sans requête. C'est
   * fragile par nature sur une page qui continue de parler — et depuis que le
   * fournisseur de contexte reprend deux secondes après une lecture vide,
   * c'est un silence qui peut ne pas venir quand on l'attend. Ce test-ci ouvre
   * TROIS contextes de suite dans le même budget de soixante secondes : c'est
   * lui qui a fini par déborder, sur une machine chargée.
   *
   * Les deux vues sont rendues ensemble et `historique.css` choisit laquelle
   * paraît ; attendre l'une OU l'autre dit exactement ce qu'on veut savoir —
   * la liste est là — et le dit dès que c'est vrai.
   */
  await page.goto("/history", { waitUntil: "domcontentloaded" });
  await page.locator(".historique-cartes, .historique-tableau").first()
    .waitFor({ state: "attached", timeout: 20_000 });
  return { ctx, page };
}

test("sur téléphone : des cartes, pas un tableau à faire défiler", async ({ browser }) => {
  const { ctx, page } = await historique(browser, 390);
  await expect(page.locator(".carte-activite").first()).toBeVisible();
  await expect(page.locator(".historique-tableau")).toBeHidden();

  /**
   * Aucun conteneur ne doit défiler horizontalement : c'était tout le défaut.
   *
   * On ne retient que les VRAIS conteneurs défilants, ceux dont `overflow-x`
   * vaut `auto` ou `scroll`. La première version prenait tout élément dont le
   * contenu dépasse, et signalait donc les libellés coupés par une ellipse —
   * qui débordent par construction et ne se font jamais défiler.
   */
  const quiDefile = await page.evaluate(() =>
    [...document.querySelectorAll("*")]
      .filter((e) => {
        const o = getComputedStyle(e).overflowX;
        return (o === "auto" || o === "scroll")
          && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0;
      })
      .map((e) => e.className?.toString?.() || e.tagName));
  expect(quiDefile).toEqual([]);
  await ctx.close();
});

test("chaque activité tient d'un seul tenant", async ({ browser }) => {
  const { ctx, page } = await historique(browser, 390);
  const carte = page.locator(".carte-activite").first();

  // Ce qu'on vient chercher : le nom, le résultat et ce que ça coûte, ensemble.
  await expect(carte).toContainText(/Victoire|Défaite/);
  await expect(carte).toContainText(/pompes/);
  await expect(carte.locator(".carte-activite-nom")).toContainText(/\S/);

  // Et le nom le plus long du jeu ne pousse rien hors de la carte.
  const debordeDedans = await carte.evaluate((e) => e.scrollWidth > e.clientWidth + 1);
  expect(debordeDedans).toBe(false);
  await ctx.close();
});

test("toutes les commandes se touchent au doigt", async ({ browser }) => {
  const { ctx, page } = await historique(browser, 390);
  const petites = await page.evaluate(() =>
    [...document.querySelectorAll(".carte-activite button")]
      .map((b) => {
        const r = b.getBoundingClientRect();
        return { nom: b.getAttribute("aria-label"), l: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((b) => b.l < 44 || b.h < 44));
  expect(petites).toEqual([]);
  await ctx.close();
});

test("juste sous le seuil, ce sont encore des cartes qui ne défilent pas", async ({ browser }) => {
  /**
   * Le seuil doit être celui où le tableau TIENT, pas celui où il entre.
   *
   * Il réclame 760 px et la page lui retire 32 de marges : posé à 760, il
   * paraissait dès 760 px de fenêtre et se remettait à défiler jusqu'à 792.
   * Une bande de trente-deux pixels, assez étroite pour qu'on n'y tombe
   * jamais en testant à la main — et c'est précisément la largeur d'une
   * tablette en portrait.
   */
  for (const largeur of [768, 800, 819]) {
    const { ctx, page } = await historique(browser, largeur);
    await expect(page.locator(".historique-tableau"), String(largeur)).toBeHidden();
    const quiDefile = await page.evaluate(() =>
      [...document.querySelectorAll("*")]
        .filter((e) => {
          const o = getComputedStyle(e).overflowX;
          return (o === "auto" || o === "scroll")
            && e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0;
        })
        .map((e) => e.className?.toString?.() || e.tagName));
    expect(quiDefile, String(largeur)).toEqual([]);
    await ctx.close();
  }
});

test("dès que le tableau tient, il ne défile pas non plus", async ({ browser }) => {
  const { ctx, page } = await historique(browser, 820);
  await expect(page.locator(".historique-tableau")).toBeVisible();
  const defile = await page.evaluate(() => {
    const t = document.querySelector(".historique-tableau");
    return t ? t.scrollWidth > t.clientWidth + 1 : false;
  });
  expect(defile).toBe(false);
  await ctx.close();
});

test("sur un écran large : le tableau reprend sa place", async ({ browser }) => {
  // Les cartes n'ont pas à remplacer le tableau partout : à cette largeur, il
  // montre plus de choses d'un coup d'œil, et c'est pour ça qu'il existe.
  const { ctx, page } = await historique(browser, 1280);
  await expect(page.locator(".historique-tableau")).toBeVisible();
  await expect(page.locator(".carte-activite").first()).toBeHidden();
  await ctx.close();
});

test("une icône de champion qui ne charge pas laisse la lettre, pas un trou", async ({ browser }) => {
  // Les icônes viennent d'un domaine tiers (Data Dragon) : une coupure chez
  // eux, un bloqueur, un patch qui déplace un fichier, et elles manquent.
  //
  // Ce que ce test couvre, et ce qu'il ne couvre pas : il éprouve le repli
  // ORDINAIRE, celui d'une image qui échoue après l'hydratation. C'est le cas
  // courant, et rien ne le couvrait.
  //
  // Il ne prouve PAS le contrôle ajouté au montage (`complete` et
  // `naturalWidth`), qui vise l'échec survenu AVANT l'hydratation : ici
  // l'interception réseau tombe forcément après. Sabotage fait, ce contrôle
  // retiré : le test passe quand même. Le cas d'avant hydratation n'est
  // éprouvé que sur l'image du bilan, où elle part avec le HTML.
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.addInitScript((u) => {
    try {
      sessionStorage.setItem("splash", "1");
      for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
        localStorage.setItem(c, "1");
      }
    } catch { /* stockage refusé */ }
  }, uid);

  await page.route("https://ddragon.leagueoflegends.com/**", (route) =>
    route.fulfill({ status: 404, body: "" }));

  await page.goto("/history", { waitUntil: "domcontentloaded" });
  await page.locator(".historique-cartes, .historique-tableau").first()
    .waitFor({ state: "attached", timeout: 20_000 });

  // Plus aucune image de champion à l'écran, et la lettre est là à la place.
  await expect(page.locator('img[src*="ddragon"]')).toHaveCount(0);
  // Les deux présentations sont rendues, et c'est la feuille de style qui
  // choisit : sans filtre de visibilité, `.first()` tombe sur la carte que
  // l'écran de poste masque.
  await expect(page.getByText("A", { exact: true }).locator("visible=true").first())
    .toBeVisible();
  await ctx.close();
});

test("une icône qui traîne puis échoue ne fait pas sauter les lignes", async ({ browser }) => {
  /**
   * Le pendant du test précédent, sur la MISE EN PAGE plutôt que sur le
   * contenu. Une image cassée n'est pas une image vide : le navigateur y rend
   * le texte de remplacement, qui passe à la ligne dans trente-huit pixels de
   * large et fait grandir la ligne. React reprend la main quelques
   * millisecondes plus tard et pose le repli, donc la ligne redescend — deux
   * déplacements successifs, l'un dans chaque sens.
   *
   * Mesuré par la campagne du 4 septembre : **CLS 0,102** sur un historique de
   * neuf parties, pour un seuil de 0,1. Il ne se voyait sur aucun compte vide,
   * et pas non plus quand le CDN répond vite : il fallait des lignes ET une
   * réponse lente, c'est-à-dire exactement la situation de quelqu'un sur un
   * réseau moyen.
   *
   * Le retard est ce qui rend le test discriminant : une interception qui
   * refuse tout de suite ne laisse pas au navigateur le temps de peindre
   * l'état cassé, et la mesure rend le même chiffre des deux côtés.
   */
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.addInitScript((u) => {
    try {
      sessionStorage.setItem("splash", "1");
      for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
        localStorage.setItem(c, "1");
      }
    } catch { /* stockage refusé */ }
    /**
     * Le chiffre ET les coupables.
     *
     * « CLS 0,072 » ne se diagnostique pas : il ne dit ni ce qui a bougé, ni
     * quand. Le nom de l'élément déplacé transforme un chiffre en piste, et
     * c'est la leçon déjà écrite pour `performance.mjs`.
     */
    const w = window as unknown as { __cls: number; __clsLignes: number; __clsQui: string[] };
    w.__cls = 0;
    w.__clsLignes = 0;
    w.__clsQui = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as (PerformanceEntry & {
        value: number; hadRecentInput: boolean;
        sources?: { node?: Element; previousRect: DOMRectReadOnly; currentRect: DOMRectReadOnly }[];
      })[]) {
        if (e.hadRecentInput) continue;
        w.__cls += e.value;
        /**
         * Ce qui est compté ici, ce sont les LIGNES, pas la page.
         *
         * Le pied de page se pose après le premier rendu et déplace tout ce
         * qui est sous lui : c'est un déplacement réel, il existait déjà avant
         * ce chantier, et il vaut à lui seul plus que le seuil qu'on veut
         * tenir. Le mêler à la mesure noierait exactement ce qu'on éprouve —
         * une ligne d'historique qui grandit puis rapetisse pendant qu'une
         * icône échoue.
         */
        if ((e.sources ?? []).some((src) => src.node?.closest?.(
          ".historique-tableau, .historique-cartes"))) w.__clsLignes += e.value;
        for (const src of e.sources ?? []) {
          const el = src.node;
          const nom = el && el.tagName ? el.tagName.toLowerCase() : "?";
          const cl = el && typeof el.className === "string" && el.className
            ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
          w.__clsQui.push(`${e.value.toFixed(3)} @${Math.round(e.startTime)}ms ${nom}${cl} `
            + `h:${Math.round(src.previousRect.height)}→${Math.round(src.currentRect.height)} `
            + `y:${Math.round(src.previousRect.y)}→${Math.round(src.currentRect.y)}`);
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  }, uid);

  /**
   * Trois secondes et demie, et ce chiffre porte le test.
   *
   * À une seconde et demie, le sabotage passait au VERT : le navigateur n'a
   * pas peint l'état cassé avant que React ne pose le repli, donc il n'y avait
   * rien à mesurer. Mesuré des deux côtés à 3500 ms : 0,034 de déplacement sur
   * les lignes sans la correction, exactement zéro avec.
   */
  await page.route("https://ddragon.leagueoflegends.com/**", async (route) => {
    await new Promise((r) => setTimeout(r, 3500));
    await route.abort();
  });

  await page.goto("/history", { waitUntil: "domcontentloaded" });
  await page.locator(".historique-cartes, .historique-tableau").first()
    .waitFor({ state: "attached", timeout: 20_000 });
  // Le repli est posé : l'échec a bien eu lieu, donc la mesure porte sur
  // quelque chose. Sans ce contrôle, une interception qui ne prendrait pas
  // rendrait un CLS nul et le test passerait en n'éprouvant rien.
  await expect(page.locator('img[src*="ddragon"]')).toHaveCount(0, { timeout: 20_000 });
  await page.waitForTimeout(1000);

  const { lignes, qui } = await page.evaluate(() => {
    const w = window as unknown as { __clsLignes: number; __clsQui: string[] };
    return { lignes: w.__clsLignes, qui: w.__clsQui };
  });
  // Le témoin : la sonde a bien vu quelque chose bouger. Sans lui, un
  // observateur qui ne s'attache plus rendrait zéro et le test passerait au
  // vert en n'ayant rien regardé.
  expect(qui.length, "aucun déplacement relevé : la sonde ne mesure plus rien")
    .toBeGreaterThan(0);
  expect(lignes, `les lignes ont sauté de ${lignes.toFixed(3)} pendant que l'icône échouait :\n  ${qui.join("\n  ")}`)
    .toBeLessThan(0.01);
  await ctx.close();
});

test("une suppression refusée ne fait pas disparaître la partie", async ({ browser }) => {
  // C'était le pire des deux : la ligne quittait l'écran QUELLE QUE SOIT la
  // réponse. Une suppression refusée paraissait réussie, et la partie revenait
  // au rechargement suivant sans que rien ne l'explique.
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.addInitScript((u) => {
    try {
      sessionStorage.setItem("splash", "1");
      for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
        localStorage.setItem(c, "1");
      }
    } catch { /* stockage refusé */ }
  }, uid);

  await page.route("**/api/games/*", async (route) => {
    if (route.request().method() === "DELETE") {
      return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    }
    await route.continue();
  });

  await page.goto("/history", { waitUntil: "domcontentloaded" });
  await page.locator("tbody tr").first().waitFor({ state: "attached", timeout: 20_000 });

  const avant = await page.locator("tbody tr").count();
  expect(avant).toBeGreaterThan(0);

  await page.locator("tbody tr").first().getByRole("button", { name: /supprimer|delete|✕|×/i })
    .first().click();

  await expect(page.getByRole("alert").filter({ hasText: /n.a pas abouti|did not go through/i }))
    .toBeVisible({ timeout: 10_000 });
  // Et la ligne est toujours là : c'est la base qui tranche, pas l'écran.
  expect(await page.locator("tbody tr").count()).toBe(avant);
  await ctx.close();
});

/**
 * Corriger le résultat d'une partie.
 *
 * La détection locale a enregistré des victoires en défaites tant qu'elle
 * inventait l'issue manquante. Ces parties existent, elles portent une dette
 * qui n'était pas due, et la seule façon de la reprendre était de supprimer la
 * partie — c'est-à-dire de la perdre pour corriger une lettre.
 *
 * Les tests de route disent ce que le barème rend. Ils ne disent rien du
 * branchement : que le crayon ouvre le choix, que le choix appelle la route,
 * et que l'écran ne bouge que si la base a bougé. Un branchement se vérifie en
 * marchant dessus.
 */
test("corriger une défaite en victoire rejoue le barème", async ({ browser }) => {
  const { ctx, page } = await historique(browser, 1280);

  const avant = await (await page.request.get("/api/games")).json();
  const kog = avant.find((g: { champion: string }) => g.champion === "Kog'Maw");
  expect(kog.result).toBe("D");

  const ligne = page.locator("tbody tr").filter({ hasText: "Kog'Maw" }).first();
  await ligne.getByRole("button", { name: /corriger le résultat|correct the result/i }).click();
  await ligne.getByRole("button", { name: /^victoire$|^victory$/i }).click();

  /**
   * On attend que l'ÉDITEUR se referme, pas que « Victoire » paraisse.
   *
   * La première version attendait le texte, et il était déjà là : c'est le
   * libellé du bouton de choix qu'on venait de cliquer. L'attente se résolvait
   * donc instantanément, avant même que la requête soit partie, et la lecture
   * en base qui suit portait sur l'état d'avant.
   *
   * Ça passait ici et tombait en intégration continue, où la requête met plus
   * longtemps que la lecture qui la suit. Un test vert sur une machine rapide
   * et rouge sur une machine lente ne dit pas que la machine lente a tort : il
   * dit que le test n'attendait rien.
   *
   * L'éditeur ne se referme QUE si la base a répondu — c'est le seul signal
   * qui prouve que la correction est partie.
   */
  await expect(ligne.locator(".choix-resultat").first()).toBeHidden({ timeout: 15_000 });
  await expect(ligne.getByText(/^victoire$|^victory$/i)).toBeVisible();

  // Et la base le dit aussi. Sans ce second contrôle, un écran qui se contente
  // de réécrire la lettre chez lui passerait le test.
  const apres = await (await page.request.get("/api/games")).json();
  const corrigee = apres.find((g: { id: string }) => g.id === kog.id);
  expect(corrigee.result).toBe("V");
  // Le coût a suivi : une victoire ne se paie pas comme une défaite. Un champ
  // réécrit sans recalcul laisserait le même nombre.
  expect(corrigee.pompesCalculees).toBeLessThan(kog.pompesCalculees);
  await ctx.close();
});

test("une correction refusée ne change rien à l'écran", async ({ browser }) => {
  const { ctx, page } = await historique(browser, 1280);

  await page.route("**/api/games/*", async (route) => {
    if (route.request().method() === "PATCH") {
      return route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
    }
    await route.continue();
  });

  const ligne = page.locator("tbody tr").filter({ hasText: "Maître Yi" }).first();
  await ligne.getByRole("button", { name: /corriger le résultat|correct the result/i }).click();
  await ligne.getByRole("button", { name: /^victoire$|^victory$/i }).click();

  await expect(page.getByRole("alert").filter({ hasText: /n.a pas abouti|did not go through/i }))
    .toBeVisible({ timeout: 10_000 });
  // La ligne reste une défaite : c'est la base qui tranche, pas l'écran.
  const apres = await (await page.request.get("/api/games")).json();
  expect(apres.find((g: { champion: string }) => g.champion === "Maître Yi").result).toBe("D");
  await ctx.close();
});

/**
 * La place de la liste, réservée avant qu'elle n'arrive.
 *
 * L'historique affichait un « Chargement… » d'une ligne, le pied de page se
 * posait juste dessous, et tout ce qui était visible sautait quand les parties
 * arrivaient : **0,252 de déplacement cumulé** mesuré sur soixante parties,
 * pour un seuil de 0,1. C'est le défaut déjà corrigé sur le tableau de bord, à
 * 0,148 — et il a vécu ici parce que toutes les campagnes tournaient sur un
 * compte VIDE, où une liste sans ligne ne pousse rien.
 *
 * Le contrôle ne mesure pas le déplacement, qui dépend des polices et de
 * l'ordre des ressources : il mesure la RÉSERVE, qui est la cause. La page
 * pendant le chargement doit faire à peu près la hauteur qu'elle aura une fois
 * remplie.
 */
test("la liste réserve sa place pendant le chargement", async ({ browser }) => {
  const ctx = await browser.newContext({ storageState: etat, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.addInitScript((u) => {
    try {
      sessionStorage.setItem("splash", "1");
      for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) {
        localStorage.setItem(c, "1");
      }
    } catch { /* stockage refusé */ }
  }, uid);

  // La réponse est retenue le temps de mesurer l'écran d'attente. Sans ce
  // délai, la liste arrive avant qu'on ait pu regarder.
  await page.route("**/api/games**", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });

  await page.goto("/history", { waitUntil: "domcontentloaded" });
  await page.locator("[data-attente='historique']").waitFor({ timeout: 15_000 });
  const enAttente = await page.evaluate(() => document.body.scrollHeight);

  // Le squelette qui s'efface est le seul marqueur qui vaille des deux côtés :
  // à 1280 px les cartes existent dans le DOM mais la feuille de style les
  // cache, donc chercher un champion tomberait sur un élément invisible.
  await page.locator("[data-attente='historique']").waitFor({ state: "detached", timeout: 20_000 });
  await page.locator("table").first().waitFor({ timeout: 10_000 });
  const remplie = await page.evaluate(() => document.body.scrollHeight);

  // Sans réserve, l'écran d'attente fait un quart de la page remplie et le
  // pied saute de plusieurs centaines de pixels. La marge est large à dessein :
  // c'est l'ordre de grandeur qui compte, pas une hauteur au pixel.
  expect(enAttente).toBeGreaterThan(remplie * 0.6);
  await ctx.close();
});

/**
 * Le message d'historique vide part AVEC LA RÉPONSE, pas après hydratation.
 *
 * Mesuré le 4 septembre : pour un compte NEUF, ce message était le plus grand
 * élément de la page, et il attendait le paquet JavaScript puis un aller-retour
 * vers `/api/games` — 2 940 ms sur téléphone bridé, contre 900 une fois rendu
 * au serveur.
 *
 * Le contrôle lit le HTML SERVI et non la page rendue : une fois hydratée, elle
 * afficherait le message dans les deux cas, et le test ne prouverait rien. C'est
 * la leçon déjà écrite pour le premier écran du tableau de bord.
 */
test("un historique vide dit quoi faire dès le HTML servi", async ({ browser }) => {
  const { etat } = await ouvrirCompte(browser, "Vide");
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();

  const reponse = await page.goto("/fr/history");
  const html = await reponse!.text();
  // Sans apostrophe : le HTML servi les échappe en `&#x27;`, et un contrôle
  // écrit avec le caractère lisible échouerait sur du texte pourtant présent.
  expect(html).toContain("depuis le tableau de bord");

  await ctx.close();
});
