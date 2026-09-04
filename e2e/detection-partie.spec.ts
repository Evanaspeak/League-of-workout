import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";

/**
 * Ce que la détection locale enregistre, et surtout ce qu'elle n'enregistre
 * plus.
 *
 * Elle écrivait une défaite chaque fois que l'événement de fin n'avait pas pu
 * être lu — et cette lecture est une course, gagnée ou perdue selon l'instant
 * du dernier relevé. Toutes les courses perdues tombaient du même côté : une
 * défaite prise pour une défaite ne se voit pas, une victoire prise pour une
 * défaite fait payer une dette qu'on ne doit pas.
 *
 * Le pont Electron se simule : ce qu'on éprouve est la réaction du composant,
 * pas Electron. `addInitScript` le pose avant que la page ne s'exécute, ce qui
 * est aussi l'ordre réel — le préchargement passe avant le rendu.
 */
test.describe.configure({ mode: "serial" });

let etat: import("@playwright/test").BrowserContextOptions["storageState"];

/** Pose un faux pont, et retient ce que l'application dit en jeu. */
const poserPont = () => {
  const w = window as unknown as {
    electronLOL?: unknown;
    __finPartie?: (p: unknown) => void;
    __dits?: string[];
  };
  w.__dits = [];
  w.electronLOL = {
    onPartieTerminee: (rappel: (p: unknown) => void) => {
      w.__finPartie = rappel;
      return () => {};
    },
    /**
     * Les phases du lanceur : c'est par là que la question arrive à CHAQUE
     * partie de League, et non une seule fois au lancement du jeu.
     *
     * Une LISTE d'abonnés, et non un seul : deux composants écoutent ce canal
     * — la détection de session et le calcul de dette en direct. Un emplacement
     * unique gardait le dernier inscrit, donc le test poussait ses phases au
     * mauvais composant et rien ne se passait. Le vrai pont diffuse à tous.
     */
    onPhase: (rappel: (p: unknown) => void) => {
      const w2 = w as unknown as { __phases?: Array<(p: unknown) => void> };
      w2.__phases = [...(w2.__phases ?? []), rappel];
      return () => {};
    },
    /** La question, et la réponse qu'on lui fait dire depuis le test. */
    overlayDemander: async () =>
      (w as unknown as { __reponse?: boolean | null }).__reponse ?? null,
    overlayMasquerPartie: async () => true,
    notifier: (titre: string, corps: string) => { w.__dits!.push(`${titre} | ${corps}`); },
  };
};

async function ouvrirSurLApplication(browser: import("@playwright/test").Browser) {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.addInitScript(poserPont);
  await page.goto("/dashboard");
  // Le composant est chargé à la demande : il n'écoute qu'une fois son module
  // arrivé. Le guetter est la seule façon de ne pas tirer dans le vide.
  await page.waitForFunction(
    () => typeof (window as unknown as { __finPartie?: unknown }).__finPartie === "function",
    null, { timeout: 30_000 },
  );
  return { ctx, page };
}

const partie = (resultat: string | null, extra: Record<string, unknown> = {}) => ({
  // Le champion sert de signature : il ne suffit pas de compter, il faut
  // pouvoir dire QUELLE partie a été écrite. Un compte inchangé peut cacher
  // une partie écrite et une autre perdue.
  score: { kills: 8, deaths: 3, assists: 11, cs: 180, champion: "Ahri" },
  resultat,
  dureeSec: 1800,
  contexte: { file: { nom: "Classée Solo/Duo", classee: true }, role: "Mid" },
  ...extra,
});

async function nombreDeParties(ctx: import("@playwright/test").BrowserContext) {
  const res = await ctx.request.get("/api/games");
  expect(res.status()).toBe(200);
  const corps = await res.json();
  const liste = Array.isArray(corps) ? corps : (corps.games ?? []);
  return liste as Array<{
    result: string; champion: string | null; role: string | null;
    sansEnjeu?: boolean; pompesCalculees?: number;
  }>;
}

test("ouvrir un compte", async ({ browser }) => {
  etat = (await ouvrirCompte(browser, "Det")).etat;
});

test("une victoire lue s'enregistre en victoire", async ({ browser }) => {
  const { ctx, page } = await ouvrirSurLApplication(browser);
  await page.evaluate((p) =>
    (window as unknown as { __finPartie: (x: unknown) => void }).__finPartie(p), partie("V"));

  await expect.poll(async () => (await nombreDeParties(ctx)).length, { timeout: 20_000 }).toBe(1);
  const [game] = await nombreDeParties(ctx);
  expect(game.result).toBe("V");
  await ctx.close();
});

