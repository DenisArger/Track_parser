import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    setupFiles: ["vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      exclude: [
        "node_modules/**",
        ".next/**",
        ".netlify/**",
        "**/*.test.{ts,tsx}",
        "**/types/**",
        "vitest.config.ts",
        "vitest.setup.ts",
      ],
      include: ["lib/**/*.ts", "app/**/*.{ts,tsx}", "middleware.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
    dedupe: ["react", "react-dom"],
  },
});
