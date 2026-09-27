import type { StatusView } from "../api-types";

export type ConnectionState = "loading" | "setup" | "error" | "live" | "readonly";

/**
 * One reading of /api/status for every screen. A configured server can still fail to reach graph8:
 * /api/status then answers 200 with `error`, which is an error state, not a healthy one.
 * A failed refetch wins over the last good status the cache keeps, so a stale "connected" never shows.
 */
export function connectionState(status: StatusView | undefined, fetchError?: { message: string }): { state: ConnectionState; message?: string } {
  if (fetchError) return { state: "error", message: fetchError.message };
  if (!status) return { state: "loading" };
  if (!status.configured) return { state: "setup", message: `Add ${status.missing.join(" and ") || "the API keys"} to .env.local (on Vercel: the project's environment variables)` };
  if (status.error) return { state: "error", message: status.error };
  if (status.write && !status.write.allowed) return { state: "readonly", message: status.write.reason };
  return { state: "live" };
}
