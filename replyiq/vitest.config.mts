import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// `npm test` runs the offline suite. `npm run test:live` (RUN_LIVE=1) adds tests/live/**, which
// call real graph8 + OpenAI using .env.local. Only tag.live writes (tags on the synthetic [DEMO] sequence).
// Live files run one at a time: fair use of graph8, and no request bursts (a burst drew a spurious 401 on 27 Sep).
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
    fileParallelism: !live,
  },
});
