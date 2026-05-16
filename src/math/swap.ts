const Q96 = 2n ** 96n;

export type SpotAmountOutParams = {
  /** sqrtPriceX96 atual do pool. */
  sqrtPriceX96: bigint;
  /** Quantidade de entrada (raw, na unidade do tokenIn). */
  amountIn: bigint;
  /** true se tokenIn é o token0 do pool (input address < output address). */
  zeroForOne: boolean;
};

/**
 * Estimativa spot do output de um swap single-hop, sem price impact.
 * price (token1/token0) = (sqrtPriceX96 / 2^96)^2.
 * zeroForOne: amountOut = amountIn * price
 * oneForZero: amountOut = amountIn / price
 */
export function spotAmountOut(params: SpotAmountOutParams): bigint {
  const { sqrtPriceX96, amountIn, zeroForOne } = params;

  if (sqrtPriceX96 <= 0n) {
    throw new Error("spotAmountOut: sqrtPriceX96 must be positive");
  }

  if (zeroForOne) {
    return (amountIn * sqrtPriceX96 * sqrtPriceX96) / (Q96 * Q96);
  }
  return (amountIn * Q96 * Q96) / (sqrtPriceX96 * sqrtPriceX96);
}
