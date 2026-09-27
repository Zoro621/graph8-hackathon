import { getDeps } from "@/lib/server/deps";
import { fail, ok } from "@/lib/server/http";
import { getOriginal } from "@/lib/server/service";

/** The run's original sequence (V1), read live from graph8. Read-only. */
export async function GET(_req: Request, ctx: RouteContext<"/api/runs/[runId]/original">) {
  try {
    const { runId } = await ctx.params;
    return ok(await getOriginal(getDeps(), runId));
  } catch (err) {
    return fail(err);
  }
}
