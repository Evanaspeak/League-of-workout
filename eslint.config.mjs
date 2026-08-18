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
const GLYPHES_INTERDITS =
  "[\\u{1F000}-\\u{1FAFF}\\u{2190}-\\u{21FF}\\u{2600}-\\u{27BF}\\u{2B00}-\\u{2BFF}\\u{FE0F}]";

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
