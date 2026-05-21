import { describe, it, expect } from "vitest";
import type { TxRequest } from "../../../src/tx/types.js";
import { isTxRequest } from "../../../src/tx/types.js";

describe("TxRequest", () => {
  it("isTxRequest aceita um descritor de transação válido", () => {
    const tx: TxRequest = {
      label: "approve USDC",
      to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      data: "0xabcdef",
      value: 0n,
    };
    expect(isTxRequest(tx)).toBe(true);
  });

  it("isTxRequest rejeita objeto sem calldata", () => {
    expect(isTxRequest({ label: "x", to: "0x00", value: 0n })).toBe(false);
  });

  it("isTxRequest rejeita value não-bigint", () => {
    expect(isTxRequest({ label: "x", to: "0x00", data: "0x", value: 0 })).toBe(
      false,
    );
  });
});
