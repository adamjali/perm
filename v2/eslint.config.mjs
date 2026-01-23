// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";
import security from "eslint-plugin-security";

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  ...storybook.configs["flat/recommended"],
  security.configs.recommended,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Convex generated files
    "convex/_generated/**",
    // Coverage files
    "coverage/**",
    // Serwist-generated service worker (minified third-party code)
    "public/sw.js",
  ]),
  // Custom rule overrides
  {
    rules: {
      // Allow unused variables that start with underscore
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Downgrade no-explicit-any to warning (there are many legitimate uses)
      "@typescript-eslint/no-explicit-any": "warn",
      // Downgrade empty interface error to warning (sometimes needed for extensibility)
      "@typescript-eslint/no-empty-object-type": "warn",
      // Disable set-state-in-effect - Many valid patterns like syncing state from props,
      // loading from localStorage, and SSR mounted state trigger this warning
      "react-hooks/set-state-in-effect": "off",
      // Disable incompatible-library warnings from React Compiler - React Hook Form's
      // watch() is a known incompatibility but works correctly
      "react-hooks/incompatible-library": "off",
    },
  },
  // Less strict rules for test files
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**"],
    rules: {
      // Test files often have unused variables from render destructuring, setup functions, and mocks
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_|^data$|^rfiEntries$|^rfeEntries$",
          varsIgnorePattern: "^_|^container$|^rerender$|^unmount$|^list$|^user$|^beforeEach$|^vi$|^within$|^milestoneMarkers$|^mock|^render|^expected|^beneficiary",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Test files often use any for mocking
      "@typescript-eslint/no-explicit-any": "off",
      // Test files may have expression statements for assertions
      "@typescript-eslint/no-unused-expressions": "off",
    },
  },
]);

export default eslintConfig;
