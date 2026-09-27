import { ApiError } from "./service";

/**
 * Every action (POST) must come from the app's own page: a JSON body (so a cross-site form can't send it
 * without a CORS preflight the API never answers) and, when the browser sends an Origin, the same host.
 * Stops other websites from triggering runs or drafts through a browser that can reach this app.
 */
export function assertSameOrigin(req: Request) {
  const type = req.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) throw new ApiError(415, "json_required", "Actions must be sent as application/json");
  const origin = req.headers.get("origin");
  if (!origin) return; // same-origin fetches from older browsers, curl, tests
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string | null = null;
  try {
    originHost = new URL(origin).host;
  } catch {
    /* "null" or malformed */
  }
  if (!host || originHost !== host) throw new ApiError(403, "cross_origin", "Actions are only accepted from the ReplyIQ app itself");
}
