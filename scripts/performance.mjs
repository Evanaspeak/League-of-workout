/**
 * Mesure de performance de la page d'accueil.
 *
 * Ce qui est regardé : le temps du plus grand élément affiché (LCP), le
 * déplacement de la mise en page (CLS), le poids réellement transféré et le
 * nombre de requêtes. Ce sont les quatre chiffres qui décident si quelqu'un
 * reste sur la page, et les seuls que la lecture du code ne donne pas.
 *
 * Les deux mesures se font en deux passes, et c'est nécessaire : le LCP
 * continue de retenir des candidats tant qu'aucune interaction n'a eu lieu, si
 * bien que faire défiler la page pendant la mesure élit un élément du bas et
 * multiplie le chiffre par trois. Le CLS, lui, exige au contraire ce
 * défilement, sans quoi les déplacements du bas de page passent inaperçus.
 *
 * La seconde passe s'exécute sur une connexion bridée. Mesurer en local sur
 * une machine rapide dit seulement que le code n'est pas absurde ; ce qui
 * décide du sort de la page, c'est un téléphone sur un réseau moyen.
 *
 * Usage : node scripts/performance.mjs [adresse] [chemin]
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:3311";
const CHEMIN = process.argv[3] ?? "/";
const CHROMIUM = "/opt/pw-browsers/chromium";

/**
 * Les écrans qui demandent un compte se mesurent comme les autres, à condition
 * de leur donner une session. Le jeton se dépose dans un fichier par
 * l'appelant : le script ne sait pas en fabriquer, et n'a pas à savoir.
 *
 * Auth.js découpe le cookie quand il dépasse la taille d'un en-tête : il faut
 * le redécouper à l'identique, sinon le serveur ne le reconnaît pas et la page
 * mesurée est celle de connexion.
 */
const JETON = existsSync("/tmp/jeton.txt") ? readFileSync("/tmp/jeton.txt", "utf8").trim() : null;
const HOTE = new URL(BASE).hostname;
/**
 * La mémoire de la modale d'accueil et de la visite est propre au compte —
 * `low_onboarded:<id>`. Sans l'identifiant, elles s'ouvrent par-dessus la page
 * et deviennent le plus grand élément affiché : on chronomètre alors une
 * modale au lieu du contenu, et le chiffre ne veut plus rien dire.
 */
const COMPTE = existsSync("/tmp/uid.txt") ? readFileSync("/tmp/uid.txt", "utf8").trim() : "";

function cookies() {
  if (!JETON) return [];
  const parts = JETON.length > 3500
    ? [["authjs.session-token.0", JETON.slice(0, 3500)], ["authjs.session-token.1", JETON.slice(3500)]]
    : [["authjs.session-token", JETON]];
  return parts.map(([name, value]) => ({
    name, value, domain: HOTE, path: "/", httpOnly: true, sameSite: "Lax",
  }));
}

/** Seuils publiés par Google pour un chargement jugé bon. */
const SEUILS = { lcp: 2500, cls: 0.1 };

const navigateur = await chromium.launch(
  existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {},
);
const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 900 }, locale: "fr-FR" });
await ctx.addCookies(cookies());
const page = await ctx.newPage();

/**
 * Poids transféré, par nature de ressource.
 *
 * La taille se lisait dans l'en-tête `content-length`. Next.js ne l'envoie pas
 * sur les fragments JavaScript : compressés, ils partent en
 * `Transfer-Encoding: chunked`, sans longueur annoncée. Le script rendait donc
 * « script 0 ko » sur toutes les pages — c'est-à-dire précisément la mesure
 * pour laquelle il existe. Seules les polices, servies en fichiers statiques,
 * avaient une longueur : d'où 130 ko identiques d'une page à l'autre.
 *
 * On lit maintenant ce que le navigateur a réellement reçu, par l'API de
 * chronométrage des ressources. Elle rend zéro pour une ressource d'un autre
 * domaine qui n'autorise pas la lecture de ses temps (les polices Google) :
 * pour celles-là, l'en-tête reste la meilleure source. On garde donc les deux
 * et on retient la plus grande.
 */
const parUrl = new Map();
let requetes = 0;
page.on("response", (r) => {
  requetes++;
  const taille = Number(r.headers()["content-length"] ?? 0);
  const courant = parUrl.get(r.url());
  parUrl.set(r.url(), {
    type: r.request().resourceType(),
    entete: Math.max(courant?.entete ?? 0, taille),
  });
});

/** Ce que le navigateur dit avoir reçu, url par url. */
async function poidsReels() {
  const mesures = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((e) => ({
      url: e.name,
      // `encodedBodySize` est le corps compressé, hors en-têtes ; c'est le
      // chiffre qui compte pour un réseau lent.
      taille: e.encodedBodySize || e.transferSize || 0,
    })));
  const parNature = new Map();
  const vues = new Set();
  for (const { url, taille } of mesures) {
    vues.add(url);
    const connu = parUrl.get(url);
    const nature = connu?.type ?? "autre";
    parNature.set(nature, (parNature.get(nature) ?? 0) + Math.max(taille, connu?.entete ?? 0));
  }
  // Ce que l'API de chronométrage n'a pas vu (le document lui-même, entre
  // autres) garde la taille annoncée par son en-tête.
  for (const [url, { type, entete }] of parUrl) {
    if (!vues.has(url) && entete > 0) parNature.set(type, (parNature.get(type) ?? 0) + entete);
  }
  return parNature;
}

