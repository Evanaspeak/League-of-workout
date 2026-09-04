import { test, expect } from "@playwright/test";
import { ouvrirCompte } from "./compte";
import { viderLesFenetres } from "./intro";
import { compter, requeteSql } from "./base";

/**
 * Les amis et les groupes, de bout en bout.
 *
 * Les tests unitaires disent ce que chaque route décide. Ils ne peuvent rien
 * dire de ce qui se joue ENTRE DEUX COMPTES : que la demande arrive vraiment
 * chez l'autre, qu'elle disparaisse de chez soi quand il accepte, et qu'un
 * code tiré par l'un ouvre le groupe de l'autre. C'est la seule chose qu'un
 * seul contexte de navigateur ne sait pas éprouver.
 *
 * Chaque contrôle regarde l'ÉCRAN et la BASE. Sans le second, un écran qui se
 * contente d'afficher ce qu'on vient de taper passerait le test.
 */

const LIEN = `
  SELECT a.id, a.etat, a."accepteeLe" FROM "Amitie" a
  JOIN "User" d ON d.id = a."demandeurId"
  JOIN "User" r ON r.id = a."receveurId"
  WHERE d.pseudo = $1 AND r.pseudo = $2`;

/**
 * La visite guidée NAVIGUE d'une page à l'autre : on vide les fenêtres depuis
 * la page d'arrivée, puis on va où l'on va. Traversée depuis `/amis`, elle
 * renverrait sur le tableau de bord et le test expirerait sur une page
 * parfaitement normale.
 */
async function ouvrirEcranAmis(
  browser: import("@playwright/test").Browser,
  etat: Awaited<ReturnType<import("@playwright/test").BrowserContext["storageState"]>>,
) {
  const ctx = await browser.newContext({ storageState: etat });
  const page = await ctx.newPage();
  await page.goto("/dashboard");
  await viderLesFenetres(page);
  await page.goto("/amis");
  // Si le titre manque, on dit OÙ l'on a atterri : « élément introuvable » sur
  // une page de connexion envoie chercher un défaut de l'écran des amis.
  await expect(page.getByRole("heading", { name: /tes amis|your friends/i }), 
    `écran des amis introuvable — page rendue : ${page.url()}`).toBeVisible();
  return { ctx, page };
}

test("une amitié se demande, arrive chez l'autre, et s'accepte", async ({ browser }) => {
  const a = await ouvrirCompte(browser, "Ami");
  const b = await ouvrirCompte(browser, "Pote");

  const { ctx: ctxA, page: pageA } = await ouvrirEcranAmis(browser, a.etat);

  await pageA.getByLabel(/son pseudo|their display name/i).fill(b.compte.pseudo);
  await pageA.getByRole("button", { name: /envoyer la demande|send request/i }).click();

  // L'écran le dit…
  await expect(pageA.getByText(/en attente de sa réponse|waiting for their answer/i)).toBeVisible();

  // …et la base l'a gardé, dans le bon sens.
  const [enBase] = await requeteSql<{ id: string; etat: string }>(LIEN, [a.compte.pseudo, b.compte.pseudo]);
  expect(enBase?.etat).toBe("attente");

  // Chez l'autre, c'est une demande REÇUE : c'est lui, et lui seul, qui répond.
  const { ctx: ctxB, page: pageB } = await ouvrirEcranAmis(browser, b.etat);
  const recues = pageB.getByRole("heading", { name: /demandes reçues|requests received/i });
  await expect(recues).toBeVisible();
  await pageB.getByRole("button", { name: /^accepter$|^accept$/i }).click();
  await expect(recues).toBeHidden();

  const [apres] = await requeteSql<{ etat: string; accepteeLe: Date | null }>(
    LIEN, [a.compte.pseudo, b.compte.pseudo]);
  expect(apres?.etat).toBe("acceptee");
  expect(apres?.accepteeLe).not.toBeNull();

  // Et de l'autre côté, la demande envoyée est devenue un ami.
  await pageA.reload();
  await expect(pageA.getByText(/en attente de sa réponse|waiting for their answer/i)).toBeHidden();
  await expect(pageA.getByText(new RegExp(b.compte.pseudo, "i")).first()).toBeVisible();

  await ctxA.close();
  await ctxB.close();
});

