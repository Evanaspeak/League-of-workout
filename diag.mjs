import { chromium } from "playwright";
import { readFileSync } from "node:fs";
const uid = readFileSync("/tmp/uid.txt","utf8").trim();
const jeton = readFileSync("/tmp/jeton.txt","utf8").trim();
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
for (const js of [true, false]) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR", javaScriptEnabled: js });
  await ctx.addCookies([{ name: "authjs.session-token", value: jeton, domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150,
    downloadThroughput: (1.6*1024*1024)/8, uploadThroughput: (750*1024)/8 });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  if (js) await page.addInitScript((u) => { try { sessionStorage.setItem("splash","1");
    for (const c of ["low_onboarded","low_visite",`low_onboarded:${u}`,`low_visite:${u}`]) localStorage.setItem(c,"1"); } catch {} }, uid);
  await page.goto("http://127.0.0.1:3311/bilan", { waitUntil: "load" });
  await page.waitForTimeout(5000);
  const r = await page.evaluate(() => new Promise((res) => {
    let lcp = 0, el = "";
    new PerformanceObserver((l) => { for (const e of l.getEntries()) { lcp = e.startTime; el = e.element?.tagName || ""; } })
      .observe({ type: "largest-contentful-paint", buffered: true });
    setTimeout(() => {
      const img = performance.getEntriesByType("resource").find((e) => e.name.includes("bilan/image"));
      res({ lcp: Math.round(lcp), el, imgFin: img ? Math.round(img.responseEnd) : null });
    }, 300);
  }));
  console.log(js ? "avec JS  " : "sans JS  ", JSON.stringify(r));
  await ctx.close();
}
await nav.close();
