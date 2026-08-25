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
  return liste as Array<{ result: string; champion: string | null; role: string | null }>;
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
