import "./load-env";
import { envStatus, getEnv } from "../lib/env";

const status = envStatus();
console.log(`graph8 key:   ${status.g8Key ? "✅ set" : "❌ missing"}`);
console.log(`OpenAI key:   ${status.openaiKey ? "✅ set" : "❌ missing"}`);
console.log(`Launch flag:  ${status.launchEnabled ? "ON" : "off"}`);

try {
  const env = getEnv();
  console.log(`Models:       classify=${env.OPENAI_CLASSIFY_MODEL}  reason=${env.OPENAI_REASON_MODEL}`);
  console.log("✅ Environment is valid");
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
