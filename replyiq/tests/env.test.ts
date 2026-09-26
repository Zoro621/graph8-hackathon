import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function load() {
  return import("../lib/env");
}

describe("getEnv", () => {
  it("applies defaults when only keys are set", async () => {
    vi.stubEnv("G8_API_KEY", "test-g8");
    vi.stubEnv("OPENAI_API_KEY", "test-openai");
    const { getEnv } = await load();
    const env = getEnv();
    expect(env.G8_API_BASE).toBe("https://be.graph8.com/api/v1");
    expect(env.ENABLE_LAUNCH).toBe(false);
    expect(env.MIN_GROUP_SIZE).toBe(2);
  });

  it("throws a helpful error when keys are missing", async () => {
    vi.stubEnv("G8_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    const { getEnv } = await load();
    expect(() => getEnv()).toThrow(/G8_API_KEY/);
  });

  it("parses the launch flag", async () => {
    vi.stubEnv("G8_API_KEY", "x");
    vi.stubEnv("OPENAI_API_KEY", "y");
    vi.stubEnv("ENABLE_LAUNCH", "true");
    const { getEnv } = await load();
    expect(getEnv().ENABLE_LAUNCH).toBe(true);
  });
});
