import { describe, it, expect } from "vitest";
import { computeDepositRatio } from "../../../src/math/deposit.js";
import { getSqrtRatioAtTick } from "../../../src/math/ticks.js";

describe("computeDepositRatio", () => {
  const tickLower = -1000;
  const tickUpper = 1000;

  it("preço no centro do range simétrico: f0 ≈ 0.5", () => {
    const f0 = computeDepositRatio({
      sqrtPriceX96: getSqrtRatioAtTick(0),
      tickLower,
      tickUpper,
    });
    expect(f0).toBeGreaterThan(0.4);
    expect(f0).toBeLessThan(0.6);
  });

  it("preço abaixo do range: f0 === 1 (tudo em token0)", () => {
    const f0 = computeDepositRatio({
      sqrtPriceX96: getSqrtRatioAtTick(-5000),
      tickLower,
      tickUpper,
    });
    expect(f0).toBe(1);
  });

  it("preço acima do range: f0 === 0 (tudo em token1)", () => {
    const f0 = computeDepositRatio({
      sqrtPriceX96: getSqrtRatioAtTick(5000),
      tickLower,
      tickUpper,
    });
    expect(f0).toBe(0);
  });

  it("range assimétrico (preço perto do limite inferior): mais valor em token0 (f0 > 0.5)", () => {
    const f0 = computeDepositRatio({
      sqrtPriceX96: getSqrtRatioAtTick(0),
      tickLower: -200,
      tickUpper: 2000,
    });
    expect(f0).toBeGreaterThan(0.5);
    expect(f0).toBeLessThan(1);
  });

  it("rejeita tickLower >= tickUpper", () => {
    expect(() =>
      computeDepositRatio({
        sqrtPriceX96: getSqrtRatioAtTick(0),
        tickLower: 100,
        tickUpper: 100,
      }),
    ).toThrow();
  });

  it("rejeita sqrtPriceX96 não positivo", () => {
    expect(() =>
      computeDepositRatio({ sqrtPriceX96: 0n, tickLower, tickUpper }),
    ).toThrow();
  });
});
