import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// `npm test` runs the offline suite. `npm run test:live` (RUN_LIVE=1) adds tests/live/**, which
// call real graph8 + OpenAI using .env.local. Live tests never write to graph8.
const live = process.env.RUN_LIVE === "1";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: live ? ["node_modules/**"] : ["node_modules/**", "tests/live/**"],
    environment: "node",
    setupFiles: live ? ["tests/live/setup.ts"] : [],
    testTimeout: live ? 180_000 : 5_000,
    hookTimeout: live ? 180_000 : 10_000,
  },
});
