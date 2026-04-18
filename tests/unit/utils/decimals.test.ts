import { describe, it, expect, beforeEach, vi } from "vitest";
import { getTokenDecimals, _resetCache } from "../../../src/utils/decimals.js";

describe("getTokenDecimals", () => {
  beforeEach(() => _resetCache());

  it("reads decimals from contract", async () => {
    const readContract = vi.fn().mockResolvedValue(6);
    const publicClient = { chain: { id: 42161 }, readContract } as any;
    const decimals = await getTokenDecimals({
      publicClient,
      token: "0xaf88d065e77C8cC2239327C5EDb3A432268e5831",
    });
    expect(decimals).toBe(6);
    expect(readContract).toHaveBeenCalledTimes(1);
  });

  it("caches per (chainId, token)", async () => {
    const readContract = vi.fn().mockResolvedValue(18);
    const publicClient = { chain: { id: 42161 }, readContract } as any;
    const token = "0xaf88d065e77C8cC2239327C5EDb3A432268e5831" as const;
    await getTokenDecimals({ publicClient, token });
    await getTokenDecimals({ publicClient, token });
    expect(readContract).toHaveBeenCalledTimes(1);
  });

  it("throws when client has no chain", async () => {
    const publicClient = { readContract: vi.fn() } as any;
    await expect(
      getTokenDecimals({
        publicClient,
        token: "0xaf88d065e77C8cC2239327C5EDb3A432268e5831",
      }),
    ).rejects.toThrow(/chain configured/);
  });
});
