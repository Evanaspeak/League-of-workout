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
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:3311";
const CHEMIN = process.argv[3] ?? "/";
const CHROMIUM = "/opt/pw-browsers/chromium";

/** Seuils publiés par Google pour un chargement jugé bon. */
const SEUILS = { lcp: 2500, cls: 0.1 };

const navigateur = await chromium.launch(
  existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {},
);
const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 900 }, locale: "fr-FR" });
const page = await ctx.newPage();

/** Poids transféré, par nature de ressource. */
const parNature = new Map();
let requetes = 0;
page.on("response", async (r) => {
  requetes++;
  const type = r.request().resourceType();
  const taille = Number(r.headers()["content-length"] ?? 0);
  parNature.set(type, (parNature.get(type) ?? 0) + taille);
});

await page.addInitScript(() => {
  // L'écran d'ouverture recouvre la page : mesuré avec, on chronomètre une
  // animation plutôt que le contenu.
  try { sessionStorage.setItem("splash", "1"); } catch {}
  window.__mesures = { lcp: 0, cls: 0 };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__mesures.lcp = e.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      if (!e.hadRecentInput) window.__mesures.cls += e.value;
    }
  }).observe({ type: "layout-shift", buffered: true });
});

await page.goto(BASE + CHEMIN, { waitUntil: "networkidle" });
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
await lente.addInitScript(() => {
  try { sessionStorage.setItem("splash", "1"); } catch {}
  window.__mesures = { lcp: 0 };
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) window.__mesures.lcp = e.startTime;
  }).observe({ type: "largest-contentful-paint", buffered: true });
});
await lente.goto(BASE + CHEMIN, { waitUntil: "load" });
await lente.waitForTimeout(6000);
const lcpLent = (await lente.evaluate(() => window.__mesures)).lcp;
console.log(`\n  Sur téléphone, réseau moyen et processeur quatre fois plus lent :`);
console.log(`  LCP           ${Math.round(lcpLent)} ms      (bon en dessous de ${SEUILS.lcp})`);

await navigateur.close();
