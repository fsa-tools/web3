import { describe, it, expect } from "vitest";
import { spotAmountOut } from "../../../src/math/swap.js";

const Q96 = 2n ** 96n;

describe("spotAmountOut", () => {
  it("preço 1.0, zeroForOne: output ≈ input", () => {
    const out = spotAmountOut({
      sqrtPriceX96: Q96,
      amountIn: 1000n,
      zeroForOne: true,
    });
    expect(out).toBe(1000n);
  });

  it("preço 1.0, oneForZero: output ≈ input", () => {
    const out = spotAmountOut({
      sqrtPriceX96: Q96,
      amountIn: 1000n,
      zeroForOne: false,
    });
    expect(out).toBe(1000n);
  });

  it("preço 4.0 (sqrt=2), zeroForOne: output = input * 4", () => {
    const out = spotAmountOut({
      sqrtPriceX96: 2n * Q96,
      amountIn: 1000n,
      zeroForOne: true,
    });
    expect(out).toBe(4000n);
  });

  it("preço 4.0 (sqrt=2), oneForZero: output = input / 4", () => {
    const out = spotAmountOut({
      sqrtPriceX96: 2n * Q96,
      amountIn: 1000n,
      zeroForOne: false,
    });
    expect(out).toBe(250n);
  });

  it("rejeita sqrtPriceX96 não positivo", () => {
    expect(() =>
      spotAmountOut({ sqrtPriceX96: 0n, amountIn: 1000n, zeroForOne: true }),
    ).toThrow();
  });
});
