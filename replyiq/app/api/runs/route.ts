import { getDeps } from "@/lib/server/deps";
import { body, fail, ok } from "@/lib/server/http";
import { listRunSummaries, startRun } from "@/lib/server/service";

// The pipeline runs after the response (next/server `after`), within this route's max duration.
export const maxDuration = 300;

export async function GET() {
  try {
    return ok(await listRunSummaries(getDeps()));
  } catch (err) {
    return fail(err);
  }
}

export async function POST(req: Request) {
  try {
    return ok(await startRun(getDeps(), await body(req)), 202);
  } catch (err) {
    return fail(err);
  }
}
