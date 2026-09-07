/**
 * Les coutures et les nombres bruts, LUS À L'ÉCRAN.
 *
 * Usage : node scripts/coutures.mjs [base] [--langue=ja] [--pages=/dashboard,/history]
 *
 * Deux familles de défauts que ce projet a payées une dizaine de fois, et que
 * les gardes statiques ne peuvent pas voir :
 *
 * - **la couture** : une espace latine assise entre deux idéogrammes. Le
 *   japonais et le chinois séparent volontiers un morceau LATIN de ce qui
 *   l'entoure (« 60 試合 »), et cette convention cesse de valoir à l'instant
 *   où la valeur interpolée est elle-même en idéogrammes — une durée passée
 *   par `Intl`, une date, un pseudo japonais. Elle ne peut donc PAS se décider
 *   à l'écriture du gabarit : la même clé reçoit « 5分20秒 » et « 38 » ;
 * - **le nombre brut** : quatre chiffres ou plus sans séparateur de milliers.
 *   Il n'existe qu'AU-DESSUS DU MILLIER, donc jamais sur un compte de
 *   démonstration : le compte doit être semé, et l'outil dit combien de textes
 *   il a lus pour qu'un « rien trouvé » ne se confonde pas avec « rien
 *   regardé ».
 *
 * Ce qui a trouvé ces défauts jusqu'ici, c'est de LIRE les écrans dans une
 * écriture différente. Cet outil fait le balayage à la main ; il ne remplace
 * pas la lecture, il l'exhausse.
 *
 * `src/coutures.test.ts` éprouve les deux motifs sur des cas fabriqués — dont
 * les défauts réels du journal. L'état sain du produit étant zéro trouvaille,
 * les écrans ne peuvent pas distinguer un motif juste d'un motif aveugle :
 * ma première version déclarait un balayage propre avec un motif qui ne
 * voyait PAS « 15360 / 25000 », c'est-à-dire le défaut pour lequel il existe.
 */
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { enLangue, langueDemandee, positionnels, refuserPrefixe } from "./langue.mjs";

const [BASE = "http://127.0.0.1:3311", PAGES_ARG] = positionnels(process.argv);
const LANGUE = langueDemandee(process.argv);
const CHROMIUM = "/opt/pw-browsers/chromium";

const drapeauPages = process.argv.find((a) => a.startsWith("--pages="));
const PAGES = (drapeauPages ? drapeauPages.slice("--pages=".length) : PAGES_ARG
  ?? "/dashboard,/history,/amis,/bilan,/settings#effort,/settings#corps,/settings#jeux")
  .split(",").map((c) => refuserPrefixe(c.split("#")[0]) && c);

/**
 * Une espace assise ENTRE DEUX idéogrammes.
 *
 * L'espace qui suit un chiffre latin reste : c'est la convention, et un motif
 * qui la refuserait accuserait « 60 試合 », qui est juste.
 *
 * **Un faux positif connu, et il est gardé exprès** : 「ソロ/デュオ ランク」 sur
 * la page d'accueil. Le katakana appartient à la classe CJK, donc une espace
 * entre deux mots en katakana ressemble à une couture — et elle peut être
 * voulue, c'est ainsi qu'on sépare deux mots d'un composé. Réécrire du
 * japonais sur un jugement de style n'est pas une correction. Le motif reste
 * large parce que ses vrais cas sont des IDÉOGRAMMES ; celui-ci se reconnaît
 * et se laisse.
 */
export const COUTURE = /[぀-ヿ㐀-鿿][  ][぀-ヿ㐀-鿿]/;

/**
 * Quatre chiffres ou plus, sans séparateur de milliers.
 *
 * Les bornes disent chacune ce qu'elles écartent :
 * - devant : un chiffre, un point, une virgule ou une espace de groupement,
 *   sinon « 15,360 » et « 15 360 » seraient accusés par leur seconde moitié ;
 * - derrière : les mêmes, plus 年 et « / » et « - », qui sont des DATES —
 *   « 2026年9月7日 » et « 2026/9/6 » ne sont pas des nombres à grouper.
 *
 * La borne arrière ne peut PAS contenir l'espace ordinaire : « 15360 / 25000 »
 * est suivi d'une espace, et l'y mettre rend le motif aveugle au défaut le
 * plus fréquent de la famille. C'est exactement l'erreur commise au premier
 * jet, et elle a produit un balayage « propre » qui ne prouvait rien.
 */
