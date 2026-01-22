import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      ".yarn/**",
      ".netlify/**",
      "dist/**",
      "build/**",
      "*.config.js",
      "*.config.mjs",
      "vitest.config.ts",
      "vitest.setup.ts",
      "downloads/**",
      "processed/**",
      "rejected/**",
      "server_upload/**",
      "temp/**",
    ],
  },
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
      react,
      "react-hooks": reactHooks,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unescaped-entities": "error",
      "react-hooks/set-state-in-effect": "warn", // Allow setState in useEffect for initialization
      "@typescript-eslint/no-explicit-any": "warn", // Allow any types with warning
      "@typescript-eslint/no-require-imports": "warn", // Allow require() in config files
      "no-async-promise-executor": "warn", // Allow async promise executors
      "no-extra-boolean-cast": "warn", // Allow double negation
      "no-control-regex": "warn", // Allow control characters in regex
      "no-undef": "off", // TypeScript handles this
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
];
