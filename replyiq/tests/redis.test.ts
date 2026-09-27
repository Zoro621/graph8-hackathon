import { describe, expect, it } from "vitest";
import { createRedis, redisConfig, RedisError } from "../lib/redis";
import { createRedisStore } from "../lib/store";
import { redisJobs } from "../lib/server/jobs";
import { emptyRun } from "../lib/pipeline/runPipeline";

/** An in-memory stand-in for Upstash's REST API: POST / with one command, POST /pipeline with several. */
function fakeUpstash(token = "t0ken") {
  const kv = new Map<string, string>();
  const zsets = new Map<string, Map<string, number>>();
  const requests: { path: string; auth: string | null; body: unknown }[] = [];
  const run = (c: string[]): unknown => {
    const [op, ...a] = c;
    switch (op.toUpperCase()) {
      case "GET":
        return kv.get(a[0]) ?? null;
      case "SET": {
        const nx = a.includes("NX");
        if (nx && kv.has(a[0])) return null;
        kv.set(a[0], a[1]);
        return "OK";
      }
      case "DEL":
        return kv.delete(a[0]) ? 1 : 0;
      case "MGET":
        return a.map((k) => kv.get(k) ?? null);
      case "ZADD": {
        const z = zsets.get(a[0]) ?? new Map<string, number>();
        z.set(a[2], Number(a[1]));
        zsets.set(a[0], z);
        return 1;
      }
      case "ZRANGE": {
        const entries = [...(zsets.get(a[0]) ?? new Map()).entries()].sort((x, y) => x[1] - y[1]).map(([m]) => m);
        return a.includes("REV") ? entries.reverse() : entries;
      }
      default:
        throw new Error(`unsupported ${op}`);
    }
  };
  const fetchImpl = (async (url: string, init: RequestInit) => {
    const path = new URL(url).pathname;
    const auth = new Headers(init.headers).get("authorization");
    const body = JSON.parse(String(init.body));
    requests.push({ path, auth, body });
    if (auth !== `Bearer ${token}`) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    const reply = (c: string[]) => {
      try {
        return { result: run(c) };
      } catch (err) {
        return { error: (err as Error).message };
      }
    };
    return new Response(JSON.stringify(path === "/pipeline" ? (body as string[][]).map(reply) : reply(body as string[])), { status: 200 });
  }) as unknown as typeof fetch;
  return { fetchImpl, kv, requests };
}

describe("Upstash Redis (serverless run storage)", () => {
  it("reads either variable pair, preferring Upstash's own names", () => {
    expect(redisConfig({})).toBeNull();
    expect(redisConfig({ KV_REST_API_URL: "https://kv.example/", KV_REST_API_TOKEN: "a" })).toEqual({ url: "https://kv.example", token: "a" });
    expect(redisConfig({ KV_REST_API_URL: "https://kv", KV_REST_API_TOKEN: "a", UPSTASH_REDIS_REST_URL: "https://up", UPSTASH_REDIS_REST_TOKEN: "b" })).toEqual({ url: "https://up", token: "b" });
  });

  it("sends commands with the token and surfaces Redis errors", async () => {
    const up = fakeUpstash();
    const redis = createRedis({ url: "https://r.example", token: "t0ken", fetchImpl: up.fetchImpl });
    expect(await redis.cmd("SET", "k", 1)).toBe("OK");
    expect(up.requests[0]).toEqual({ path: "/", auth: "Bearer t0ken", body: ["SET", "k", "1"] });
    await expect(redis.cmd("NOPE")).rejects.toBeInstanceOf(RedisError);
    const bad = createRedis({ url: "https://r.example", token: "wrong", fetchImpl: up.fetchImpl });
    await expect(bad.cmd("GET", "k")).rejects.toThrow(/401/);
  });

  it("stores runs by id and lists them newest first", async () => {
    const up = fakeUpstash();
    const store = createRedisStore(createRedis({ url: "https://r.example", token: "t0ken", fetchImpl: up.fetchImpl }));
    const older = emptyRun("aaaaaaaaaaaa", { sequenceId: "s" }, new Date("2026-09-27T09:00:00Z"));
    const newer = emptyRun("bbbbbbbbbbbb", { sequenceId: "s" }, new Date("2026-09-27T10:00:00Z"));
    await store.save(older);
    await store.save(newer);
    await store.save({ ...older, status: "done" }); // re-saving keeps one entry
    expect(await store.load("aaaaaaaaaaaa")).toMatchObject({ id: "aaaaaaaaaaaa", status: "done" });
    expect(await store.load("cccccccccccc")).toBeNull();
    expect((await store.list()).map((r) => r.id)).toEqual(["bbbbbbbbbbbb", "aaaaaaaaaaaa"]);
    await expect(store.load("../../etc")).rejects.toThrow(/Invalid run id/);
  });

  it("the job lock is shared: a second claim fails until release; it carries the job for every instance to see", async () => {
    const up = fakeUpstash();
    const redis = createRedis({ url: "https://r.example", token: "t0ken", fetchImpl: up.fetchImpl });
    const a = redisJobs(redis);
    const b = redisJobs(redis); // another serverless instance
    expect(await a.claim("aaaaaaaaaaaa", "draft", "pricing_request")).toBe(true);
    expect(await b.claim("aaaaaaaaaaaa", "pipeline")).toBe(false);
    expect(await b.active("aaaaaaaaaaaa")).toMatchObject({ kind: "draft", group: "pricing_request" });
    expect(up.requests.find((r) => (r.body as string[])[0] === "SET")?.body).toEqual(expect.arrayContaining(["NX", "EX", "330"])); // frees itself if a function dies
    await a.release("aaaaaaaaaaaa");
    expect(await b.active("aaaaaaaaaaaa")).toBeNull();
    expect(await b.claim("aaaaaaaaaaaa", "pipeline")).toBe(true);
  });
});
