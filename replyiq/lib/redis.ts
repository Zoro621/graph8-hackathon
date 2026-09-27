// A minimal Upstash Redis client over its REST API (no dependency): used on serverless hosts like Vercel,
// where there is no disk to keep runs on and each request may reach a different instance.
// Vercel's Upstash integration sets KV_REST_API_URL / KV_REST_API_TOKEN; Upstash's own console uses
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN. Either pair works.

export type RedisArg = string | number;

export interface RedisClient {
  cmd<T = unknown>(...args: RedisArg[]): Promise<T>;
  /** Several commands in one round trip; results in order. */
  pipeline(cmds: RedisArg[][]): Promise<unknown[]>;
}

export class RedisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RedisError";
  }
}

/** The Upstash REST endpoint and token from the environment, or null when not configured. */
export function redisConfig(env: Record<string, string | undefined> = process.env): { url: string; token: string } | null {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/+$/, ""), token } : null;
}

export function createRedis(opts: { url: string; token: string; fetchImpl?: typeof fetch }): RedisClient {
  const doFetch = opts.fetchImpl ?? fetch;
  const post = async (path: string, body: unknown) => {
    const res = await doFetch(`${opts.url}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) throw new RedisError(`Redis request failed (${res.status}): ${(json as { error?: string } | null)?.error ?? res.statusText}`);
    return json;
  };
  const unwrap = (r: unknown) => {
    const x = r as { result?: unknown; error?: string };
    if (x?.error) throw new RedisError(x.error);
    return x?.result;
  };
  return {
    async cmd<T>(...args: RedisArg[]) {
      return unwrap(await post("", args.map(String))) as T;
    },
    async pipeline(cmds: RedisArg[][]) {
      if (!cmds.length) return [];
      const out = (await post("/pipeline", cmds.map((c) => c.map(String)))) as unknown[];
      return out.map(unwrap);
    },
  };
}
