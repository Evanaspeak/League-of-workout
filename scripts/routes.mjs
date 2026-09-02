/**
 * Coût par route d'API : ce qui revient, et en combien de temps.
 *
 * `charge.mjs` monte en charge sur le DOCUMENT. C'est utile et ça ne dit rien
 * du poids d'une réponse d'API — la mesure qu'il fallait pour juger du
 * resserrement des colonnes, et qu'aucun outil ne rendait. On demande chaque
 * route avec la session de mesure, on pèse le corps, on chronomètre vingt
 * appels de suite.
 *
 * Il ne tape que sur le serveur local, comme `charge.mjs` : les scripts de
 * mesure n'écrivent jamais dans la vraie base.
 *
 *   node scripts/compte-mesure.mjs     # un compte frais
 *   node scripts/semer-parties.mjs     # de quoi peser autre chose que le vide
 *   node scripts/routes.mjs
 *
 * Sur un compte NEUF, `/api/games` rend deux octets et `/api/dashboard` presque
 * rien : la mesure serait juste et ne dirait rien. C'est pour ça que le semis
 * existe.
 */
import { readFileSync } from "node:fs";
const BASE = process.env.BASE ?? "http://127.0.0.1:3311";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(BASE)) {
  console.error("Ce script lit un compte de mesure : il ne tourne que sur le serveur local.");
  process.exit(1);
}
const jeton = readFileSync("/tmp/jeton.txt", "utf8").trim();

/**
 * Le jeton se découpe au-delà de 3500 caractères, comme le fait Auth.js.
 * La première version envoyait la valeur nue en guise d'en-tête `cookie` :
 * les sept routes rendaient alors le MÊME nombre d'octets — la page de
 * connexion — et le rapport avait l'air d'un rapport. C'est le premier piège
 * écrit dans le journal, et il se retombe dedans à chaque outil qu'on écrit.
 */
const cookie = jeton.length > 3500
  ? `authjs.session-token.0=${jeton.slice(0, 3500)}; authjs.session-token.1=${jeton.slice(3500)}`
  : `authjs.session-token=${jeton}`;

const ROUTES = [
  "/api/contexte", "/api/dashboard", "/api/games", "/api/progression",
  "/api/settings", "/api/dette", "/api/user",
];

// Contrôle d'atterrissage AVANT toute mesure : une session périmée fait
// chronométrer la page de connexion en croyant mesurer une route.
const temoin = await fetch(BASE + "/api/user", { headers: { cookie } });
const corpsTemoin = await temoin.text();
if (temoin.status !== 200 || !corpsTemoin.trimStart().startsWith("{")) {
  console.error(`Session invalide : /api/user rend ${temoin.status} et du ` +
    `${corpsTemoin.trimStart().startsWith("<") ? "HTML" : "non-JSON"}.`);
  console.error("Relancer `node scripts/compte-mesure.mjs`.");
  process.exit(2);
}

console.log("route                 octets   médiane   p95");
for (const r of ROUTES) {
  const temps = [];
  let octets = 0, code = 0;
  for (let i = 0; i < 20; i++) {
    const t0 = performance.now();
    const res = await fetch(BASE + r, { headers: { cookie } });
    const corps = await res.text();
    temps.push(performance.now() - t0);
    octets = Buffer.byteLength(corps);
    code = res.status;
  }
  temps.sort((a, b) => a - b);
  const med = temps[10].toFixed(0);
  const p95 = temps[18].toFixed(0);
  const alerte = code === 200 ? "" : `  ⚠ ${code}`;
  console.log(`${r.padEnd(20)} ${String(octets).padStart(7)} ${med.padStart(8)} ms ${p95.padStart(5)} ms${alerte}`);
}
