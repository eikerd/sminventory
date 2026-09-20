import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Reference material, not source: docs/error-code.js is a ~9,000-line minified
    // bundle, and linting it produced dozens of rules-of-hooks errors about its
    // mangled identifiers.
    "docs/**",
  ]),
]);

export default eslintConfig;
