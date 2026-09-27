// Live suite: load .env.local like `next dev` does.
// Vitest sets NODE_ENV=test, and @next/env skips .env.local in test mode, so load in development mode.
import { loadEnvConfig } from "@next/env";

const prev = process.env.NODE_ENV;
(process.env as Record<string, string | undefined>).NODE_ENV = "development";
loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });
(process.env as Record<string, string | undefined>).NODE_ENV = prev;
