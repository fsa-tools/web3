import type { Address, Hex, PublicClient } from "viem";
import { POOL_ABI } from "../abis/pool.js";

export type EstimateGasParams = {
  publicClient: PublicClient;
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
  publicClient: PublicClient;
  wethUsdcPoolAddress: Address;
  poolAbi?: typeof POOL_ABI;
};

export type GasGuardOptions = {
  publicClient: PublicClient;
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
  publicClient: PublicClient;
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
  params: EstimateGasParams,
): Promise<GasEstimate> {
  const { publicClient, fallbackGasUnits = DEFAULT_FALLBACK_GAS } = params;
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

export class GasThresholdExceededError extends Error {
  readonly estimatedCostUsd: number;
  readonly thresholdUsd: number;
  readonly retriesAttempted: number;

  constructor(params: {
    estimatedCostUsd: number;
    thresholdUsd: number;
    retriesAttempted: number;
  }) {
    super(
      `Gas cost $${params.estimatedCostUsd.toFixed(4)} exceeds threshold $${params.thresholdUsd} after ${params.retriesAttempted} retries`,
    );
    this.name = "GasThresholdExceededError";
    this.estimatedCostUsd = params.estimatedCostUsd;
    this.thresholdUsd = params.thresholdUsd;
    this.retriesAttempted = params.retriesAttempted;
  }
}

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
  fn: () => Promise<T>,
  options: GasGuardOptions | GasGuardOptionsWithRetry,
): Promise<T> {
  const { publicClient, expectedGasUnits, ethPriceUsd, gasCostThresholdUsd } =
    options;
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
  params: EstimateDryRunCostParams,
): Promise<DryRunCostEstimate> {
  const { publicClient, expectedGasUnits, ethPriceUsd } = params;
  const feeData = await publicClient.estimateFeesPerGas();
  const baseFeeWei = feeData.maxFeePerGas ?? 0n;
  const baseFeeGwei = Number(baseFeeWei) / 1e9;
  const costUsd =
    (Number(expectedGasUnits * baseFeeWei) / WEI_PER_ETH) * ethPriceUsd;
  return { costUsd, baseFeeGwei, ethPriceUsd };
}

export async function getEthPriceUsd(
  params: GetEthPriceParams,
): Promise<number> {
  const abi = params.poolAbi ?? POOL_ABI;
  const result = (await params.publicClient.readContract({
    address: params.wethUsdcPoolAddress,
    abi,
    functionName: "slot0",
  })) as unknown as [bigint, ...unknown[]];
  const sqrtPriceX96 = result[0];
  const Q96 = 2n ** 96n;
  const price = Number(sqrtPriceX96 * sqrtPriceX96) / Number(Q96 * Q96);
  // WETH/USDC pool: price = USDC per WETH (adjust for decimals: USDC=6, WETH=18)
  const DECIMALS_ADJUSTMENT = 1e12; // 10^(18-6)
  return price * DECIMALS_ADJUSTMENT;
}
