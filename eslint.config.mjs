import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Émojis et pictogrammes typographiques : interdits dans le code de l'app.
 *
 * Un émoji est rendu par la police du système. Il n'a ni grille, ni graisse, ni
 * alignement optique, change d'un poste à l'autre, et ne s'accorde à aucune
 * direction artistique — c'est la signature la plus reconnaissable d'une
 * interface produite à la chaîne. Même reproche aux glyphes employés comme
 * icônes (→ ✓ ✕ ▾) : ce sont des caractères de texte, pas des dessins.
 *
 * Le jeu d'icônes de `src/components/Icone.tsx` couvre ces besoins. Une icône
 * qui manque s'y ajoute ; elle ne se tape pas dans une chaîne.
 */
// ⌀-⏿ couvre les « Miscellaneous Technical » : c'est là que vivent
// ⏳, ⌛ et ⏰, qui passaient au travers alors qu'ils rendent exactement le même
// service qu'un émoji — un pictogramme tapé au clavier plutôt que dessiné.
// U+2192 « → » est EXCLU, et c'est une correction de la règle plutôt qu'une
// exception de plus. Recensé sur tout le dépôt : quatre-vingt-cinq occurrences,
// dont quatre-vingt-trois dans des COMMENTAIRES — que ce sélecteur ne lit pas —
// et deux dans une chaîne, toutes deux de la forme « A → B » : la période d'un
// bilan de saison, et l'avant/après d'une correction de date. C'est un
// opérateur de relation, comme « · » ou « % », pas une icône qu'on tape faute
// de savoir la dessiner. La règle le disait déjà pour les tests (« la flèche y
// est de la ponctuation ») ; elle le dit maintenant partout.
//
// Sa limite est écrite plutôt que laissée à découvrir : une flèche EMPLOYÉE
// comme icône — seule dans un bouton, sans rien à sa gauche — passerait
// désormais. Aucune n'existe aujourd'hui, et le jeu d'icônes en porte une.
const GLYPHES_INTERDITS =
  "[\\u{1F000}-\\u{1FAFF}\\u{2190}-\\u{2191}\\u{2193}-\\u{21FF}\\u{2300}-\\u{23FF}"
  + "\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{FE0F}]";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=/${GLYPHES_INTERDITS}/u]`,
          message:
            "Émoji ou pictogramme dans une chaîne. Utilise le composant Icone (src/components/Icone.tsx) : une icône se dessine, elle ne se tape pas.",
        },
        {
          selector: `TemplateElement[value.raw=/${GLYPHES_INTERDITS}/u]`,
          message:
            "Émoji ou pictogramme dans un gabarit de chaîne. Utilise le composant Icone (src/components/Icone.tsx).",
        },
        {
          selector: `JSXText[value=/${GLYPHES_INTERDITS}/u]`,
          message:
            "Émoji ou pictogramme directement dans le JSX. Utilise le composant Icone (src/components/Icone.tsx).",
        },
      ],
    },
  },
  {
    // Le jeu d'icônes documente ce qu'il remplace : il cite donc les glyphes.
    // Les tests, eux, décrivent un comportement en prose (« niveau 1 → 14
    // pompes ») : la flèche y est de la ponctuation, pas une icône.
    files: ["src/components/Icone.tsx", "src/**/*.test.ts", "src/**/*.test.tsx"],
    rules: { "no-restricted-syntax": "off" },
  },
  {
    /**
     * `desktop/` est une coquille CommonJS, et `require()` y est la seule
     * forme qui marche.
     *
     * Electron charge `main.js` en CommonJS ; il n'y a pas de `type: module`
     * dans son `package.json`, et il ne peut pas y en avoir tant que le
     * préchargement doit être synchrone. Les tests de ces modules chargent
     * donc eux aussi par `require`. Soixante et onze constats venaient de là —
     * c'est-à-dire du linter pointé sur un paquet qui n'a pas ses règles, pas
     * d'un défaut.
     */
    files: ["desktop/**/*.{js,ts}"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    /**
     * Le préfixe `_` dit « je déclare ce paramètre et je ne m'en sers pas ».
     *
     * Il sert aux gabarits de pluriel des dictionnaires : une langue qui
     * n'accorde pas — le japonais, le chinois — reçoit le compte et l'ignore,
     * et la signature doit rester la même que celle des quatre autres. Le
     * retirer casserait la parité que `dictionaries.test.ts` exige.
     */
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
    },
  },
  {
    /**
     * `set-state-in-effect` reste VISIBLE et ne bloque pas, et la raison
     * n'est pas de la complaisance.
     *
     * Onze constats, et la plupart lisent une valeur que le SERVEUR ne peut
     * pas connaître — `localStorage`, `navigator.vibrate`, la file hors ligne.
     * En rendu serveur, ça ne peut se lire qu'APRÈS le montage : « corriger »
     * ces effets-là remettrait la lecture dans le rendu, donc rouvrirait une
     * divergence d'hydratation. C'est le défaut que la règle ferait NAÎTRE.
     *
     * Restent deux cas qui sont bien ceux qu'elle vise — un état dérivé du
     * contexte plutôt que calculé au rendu. Ils sont réels et ils coûtent un
     * rendu de plus, pas un défaut visible : les reprendre demande de
     * restructurer un formulaire contrôlé, ce qui se pèse et ne se fait pas
     * en passant. Le constat reste à l'écran plutôt que d'être éteint.
     */
    files: ["src/**/*.{ts,tsx}"],
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
