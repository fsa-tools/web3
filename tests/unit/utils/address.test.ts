import { describe, it, expect } from "vitest";
import { validateAddress } from "../../../src/utils/address.js";

// Correct EIP-55 checksum for USDC on Arbitrum (verified via viem getAddress)
const USDC_LOWER = "0xaf88d065e77c8cc2239327c5edb3a432268e5831";
const USDC_CHECKSUM = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

describe("validateAddress", () => {
  it("returns checksummed address", () => {
    expect(validateAddress(USDC_LOWER)).toBe(USDC_CHECKSUM);
  });

  it("accepts already-checksummed address", () => {
    expect(validateAddress(USDC_CHECKSUM)).toBe(USDC_CHECKSUM);
  });

  it("throws on invalid address", () => {
    expect(() => validateAddress("not-an-address")).toThrow(/Invalid/);
    expect(() => validateAddress("0x123")).toThrow(/Invalid/);
  });
});