test("une issue illisible n'enregistre rien, et le dit", async ({ browser }) => {
  const { ctx, page } = await ouvrirSurLApplication(browser);
  const avant = (await nombreDeParties(ctx)).length;

  await page.evaluate((p) =>
    (window as unknown as { __finPartie: (x: unknown) => void }).__finPartie(p), partie(null));

  // La notification est le seul signal : sans elle, la partie disparaîtrait en
  // silence, ce qui est l'autre façon de se tromper.
  await expect.poll(
    () => page.evaluate(() => (window as unknown as { __dits: string[] }).__dits),
    { timeout: 15_000 },
  ).not.toHaveLength(0);

  // Et le message porte les chiffres : sans eux, « ajoute la partie à la main »
  // demande de se rappeler un KDA qu'on vient de quitter.
  const dit = (await page.evaluate(() => (window as unknown as { __dits: string[] }).__dits)).join(" ");
  expect(dit).toContain("Ahri");
  expect(dit).toContain("8/3/11");
  expect(dit).toContain("30 min");

  // Et surtout : rien n'a été écrit. C'est le défaut d'origine.
  expect((await nombreDeParties(ctx)).length).toBe(avant);
  await ctx.close();
});

test("une partie sans aucun relevé n'enregistre rien, et le dit", async ({ browser }) => {
  // Le cas est atteignable : la boucle de détection passe « en partie » dès sa
  // première lecture réussie, et ne garde un relevé que s'il porte un score.
  // Un joueur que l'API locale ne sait pas identifier dans sa propre partie
  // finit donc ici. Le composant retournait alors sans rien dire : la partie
  // était bien jouée, elle n'entrait pas, et personne ne l'apprenait. Le même
  // défaut que l'issue illisible, un cran plus haut.
  const { ctx, page } = await ouvrirSurLApplication(browser);
  const avant = (await nombreDeParties(ctx)).length;

  await page.evaluate((p) =>
    (window as unknown as { __finPartie: (x: unknown) => void }).__finPartie(p),
    { ...partie("V"), score: null });

  await expect.poll(
    () => page.evaluate(() => (window as unknown as { __dits: string[] }).__dits),
    { timeout: 15_000 },
  ).not.toHaveLength(0);

  // Rien n'a été écrit : c'est bien le silence qu'on corrige, pas le refus.
  expect((await nombreDeParties(ctx)).length).toBe(avant);
  await ctx.close();
});

test("un remake n'enregistre rien, et ne dit rien", async ({ browser }) => {
  const { ctx, page } = await ouvrirSurLApplication(browser);
  const avant = (await nombreDeParties(ctx)).length;

  await page.evaluate((p) =>
    (window as unknown as { __finPartie: (x: unknown) => void }).__finPartie(p),
    { ...partie(null, { motifSansResultat: "remake" }),
      score: { kills: 1, deaths: 1, assists: 1, cs: 10, champion: "Zed" } });

  // Rien à dire : une partie annulée n'est ni une victoire ni une défaite, et
  // la personne le sait déjà. On laisse le temps à un message de paraître pour
  // que l'absence soit une absence, pas une mesure prise trop tôt.
  await page.waitForTimeout(5_000);
  expect(await page.evaluate(() => (window as unknown as { __dits: string[] }).__dits)).toHaveLength(0);
  const apres = await nombreDeParties(ctx);
  expect(apres.map((g) => g.champion)).not.toContain("Zed");
  expect(apres.length).toBe(avant);
  await ctx.close();
});

