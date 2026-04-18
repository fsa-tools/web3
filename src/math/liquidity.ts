import { getSqrtRatioAtTick } from "./ticks.js";

const Q96 = 2n ** 96n;

export type GetLockedAmountsParams = {
  liquidity: bigint;
  tickLower: number;
  tickUpper: number;
  currentTick: number;
  token0Decimals: number;
  token1Decimals: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getLockedAmounts(params: GetLockedAmountsParams): {
  amount0: number;
  amount1: number;
} {
  const {
    liquidity,
    tickLower,
    tickUpper,
    currentTick,
    token0Decimals,
    token1Decimals,
  } = params;

  if (liquidity === 0n) return { amount0: 0, amount1: 0 };

  const sqrtL = getSqrtRatioAtTick(tickLower);
  const sqrtU = getSqrtRatioAtTick(tickUpper);
  const clampedTick = clamp(currentTick, tickLower, tickUpper);
  const sqrtC = getSqrtRatioAtTick(clampedTick);

  // amount0_raw = liquidity * Q96 * (sqrtU - sqrtC) / (sqrtC * sqrtU)
  const amount0Raw =
    sqrtC > 0n && sqrtU > 0n
      ? (liquidity * Q96 * (sqrtU - sqrtC)) / (sqrtC * sqrtU)
      : 0n;

  // amount1_raw = liquidity * (sqrtC - sqrtL) / Q96
  const amount1Raw = (liquidity * (sqrtC - sqrtL)) / Q96;

  const amount0 = Number(amount0Raw) / 10 ** token0Decimals;
  const amount1 = Number(amount1Raw) / 10 ** token1Decimals;

  return { amount0, amount1 };
}
