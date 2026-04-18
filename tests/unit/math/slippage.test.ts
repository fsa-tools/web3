import { describe, it, expect } from "vitest";
import { toBps, fromBps, applySlippage } from "../../../src/math/slippage.js";

describe("slippage", () => {
  it("toBps converts decimal to basis points", () => {
    expect(toBps(0.01)).toBe(100);
    expect(toBps(0.005)).toBe(50);
    expect(toBps(1)).toBe(10_000);
  });

  it("fromBps is inverse of toBps", () => {
    expect(fromBps(100)).toBe(0.01);
    expect(fromBps(10_000)).toBe(1);
  });

  it("applySlippage subtracts bps from amount", () => {
    expect(applySlippage(10_000n, 100)).toBe(9900n);
    expect(applySlippage(10_000n, 50)).toBe(9950n);
    expect(applySlippage(10_000n, 0)).toBe(10_000n);
  });

  it("applySlippage rejects out-of-range bps", () => {
    expect(() => applySlippage(1n, -1)).toThrow(/between 0 and 10000/);
    expect(() => applySlippage(1n, 10_001)).toThrow(/between 0 and 10000/);
  });
});
