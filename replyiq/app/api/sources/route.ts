import { getDeps } from "@/lib/server/deps";
import { fail, ok } from "@/lib/server/http";
import { listSources } from "@/lib/server/service";

export async function GET(req: Request) {
  try {
    const refresh = new URL(req.url).searchParams.get("refresh") === "1";
    return ok(await listSources(getDeps(), { refresh }));
  } catch (err) {
    return fail(err);
  }
}
