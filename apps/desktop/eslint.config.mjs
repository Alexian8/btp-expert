// ESLint v9 flat config.
//
// Strictness strategy: the lint script in package.json caps warnings via
// `--max-warnings 308` (the current baseline). New code must not raise the
// total. To ratchet down: fix some warnings, run `npm run lint` to see the
// new number, and update the cap accordingly.
//
// Current debt (as of last ratchet):
//   - ~180 `@typescript-eslint/no-explicit-any` — typing work
//   - ~93 `react-hooks/exhaustive-deps` — case-by-case review needed
//   - ~33 `unused-imports/no-unused-vars` — remove or prefix with `_`
//   - 2 `react-refresh/only-export-components`
import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "dist_electron/**",
      "node_modules/**",
      "release/**",
      "build/**",
      "electron/**",
      "*.config.js",
      "*.config.cjs",
      "*.config.mjs",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      "unused-imports": unusedImports,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // TypeScript handles undefined identifiers (and React 17+ JSX runtime
      // doesn't require React to be in scope).
      "no-undef": "off",
      "no-unused-vars": "off",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      // Auto-fixable unused imports detection (delegated from
      // @typescript-eslint/no-unused-vars, which can't auto-fix imports).
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "warn",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-empty": ["warn", { allowEmptyCatch: true }],
    },
  },
];
