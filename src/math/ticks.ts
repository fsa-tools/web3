const LOG_BASE = Math.log(1.0001);

export function priceToTick(
  price: number,
  token0Decimals: number,
  token1Decimals: number,
): number {
  const adjustedPrice = price * 10 ** (token0Decimals - token1Decimals);
  return Math.floor(Math.log(adjustedPrice) / LOG_BASE);
}

export function tickToPrice(
  tick: number,
  token0Decimals: number,
  token1Decimals: number,
): number {
  const rawPrice = 1.0001 ** tick;
  return rawPrice / 10 ** (token0Decimals - token1Decimals);
}

export function roundToTickSpacing(tick: number, tickSpacing: number): number {
  return Math.floor(tick / tickSpacing) * tickSpacing;
}

export function percentToTickOffset(pct: number): number {
  if (pct === 0) return 0;
  return Math.abs(Math.log(1 + Math.abs(pct) / 100) / LOG_BASE);
}

export function feeToTickSpacing(feeBps: number): number {
  return Math.round(feeBps / 50);
}

export function ceilToTickSpacing(tick: number, tickSpacing: number): number {
  return Math.ceil(tick / tickSpacing) * tickSpacing;
}

export const MIN_TICK = -887272;
export const MAX_TICK = 887272;

const Q96_NUM = Number(2n ** 96n);

export function getSqrtRatioAtTick(tick: number): bigint {
  return BigInt(Math.round(Math.sqrt(1.0001 ** tick) * Q96_NUM));
}

export function formatSqrtPrice(
  sqrtPriceX96: bigint,
  token0Decimals: number,
  token1Decimals: number,
): number {
  if (sqrtPriceX96 === 0n) return 0;
  const PRECISION = 18;
  const scaledPrice =
    (sqrtPriceX96 ** 2n *
      10n ** BigInt(PRECISION + token1Decimals - token0Decimals)) /
    2n ** 192n;
  return Number(scaledPrice) / 10 ** PRECISION;
}

export function inversePriceToTick(
  price: number,
  token0Decimals: number,
  token1Decimals: number,
): number {
  const adjustedPrice = price * 10 ** (token0Decimals - token1Decimals);
  return -Math.floor(Math.log(adjustedPrice) / LOG_BASE) || 0;
}
