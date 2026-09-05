import { describe, it, expect } from "vitest";
import { ADDRESSES } from "../../src/constants/addresses.js";
import { createChainContext } from "../../src/context.js";

const AAVE_V3_POOL_BASE = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";

describe("ADDRESSES — Aave V3 na Base (#13)", () => {
  it("ADDRESSES[8453].aave.pool aponta para o Pool da Aave V3 na Base", () => {
    expect(ADDRESSES[8453]?.aave?.pool).toBe(AAVE_V3_POOL_BASE);
  });

  it("createChainContext na Base expõe addresses.aave.pool", () => {
    const ctx = createChainContext({
      chainId: 8453,
      rpcUrls: ["https://mainnet.base.org"],
    });
    expect(ctx.addresses.aave?.pool).toBe(AAVE_V3_POOL_BASE);
  });
});