test("retirer un ami demande deux gestes, et efface la ligne", async ({ browser }) => {
  const a = await ouvrirCompte(browser, "Reti");
  const b = await ouvrirCompte(browser, "Rete");

  // L'amitié est posée par les routes : ce qu'on éprouve ici est le retrait.
  const ctxPoseA = await browser.newContext({ storageState: a.etat });
  await ctxPoseA.request.post("/api/amis", { data: { pseudo: b.compte.pseudo } });
  const [lien] = await requeteSql<{ id: string }>(LIEN, [a.compte.pseudo, b.compte.pseudo]);
  const ctxPoseB = await browser.newContext({ storageState: b.etat });
  await ctxPoseB.request.patch(`/api/amis/${lien.id}`);
  await ctxPoseA.close();
  await ctxPoseB.close();

  const { ctx, page } = await ouvrirEcranAmis(browser, a.etat);
  await expect(page.getByText(new RegExp(b.compte.pseudo, "i")).first()).toBeVisible();

  /**
   * Le premier clic ne retire rien.
   *
   * Deux gestes, pas une bascule : une frappe malheureuse sur la ligne d'à
   * côté ne doit pas défaire une amitié qu'il faudra redemander. C'est la
   * règle déjà posée pour la correction d'un résultat de partie.
   */
  await page.getByRole("button", { name: /^retirer$|^remove$/i }).click();
  await expect(page.getByText(/de tes amis \?|from your friends\?/i)).toBeVisible();
  expect(await compter('SELECT count(*) AS n FROM "Amitie" WHERE id = $1', [lien.id])).toBe(1);

  await page.getByRole("button", { name: /^retirer$|^remove$/i }).click();

  await expect(page.getByText(/personne pour l.instant|nobody yet/i)).toBeVisible();
  expect(await compter('SELECT count(*) AS n FROM "Amitie" WHERE id = $1', [lien.id])).toBe(0);

  await ctx.close();
});

test("un groupe créé par l'un se rejoint par son code chez l'autre", async ({ browser }) => {
  const a = await ouvrirCompte(browser, "Chef");
  const b = await ouvrirCompte(browser, "Memb");
  const nom = `Bras ${Date.now().toString(36)}`;

  const { ctx: ctxA, page: pageA } = await ouvrirEcranAmis(browser, a.etat);
  await pageA.getByLabel(/nom du groupe|group name/i).fill(nom);
  await pageA.getByRole("button", { name: /^créer$|^create$/i }).click();

  await expect(pageA.getByText(nom)).toBeVisible();
  await expect(pageA.getByText(/tu l.as créé|you created it/i)).toBeVisible();

  const [groupe] = await requeteSql<{ id: string; code: string }>(
    'SELECT id, code FROM "Groupe" WHERE nom = $1', [nom]);
  const seul = await requeteSql<{ role: string }>(
    'SELECT role FROM "MembreGroupe" WHERE "groupeId" = $1', [groupe.id]);
  expect(seul.map((m) => m.role)).toEqual(["proprietaire"]);

  /**
   * Le code se retape comme on l'a lu : en minuscules, avec un tiret.
   *
   * C'est la seule porte du groupe. La refuser pour une question de
   * présentation, c'est la fermer.
   */
  const { ctx: ctxB, page: pageB } = await ouvrirEcranAmis(browser, b.etat);
  const tapeALaMain = `${groupe.code.slice(0, 4).toLowerCase()}-${groupe.code.slice(4)}`;
  await pageB.getByLabel(/code d.invitation|invite code/i).fill(tapeALaMain);
  await pageB.getByRole("button", { name: /^rejoindre$|^join$/i }).click();

  await expect(pageB.getByText(nom)).toBeVisible();
  await expect(pageB.getByText(/tu l.as créé|you created it/i)).toBeHidden();

  const membres = await requeteSql<{ role: string }>(
    'SELECT role FROM "MembreGroupe" WHERE "groupeId" = $1', [groupe.id]);
  expect(membres).toHaveLength(2);
  expect(membres.filter((m) => m.role === "proprietaire")).toHaveLength(1);

  await ctxA.close();
  await ctxB.close();
});

