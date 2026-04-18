const MAX_BPS = 10_000;

export function toBps(decimal: number): number {
  return Math.round(decimal * MAX_BPS);
}

export function fromBps(bps: number): number {
  return bps / MAX_BPS;
}

export function applySlippage(amount: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps > MAX_BPS) {
    throw new Error(`slippageBps ${slippageBps} must be between 0 and 10000`);
  }
  return (amount * BigInt(MAX_BPS - slippageBps)) / BigInt(MAX_BPS);
}
