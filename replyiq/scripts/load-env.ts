// Loads .env.local the same way `next dev` does, for tsx scripts.
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());
