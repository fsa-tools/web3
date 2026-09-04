import { describe, it, expect } from "vitest";
import { encodeErrorResult } from "viem";
import type { Abi } from "viem";
import { decodeRevertReason } from "../../../src/simulate/decode-revert.js";

const ERROR_STRING_ABI = [
  {
    type: "error",
    name: "Error",
    inputs: [{ name: "message", type: "string" }],
  },
] as const satisfies Abi;

const PANIC_ABI = [
  {
    type: "error",
    name: "Panic",
    inputs: [{ name: "code", type: "uint256" }],
  },
] as const satisfies Abi;

const CUSTOM_PROTOCOL_ABI = [
  {
    type: "error",
    name: "InsufficientOutputAmount",
    inputs: [{ name: "expected", type: "uint256" }],
  },
] as const satisfies Abi;

describe("decodeRevertReason", () => {
  it("traduz um código numérico da Aave para o nome/descrição da constante", () => {
    const data = encodeErrorResult({
      abi: ERROR_STRING_ABI,
      errorName: "Error",
      args: ["27"],
    });
    const reason = decodeRevertReason(data);
    expect(reason).toContain("RESERVE_INACTIVE");
    expect(reason).toContain("27");
  });

  it("devolve a mensagem crua quando Error(string) não é um código Aave conhecido", () => {
    const data = encodeErrorResult({
      abi: ERROR_STRING_ABI,
      errorName: "Error",
      args: ["ERC20: transfer amount exceeds balance"],
    });
    expect(decodeRevertReason(data)).toBe(
      "ERC20: transfer amount exceeds balance",
    );
  });

  it("decodifica Panic(uint256) para a descrição do código", () => {
    const data = encodeErrorResult({
      abi: PANIC_ABI,
      errorName: "Panic",
      args: [0x11n],
    });
    expect(decodeRevertReason(data)).toBe(
      "Arithmetic overflow or underflow",
    );
  });

  it("decodifica um custom error de uma ABI de protocolo fornecida pelo chamador", () => {
    const data = encodeErrorResult({
      abi: CUSTOM_PROTOCOL_ABI,
      errorName: "InsufficientOutputAmount",
      args: [100n],
    });
    expect(decodeRevertReason(data, [CUSTOM_PROTOCOL_ABI])).toBe(
      "InsufficientOutputAmount(100)",
    );
  });

  it("devolve undefined quando o selector não bate com nenhuma ABI conhecida", () => {
    expect(decodeRevertReason("0xdeadbeef")).toBeUndefined();
  });

  it("devolve undefined quando não há revert data", () => {
    expect(decodeRevertReason("0x")).toBeUndefined();
    expect(decodeRevertReason(undefined)).toBeUndefined();
  });
});
