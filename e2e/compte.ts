import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { purgerTentatives } from "./limiteur";
import { sansLangue } from "./chemin";

/**
 * Se connecte, et DIT ce qu'il voit quand ça ne marche pas.
 *
 * Ces treize lignes étaient recopiées dans treize fichiers — la seule vraie
 * duplication de la suite navigateur, et la plus chère : c'est ici que tombe
 * l'aléa que ce projet recense depuis août sans jamais avoir su le nommer.
 * `waitForURL` expire au bout de trente secondes en disant « waiting for
 * navigation until load », c'est-à-dire rien.
 *
 * **Trois causes produisent ce même message, et elles ne se corrigent pas de
 * la même façon :**
 *
 *  - le serveur a REFUSÉ — un message d'erreur est à l'écran, et les champs
 *    portent encore ce qu'on a tapé ;
 *  - la page n'était pas HYDRATÉE quand on a rempli — le champ se vide TOUT
 *    SEUL, parce que l'état React n'a jamais reçu la saisie et que le premier
 *    rendu qui suit remet le champ contrôlé à la valeur de l'état. Le bouton,
 *    lui, reste ACTIF : il est `disabled={loading}` et rien d'autre. La
 *    description de V537 disait « champs vides ET bouton désactivé » ; cette
 *    seconde moitié est fausse, et c'est elle qui a rendu la cause
 *    méconnaissable le jour où elle s'est présentée ;
 *  - la requête n'est jamais REVENUE — tout est en place et rien ne bouge.
 *
 * Le relevé ne coûte rien quand tout va bien : il n'est fait qu'à l'échec.
 * C'est la règle du fichier — quand un test échoue pour une raison qu'on ne
 * sait pas NOMMER, on instrumente avant la deuxième tentative.
 */
export async function seConnecter(
  page: Page,
  pseudo: string,
  code: string,
  options: { chemin?: string } = {},
) {
  await page.goto(options.chemin ?? "/login");
  const champPseudo = page.getByPlaceholder(/ton pseudo|your username/i);
  const champCode = page.getByPlaceholder(/ton code|your code/i);
  const bouton = page.getByRole("button", { name: /^se connecter$|^sign in$/i });
  await remplirVraiment(champPseudo, pseudo, champCode, code);
  try {
    await Promise.all([
      page.waitForURL((u) => !sansLangue(u.pathname).startsWith("/login"), { timeout: 30_000 }),
      bouton.click(),
    ]);
  } catch (echec) {
    const etat = await releverLEcran(page, champPseudo, champCode, bouton);
    throw new Error(`la connexion de ${pseudo} n'a pas abouti — ${etat}`, { cause: echec });
  }
}

/**
 * Remplit les deux champs, et n'en sort que lorsqu'ils PORTENT vraiment ce
 * qu'on a tapé.
 *
 * Les deux champs sont CONTRÔLÉS par React (`value={codePseudo}`) : une
 * saisie qui arrive avant que React n'écoute n'atteint aucun état, et le
 * premier rendu qui suit remet le champ à la valeur de l'état — c'est-à-dire
 * à vide. Le champ se vide alors tout seul, sans erreur et sans rien à
 * l'écran.
 *
 * Ce que ça coûte au clic est le pire des symptômes : le champ étant
 * `required`, c'est le NAVIGATEUR qui refuse l'envoi. Aucune requête ne part,
 * aucun message ne paraît, le bouton reste actif, et `waitForURL` expire
 * trente secondes plus tard en annonçant « waiting for navigation until
 * load », c'est-à-dire rien.
 *
 * Ce contrôle ne prouve PAS que la cause est celle-là : il refuse de cliquer
 * sur un formulaire dont un champ requis est vide, ce qui est la bonne
 * conduite quelle que soit la raison du vide. Et il ne coûte rien quand tout
 * va bien — deux lectures qui passent du premier coup.
 */
