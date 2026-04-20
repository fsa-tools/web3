import type { Address, Hex } from "viem";
import { POOL_ABI } from "../abis/pool.js";
import type { ChainContext } from "../context.js";
import { GasThresholdExceededError } from "../errors.js";

export type EstimateGasParams = {
  to: Address;
  data: Hex;
  value?: bigint;
  account?: Address;
  fallbackGasUnits?: bigint;
};

export type GasEstimate = {
  gasUnits: bigint;
  baseFeeGwei: number;
  gasCostEth: number;
};

export type GasOptions = {
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  gas?: bigint;
};

export type GetEthPriceParams = {
  wethUsdcPoolAddress: Address;
  poolAbi?: typeof POOL_ABI;
};

export type GasGuardOptions = {
  expectedGasUnits: bigint;
  ethPriceUsd: number;
  gasCostThresholdUsd: number;
};

export type GasGuardOptionsWithRetry = GasGuardOptions & {
  maxRetries: number;
  retryIntervalMs: number;
  maxWaitTimeMs?: number;
};

export type EstimateDryRunCostParams = {
  expectedGasUnits: bigint;
  ethPriceUsd: number;
};

export type DryRunCostEstimate = {
  costUsd: number;
  baseFeeGwei: number;
  ethPriceUsd: number;
};

const DEFAULT_FALLBACK_GAS = 500000n;
const WEI_PER_ETH = 1e18;

export async function estimateGas(
  ctx: ChainContext,
  params: EstimateGasParams,
): Promise<GasEstimate> {
  const { publicClient } = ctx;
  const { fallbackGasUnits = DEFAULT_FALLBACK_GAS } = params;
  let gasUnits: bigint;
  try {
    gasUnits = await publicClient.estimateGas({
      to: params.to,
      data: params.data,
      value: params.value,
      account: params.account,
    });
  } catch {
    gasUnits = fallbackGasUnits;
  }
  const feeData = await publicClient.estimateFeesPerGas();
  const baseFeeWei = feeData.maxFeePerGas ?? 0n;
  const baseFeeGwei = Number(baseFeeWei) / 1e9;
  const gasCostEth = Number(gasUnits * baseFeeWei) / WEI_PER_ETH;
  return { gasUnits, baseFeeGwei, gasCostEth };
}

export { GasThresholdExceededError } from "../errors.js";

function estimateCostEth(
  expectedGasUnits: bigint,
  maxFeePerGas: bigint,
): number {
  return Number(expectedGasUnits * maxFeePerGas) / WEI_PER_ETH;
}

function estimateCostUsd(
  expectedGasUnits: bigint,
  maxFeePerGas: bigint,
  ethPriceUsd: number,
): number {
  return estimateCostEth(expectedGasUnits, maxFeePerGas) * ethPriceUsd;
}

function isTimeoutExceeded(
  startTime: number,
  maxWaitTimeMs: number | undefined,
): boolean {
  return maxWaitTimeMs !== undefined && Date.now() - startTime >= maxWaitTimeMs;
}

export async function withGasGuard<T>(
  ctx: ChainContext,
  fn: () => Promise<T>,
  options: GasGuardOptions | GasGuardOptionsWithRetry,
): Promise<T> {
  const { publicClient } = ctx;
  const { expectedGasUnits, ethPriceUsd, gasCostThresholdUsd } = options;
  const hasRetry = "maxRetries" in options;
  const maxRetries = hasRetry ? options.maxRetries : 0;
  const retryIntervalMs = hasRetry ? options.retryIntervalMs : 0;
  const maxWaitTimeMs = hasRetry ? options.maxWaitTimeMs : undefined;
  const startTime = Date.now();
  let attempt = 0;
  let lastCostUsd = 0;

  while (true) {
    if (isTimeoutExceeded(startTime, maxWaitTimeMs)) {
      throw new GasThresholdExceededError({
        estimatedCostUsd: lastCostUsd,
        thresholdUsd: gasCostThresholdUsd,
        retriesAttempted: attempt,
      });
    }
    const feeData = await publicClient.estimateFeesPerGas();
    const maxFeePerGas = feeData.maxFeePerGas;
    if (maxFeePerGas === null || maxFeePerGas === undefined) {
      throw new Error(
        "withGasGuard requires EIP-1559 support. Chain does not provide maxFeePerGas.",
      );
    }
    const estimatedCostUsd = estimateCostUsd(
      expectedGasUnits,
      maxFeePerGas,
      ethPriceUsd,
    );
    lastCostUsd = estimatedCostUsd;
    if (estimatedCostUsd < gasCostThresholdUsd) {
      return fn();
    }
    if (attempt >= maxRetries) {
      throw new GasThresholdExceededError({
        estimatedCostUsd,
        thresholdUsd: gasCostThresholdUsd,
        retriesAttempted: attempt,
      });
    }
    await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    attempt++;
  }
}

export async function estimateDryRunCost(
  ctx: ChainContext,
  params: EstimateDryRunCostParams,
): Promise<DryRunCostEstimate> {
  const feeData = await ctx.publicClient.estimateFeesPerGas();
  const baseFeeWei = feeData.maxFeePerGas ?? 0n;
  const baseFeeGwei = Number(baseFeeWei) / 1e9;
  const costUsd =
    (Number(params.expectedGasUnits * baseFeeWei) / WEI_PER_ETH) *
    params.ethPriceUsd;
  return { costUsd, baseFeeGwei, ethPriceUsd: params.ethPriceUsd };
}

export async function getEthPriceUsd(
  ctx: ChainContext,
  params: GetEthPriceParams,
): Promise<number> {
  const abi = params.poolAbi ?? POOL_ABI;
  const result = (await ctx.publicClient.readContract({
    address: params.wethUsdcPoolAddress,
    abi,
    functionName: "slot0",
  })) as unknown as [bigint, ...unknown[]];
  const sqrtPriceX96 = result[0];
  const Q96 = 2n ** 96n;
  const price = Number(sqrtPriceX96 * sqrtPriceX96) / Number(Q96 * Q96);
  const DECIMALS_ADJUSTMENT = 1e12;
  return price * DECIMALS_ADJUSTMENT;
}
