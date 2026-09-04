import { test, expect, type Page } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { viderLesFenetres } from "./intro";
import { compter } from "./base";
import { defiDuJour } from "../src/lib/defiQuotidien";
import { XP_DEFI_JOUR } from "../src/lib/xpDefis";

/**
 * L'XP des défis personnels, de l'écran jusqu'à la base et retour.
 *
 * Ce que les tests de route ne peuvent PAS voir, et qui fait tout l'objet de
 * ce fichier : que la ligne écrite existe vraiment, qu'elle ne peut pas
 * s'écrire deux fois, et que l'XP repart de la base au chargement suivant. La
 * doublure de base rend ce qu'on lui dit de rendre ; l'unicité, elle, est une
 * propriété de PostgreSQL, posée par une migration, et c'est exactement le
 * genre de chose qu'une migration peut rater sans que rien ne le dise.
 *
 * Le défi du jour est décidé par le JOUR, donc il change tous les jours. Un
 * parcours écrit contre un défi précis passerait au vert cinq jours sur six en
 * n'éprouvant rien : celui-ci lit le défi du jour et le remplit, quel qu'il
 * soit.
 */

const LIGNES_DU_JOUR = `SELECT count(*)::text AS n FROM "DefiAccompli" d
  JOIN "User" u ON u.id = d."userId" WHERE u.pseudo = $1 AND d.periode = $2`;

/** Le jour local du navigateur, sous la forme que la route attend. */
function jourLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function partie(page: Page, jeu: string, result: "V" | "D") {
  const r = await page.request.post("/api/games", {
    data: {
      jeu, role: "Mid", champion: "Ahri",
      kills: result === "V" ? 8 : 0, deaths: result === "V" ? 1 : 12, assists: 1, result,
    },
  });
  expect(r.status(), await r.text()).toBe(200);
}

/** Ce que rend la route, réduit à ce qu'on regarde ici. */
type Progression = {
  defi: { cle: string; ou: number; cible: number; fait: boolean };
  badges: { niveau: { xp: number } };
};

async function progression(page: Page, jour: string): Promise<Progression> {
  const r = await page.request.get(`/api/progression?jour=${jour}`);
  expect(r.status(), await r.text()).toBe(200);
  return await r.json() as Progression;
}

test("un défi du jour rempli se retient une fois, et son XP revient de la base", async ({ browser }) => {
  const { etat, compte } = await ouvrirCompte(browser, "Defi", { consentement: true });
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  await viderLesFenetres(page);

  const jour = jourLocal();
  const defi = defiDuJour(jour);

  // Rien n'est retenu au départ : sans ce point de comparaison, un compte qui
  // porterait déjà une ligne rendrait le contrôle final vrai sans rien prouver.
  expect(await compter(LIGNES_DU_JOUR, [compte.pseudo, jour])).toBe(0);

  /**
   * Remplir le défi du jour, quel qu'il soit.
   *
   * Les deux mesures qui portent sur un paiement passent par une dette qu'on
   * fait monter puis qu'on solde : c'est la boucle du produit, et depuis que
   * les pompes l'alimentent, elle marche sur le compte par défaut.
   */
  if (defi.mesure === "points" || defi.mesure === "seances") {
    for (let i = 0; i < 30; i += 1) {
      await partie(page, "League of Legends", "D");
      const dette = await (await page.request.get("/api/dette")).json() as { points: number };
      if (dette.points >= defi.cible) break;
    }
    const paye = await page.request.patch("/api/dette", { data: { tout: true, jour } });
    expect(paye.status(), await paye.text()).toBe(200);
  } else if (defi.mesure === "jeux") {
    const jeux = ["League of Legends", "Apex Legends", "Valorant", "Rocket League"];
    for (let i = 0; i < defi.cible; i += 1) await partie(page, jeux[i % jeux.length], "D");
  } else {
    const issue = defi.mesure === "victoires" ? "V" : "D";
    for (let i = 0; i < defi.cible; i += 1) await partie(page, "League of Legends", issue);
  }

  /**
   * Le premier appel CONSTATE que le défi est rempli et écrit la ligne — mais
   * il a lu la somme d'XP AVANT de l'écrire. Son chiffre ne porte donc pas
   * encore les cinquante points, et c'est ce décalage qui rend le contrôle
   * suivant possible : il compare deux lectures dont la seule différence est
   * un aller-retour par la base.
   */
  const premier = await progression(page, jour);
  expect({ cle: premier.defi.cle, fait: premier.defi.fait })
    .toEqual({ cle: defi.cle, fait: true });

  await expect.poll(
    () => compter(LIGNES_DU_JOUR, [compte.pseudo, jour]),
    { timeout: 10_000, message: "aucune ligne DefiAccompli écrite pour le défi rempli" },
  ).toBe(1);

  // L'XP revient de la base, et elle a monté d'exactement ce que vaut un défi
  // du jour. Rien d'autre n'a bougé entre les deux appels.
  const second = await progression(page, jour);
  expect(second.badges.niveau.xp).toBe(premier.badges.niveau.xp + XP_DEFI_JOUR);

  /**
   * Et le troisième appel ne redonne RIEN.
   *
   * C'est le contrôle qui ne peut se faire qu'ici : l'unicité est posée par la
   * migration, sur le couple compte-défi-période. Sans elle, chaque chargement
   * d'un écran connecté ajouterait cinquante points d'XP, et le niveau
   * monterait tout seul tant qu'on laisse un onglet ouvert.
   */
  const troisieme = await progression(page, jour);
  expect(troisieme.badges.niveau.xp).toBe(second.badges.niveau.xp);
  expect(await compter(LIGNES_DU_JOUR, [compte.pseudo, jour])).toBe(1);

  await ctx.close();
});