test("un code refusé ne change rien, et l'écran le dit", async ({ browser }) => {
  const a = await ouvrirCompte(browser, "Faux");
  const { ctx, page } = await ouvrirEcranAmis(browser, a.etat);

  // Huit caractères de l'alphabet, donc un code de la bonne FORME : c'est le
  // serveur qui refuse, pas la saisie.
  await page.getByLabel(/code d.invitation|invite code/i).fill("ZZZZZZZZ");
  await page.getByRole("button", { name: /^rejoindre$|^join$/i }).click();

  await expect(page.getByText(/aucun groupe pour ce code|no group for that code/i)).toBeVisible();
  await expect(page.getByText(/aucun groupe\.|no groups\./i)).toBeVisible();
  expect(await compter(
    'SELECT count(*) AS n FROM "MembreGroupe" m JOIN "User" u ON u.id = m."userId" WHERE u.pseudo = $1',
    [a.compte.pseudo],
  )).toBe(0);

  await ctx.close();
});

/**
 * Le classement, et ce qu'il faut DEUX comptes pour éprouver.
 *
 * Les tests unitaires disent ce que `classer` ordonne et ce que la route lit.
 * Ils ne disent rien de la seule chose qui compte ici : que l'effort payé par
 * QUELQU'UN D'AUTRE remonte bien jusqu'à mon écran, et que celui d'un inconnu
 * n'y remonte pas.
 *
 * Les paiements sont posés en base plutôt que faits à l'écran. Ce que ce test
 * éprouve est la lecture croisée, pas le décompte de dette — qui a son propre
 * parcours, et qui coûterait ici deux séances chronométrées.
 */
const PAYER = `INSERT INTO "Paiement" (id, "userId", points, jour)
  SELECT $1, id, $2, $3 FROM "User" WHERE pseudo = $4`;

/**
 * Un identifiant par exécution.
 *
 * Des identifiants fixes marchent tant que la préparation purge les comptes
 * `@example.test` avant chaque suite — ce qu'elle fait. Mais l'insertion
 * tomberait sur une clé en double le jour où l'ordre change, et l'échec
 * ressemblerait à un défaut du classement plutôt qu'à un reste de la veille.
 */
