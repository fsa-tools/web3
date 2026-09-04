import { describe, it, expect } from "vitest";
import {
  BaseError,
  MethodNotFoundRpcError,
  MethodNotSupportedRpcError,
} from "viem";
import { isMethodNotSupportedError } from "../../../src/simulate/method-support.js";

describe("isMethodNotSupportedError", () => {
  it("reconhece MethodNotFoundRpcError (-32601), mesmo envolvido em causas", () => {
    const err = new BaseError("boom", {
      cause: new MethodNotFoundRpcError(new Error("x"), {
        method: "eth_simulateV1",
      }),
    });
    expect(isMethodNotSupportedError(err)).toBe(true);
  });

  it("reconhece MethodNotSupportedRpcError (-32004)", () => {
    const err = new MethodNotSupportedRpcError(new Error("x"), {
      method: "eth_simulateV1",
    });
    expect(isMethodNotSupportedError(err)).toBe(true);
  });

  it("reconhece pelo texto quando o provider não devolve a classe tipada", () => {
    const err = new Error(
      'the method "eth_simulateV1" does not exist/is not available',
    );
    expect(isMethodNotSupportedError(err)).toBe(true);
  });

  it("não confunde revert de contrato com método não suportado", () => {
    const err = new Error("execution reverted: INSUFFICIENT_BALANCE");
    expect(isMethodNotSupportedError(err)).toBe(false);
  });

  it("não confunde rate limit (429) com método não suportado", () => {
    const err = new Error("429 Too Many Requests");
    expect(isMethodNotSupportedError(err)).toBe(false);
  });
});
