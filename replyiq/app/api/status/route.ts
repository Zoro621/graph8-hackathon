import { envStatus } from "@/lib/env";
import { getDeps, missingKeys } from "@/lib/server/deps";
import { fail, ok } from "@/lib/server/http";
import { getStatus } from "@/lib/server/service";
import type { StatusView } from "@/lib/api-types";

export async function GET() {
  const missing = missingKeys();
  if (missing.length) return ok<StatusView>({ configured: false, missing, launchEnabled: envStatus().launchEnabled, minGroupSize: Number(process.env.MIN_GROUP_SIZE) || 2 });
  try {
    return ok(await getStatus(getDeps()));
  } catch (err) {
    return fail(err);
  }
}
