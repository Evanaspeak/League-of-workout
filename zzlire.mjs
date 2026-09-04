import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";
const j = readFileSync("/tmp/jeton.txt", "utf8").trim();
const uid = readFileSync("/tmp/uid.txt", "utf8").trim();
const n = "authjs.session-token";
const cookies = j.length > 3500
  ? [{ name: `${n}.0`, value: j.slice(0,3500), domain: "127.0.0.1", path: "/" },
     { name: `${n}.1`, value: j.slice(3500), domain: "127.0.0.1", path: "/" }]
  : [{ name: n, value: j, domain: "127.0.0.1", path: "/" }];
const CH = "/opt/pw-browsers/chromium";
const nav = await chromium.launch(existsSync(CH) ? { executablePath: CH } : {});
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: "fr-FR" });
await ctx.addCookies(cookies);
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(60_000);
await page.addInitScript((u) => {
  try { sessionStorage.setItem("splash", "1");
    for (const c of ["low_onboarded", "low_visite", `low_onboarded:${u}`, `low_visite:${u}`]) localStorage.setItem(c, "1");
  } catch {}
}, uid);
for (const chemin of process.argv.slice(2)) {
  await page.goto(`http://127.0.0.1:3311${chemin}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const t = await page.evaluate(() => (document.querySelector("main") || document.body).innerText);
  console.log(`\n════════ ${chemin}\n${t.split("\n").filter((l) => l.trim()).join("\n")}`);
}
await nav.close();