test("le rôle donné par le lanceur est retenu pour les parties suivantes", async ({ browser }) => {
  // Le repli n'était alimenté que par la saisie manuelle : quelqu'un qui ne
  // joue qu'avec la détection automatique retombait toujours sur la constante,
  // quel que soit son rôle. Or un support compté comme jungler paie ses morts
  // trois points au lieu de deux et deux dixièmes.
  const { ctx, page } = await ouvrirSurLApplication(browser);

  await page.evaluate((p) =>
    (window as unknown as { __finPartie: (x: unknown) => void }).__finPartie(p),
    { ...partie("V"), contexte: { file: { nom: "Classée Solo/Duo", classee: true }, role: "Support" } });

  await expect.poll(
    () => page.evaluate(() => { try { return localStorage.getItem("lastRole"); } catch { return null; } }),
    { timeout: 15_000 },
  ).toBe("Support");

  // Et la partie suivante, sans rôle au contexte, l'emploie.
  await page.evaluate((p) =>
    (window as unknown as { __finPartie: (x: unknown) => void }).__finPartie(p),
    { ...partie("D"), contexte: null,
      score: { kills: 1, deaths: 9, assists: 14, cs: 20, champion: "Lulu" } });

  await expect.poll(async () => {
    const parties = await nombreDeParties(ctx);
    return parties.find((g) => g.champion === "Lulu")?.role ?? null;
  }, { timeout: 20_000 }).toBe("Support");

  await ctx.close();
});

test("une partie que le serveur refuse le dit, au lieu de disparaître", async ({ browser }) => {
  // C'est le chemin principal du produit : une session expirée, une valeur
  // hors bornes, une configuration absente, et la soirée ne comptait pas sans
  // que rien ne le dise. Le commentaire invoquait le suivi de session comme
  // filet de sécurité ; sans clé Riot de production, ce filet n'existe pas.
  const { ctx, page } = await ouvrirSurLApplication(browser);
  const avant = (await nombreDeParties(ctx)).length;

  /**
   * Le détournement se COMPTE, et c'est ce qui distingue les deux échecs.
   *
   * Ce test est tombé une fois en intégration continue avec « Partie
   * terminée » à la place du refus — c'est-à-dire le message du SUCCÈS. Sans
   * compteur, ça se lit comme « la route ne dit plus son motif », et on va
   * chercher le défaut dans la route ; la vérité était que l'interception
   * n'avait pas pris et que la vraie route avait répondu. Deux causes, un seul
   * symptôme, et neuf minutes perdues du mauvais côté.
   */
  let detourne = 0;
  await page.route("**/api/games", async (route) => {
    if (route.request().method() === "POST") {
      detourne += 1;
      return route.fulfill({
        status: 400, contentType: "application/json",
        body: JSON.stringify({ error: "Rôle inconnu" }),
      });
    }
    await route.continue();
  });

  await page.evaluate((p) =>
    (window as unknown as { __finPartie: (x: unknown) => void }).__finPartie(p),
    { ...partie("V"), score: { kills: 3, deaths: 3, assists: 3, cs: 90, champion: "Yasuo" } });

  await expect.poll(
    () => page.evaluate(() => (window as unknown as { __dits: string[] }).__dits),
    { timeout: 15_000 },
  ).not.toHaveLength(0);

  // Le motif rendu par la route accompagne le message : « refusé » tout seul
  // n'apprend rien.
  const dit = (await page.evaluate(() => (window as unknown as { __dits: string[] }).__dits)).join(" ");
  // D'abord la cause, ensuite le symptôme : à zéro, c'est le détournement qui
  // a manqué, et le message n'apprend rien.
  expect({ detourne, dit }).toMatchObject({ detourne: 1 });
  expect(dit).toMatch(/Rôle inconnu/);
  expect((await nombreDeParties(ctx)).length).toBe(avant);
  await ctx.close();
});

/**
 * Une partie refusée à l'écran de chargement.
 *
 * Ce que les tests unitaires ne voient pas : que le refus SURVIT entre les
 * deux composants. La question se pose au démarrage, l'enregistrement se fait
 * à la fin, et la page peut se recharger entre les deux. Le souvenir passe par
 * le stockage — trois endroits où il peut se perdre sans que rien ne le dise,
 * puisqu'une partie sans enjeu s'enregistre exactement comme une autre.
 */
