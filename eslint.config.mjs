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
    // Different runtimes with their own tooling, not part of the Next.js app:
    "supabase/**",   // Deno edge functions (deno-lint, not eslint)
    "design/**",     // Design Component artboards for the mockup canvas
  ]),
]);

export default eslintConfig;
