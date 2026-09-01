/**
 * Ouvre un compte neuf et dépose de quoi mesurer avec.
 *
 * Les trois scripts de mesure lisent `/tmp/jeton.txt` et `/tmp/uid.txt`. Deux
 * campagnes ont déjà été faussées faute d'un compte frais : un cookie périmé
 * fait mesurer la page de CONNEXION en croyant mesurer le tableau de bord, et
 * un identifiant absent fait mesurer la MODALE D'ACCUEIL, qui devient alors le
 * plus grand élément de la page. Les deux pièges sont écrits dans le journal ;
 * ce script existe pour qu'on cesse de les retomber.
 *
 * Il ne tape que sur le serveur local : un compte de mesure n'a rien à faire
 * dans la vraie base.
 *
 *   node scripts/compte-mesure.mjs
 */
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3311";
if (!/^https?:\/\/(127\.0\.0\.1|localhost)/.test(BASE)) {
  console.error("Ce script ouvre un compte : il ne tourne que sur le serveur local.");
  process.exit(1);
}

const marque = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
// Le domaine `.test` est réservé aux exemples : aucun compte réel ne le porte,
// et la préparation des parcours navigateur purge ces comptes-là.
const compte = { pseudo: `mes${marque}`, email: `mes-${marque}@example.test` };

const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const ctx = await nav.newContext({ locale: "fr-FR" });
const page = await ctx.newPage();

await page.goto(`${BASE}/fr/beta`);
await page.getByPlaceholder(/pseudo/i).first().fill(compte.pseudo);
await page.locator('input[type="email"]').first().fill(compte.email);
const envoyer = page.getByRole("button", { name: /rejoindre|obtenir|valider|envoyer|join/i }).first();
for (let i = 0; i < 20 && !(await envoyer.isEnabled()); i++) await page.waitForTimeout(500);
await envoyer.click();
const code = (await page.locator(".mono-num").first().innerText({ timeout: 20_000 })).trim();

await page.goto(`${BASE}/fr/login`);
await page.getByPlaceholder(/ton pseudo|your username/i).fill(compte.pseudo);
await page.getByPlaceholder(/ton code|your code/i).fill(code);
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30_000 }),
  page.getByRole("button", { name: /^se connecter$|^sign in$/i }).click(),
]);

// Le consentement santé est modal et recouvre la page : il se traverse par
// l'API, comme dans les fichiers de parcours.
await ctx.request.post(`${BASE}/api/consentement`, { data: { accepte: true } });

const session = (await ctx.cookies()).find((c) => c.name.includes("session-token"));
const uid = await page.evaluate(async () => {
  const r = await fetch("/api/auth/session");
  return (await r.json())?.user?.id ?? "";
});

if (!session?.value || !uid) {
  console.error("Compte ouvert mais session ou identifiant manquant : ne pas mesurer avec ça.");
  process.exit(1);
}
writeFileSync("/tmp/jeton.txt", session.value);
writeFileSync("/tmp/uid.txt", uid);
console.log("connexion OK, compte de mesure créé — jeton et identifiant déposés");
await nav.close();
