import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: jsxA11y.flatConfigs.recommended.rules,
    settings: {
      "jsx-a11y": {
        components: {
          Input: "input",
          Label: "label",
          Textarea: "textarea",
        },
      },
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    // Vendored Figwright development-plugin bundles are prebuilt/minified.
    ".tools/figwright/plugin/dist/**",
  ]),
]);

export default eslintConfig;
