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
  /**
   * Quatre workers, et non un.
   *
   * La raison d'origine — « les parcours écrivent dans la même base » — n'est
   * plus vraie : chaque fichier ouvre son propre compte avec un suffixe
   * aléatoire, et la dette comme les pseudos sont par compte. Il ne restait
   * que deux obstacles réels, tous deux traités :
   *
   *  * `bareme-gele.spec.ts` écrit les ratios GLOBAUX dans `SystemConfig`. Il
   *    est seul dans le projet `serie`, qui ne démarre qu'une fois le reste
   *    terminé ;
   *  * le limiteur d'inscription est indexé sur l'adresse IP, donc commun à
   *    tous les workers. Chacun envoie maintenant la sienne — voir
   *    `e2e/compte.ts`.
   *
   * `fullyParallel: false` garde l'ordre DANS un fichier : plusieurs parcours
   * y partagent un compte ouvert par le premier test, et les paralléliser
   * casserait cette dépendance-là, qui est voulue.
   *
   * **Deux et non quatre**, et la raison est le PROCESSEUR, pas la base. La
   * machine a quatre cœurs ; à quatre workers il faut y loger quatre Chromium,
   * quatre processus de test ET le serveur Next, qui hache les mots de passe
   * en bcrypt coût 12 — du calcul pur, un quart de seconde par connexion. Deux
   * parcours sont morts là-dessus, tous deux en expirant sur la connexion,
   * jamais sur ce qu'ils éprouvaient. Un banc d'essai qui sature la machine ne
   * mesure plus le produit, il mesure la file d'attente.
   */
  /**
   * Deux workers en local, UN SEUL en intégration continue — et ce n'est pas
   * une prudence, c'est la même mesure lue à l'endroit.
   *
   * Les tests de langue sont passés en mode parallèle, donc l'ordonnanceur
   * fait tourner en permanence des chargements de page rendus au serveur à
   * côté des parcours qui ouvrent un compte. Le haché bcrypt coût 12 de la
   * connexion perd alors sa place dans la file : la CI a rendu le MÊME échec
   * que les quatre workers d'août — `waitForURL` qui expire sur la connexion,
   * jamais sur ce que le test éprouvait.
   *
   * La réponse n'est pas de baisser le coût du haché, qui est un choix de
   * production et n'a pas à porter un bouton, ni d'allonger un délai en
   * espérant. C'est de donner une MACHINE ENTIÈRE à chaque worker : quatre
   * tronçons d'un worker chacun, sur quatre runners. Le dépôt est public, ces
   * minutes ne se paient pas, et un runner qui héberge un seul Chromium, un
   * seul processus de test et le serveur Next ne sature plus.
   *
   * En local il n'y a qu'une machine : deux workers y restent le compromis
   * mesuré, quatre ayant déjà tué deux parcours sur la connexion.
   */
  workers: process.env.CI ? 1 : 2,
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
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], launchOptions },
      testIgnore: /bareme-gele\.spec\.ts/,
    },
    {
      /**
       * `bareme-gele` est SEUL à écrire une configuration globale — les ratios
       * entre exercices. Il attend donc que tout le reste soit terminé :
       * lancé en parallèle, il changerait le barème sous les pieds des autres,
       * et l'échec tomberait n'importe où sauf ici.
       */
      name: "bareme",
      use: { ...devices["Desktop Chrome"], launchOptions },
      testMatch: /bareme-gele\.spec\.ts/,
      dependencies: ["chromium"],
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/cgu`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