const jeton = () => `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const jourLocalTest = (recul = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - recul);
  const deux = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
};

test("le classement compte l'effort payé par l'autre, et pas celui d'un inconnu", async ({ browser }) => {
  const a = await ouvrirCompte(browser, "Rang");
  const b = await ouvrirCompte(browser, "Duel");
  const c = await ouvrirCompte(browser, "Tiers");

  // A et B deviennent amis : B demande, A accepte.
  const { ctx: ctxB, page: pageB } = await ouvrirEcranAmis(browser, b.etat);
  await pageB.getByLabel(/son pseudo|their display name/i).fill(a.compte.pseudo);
  await pageB.getByRole("button", { name: /envoyer la demande|send request/i }).click();
  await expect(pageB.getByText(/en attente de sa réponse|waiting for their answer/i)).toBeVisible();
  await ctxB.close();

  const { ctx: ctxA, page: pageA } = await ouvrirEcranAmis(browser, a.etat);
  await pageA.getByRole("button", { name: /^accepter$|^accept$/i }).click();
  await expect(pageA.getByRole("button", { name: /^accepter$|^accept$/i })).toHaveCount(0);

  // B paie plus que A ; C, qui n'est l'ami de personne, paie davantage encore.
  await requeteSql(PAYER, [jeton(), 40, jourLocalTest(), a.compte.pseudo]);
  await requeteSql(PAYER, [jeton(), 150, jourLocalTest(2), b.compte.pseudo]);
  await requeteSql(PAYER, [jeton(), 9000, jourLocalTest(), c.compte.pseudo]);
  /**
   * Et un paiement de B hors fenêtre. Sans lui, une route qui ignorerait la
   * borne basse rendrait exactement le même classement : le test passerait en
   * n'éprouvant pas la fenêtre.
   */
  await requeteSql(PAYER, [jeton(), 5000, jourLocalTest(30), b.compte.pseudo]);

  await pageA.reload();
  const tableau = pageA.getByRole("table");
  await expect(tableau).toBeVisible();

  /**
   * La borne est lue à la source AVANT de regarder l'écran, et c'est un choix
   * de diagnostic.
   *
   * Une exécution complète a rendu une fois « 5150 » ici — le paiement hors
   * fenêtre compté — sans que l'échec dise si la borne basse avait bougé, si
   * le jour envoyé était le bon, ou si le serveur servait un `.next` d'avant.
   * Un nombre faux à l'écran ne se diagnostique pas ; la borne qui l'a produit,
   * si. C'est la leçon déjà écrite pour `performance.mjs` : un chiffre sans
   * nom n'apprend rien.
   */
  const brut = await pageA.evaluate(async (jour: string) => {
    const res = await fetch(`/api/classement?jour=${jour}`);
    return res.json() as Promise<{ debut: string; jours: number }>;
  }, jourLocalTest());
  expect({ debut: brut.debut, jours: brut.jours })
    .toEqual({ debut: jourLocalTest(6), jours: 7 });

  // L'ordre est celui de l'effort payé sur la fenêtre : B (150) devant A (40).
  const lignes = tableau.locator("tbody tr");
  await expect(lignes).toHaveCount(2);
  await expect(lignes.nth(0)).toContainText(b.compte.pseudo);
  await expect(lignes.nth(0)).toContainText("150");
  await expect(lignes.nth(1)).toContainText(a.compte.pseudo);
  await expect(lignes.nth(1)).toContainText("40");

  // Le tiers n'a rien demandé à personne : il n'apparaît nulle part.
  await expect(tableau).not.toContainText(c.compte.pseudo);
  // Et les cinq mille points hors fenêtre ne sont pas comptés.
  await expect(tableau).not.toContainText("5150");

  /**
   * L'onglet du cumul, et pourquoi il se prouve ICI.
   *
   * Les cinq mille points de B datent d'il y a trente jours : la semaine les
   * ignore, le cumul les compte. C'est le seul contrôle qui distingue les deux
   * onglets pour de bon — un onglet qui rechargerait la même période rendrait
   * exactement le même tableau, et rien à l'écran ne le dirait.
   */
  await pageA.getByRole("tab", { name: /depuis toujours|all time/i }).click();
  await expect(lignes.nth(0)).toContainText("5150");

  // Et le retour à la semaine les reperd : sans ce second sens, un onglet qui
  // resterait bloqué sur le cumul passerait le contrôle ci-dessus.
  await pageA.getByRole("tab", { name: /la semaine|this week/i }).click();
  await expect(lignes.nth(0)).toContainText("150");
  await expect(tableau).not.toContainText("5150");

  await ctxA.close();
});

/**
 * Le parrainage, de bout en bout.
 *
 * Ce que les tests unitaires ne peuvent pas voir : que le code SURVIT au
 * formulaire d'inscription. Il entre par l'adresse, traverse un composant qui
 * ne l'affiche jamais, et ressort dans le corps d'une requête — trois endroits
 * où il peut se perdre sans que rien ne le dise, puisqu'une inscription sans
 * parrain réussit exactement comme une inscription avec.
 */
const LIEN_PARRAIN = `
  SELECT f.pseudo AS filleul, p.pseudo AS parrain
  FROM "User" f JOIN "User" p ON p.id = f."parrainId"
  WHERE f.pseudo = $1`;

test("un lien de parrainage rend les deux comptes amis", async ({ browser }) => {
  const parrain = await ouvrirCompte(browser, "Parrain");

  const { ctx: ctxP, page: pageP } = await ouvrirEcranAmis(browser, parrain.etat);
  const lien = pageP.getByRole("heading", { name: /ton lien|your invite/i });
  await expect(lien).toBeVisible();
  const adresse = await pageP.locator("code").first().innerText();
  const code = adresse.trim().split("p=")[1];
  expect(code).toHaveLength(8);
  await expect(pageP.getByText(/personne n'est encore venu|nobody has come/i)).toBeVisible();
  await ctxP.close();

  // Quelqu'un ouvre le lien et crée son compte.
  const filleul = await ouvrirCompte(browser, "Filleul", { parrain: code });

  // La base a gardé le lien, dans le bon sens.
  const [enBase] = await requeteSql<{ filleul: string; parrain: string }>(
    LIEN_PARRAIN, [filleul.compte.pseudo]);
  expect(enBase?.parrain).toBe(parrain.compte.pseudo);

  // Et les deux sont amis sans avoir eu à se demander quoi que ce soit.
  const [amitie] = await requeteSql<{ etat: string }>(
    LIEN, [parrain.compte.pseudo, filleul.compte.pseudo]);
  expect(amitie?.etat).toBe("acceptee");

  // L'écran du filleul le montre : son classement n'est pas vide au jour un.
  const { ctx: ctxF, page: pageF } = await ouvrirEcranAmis(browser, filleul.etat);
  await expect(pageF.getByRole("table")).toContainText(parrain.compte.pseudo);
  await ctxF.close();

  // Et le parrain compte une inscription.
  const { ctx: ctxP2, page: pageP2 } = await ouvrirEcranAmis(browser, parrain.etat);
  await expect(pageP2.getByText(/1 personne est venue|1 person came/i)).toBeVisible();
  await ctxP2.close();
});

/**
 * Et le cas qui ne doit RIEN casser : un lien tronqué.
 *
 * C'est le seul chemin d'acquisition du produit. Un code fautif qui refuserait
 * l'inscription ferait perdre exactement la personne qu'on venait de
 * convaincre, en lui disant que c'est sa faute.
 */
test("un lien de parrainage cassé n'empêche pas de créer un compte", async ({ browser }) => {
  const filleul = await ouvrirCompte(browser, "Casse", { parrain: "PAS-UN-CODE" });

  const [enBase] = await requeteSql<{ parrainId: string | null }>(
    'SELECT "parrainId" FROM "User" WHERE pseudo = $1', [filleul.compte.pseudo]);
  expect(enBase?.parrainId).toBeNull();

  // Le compte existe et s'ouvre : c'est tout ce qui compte ici.
  const { ctx, page } = await ouvrirEcranAmis(browser, filleul.etat);
  await expect(page.getByRole("heading", { name: /tes amis|your friends/i })).toBeVisible();
  await ctx.close();
});

/**
 * La dette commune d'une équipe (réponse 118).
 *
 * Ce qu'aucun test unitaire ne peut voir : que l'effort fait par QUELQU'UN
 * D'AUTRE arrive vraiment sur la dette du bon compte, et que la trace reste au
 * nom de celui qui l'a faite — c'est ce qui décide de son classement.
 */
test("un coéquipier prend une part de la dette, et c'est la bonne qui baisse", async ({ browser }) => {
  const a = await ouvrirCompte(browser, "Cap");
  const b = await ouvrirCompte(browser, "Coeq");
  const nom = `Cinq ${Date.now().toString(36)}`;

  const { ctx: ctxA, page: pageA } = await ouvrirEcranAmis(browser, a.etat);
  await pageA.getByLabel(/nom du groupe|group name/i).fill(nom);
  await pageA.getByRole("button", { name: /^créer$|^create$/i }).click();
  await expect(pageA.getByText(nom)).toBeVisible();

  const [groupe] = await requeteSql<{ id: string; code: string }>(
    'SELECT id, code FROM "Groupe" WHERE nom = $1', [nom]);

  const { ctx: ctxB, page: pageB } = await ouvrirEcranAmis(browser, b.etat);
  await pageB.getByLabel(/code d.invitation|invite code/i).fill(groupe.code);
  await pageB.getByRole("button", { name: /^rejoindre$|^join$/i }).click();
  await expect(pageB.getByText(nom)).toBeVisible();

  // Une dette pour le capitaine, posée en base : ce qu'on éprouve ici est le
  // relais, pas la façon dont une dette naît — elle a ses propres parcours.
  await requeteSql('UPDATE "User" SET "dettePointsDus" = 60 WHERE pseudo = $1', [a.compte.pseudo]);

  await pageB.reload();
  // Le bouton porte le nom du GROUPE : plusieurs cartes peuvent être ouvertes
  // sur cet écran, et « la dette de l'équipe » seul ne dirait pas laquelle.
  await pageB.getByRole("button", { name: new RegExp(`(la dette de l.équipe|the team.s debt) ${nom}`, "i") }).click();
  await expect(pageB.getByText(a.compte.pseudo, { exact: true })).toBeVisible();

  const champ = pageB.getByLabel(new RegExp(`(prendre|take on) ${a.compte.pseudo}`, "i")).first();
  await champ.fill("25");
  await pageB.getByRole("button", { name: new RegExp(`(prendre|take on) ${a.compte.pseudo}`, "i") }).click();

  // L'écran ET la base : sans le second, un écran qui se contente d'afficher
  // ce qu'on vient de taper passerait le test.
  await expect(pageB.getByText(/(doit|owes) 35/i)).toBeVisible();

  const [capitaine] = await requeteSql<{ dettePointsDus: number }>(
    'SELECT "dettePointsDus" FROM "User" WHERE pseudo = $1', [a.compte.pseudo]);
  expect(capitaine.dettePointsDus).toBe(35);

  const [coequipier] = await requeteSql<{ dettePointsDus: number }>(
    'SELECT "dettePointsDus" FROM "User" WHERE pseudo = $1', [b.compte.pseudo]);
  expect(coequipier.dettePointsDus).toBe(0);

  /**
   * La trace appartient à CELUI QUI A FAIT l'effort.
   *
   * C'est ce qui décide de son classement, et c'est juste : ce sont ses
   * pompes. `pourUserId` ne dit que de quelle dette elles ont été retirées.
   */
  const paiements = await requeteSql<{ points: number; pseudo: string; beneficiaire: string }>(
    `SELECT p.points, u.pseudo, b.pseudo AS beneficiaire
       FROM "Paiement" p
       JOIN "User" u ON u.id = p."userId"
       LEFT JOIN "User" b ON b.id = p."pourUserId"
      WHERE u.pseudo = $1`, [b.compte.pseudo]);
  expect(paiements).toHaveLength(1);
  expect(paiements[0]).toMatchObject({ points: 25, beneficiaire: a.compte.pseudo });

  await ctxA.close();
  await ctxB.close();
});

/**
 * Le rendu d'attente et le rendu chargé s'apparient position par position.
 *
 * React réconcilie par RANG : deux arbres dont les enfants ne s'alignent pas
 * font démonter puis remonter tout ce qui est dedans, et le paragraphe déjà
 * peint est recréé. Mesuré deux fois cette nuit sur `/amis` — 3032 ms au lieu
 * de 1116 sur téléphone bridé — et deux fois pour la même raison : une section
 * ajoutée au MILIEU décale tout ce qui la suit.
 *
 * Aucun test unitaire ne peut le voir : c'est une propriété du DOM vivant.
 * Celui-ci marque les nœuds pendant l'attente et vérifie que ce sont les MÊMES
 * une fois les données arrivées.
 *
 * **Ce qu'il ne garde PAS, et il faut le dire.** Trois sabotages ont été
 * essayés — la section du mur retirée du rendu d'attente, la même remise
 * derrière un conditionnel dans le rendu chargé, puis les deux ensemble — et
 * AUCUN ne l'a fait tomber. La mesure ne bougeait pas non plus : 1100 ms dans
 * les trois cas. Autrement dit ni ce test ni le banc d'essai ne savent
 * reproduire à la demande le décalage qui a été mesuré deux fois pour de vrai.
 *
 * Il est gardé pour ce qu'il éprouve — les deux paragraphes ne sont pas
 * recréés — et pas pour ce qu'on aimerait qu'il éprouve. Ce qui tient
 * réellement le temps d'affichage de cet écran est la campagne de mesure, qui
 * l'a attrapé les deux fois. Un test dont on croit qu'il prouve autre chose
 * que ce qu'il prouve est pire qu'aucun test.
 */
test("le panneau du classement n'est pas recréé à l'arrivée des données", async ({ browser }) => {
  const a = await ouvrirCompte(browser, "Rang2");
  const ctx = await browser.newContext({ storageState: a.etat });
  const page = await ctx.newPage();

  // La réponse est retenue le temps de marquer le nœud : sans ce délai, elle
  // arrive avant qu'on ait pu regarder, et le test ne prouve rien.
  await page.route("**/api/classement**", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });

  await page.goto("/fr/amis");

  /**
   * On marque DEUX paragraphes, et c'est le second qui compte.
   *
   * Le premier jet ne marquait que celui du classement — placé AVANT le point
   * où les sections s'ajoutent, donc jamais décalé : retirer le mur du rendu
   * d'attente le laissait au vert. Le paragraphe du parrainage est APRÈS, et
   * c'est lui que le décalage recrée. C'est aussi lui, le plus grand élément
   * de la page.
   */
  const marquer = async (motif: RegExp, marque: number) => {
    const el = page.getByText(motif).first();
    await expect(el).toBeVisible();
    await el.evaluate((e, m) => { (e as HTMLElement & { __marque?: number }).__marque = m; }, marque);
  };
  const survit = (motif: RegExp, marque: number) =>
    page.getByText(motif).first()
      .evaluate((e, m) => (e as HTMLElement & { __marque?: number }).__marque === m, marque);

  const CLASSEMENT = /Sur l'effort réellement PAYÉ/i;
  const PARRAINAGE = /Celui qui ouvre ce lien/i;
  await marquer(CLASSEMENT, 1);
  await marquer(PARRAINAGE, 2);

  // Le tableau arrive : c'est le moment où un arbre mal aligné remonterait.
  await expect(page.getByRole("table")).toBeVisible({ timeout: 15000 });

  expect({
    classement: await survit(CLASSEMENT, 1),
    parrainage: await survit(PARRAINAGE, 2),
  }).toEqual({ classement: true, parrainage: true });

  await ctx.close();
});

/**
 * Le mur OUVERT, et pourquoi il ne se relit pas comme le reste.
 *
 * C'est la PREMIÈRE surface du produit où un compte voit le pseudo et
 * l'effort de quelqu'un avec qui il n'a aucun lien. Partout ailleurs il faut
 * une amitié acceptée des deux côtés ; ici il suffit d'avoir un compte. Ce que
 * ça publie tient donc entièrement à deux conditions lues en base, et une
 * seule des deux qui saute publie quelqu'un qui avait demandé l'inverse.
 *
 * Trois comptes, aucun ami de personne :
 *
 * - **ouvert** a ouvert son mur PAR L'ÉCRAN DE RÉGLAGES. C'est la moitié du
 *   test qu'aucun test de route ne peut faire : le réglage traverse l'écran,
 *   la route, la base, et ressort sur l'écran de QUELQU'UN D'AUTRE ;
 * - **ferme** n'a rien touché — le défaut est le plus fermé — et paie PLUS.
 *   Le chiffre est plus gros exprès : si la condition saute, il prend la
 *   première place et l'échec est franc ;
 * - **fantome** a ouvert son mur ET s'est retiré des classements. Le fantôme
 *   passe AVANT : qui s'est caché ne revient pas par le mur. Il paie plus que
 *   les deux autres, pour la même raison.
 *
 * Et le contrôle porte sur la RÉPONSE, pas seulement sur l'écran. Le filtre
 * est en base, et c'est tout le propos : une ligne écartée à l'affichage
 * traverserait quand même le réseau et figurerait dans l'onglet réseau de qui
 * regarde — c'est-à-dire exactement là où quelqu'un a demandé à ne pas être.
 * Un test qui ne lit que le tableau ne distingue pas les deux.
 */
test("le mur ouvert ne montre que ceux qui l'ont ouvert", async ({ browser }) => {
  const moi = await ouvrirCompte(browser, "Voisin");
  const ouvert = await ouvrirCompte(browser, "Ouvert");
  const ferme = await ouvrirCompte(browser, "Ferme");
  const cache = await ouvrirCompte(browser, "Cache");

  // `ouvert` ouvre son mur depuis ses réglages, comme n'importe qui le ferait.
  const ctxO = await browser.newContext({ storageState: ouvert.etat });
  const pageO = await ctxO.newPage();
  await pageO.goto("/dashboard");
  await viderLesFenetres(pageO);
  // La rubrique s'ouvre par le FRAGMENT, pas par un paramètre : le réglage du
  // mur vit dans « Ton effort », et `/settings` seul rend la liste des
  // rubriques, où le bouton n'existe pas.
  await pageO.goto("/settings#effort");
  const bouton = pageO.getByRole("button", { name: /ouvert à tous|open to all/i });
  await expect(bouton).toBeVisible();
  await bouton.click();
  await expect(bouton).toHaveAttribute("aria-pressed", "true");
  await ctxO.close();

  // Le réglage est ARRIVÉ EN BASE : sans ce contrôle, un écran qui garde chez
  // lui ce qu'on vient de cliquer passerait la moitié du test.
  const [enBase] = await requeteSql<{ recordsPublics: boolean }>(
    `SELECT "recordsPublics" FROM "User" WHERE pseudo = $1`, [ouvert.compte.pseudo]);
  expect(enBase?.recordsPublics).toBe(true);

  // `cache` ouvre le sien et se retire des classements : les deux à la fois.
  await requeteSql(
    `UPDATE "User" SET "recordsPublics" = true, fantome = true WHERE pseudo = $1`,
    [cache.compte.pseudo]);

  await requeteSql(PAYER, [jeton(), 300, jourLocalTest(), ouvert.compte.pseudo]);
  await requeteSql(PAYER, [jeton(), 800, jourLocalTest(), ferme.compte.pseudo]);
  await requeteSql(PAYER, [jeton(), 5000, jourLocalTest(), cache.compte.pseudo]);

  const { ctx, page } = await ouvrirEcranAmis(browser, moi.etat);

  /**
   * Ce que l'écran montre : celui qui a ouvert, et son jour. DEUX fois — le
   * mur a deux lignes, « ce mois-ci » et « depuis toujours », et son seul
   * paiement tient les deux. Le compte exact plutôt qu'un `.first()` : il dit
   * l'état réel, là où le premier trouvé passerait aussi bien avec une ligne
   * qu'avec dix.
   */
  const mur = page.getByText(new RegExp(`${ouvert.compte.pseudo}.*300`));
  await expect(mur).toHaveCount(2);
  await expect(mur.first()).toBeVisible();

  /**
   * Et ce que le RÉSEAU porte.
   *
   * **Ce contrôle ne distingue PAS, aujourd'hui, « filtré en base » de
   * « filtré à l'affichage »**, et c'est le sabotage qui l'a dit plutôt que la
   * relecture. Le filtre déplacé dans le composant fait tomber le contrôle de
   * l'ÉCRAN en premier : le mur ne publie que le VAINQUEUR de chaque période,
   * donc une ligne fermée qui traverse le réseau est forcément celle qui a
   * pris la place, et la cacher laisse le mur vide. Il n'existe pas d'état où
   * la réponse la porte et où l'écran reste juste.
   *
   * Il n'est pas décoratif pour autant : il mord le jour où ce mur publiera
   * autre chose qu'un vainqueur — un classement des cinq premiers, un drapeau
   * envoyé au navigateur — c'est-à-dire précisément le jour où le filtre
   * pourrait glisser à l'affichage sans que rien à l'écran ne bouge.
   */
  const reponse = await page.evaluate(async (jour: string) => {
    const res = await fetch(`/api/classement?jour=${jour}`);
    return res.json() as Promise<{
      recordsOuverts: { mois: { points: number } | null; toujours: { points: number } | null } | null;
    }>;
  }, jourLocalTest());
  const corps = JSON.stringify(reponse);

  /**
   * Les PSEUDOS se cherchent dans le corps entier — ils portent une marque
   * tirée au hasard, donc ils ne peuvent pas s'y trouver par accident.
   *
   * **Les CHIFFRES, eux, ne se cherchent pas ainsi**, et c'est l'intégration
   * continue qui l'a dit : `corps.includes("800")` y était vrai alors que le
   * compte fermé était bien absent. « 800 » est trois caractères, et du JSON en
   * contient — dans un identifiant, dans une date, dans un total. Le test
   * passait en local et tombait sur une autre base : ce n'est pas un aléa, c'est
   * un contrôle qui pouvait être vrai sans rien prouver, et qui l'a été.
   *
   * Ils se lisent donc à leur place, dans les lignes composées du mur.
   */
  expect({
    ouvertVu: corps.includes(ouvert.compte.pseudo),
    fermeVu: corps.includes(ferme.compte.pseudo),
    cacheVu: corps.includes(cache.compte.pseudo),
  }).toEqual({ ouvertVu: true, fermeVu: false, cacheVu: false });

  expect([
    reponse.recordsOuverts?.mois?.points,
    reponse.recordsOuverts?.toujours?.points,
  ]).toEqual([300, 300]);

  await ctx.close();
});
