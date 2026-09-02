/**
 * Soixante parties sur le compte de mesure, pour peser de vraies réponses.
 *
 * Sans elles, `routes.mjs` mesure un historique vide — deux octets — et rend
 * un rapport parfaitement juste qui ne dit rien. C'est la variante « mesurer
 * la bonne page » appliquée au contenu plutôt qu'à l'adresse.
 *
 *   node scripts/compte-mesure.mjs && node scripts/semer-parties.mjs
 */
import { readFileSync } from "node:fs";
const BASE = process.env.BASE ?? "http://127.0.0.1:3311";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(BASE)) {
  console.error("Ce script écrit des parties : il ne tourne que sur le serveur local.");
  process.exit(1);
}
const j = readFileSync("/tmp/jeton.txt", "utf8").trim();
const cookie = j.length > 3500
  ? `authjs.session-token.0=${j.slice(0, 3500)}; authjs.session-token.1=${j.slice(3500)}`
  : `authjs.session-token=${j}`;

const ROLES = ["Top", "Jungle", "Mid", "ADC", "Support"];
const CHAMPS = ["Ahri", "Yasuo", "Lux", "Ezreal", "Thresh", "Kog'Maw"];
let ok = 0, refus = 0;
for (let i = 0; i < 60; i++) {
  const r = await fetch(`${BASE}/api/games`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      jeu: "League of Legends", role: ROLES[i % 5], champion: CHAMPS[i % 6],
      kills: i % 12, deaths: (i * 3) % 11, assists: (i * 5) % 15,
      result: i % 3 === 0 ? "V" : "D", exercice: "pompes",
      date: new Date(Date.now() - i * 3600_000).toISOString(),
    }),
  });
  if (r.ok) ok += 1; else { refus += 1; if (refus === 1) console.log("premier refus :", r.status, (await r.text()).slice(0, 120)); }
}
console.log(`${ok} parties enregistrées, ${refus} refusées`);