test("une partie refusée s'enregistre sans enjeu, et ne crée pas de dette", async ({ browser }) => {
  const { ctx, page } = await ouvrirSurLApplication(browser);

  // Le refus, tel que `DetectionSession` l'écrit.
  await page.evaluate(() => {
    localStorage.setItem("low_partie_sans_enjeu", JSON.stringify({ le: Date.now() }));
  });

  // Et le rechargement, qui est précisément ce que l'état React ne survivrait
  // pas — c'est la raison pour laquelle le souvenir vit dans le stockage.
  await page.reload();
  await page.waitForFunction(
    () => typeof (window as unknown as { __finPartie?: unknown }).__finPartie === "function",
    null, { timeout: 30_000 },
  );

  await page.evaluate((p) => {
    (window as unknown as { __finPartie: (x: unknown) => void }).__finPartie(p);
  }, partie("D", { score: { kills: 1, deaths: 9, assists: 2, cs: 40, champion: "Zed" } }));

  await expect.poll(
    async () => (await nombreDeParties(ctx)).some((g) => g.champion === "Zed"),
    { timeout: 20_000 },
  ).toBe(true);
  const ligne = (await nombreDeParties(ctx)).find((g) => g.champion === "Zed")!;
  expect({ sansEnjeu: ligne.sansEnjeu, points: ligne.pompesCalculees })
    .toEqual({ sansEnjeu: true, points: 0 });

  // Le souvenir est consommé : la partie suivante compte normalement.
  const reste = await page.evaluate(() => localStorage.getItem("low_partie_sans_enjeu"));
  expect(reste).toBeNull();

  await ctx.close();
});

/**
 * La question est posée à CHAQUE partie de League, et pas au lancement du jeu.
 *
 * `onJeuDetecte` regarde la liste des processus : il se déclenche quand League
 * s'ouvre, une fois, et plus jamais tant que le client tourne. On enchaînait
 * donc trois parties avec une seule question — un refus ne portait que sur la
 * première, et les deux suivantes s'enregistraient normalement. C'est ce qui a
 * été signalé, et aucun test ne l'aurait vu : celui du sans-enjeu posait la
 * marque à la main au lieu de cliquer « non ».
 */
test("refuser vaut pour la partie refusée, et pour chacune séparément", async ({ browser }) => {
  /**
   * Un compte à lui : les huit tests qui précèdent partagent celui du fichier,
   * et sa session ne répondait plus quand celui-ci s'exécutait — `/api/settings`
   * rendait la page de connexion, donc la question n'était jamais posée. Un
   * test qui dépend de l'état laissé par ceux d'avant échoue pour une raison
   * qui n'a rien à voir avec ce qu'il éprouve.
   */
  const propre = (await ouvrirCompte(browser, "Phase")).etat;
  const ctx = await browser.newContext({ storageState: propre });
  const page = await ctx.newPage();
  await page.addInitScript(poserPont);
  await page.goto("/dashboard");
  await page.waitForFunction(
    () => ((window as unknown as { __phases?: unknown[] }).__phases ?? []).length >= 2,
    null, { timeout: 30_000 },
  );

  const phase = (p: string) => page.evaluate((valeur) => {
    for (const f of (window as unknown as { __phases: Array<(x: unknown) => void> }).__phases) {
      f({ phase: valeur, file: null, role: "Mid" });
    }
  }, p);

  const repondre = (v: boolean | null) => page.evaluate((valeur) => {
    (window as unknown as { __reponse: boolean | null }).__reponse = valeur;
  }, v);

  // Première partie : refusée.
  await repondre(false);
  await phase("ChampSelect");
  await phase("GameStart");
  await page.waitForFunction(
    () => localStorage.getItem("low_partie_sans_enjeu") !== null,
    null, { timeout: 15_000 },
  );
  await page.evaluate((p) => {
    (window as unknown as { __finPartie: (x: unknown) => void }).__finPartie(p);
  }, partie("D", { score: { kills: 1, deaths: 9, assists: 2, cs: 40, champion: "Zed" } }));

  await expect.poll(
    async () => (await nombreDeParties(ctx)).find((g) => g.champion === "Zed")?.sansEnjeu,
    { timeout: 20_000 },
  ).toBe(true);

  /**
   * Seconde partie, SANS relancer le jeu : c'est le cas qui a été signalé. La
   * phase repasse par le menu puis revient en partie ; la question doit être
   * reposée, et une réponse différente doit produire un résultat différent.
   */
  await repondre(true);
  await phase("None");
  await phase("GameStart");
  await page.waitForFunction(
    () => localStorage.getItem("low_partie_sans_enjeu") === null,
    null, { timeout: 15_000 },
  );
  await page.evaluate((p) => {
    (window as unknown as { __finPartie: (x: unknown) => void }).__finPartie(p);
  }, partie("D", { score: { kills: 3, deaths: 4, assists: 5, cs: 90, champion: "Jinx" } }));

  await expect.poll(
    async () => (await nombreDeParties(ctx)).find((g) => g.champion === "Jinx")?.sansEnjeu,
    { timeout: 20_000 },
  ).toBe(false);

  await ctx.close();
});
