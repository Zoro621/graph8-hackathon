import { getDeps } from "@/lib/server/deps";
import { fail, ok } from "@/lib/server/http";
import { getRunView } from "@/lib/server/service";

export async function GET(_req: Request, ctx: RouteContext<"/api/runs/[runId]">) {
  try {
    const { runId } = await ctx.params;
    return ok(await getRunView(getDeps(), runId));
  } catch (err) {
    return fail(err);
  }
}
