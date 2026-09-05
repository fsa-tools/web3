import { describe, it, expect, vi } from "vitest";
import { BaseError, MethodNotFoundRpcError, RawContractError, encodeErrorResult } from "viem";
import type { Address, Hex } from "viem";
import { simulateTxRequests } from "../../../src/simulate/simulate-tx-requests.js";
import type { TxRequest } from "../../../src/tx/types.js";
import type { ChainContext } from "../../../src/context.js";
import type { SimulationProbe } from "../../../src/simulate/types.js";

const FROM: Address = "0x0000000000000000000000000000000000000001";
const TO_A: Address = "0x0000000000000000000000000000000000000002";
const TO_B: Address = "0x0000000000000000000000000000000000000003";

const ERROR_STRING_ABI = [
  {
    type: "error",
    name: "Error",
    inputs: [{ name: "message", type: "string" }],
  },
] as const;

function txsFixture(): TxRequest[] {
  return [
    { label: "approve", to: TO_A, data: "0xapprove", value: 0n },
    { label: "supply", to: TO_B, data: "0xsupply", value: 0n },
  ];
}

function mockCtx(publicClient: Record<string, unknown>): ChainContext {
  return { publicClient } as unknown as ChainContext;
}

describe("simulateTxRequests", () => {
  it("devolve lista vazia sem chamar o provider quando não há txs", async () => {
    const simulateCalls = vi.fn();
    const ctx = mockCtx({ simulateCalls });
    const result = await simulateTxRequests(ctx, [], { from: FROM });
    expect(result).toEqual({ chained: true, results: [], assetDiffs: [] });
    expect(simulateCalls).not.toHaveBeenCalled();
  });

  it("usa eth_simulateV1 (chained) e mapeia ok/revert por tx quando o provider suporta", async () => {
    const revertData = encodeErrorResult({
      abi: ERROR_STRING_ABI,
      errorName: "Error",
      args: ["27"],
    });
    const simulateCalls = vi.fn(async () => ({
      assetChanges: [
        {
          token: { address: TO_A, symbol: "USDC", decimals: 6 },
          value: { pre: 1000n, post: 400n, diff: -600n },
        },
      ],
      block: {},
      results: [
        { status: "success", data: "0x", gasUsed: 50_000n, logs: [] },
        { status: "failure", data: revertData, gasUsed: 30_000n, logs: [] },
      ],
    }));
    const ctx = mockCtx({ simulateCalls });

    const result = await simulateTxRequests(ctx, txsFixture(), { from: FROM });

    expect(result.chained).toBe(true);
    expect(simulateCalls).toHaveBeenCalledWith(
      expect.objectContaining({
        account: FROM,
        traceAssetChanges: true,
        calls: [
          { to: TO_A, data: "0xapprove", value: 0n },
          { to: TO_B, data: "0xsupply", value: 0n },
        ],
      }),
    );
    expect(result.results).toEqual([
      { label: "approve", to: TO_A, status: "ok", gasUsed: 50_000n, reason: undefined },
      {
        label: "supply",
        to: TO_B,
        status: "revert",
        gasUsed: 30_000n,
        reason: expect.stringContaining("RESERVE_INACTIVE"),
      },
    ]);
    expect(result.assetDiffs).toEqual([
      { token: TO_A, symbol: "USDC", decimals: 6, pre: 1000n, post: 400n, diff: -600n },
    ]);
  });

  it("cai para eth_call isolado (chained: false) quando eth_simulateV1 não é suportado", async () => {
    const simulateCalls = vi.fn(async () => {
      throw new BaseError("boom", {
        cause: new MethodNotFoundRpcError(new Error("x"), {
          method: "eth_simulateV1",
        }),
      });
    });
    const call = vi.fn(async () => "0x" as const);
    const estimateGas = vi.fn(async () => 42_000n);
    const ctx = mockCtx({ simulateCalls, call, estimateGas });

    const result = await simulateTxRequests(ctx, txsFixture(), { from: FROM });

    expect(result.chained).toBe(false);
    expect(result.assetDiffs).toBeUndefined();
    expect(result.results).toEqual([
      { label: "approve", to: TO_A, status: "ok", gasUsed: 42_000n, reason: undefined },
      { label: "supply", to: TO_B, status: "ok", gasUsed: 42_000n, reason: undefined },
    ]);
    expect(call).toHaveBeenCalledTimes(2);
    expect(estimateGas).toHaveBeenCalledTimes(2);
  });

  it("no fallback isolado, decodifica o revert de cada tx e não chama estimateGas para ela", async () => {
    const revertData = encodeErrorResult({
      abi: ERROR_STRING_ABI,
      errorName: "Error",
      args: ["27"],
    });
    const simulateCalls = vi.fn(async () => {
      throw new MethodNotFoundRpcError(new Error("x"), {
        method: "eth_simulateV1",
      });
    });
    const call = vi
      .fn()
      .mockResolvedValueOnce("0x")
      .mockRejectedValueOnce(new RawContractError({ data: revertData }));
    const estimateGas = vi.fn(async () => 42_000n);
    const ctx = mockCtx({ simulateCalls, call, estimateGas });

    const result = await simulateTxRequests(ctx, txsFixture(), { from: FROM });

    expect(result.chained).toBe(false);
    expect(result.results[1]).toEqual({
      label: "supply",
      to: TO_B,
      status: "revert",
      gasUsed: 0n,
      reason: expect.stringContaining("RESERVE_INACTIVE"),
    });
    expect(estimateGas).toHaveBeenCalledTimes(1);
  });

  it("propaga erros de RPC que não são 'método não suportado' (não mascara falha real do rpc-pool)", async () => {
    const simulateCalls = vi.fn(async () => {
      throw new Error("all providers exhausted");
    });
    const ctx = mockCtx({ simulateCalls });

    await expect(
      simulateTxRequests(ctx, txsFixture(), { from: FROM }),
    ).rejects.toThrow("all providers exhausted");
  });
});

