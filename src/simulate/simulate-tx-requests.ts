import { BaseError } from "viem";
import type { Abi, Address, Hex } from "viem";
import type { ChainContext } from "../context.js";
import type { TxRequest } from "../tx/types.js";
import { decodeRevertReason } from "./decode-revert.js";
import { isMethodNotSupportedError } from "./method-support.js";
import type {
  AssetDiff,
  ProbeDiff,
  SimulateTxRequestsOptions,
  SimulateTxRequestsResult,
  SimulationProbe,
  TxSimulationResult,
} from "./types.js";

/**
 * Simula uma sequência de TxRequests antes de assinar. Primário:
 * eth_simulateV1 (`publicClient.simulateCalls`), que encadeia estado entre
 * as txs (approve → supply enxerga o efeito do approve). Se o provider não
 * implementar eth_simulateV1, cai para eth_call isolado por tx — marcado
 * `chained: false` para o consumidor não apresentar cobertura reduzida como
 * se fosse encadeada. Erros de RPC não relacionados a suporte de método
 * (rate limit, todos os providers esgotados) propagam — a rotação do
 * rpc-pool já trata isso, este módulo não deve mascarar.
 */
export async function simulateTxRequests(
  ctx: ChainContext,
  txs: readonly TxRequest[],
  options: SimulateTxRequestsOptions,
): Promise<SimulateTxRequestsResult> {
  if (txs.length === 0) return { chained: true, results: [], assetDiffs: [] };

  const abis = options.abis ?? [];
  const probes = options.probes ?? [];
  try {
    return await simulateChained(ctx, txs, options.from, abis, probes);
  } catch (err) {
    if (!isMethodNotSupportedError(err)) throw err;
    return simulateIsolated(ctx, txs, options.from, abis);
  }
}

async function simulateChained(
  ctx: ChainContext,
  txs: readonly TxRequest[],
  from: Address,
  abis: readonly Abi[],
  probes: readonly SimulationProbe[],
): Promise<SimulateTxRequestsResult> {
  const probeCalls = probes.map((probe) => ({
    to: probe.to,
    data: probe.data,
    value: 0n,
  }));
  const txCalls = txs.map((tx) => ({ to: tx.to, data: tx.data, value: tx.value }));

  const sim = await ctx.publicClient.simulateCalls({
    account: from,
    calls: [...probeCalls, ...txCalls, ...probeCalls],
    traceAssetChanges: true,
  });

  const results: TxSimulationResult[] = txs.map((tx, i) => {
    const call = sim.results[probes.length + i];
    if (!call) {
      throw new Error(
        `simulateCalls devolveu ${sim.results.length} resultados para ${txs.length} txs + ${probes.length} probes`,
      );
    }
    const status: "ok" | "revert" = call.status === "success" ? "ok" : "revert";
    return {
      label: tx.label,
      to: tx.to,
      status,
      gasUsed: call.gasUsed,
      reason:
        status === "revert" ? decodeRevertReason(call.data, abis) : undefined,
    };
  });

  const assetDiffs: AssetDiff[] = sim.assetChanges.map((change) => ({
    token: change.token.address,
    symbol: change.token.symbol,
    decimals: change.token.decimals,
    pre: change.value.pre,
    post: change.value.post,
    diff: change.value.diff,
  }));

  const probeDiffs =
    probes.length > 0
      ? decodeProbeDiffs(probes, sim.results, txs.length)
      : undefined;

  return { chained: true, results, assetDiffs, probeDiffs };
}

function decodeProbeDiffs(
  probes: readonly SimulationProbe[],
  callResults: readonly { status: "success" | "failure"; data: Hex }[],
  txCount: number,
): ProbeDiff[] {
  return probes.map((probe, i) => {
    const preCall = callResults[i];
    const postCall = callResults[probes.length + txCount + i];
    if (!preCall || preCall.status !== "success") {
      throw new Error(`probe "${probe.label}" reverteu na leitura pré-tx`);
    }
    if (!postCall || postCall.status !== "success") {
      throw new Error(`probe "${probe.label}" reverteu na leitura pós-tx`);
    }
    return {
      label: probe.label,
      pre: probe.decode(preCall.data),
      post: probe.decode(postCall.data),
    };
  });
}

async function simulateIsolated(
  ctx: ChainContext,
  txs: readonly TxRequest[],
  from: Address,
  abis: readonly Abi[],
): Promise<SimulateTxRequestsResult> {
  const results: TxSimulationResult[] = [];
  for (const tx of txs) {
    const callParams = { account: from, to: tx.to, data: tx.data, value: tx.value };
    try {
      await ctx.publicClient.call(callParams);
    } catch (err) {
      results.push({
        label: tx.label,
        to: tx.to,
        status: "revert",
        gasUsed: 0n,
        reason: decodeRevertReason(extractRevertData(err), abis),
      });
      continue;
    }
    const gasUsed = await ctx.publicClient.estimateGas(callParams);
    results.push({
      label: tx.label,
      to: tx.to,
      status: "ok",
      gasUsed,
      reason: undefined,
    });
  }
  return { chained: false, results };
}

function extractRevertData(err: unknown): Hex | undefined {
  if (!(err instanceof BaseError)) return undefined;
  const withData = err.walk(
    (candidate) =>
      typeof candidate === "object" &&
      candidate !== null &&
      "data" in candidate,
  );
  const data = (withData as { data?: unknown } | null)?.data;
  return typeof data === "string" && data.startsWith("0x")
    ? (data as Hex)
    : undefined;
}
