import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../../../src/utils/retry.js";

describe("withRetry", () => {
  it("returns result immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds on second attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { base: 1, max: 10, attempts: 3 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after all attempts exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("rpc down"));
    await expect(
      withRetry(fn, { base: 1, max: 10, attempts: 3 }),
    ).rejects.toThrow("rpc down");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("uses custom attempts count", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(
      withRetry(fn, { base: 1, max: 10, attempts: 2 }),
    ).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("returns typed result preserving generic T", async () => {
    const fn = vi.fn().mockResolvedValue(42n);
    const result = await withRetry(fn);
    expect(result).toBe(42n);
  });
});