async function remplirVraiment(
  champPseudo: ReturnType<Page["getByPlaceholder"]>,
  pseudo: string,
  champCode: ReturnType<Page["getByPlaceholder"]>,
  code: string,
) {
  await expect(async () => {
    /**
     * Le vidage vaut ici aussi, et la condition d'avant l'empêchait.
     *
     * Elle ne refaisait le `fill` que si la valeur DIFFÉRAIT — c'est-à-dire
     * jamais dans l'état qui nous occupe, où le champ porte déjà ce qu'on a
     * tapé et où seul l'état React est vide. Elle ne pouvait donc rattraper
     * que le cas où le champ s'est vidé tout seul, qui est l'autre moitié.
     *
     * Ce que ça change côté connexion n'est PAS mesuré : le bouton y vaut
     * `disabled={loading}` et rien d'autre, donc il ne dit pas si l'état a
     * reçu la saisie. Le vidage est repris parce que le mécanisme est le même
     * et qu'il ne coûte rien ; l'affirmer réparé serait aller au-delà.
     */
    await reposer(champPseudo, pseudo);
    await reposer(champCode, code);
    expect(await champPseudo.inputValue()).toBe(pseudo);
    expect(await champCode.inputValue()).toBe(code);
  }).toPass({ timeout: 15_000 });
}

/** Ce que l'écran de connexion montre à l'instant où l'on renonce. */
async function releverLEcran(
  page: Page,
  champPseudo: ReturnType<Page["getByPlaceholder"]>,
  champCode: ReturnType<Page["getByPlaceholder"]>,
  bouton: ReturnType<Page["getByRole"]>,
): Promise<string> {
  // Chaque lecture est bornée et rattrapée : une sonde qui tombe elle-même
  // remplacerait le message qu'on cherchait par le sien.
  const sur = async <T>(lire: () => Promise<T>, defaut: T): Promise<T> => {
    try { return await lire(); } catch { return defaut; }
  };
  const adresse = await sur(async () => new URL(page.url()).pathname, "?");
  const remplis = await sur(
    async () => `${(await champPseudo.inputValue()) !== ""}/${(await champCode.inputValue()) !== ""}`,
    "?",
  );
  const actif = await sur(() => bouton.isEnabled({ timeout: 2_000 }), false);
  const messages = await sur(
    async () => (await page.getByRole("alert").allInnerTexts()).map((t) => t.trim()).filter(Boolean),
    [] as string[],
  );
  return [
    `adresse ${adresse}`,
    `champs remplis ${remplis}`,
    `bouton ${actif ? "actif" : "désactivé"}`,
    messages.length ? `à l'écran : ${messages.join(" | ")}` : "aucun message à l'écran",
  ].join(", ");
}

/**
 * Ouvre un compte neuf et rend son état de session.
 *
 * La saisie est reprise tant que le bouton ne s'active pas, et **ce n'est plus
 * une précaution** : le commentaire écrit ici disait « pas la correction d'un
 * défaut constaté », et le défaut s'est constaté en CI sur V581 — le bouton
 * « Obtenir mon code » est resté désactivé pendant cent onze reprises de
 * Playwright, sur `bareme-gele.spec.ts`, qui recopiait les trois lignes SANS
 * la reprise.
 *
 * L'hypothèse écrite alors était fausse elle aussi : « quand le bouton reste
 * désactivé, c'est en général qu'il n'y a pas de JavaScript du tout, et
 * reprendre la saisie n'y peut rien ». Il y en avait — c'est bien React qui
 * avait posé le `disabled` — et ce qui manquait était un second `fill` APRÈS
 * l'hydratation. La reprise n'y peut donc rien seulement dans le cas qu'on
 * croyait ; dans celui qui arrive, elle est tout ce qui répare.
 */
