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

  // Para liquidez L no range, com sqrt-preços lower/current/upper:
  //   amount0 = L * (upper - current) / (current * upper)
  //   amount1 = L * (current - lower)
  // value0 = amount0 * preço = amount0 * current^2 = L * current * (upper - current) / upper
  // value1 = amount1 = L * (current - lower)
  // L cancela na fração f0 abaixo.
  const value0 = (current * (upper - current)) / upper;
  const value1 = current - lower;

  return value0 / (value0 + value1);
}
