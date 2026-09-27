import { getDeps } from "@/lib/server/deps";
import { body, fail, ok } from "@/lib/server/http";
import { startDraft } from "@/lib/server/service";

// Drafting runs after the response and can wait on graph8 Studio for a few minutes.
export const maxDuration = 300;

export async function POST(req: Request, ctx: RouteContext<"/api/runs/[runId]/groups/[key]/draft">) {
  try {
    const { runId, key } = await ctx.params;
    return ok(await startDraft(getDeps(), runId, key, await body(req)), 202);
  } catch (err) {
    return fail(err);
  }
}
