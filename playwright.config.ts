import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/**
 * Tests de bout en bout.
 *
 * Ils ne remplacent pas les tests de routes : ceux-là éprouvent chaque
 * frontière isolément, ceux-ci vérifient qu'un enchaînement complet tient
 * debout dans un vrai navigateur, avec le vrai rendu, la vraie base et les
 * vrais cookies. Un parcours peut être cassé alors que chacune de ses étapes
 * passe son propre test.
 *
 * Ils demandent donc ce que les autres évitent : une base PostgreSQL et un
 * serveur. D'où la commande séparée — `npx jest` doit rester exécutable
 * partout, sans rien installer.
 */
const PORT = Number(process.env.E2E_PORT ?? 3311);

/**
 * Certains environnements fournissent déjà un Chromium, à un emplacement qui
 * ne correspond pas à celui qu'attend la version installée de Playwright.
 * Quand ce binaire existe, on s'en sert ; sinon on laisse Playwright utiliser
 * le sien, celui que `npx playwright install chromium` aura déposé.
 */
const CHROMIUM_FOURNI = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const launchOptions = existsSync(CHROMIUM_FOURNI)
  ? { executablePath: CHROMIUM_FOURNI }
  : {};

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/preparation.ts",
  // Les parcours écrivent dans la même base : les faire tourner en parallèle
  // les ferait se marcher dessus (compteur de dette, unicité des pseudos).
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "list" : "line",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: "fr-FR",
    // Une trace n'est gardée que sur un échec : elle sert à comprendre après
    // coup, pas à alourdir chaque exécution.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], launchOptions } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/cgu`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
