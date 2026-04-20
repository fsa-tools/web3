// tests/unit/errors.test.ts
import { describe, it, expect } from "vitest";
import {
  ChainNotSupportedError,
  ProtocolNotSupportedError,
  ReserveInactiveError,
  InsufficientAllowanceError,
  SlippageExceededError,
  AddressValidationError,
  ReceiptEventNotFoundError,
} from "../../src/errors.js";

const ADDR = "0x1234567890123456789012345678901234567890" as const;
const HASH = "0xabcdef" as `0x${string}`;

describe("typed errors", () => {
  it("ChainNotSupportedError: instanceof Error, carrega chainId, message contém id", () => {
    const err = new ChainNotSupportedError(99999);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ChainNotSupportedError);
    expect(err.chainId).toBe(99999);
    expect(err.message).toContain("99999");
    expect(err.name).toBe("ChainNotSupportedError");
  });

  it("ProtocolNotSupportedError: carrega chainId e protocol", () => {
    const err = new ProtocolNotSupportedError(8453, "aerodrome");
    expect(err).toBeInstanceOf(Error);
    expect(err.chainId).toBe(8453);
    expect(err.protocol).toBe("aerodrome");
    expect(err.message).toContain("aerodrome");
  });

  it("ReserveInactiveError: carrega asset e reason opcional", () => {
    const err = new ReserveInactiveError(ADDR, "paused");
    expect(err).toBeInstanceOf(Error);
    expect(err.asset).toBe(ADDR);
    expect(err.reason).toBe("paused");

    const errNoReason = new ReserveInactiveError(ADDR);
    expect(errNoReason.reason).toBeUndefined();
  });

  it("InsufficientAllowanceError: carrega token, required, actual", () => {
    const err = new InsufficientAllowanceError(ADDR, 1000n, 500n);
    expect(err).toBeInstanceOf(Error);
    expect(err.token).toBe(ADDR);
    expect(err.required).toBe(1000n);
    expect(err.actual).toBe(500n);
  });

  it("SlippageExceededError: carrega bps e max", () => {
    const err = new SlippageExceededError(6000, 5000);
    expect(err).toBeInstanceOf(Error);
    expect(err.bps).toBe(6000);
    expect(err.max).toBe(5000);
  });

  it("AddressValidationError: carrega value inválido", () => {
    const err = new AddressValidationError("not-an-address");
    expect(err).toBeInstanceOf(Error);
    expect(err.value).toBe("not-an-address");
  });

  it("ReceiptEventNotFoundError: carrega eventName e txHash", () => {
    const err = new ReceiptEventNotFoundError("IncreaseLiquidity", HASH);
    expect(err).toBeInstanceOf(Error);
    expect(err.eventName).toBe("IncreaseLiquidity");
    expect(err.txHash).toBe(HASH);
  });
});