const PROBE_TO: Address = "0x0000000000000000000000000000000000000004";

function healthFactorProbe(): SimulationProbe<bigint> {
  return {
    label: "aave-account-data",
    to: PROBE_TO,
    data: "0xgetuseraccountdata",
    decode: (data: Hex) => BigInt(data),
  };
}

describe("simulateTxRequests — probes", () => {
  it("prefixa e sufixa os probes no mesmo batch e devolve pre/post em probeDiffs", async () => {
    const probe = healthFactorProbe();
    const simulateCalls = vi.fn(async () => ({
      assetChanges: [],
      block: {},
      results: [
        { status: "success", data: "0x1", gasUsed: 0n, logs: [] }, // probe pre
        { status: "success", data: "0x", gasUsed: 50_000n, logs: [] }, // approve
        { status: "success", data: "0x", gasUsed: 50_000n, logs: [] }, // supply
        { status: "success", data: "0x2", gasUsed: 0n, logs: [] }, // probe post
      ],
    }));
    const ctx = mockCtx({ simulateCalls });

    const result = await simulateTxRequests(ctx, txsFixture(), {
      from: FROM,
      probes: [probe],
    });

    expect(simulateCalls).toHaveBeenCalledWith(
      expect.objectContaining({
        calls: [
          { to: PROBE_TO, data: "0xgetuseraccountdata", value: 0n },
          { to: TO_A, data: "0xapprove", value: 0n },
          { to: TO_B, data: "0xsupply", value: 0n },
          { to: PROBE_TO, data: "0xgetuseraccountdata", value: 0n },
        ],
      }),
    );
    expect(result.results).toHaveLength(2);
    expect(result.probeDiffs).toEqual([{ label: "aave-account-data", pre: 1n, post: 2n }]);
  });

  it("sem probes, o batch é idêntico ao atual (nenhuma call extra)", async () => {
    const simulateCalls = vi.fn(async () => ({
      assetChanges: [],
      block: {},
      results: [
        { status: "success", data: "0x", gasUsed: 50_000n, logs: [] },
        { status: "success", data: "0x", gasUsed: 50_000n, logs: [] },
      ],
    }));
    const ctx = mockCtx({ simulateCalls });

    const result = await simulateTxRequests(ctx, txsFixture(), { from: FROM });

    expect(simulateCalls).toHaveBeenCalledWith(
      expect.objectContaining({
        calls: [
          { to: TO_A, data: "0xapprove", value: 0n },
          { to: TO_B, data: "0xsupply", value: 0n },
        ],
      }),
    );
    expect(result.probeDiffs).toBeUndefined();
  });

  it("probe que reverte no pré lança erro nomeando o label do probe", async () => {
    const probe = healthFactorProbe();
    const simulateCalls = vi.fn(async () => ({
      assetChanges: [],
      block: {},
      results: [
        { status: "failure", data: "0x", gasUsed: 0n, logs: [] }, // probe pre revert
        { status: "success", data: "0x", gasUsed: 50_000n, logs: [] },
        { status: "success", data: "0x", gasUsed: 50_000n, logs: [] },
        { status: "success", data: "0x2", gasUsed: 0n, logs: [] },
      ],
    }));
    const ctx = mockCtx({ simulateCalls });

    await expect(
      simulateTxRequests(ctx, txsFixture(), { from: FROM, probes: [probe] }),
    ).rejects.toThrow(/aave-account-data/);
  });

  it("probe que reverte no pós lança erro nomeando o label do probe", async () => {
    const probe = healthFactorProbe();
    const simulateCalls = vi.fn(async () => ({
      assetChanges: [],
      block: {},
      results: [
        { status: "success", data: "0x1", gasUsed: 0n, logs: [] },
        { status: "success", data: "0x", gasUsed: 50_000n, logs: [] },
        { status: "success", data: "0x", gasUsed: 50_000n, logs: [] },
        { status: "failure", data: "0x", gasUsed: 0n, logs: [] }, // probe post revert
      ],
    }));
    const ctx = mockCtx({ simulateCalls });

    await expect(
      simulateTxRequests(ctx, txsFixture(), { from: FROM, probes: [probe] }),
    ).rejects.toThrow(/aave-account-data/);
  });

  it("no fallback isolado (chained: false), probeDiffs fica undefined", async () => {
    const probe = healthFactorProbe();
    const simulateCalls = vi.fn(async () => {
      throw new MethodNotFoundRpcError(new Error("x"), {
        method: "eth_simulateV1",
      });
    });
    const call = vi.fn(async () => "0x" as const);
    const estimateGas = vi.fn(async () => 42_000n);
    const ctx = mockCtx({ simulateCalls, call, estimateGas });

    const result = await simulateTxRequests(ctx, txsFixture(), {
      from: FROM,
      probes: [probe],
    });

    expect(result.chained).toBe(false);
    expect(result.probeDiffs).toBeUndefined();
  });
});
