import { describe, expect, it, vi } from "vitest";
import { renameWithRetry } from "../lib/store";

const fsError = (code: string) => Object.assign(new Error(code), { code });

describe("renameWithRetry (Windows file locks)", () => {
  it("retries EPERM / EBUSY until the rename succeeds", async () => {
    const renameImpl = vi.fn().mockRejectedValueOnce(fsError("EPERM")).mockRejectedValueOnce(fsError("EBUSY")).mockResolvedValueOnce(undefined);
    const sleep = vi.fn().mockResolvedValue(undefined);
    await renameWithRetry("a.tmp", "a.json", { renameImpl, sleep });
    expect(renameImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([25, 50]);
  });

  it("gives up after the last attempt and rethrows", async () => {
    const renameImpl = vi.fn().mockRejectedValue(fsError("EPERM"));
    await expect(renameWithRetry("a.tmp", "a.json", { renameImpl, sleep: async () => {}, attempts: 3 })).rejects.toThrow("EPERM");
    expect(renameImpl).toHaveBeenCalledTimes(3);
  });

  it("does not retry other errors", async () => {
    const renameImpl = vi.fn().mockRejectedValue(fsError("ENOSPC"));
    await expect(renameWithRetry("a.tmp", "a.json", { renameImpl, sleep: async () => {} })).rejects.toThrow("ENOSPC");
    expect(renameImpl).toHaveBeenCalledTimes(1);
  });
});