export async function ouvrirCompte(
  browser: Browser,
  prefixe: string,
  options: { consentement?: boolean; parrain?: string } = {},
): Promise<{
  etat: Awaited<ReturnType<BrowserContext["storageState"]>>;
  compte: { pseudo: string; email: string };
  /** Le code d'accès tiré à l'inscription — un parcours de récupération doit
   *  pouvoir prouver qu'il ne marche PLUS après un échange. */
  code: string;
}> {
  const marque = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
  const compte = { pseudo: `${prefixe}${marque}`, email: `${prefixe.toLowerCase()}-${marque}@example.test` };

  /**
   * Une adresse par worker, pour le limiteur d'inscription.
   *
   * Il autorise cinq inscriptions par quart d'heure et par ADRESSE IP. Tous
   * les workers sortent de la même machine : à quatre en parallèle, ils se
   * bloquaient les uns les autres, et le symptôme — « le compte ne s'ouvre
   * pas » — ne ressemble pas à sa cause. `getClientIp` lit `x-forwarded-for`
   * quand l'en-tête de plateforme est absent, ce qui est le cas en local.
   *
   * Lue à l'exécution et non au chargement de la configuration : c'est
   * Playwright qui pose cette variable dans chaque worker.
   */
  const worker = process.env.TEST_PARALLEL_INDEX ?? "0";
  const ctx = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": `10.0.0.${Number(worker) + 1}` },
  });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try { sessionStorage.setItem("splash", "1"); } catch { /* stockage refusé */ }
  });
  await purgerTentatives();

  /**
   * Le code de parrainage passe par l'ADRESSE, comme pour quelqu'un qui suit
   * un lien reçu. Le poser dans le corps de la requête éprouverait la route et
   * non le chemin : c'est la traversée du formulaire qui peut se perdre.
   */
  await page.goto(options.parrain ? `/beta?p=${options.parrain}` : "/beta");
  const envoyer = boutonInscription(page);
  await remplirInscription(page, compte);
  await envoyer.click();

  const bloc = page.locator(".mono-num").first();
  await bloc.waitFor({ timeout: 20_000 });
  const code = (await bloc.innerText()).trim();

  await seConnecter(page, compte.pseudo, code);

  // La demande de consentement santé est modale et recouvre la page : rien ne
  // se clique derrière. Elle se traverse par l'API, comme dans les cinq autres
  // fichiers qui sont tombés dessus avant celui-ci.
  if (options.consentement !== false) {
    await ctx.request.post("/api/consentement", { data: { accepte: true } });
  }

  /**
   * La session est vérifiée AVANT de rendre l'état.
   *
   * Sans ce contrôle, un compte dont la connexion a échoué rend un état sans
   * cookie, et tous les tests qui s'en servent échouent bien plus loin, sur
   * « élément introuvable » — un symptôme qui ne ressemble en rien à sa cause.
   * C'est ce qui vient d'arriver deux fois : une session morte, et neuf
   * minutes passées à chercher ailleurs.
   */
  const sonde = await ctx.request.get("/api/user");
  if (!sonde.ok()) {
    throw new Error(
      `ouvrirCompte(${prefixe}) : la session n'est pas établie — /api/user rend ${sonde.status()}. `
      + "Le compte a peut-être été refusé (limiteur, pseudo pris) ou la connexion n'a pas abouti.",
    );
  }

  const etat = await ctx.storageState();
  await ctx.close();
  return { etat, compte, code };
}

export function boutonInscription(page: Page) {
  return page.getByRole("button", { name: /rejoindre|obtenir|valider|envoyer|join/i }).first();
}

export async function remplirInscription(
  page: Page,
  compte: { pseudo: string; email: string },
) {
  const envoyer = boutonInscription(page);
  await expect.poll(async () => {
    await reposer(page.getByPlaceholder(/pseudo/i).first(), compte.pseudo);
    await reposer(page.locator('input[type="email"]').first(), compte.email);
    return envoyer.isEnabled();
  }, { timeout: 30_000, intervals: [500, 1_000, 2_000] }).toBe(true);
}

/**
 * Vide le champ AVANT de le remplir, et c'est toute la correction.
 *
 * **Mesuré, parce que l'hypothèse écrite ici était fausse.** La saisie qui
 * arrive avant l'hydratation laisse un état stable et faux : le DOM porte la
 * valeur, l'état React est vide, et rien ne les réconcilie — React ne relit
 * pas le DOM en s'hydratant, et sans changement d'état il ne rerend pas. Le
 * champ garde donc ce qu'on a tapé pendant que le bouton reste éteint.
 *
 * Ce qui rendait la reprise INOPÉRANTE est que `fill` ne fait rien quand la
 * valeur est déjà la bonne : pas de changement, pas d'événement, pas d'état.
 * La boucle tournait trente secondes et rendait le même écran. Mesuré sur les
 * trois façons de reprendre, fragments retardés de deux secondes :
 *
 * | reprise                | bouton après |
 * |------------------------|--------------|
 * | `fill` répété          | **éteint**   |
 * | vider puis remplir     | actif        |
 * | frappe au clavier      | actif        |
 *
 * Le vidage est retenu plutôt que la frappe : il coûte deux appels au lieu
 * d'un caractère par lettre, et il ne dépend pas de ce que le champ contient
 * déjà.
 */
async function reposer(champ: ReturnType<Page["locator"]>, valeur: string) {
  await champ.fill("");
  await champ.fill(valeur);
}