export const BRUT = /(?<![\d.,  \/-])\d{4,}(?![\d.,  ]|年|\/|-)/;

if (import.meta.url !== `file://${process.argv[1]}`) {
  // Importé pour ses motifs : rien à balayer.
} else {
  const jeton = existsSync("/tmp/jeton.txt") ? readFileSync("/tmp/jeton.txt", "utf8").trim() : null;
  const uid = existsSync("/tmp/uid.txt") ? readFileSync("/tmp/uid.txt", "utf8").trim() : null;
  if (!jeton || !uid) {
    // Le piège écrit deux fois au journal : sans identifiant, les fenêtres
    // d'accueil recouvrent l'écran et l'outil lit la modale au lieu de la page.
    console.error("Il manque /tmp/jeton.txt ou /tmp/uid.txt. Lance d'abord"
      + " scripts/compte-mesure.mjs, puis scripts/semer-parties.mjs.");
    process.exit(1);
  }

  const nav = await chromium.launch({ executablePath: CHROMIUM });
  let lus = 0;
  const constats = [];
  const nonMesurees = [];

  for (const chemin of PAGES) {
    const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies([{
      name: "authjs.session-token", value: jeton,
      domain: new URL(BASE).hostname, path: "/", httpOnly: true, sameSite: "Lax",
    }]);
    await ctx.addInitScript((id) => {
      localStorage.setItem(`low_onboarded:${id}`, "1");
      localStorage.setItem(`low_visite:${id}`, "1");
      localStorage.setItem("low_sante_consent", "1");
    }, uid);
    const page = await ctx.newPage();
    const [nu, fragment] = chemin.split("#");
    const adresse = BASE + enLangue(LANGUE, nu) + (fragment ? `#${fragment}` : "");
    await page.goto(adresse, { waitUntil: "domcontentloaded" });
    // Le contrôle d'atterrissage passe APRÈS l'attente : une page peut partir
    // toute seule (la visite guidée navigue), et le vérifier avant ne le voit
    // pas. C'est la variante du premier piège de ces outils, écrite au journal.
    await page.waitForTimeout(4500);
    const arrivee = new URL(page.url()).pathname;
    if (!arrivee.endsWith(nu === "/" ? `/${LANGUE}` : nu)) {
      nonMesurees.push(`${chemin} → ${arrivee}`);
      await ctx.close();
      continue;
    }

    const textes = await page.evaluate(() => {
      const out = [];
      for (const e of document.querySelectorAll("body *")) {
        if (e.tagName === "SCRIPT" || e.tagName === "STYLE" || e.children.length) continue;
        const t = (e.textContent || "").trim();
        // Une adresse n'est pas une phrase : un lien de parrainage porte un
        // code qui n'a ni à être groupé ni à être coupé.
        if (t && t.length < 200 && !/^https?:/.test(t)) out.push(t);
      }
      return [...new Set(out)];
    });
    lus += textes.length;
    for (const t of textes) {
      if (COUTURE.test(t)) constats.push(`${chemin}  COUTURE  « ${t.slice(0, 100)} »`);
      else if (BRUT.test(t)) constats.push(`${chemin}  NOMBRE   « ${t.slice(0, 100)} »`);
    }
    await ctx.close();
  }
  await nav.close();

  console.log(`\nLangue ${LANGUE} · ${PAGES.length} page(s) demandée(s) · ${lus} textes lus`);
  for (const c of constats) console.log(`  ${c}`);
  console.log(constats.length ? `\n${constats.length} constat(s).` : "\nRien à signaler.");
  // Le second chiffre, et c'est celui qui compte : un rapport qui annonce zéro
  // sur des pages qu'il n'a pas ouvertes est l'inverse d'un audit.
  if (nonMesurees.length) {
    console.log(`\n${nonMesurees.length} page(s) NON MESURÉE(S) :`);
    for (const n of nonMesurees) console.log(`  ${n}`);
  }
  if (lus < 20) {
    console.log("\nMoins de vingt textes lus : le balayage n'a rien regardé.");
    process.exit(1);
  }
}
