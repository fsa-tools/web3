import { describe, it, expect } from "vitest";
import {
  getSqrtRatioAtTick,
  roundToTickSpacing,
  ceilToTickSpacing,
  priceToTick,
  tickToPrice,
  feeToTickSpacing,
  percentToTickOffset,
  inversePriceToTick,
  formatSqrtPrice,
  MIN_TICK,
  MAX_TICK,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
} from "../../../src/math/ticks.js";

describe("ticks", () => {
  describe("getSqrtRatioAtTick", () => {
    it("tick 0 equals Q96 (sqrt(1) * 2^96)", () => {
      // sqrt(1.0001^0) * 2^96 = 2^96
      expect(getSqrtRatioAtTick(0)).toBe(79228162514264337593543950336n);
    });

    it("positive tick produces larger sqrtRatio than negative tick", () => {
      const pos = getSqrtRatioAtTick(100);
      const neg = getSqrtRatioAtTick(-100);
      expect(pos).toBeGreaterThan(neg);
    });

    it("getSqrtRatioAtTick at MIN_TICK is smallest valid value", () => {
      expect(getSqrtRatioAtTick(MIN_TICK)).toBe(4295128739n);
    });

    it("getSqrtRatioAtTick at MAX_TICK is largest valid value", () => {
      expect(getSqrtRatioAtTick(MAX_TICK)).toBe(
        1461446703485210103287273052203988822378723970342n,
      );
    });

    it("MIN_SQRT_RATIO constant matches tick result", () => {
      expect(getSqrtRatioAtTick(MIN_TICK)).toBe(MIN_SQRT_RATIO);
    });

    it("MAX_SQRT_RATIO constant matches tick result", () => {
      expect(getSqrtRatioAtTick(MAX_TICK)).toBe(MAX_SQRT_RATIO);
    });

    it("result is always positive bigint", () => {
      for (const tick of [-100, -1, 0, 1, 100]) {
        expect(getSqrtRatioAtTick(tick)).toBeGreaterThan(0n);
      }
    });
  });

  describe("roundToTickSpacing", () => {
    it("rounds down to nearest tickSpacing multiple", () => {
      expect(roundToTickSpacing(123, 60)).toBe(120);
      expect(roundToTickSpacing(180, 60)).toBe(180);
      expect(roundToTickSpacing(0, 60)).toBe(0);
    });

    it("rounds negative ticks correctly (floor)", () => {
      expect(roundToTickSpacing(-123, 60)).toBe(-180);
      expect(roundToTickSpacing(-60, 60)).toBe(-60);
    });
  });

  describe("ceilToTickSpacing", () => {
    it("rounds up to nearest tickSpacing multiple", () => {
      expect(ceilToTickSpacing(61, 60)).toBe(120);
      expect(ceilToTickSpacing(60, 60)).toBe(60);
      expect(ceilToTickSpacing(0, 60)).toBe(0);
    });

    it("rounds negative ticks up (toward zero)", () => {
      expect(ceilToTickSpacing(-61, 60)).toBe(-60);
    });
  });

  describe("priceToTick / tickToPrice", () => {
    it("priceToTick converts price 1 (same decimals) to tick 0", () => {
      expect(priceToTick(1, 18, 18)).toBe(0);
    });

    it("tickToPrice roundtrips approximately", () => {
      const tick = priceToTick(2000, 18, 6);
      const price = tickToPrice(tick, 18, 6);
      expect(Math.abs(price - 2000) / 2000).toBeLessThan(0.001);
    });
  });

  describe("feeToTickSpacing", () => {
    it("converts 500 bps fee to spacing 10", () => {
      expect(feeToTickSpacing(500)).toBe(10);
    });

    it("converts 3000 bps fee to spacing 60", () => {
      expect(feeToTickSpacing(3000)).toBe(60);
    });

    it("converts 10000 bps fee to spacing 200", () => {
      expect(feeToTickSpacing(10000)).toBe(200);
    });
  });

  describe("percentToTickOffset", () => {
    it("returns 0 for 0%", () => {
      expect(percentToTickOffset(0)).toBe(0);
    });

    it("returns positive offset for any non-zero pct", () => {
      expect(percentToTickOffset(1)).toBeGreaterThan(0);
      expect(percentToTickOffset(-1)).toBeGreaterThan(0);
    });

    it("larger pct produces larger offset", () => {
      expect(percentToTickOffset(5)).toBeGreaterThan(percentToTickOffset(1));
    });
  });

  describe("inversePriceToTick", () => {
    it("returns negative of priceToTick for same price", () => {
      const forward = priceToTick(2000, 18, 6);
      const inverse = inversePriceToTick(2000, 18, 6);
      // inverse is the negation (approximately)
      expect(Math.abs(forward + inverse)).toBeLessThanOrEqual(1);
    });

    it("returns 0 for price 1 (same decimals)", () => {
      expect(inversePriceToTick(1, 18, 18)).toBe(0);
    });
  });

  describe("formatSqrtPrice", () => {
    it("returns 0 for sqrtPriceX96 = 0", () => {
      expect(formatSqrtPrice(0n, 18, 18)).toBe(0);
    });

    it("returns 1 for Q96 (price = 1, same decimals)", () => {
      const Q96 = 79228162514264337593543950336n;
      expect(formatSqrtPrice(Q96, 18, 18)).toBeCloseTo(1, 5);
    });
  });
});
