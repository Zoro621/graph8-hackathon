import { getDeps } from "@/lib/server/deps";
import { body, fail, ok } from "@/lib/server/http";
import { runLearnings } from "@/lib/server/service";

export const maxDuration = 120;

export async function POST(req: Request, ctx: RouteContext<"/api/runs/[runId]/learnings">) {
  try {
    const { runId } = await ctx.params;
    return ok(await runLearnings(getDeps(), runId, await body(req)));
  } catch (err) {
    return fail(err);
  }
}
