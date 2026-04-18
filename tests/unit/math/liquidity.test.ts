import { describe, it, expect } from "vitest";
import { getLockedAmounts } from "../../../src/math/liquidity.js";

describe("liquidity", () => {
  describe("getLockedAmounts", () => {
    it("returns zeros when liquidity is 0", () => {
      const result = getLockedAmounts({
        liquidity: 0n,
        tickLower: -600,
        tickUpper: 600,
        currentTick: 0,
        token0Decimals: 18,
        token1Decimals: 6,
      });
      expect(result.amount0).toBe(0);
      expect(result.amount1).toBe(0);
    });

    it("current tick inside range: both amounts positive", () => {
      const result = getLockedAmounts({
        liquidity: 1_000_000_000_000_000_000n,
        tickLower: -600,
        tickUpper: 600,
        currentTick: 0,
        token0Decimals: 18,
        token1Decimals: 18,
      });
      expect(result.amount0).toBeGreaterThan(0);
      expect(result.amount1).toBeGreaterThan(0);
    });

    it("current tick below range (clamped to lower): only amount0 > 0, amount1 = 0", () => {
      // When clamped to tickLower: sqrtC = sqrtL → amount1_raw = liquidity*(sqrtL-sqrtL)/Q96 = 0
      const result = getLockedAmounts({
        liquidity: 1_000_000_000_000_000_000n,
        tickLower: -600,
        tickUpper: 600,
        currentTick: -1000,
        token0Decimals: 18,
        token1Decimals: 18,
      });
      expect(result.amount0).toBeGreaterThan(0);
      expect(result.amount1).toBe(0);
    });

    it("current tick above range (clamped to upper): only amount1 > 0, amount0 = 0", () => {
      // When clamped to tickUpper: sqrtC = sqrtU → amount0_raw = liquidity*Q96*(sqrtU-sqrtU)/(sqrtC*sqrtU) = 0
      const result = getLockedAmounts({
        liquidity: 1_000_000_000_000_000_000n,
        tickLower: -600,
        tickUpper: 600,
        currentTick: 1000,
        token0Decimals: 18,
        token1Decimals: 18,
      });
      expect(result.amount0).toBe(0);
      expect(result.amount1).toBeGreaterThan(0);
    });

    it("decimal scaling applied correctly for different decimals", () => {
      const result18_6 = getLockedAmounts({
        liquidity: 1_000_000_000_000_000_000n,
        tickLower: -600,
        tickUpper: 600,
        currentTick: 0,
        token0Decimals: 18,
        token1Decimals: 6,
      });
      const result18_18 = getLockedAmounts({
        liquidity: 1_000_000_000_000_000_000n,
        tickLower: -600,
        tickUpper: 600,
        currentTick: 0,
        token0Decimals: 18,
        token1Decimals: 18,
      });
      // amount1 with 6 decimals token should be 10^12 times larger than with 18 decimals
      expect(result18_6.amount1 / result18_18.amount1).toBeCloseTo(1e12, -6);
    });

    it("symmetric range around tick 0: amounts are approximately equal for equal decimals", () => {
      const result = getLockedAmounts({
        liquidity: 1_000_000_000_000_000_000n,
        tickLower: -600,
        tickUpper: 600,
        currentTick: 0,
        token0Decimals: 18,
        token1Decimals: 18,
      });
      const ratio = result.amount0 / result.amount1;
      // Symmetric range → amounts should be close (within 5%)
      expect(ratio).toBeGreaterThan(0.95);
      expect(ratio).toBeLessThan(1.05);
    });
  });
});
