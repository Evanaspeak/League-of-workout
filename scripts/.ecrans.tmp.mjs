import { chromium } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";

const exe = "/opt/pw-browsers/chromium";
const jeton = readFileSync("/tmp/jeton.txt", "utf8").trim();
const dossier = process.argv[2];
const nav = await chromium.launch(existsSync(exe) ? { executablePath: exe } : {});

// Le cookie de session est trop gros pour une seule part : Auth.js le découpe.
const parts = jeton.length > 3500
  ? [["authjs.session-token.0", jeton.slice(0, 3500)], ["authjs.session-token.1", jeton.slice(3500)]]
  : [["authjs.session-token", jeton]];

const ECRANS = [
  ["dashboard", "/dashboard"],
  ["historique", "/history"],
  ["reglages", "/settings"],
];

for (const langue of ["fr", "en", "es", "de", "zh", "ja"]) {
  const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addCookies(parts.map(([name, value]) => ({
    name, value, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax",
  })));
  await ctx.addInitScript(([l]) => {
    try {
      localStorage.setItem("low_locale", l);
      sessionStorage.setItem("splash", "1");
      localStorage.setItem("low_visite", "1");
      // La mémoire de la modale est propre au compte ; on couvre les deux formes.
      for (const c of ["low_onboarded", "low_onboarded:" + (localStorage.getItem("uid") || "")]) {
        localStorage.setItem(c, "1");
      }
    } catch {}
  }, [langue]);
  const page = await ctx.newPage();
  for (const [nom, chemin] of ECRANS) {
    const erreurs = [];
    page.on("pageerror", (e) => erreurs.push(String(e).slice(0, 120)));
    await page.goto("http://localhost:3311" + chemin, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const texte = await page.evaluate(() => document.body.innerText);
    const trous = (texte.match(/\bundefined\b|\[object Object\]/g) || []).length;
    // Un débordement horizontal veut dire qu'un mot traduit ne tient pas.
    const deborde = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    console.log(`${langue}/${nom}  ${texte.length} car · trous:${trous} · débord:${deborde} · erreurs:${erreurs.length}`);
    if (erreurs.length) console.log("    ", erreurs[0]);
    await page.screenshot({ path: `${dossier}/${nom}-${langue}.png`, fullPage: true });
  }
  await ctx.close();
}
await nav.close();