await page.addInitScript((__compte) => {
  // L'écran d'ouverture recouvre la page : mesuré avec, on chronomètre une
  // animation plutôt que le contenu.
  try {
    sessionStorage.setItem("splash", "1");
    for (const c of ["low_onboarded", "low_visite", `low_onboarded:${__compte}`, `low_visite:${__compte}`]) {
      localStorage.setItem(c, "1");
    }
  } catch {}
  window.__mesures = { lcp: 0, cls: 0 };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__mesures.lcp = e.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (!e.hadRecentInput) window.__mesures.cls += e.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
}, COMPTE);

await page.goto(BASE + CHEMIN, { waitUntil: "networkidle" });
// Une session invalide renvoie vers la connexion, qui est légère et rapide :
// on mesurerait d'excellents chiffres sur la mauvaise page.
{
  const normaliser = (c) => c.replace(/\/+$/, "") || "/";
  const arrivee = normaliser(new URL(page.url()).pathname);
  if (arrivee !== normaliser(CHEMIN)) {
    console.error(`\n${CHEMIN} : la navigation a abouti sur ${arrivee}. Rien n'est mesuré.`);
    await navigateur.close();
    process.exit(2);
  }
}
await page.waitForTimeout(2000);
// Le LCP se lit AVANT tout défilement : ensuite, il élirait un élément du bas.
const lcp = (await page.evaluate(() => window.__mesures)).lcp;

// Le CLS, lui, réclame le défilement : les sections du bas peuvent déplacer
// la mise en page au moment où elles entrent à l'écran.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(2500);
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(800);
const m = { lcp, cls: (await page.evaluate(() => window.__mesures)).cls };
const nav = await page.evaluate(() => {
  const n = performance.getEntriesByType("navigation")[0];
  return n ? { dom: n.domContentLoadedEventEnd, charge: n.loadEventEnd } : null;
});

const ko = (o) => `${Math.round(o / 1024)} ko`;
const parNature = await poidsReels();
const total = [...parNature.values()].reduce((a, b) => a + b, 0);

console.log(`\n═══ ${CHEMIN}`);
console.log(`  LCP           ${Math.round(m.lcp)} ms      (bon en dessous de ${SEUILS.lcp})`);
console.log(`  CLS           ${m.cls.toFixed(3)}          (bon en dessous de ${SEUILS.cls})`);
if (nav) {
  console.log(`  DOM prêt      ${Math.round(nav.dom)} ms`);
  console.log(`  Chargement    ${Math.round(nav.charge)} ms`);
}
console.log(`  Requêtes      ${requetes}`);
console.log(`  Transféré     ${ko(total)}`);
for (const [nature, poids] of [...parNature.entries()].sort((a, b) => b[1] - a[1])) {
  if (poids > 0) console.log(`    ${nature.padEnd(12)} ${ko(poids)}`);
}

const soucis = [];
if (m.lcp > SEUILS.lcp) soucis.push(`LCP à ${Math.round(m.lcp)} ms`);
if (m.cls > SEUILS.cls) soucis.push(`CLS à ${m.cls.toFixed(3)}`);
console.log(soucis.length ? `\n  À corriger : ${soucis.join(", ")}` : "\n  Dans les seuils.");

// ── Seconde passe, connexion bridée ───────────────────────────────────────
const ctxLent = await navigateur.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
await ctxLent.addCookies(cookies());
const lente = await ctxLent.newPage();
const cdp = await ctxLent.newCDPSession(lente);
await cdp.send("Network.enable");
// Ordres de grandeur d'une 4G moyenne en zone mal couverte : 1,6 Mb/s en
// descente, 150 ms d'aller-retour.
await cdp.send("Network.emulateNetworkConditions", {
  offline: false,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
  latency: 150,
});
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await lente.addInitScript((__compte) => {
  try {
    sessionStorage.setItem("splash", "1");
    for (const c of ["low_onboarded", "low_visite", `low_onboarded:${__compte}`, `low_visite:${__compte}`]) {
      localStorage.setItem(c, "1");
    }
  } catch {}
  window.__mesures = { lcp: 0 };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__mesures.lcp = e.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
}, COMPTE);
await lente.goto(BASE + CHEMIN, { waitUntil: "load" });
await lente.waitForTimeout(6000);
const lcpLent = (await lente.evaluate(() => window.__mesures)).lcp;
console.log(`\n  Sur téléphone, réseau moyen et processeur quatre fois plus lent :`);
console.log(`  LCP           ${Math.round(lcpLent)} ms      (bon en dessous de ${SEUILS.lcp})`);

await navigateur.close();
