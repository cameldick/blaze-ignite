import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The codebase uses NodeNext `.js` import specifiers that point at `.ts`
    // sources; map them so Vitest resolves the TypeScript files.
    extensionAlias: { ".js": [".ts", ".js"] },
  },
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
  },
});
