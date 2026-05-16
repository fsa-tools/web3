import { getSqrtRatioAtTick } from "./ticks.js";

const Q96 = 2n ** 96n;

export type ComputeDepositRatioParams = {
  /** sqrtPriceX96 atual do pool (slot0). */
  sqrtPriceX96: bigint;
  tickLower: number;
  tickUpper: number;
};

/**
 * Fração do valor total (em USD) que deve estar em token0 para um depósito
 * Uniswap V3 no range [tickLower, tickUpper] dado o preço atual.
 * Retorna 1 se o preço está abaixo do range, 0 se está acima.
 */
export function computeDepositRatio(params: ComputeDepositRatioParams): number {
  const { sqrtPriceX96, tickLower, tickUpper } = params;

  if (sqrtPriceX96 <= 0n) {
    throw new Error("computeDepositRatio: sqrtPriceX96 must be positive");
  }
  if (tickLower >= tickUpper) {
    throw new Error("computeDepositRatio: tickLower must be < tickUpper");
  }

  const sqrtLower = getSqrtRatioAtTick(tickLower);
  const sqrtUpper = getSqrtRatioAtTick(tickUpper);

  if (sqrtPriceX96 <= sqrtLower) return 1;
  if (sqrtPriceX96 >= sqrtUpper) return 0;

  const lower = Number(sqrtLower) / Number(Q96);
  const upper = Number(sqrtUpper) / Number(Q96);
  const current = Number(sqrtPriceX96) / Number(Q96);

  // Locked amounts per unit of liquidity L:
  // x = (current - lower) / sqrt_current
  // y = (upper - current) * sqrt_current
  // In value terms (normalized to same denomination):
  // value0 (in units of token1) = x * price = (current - lower) * sqrt_current
  // value1 = y = (upper - current) * sqrt_current
  const value0 = (current - lower) * current;
  const value1 = upper - current;

  return value0 / (value0 + value1);
}
