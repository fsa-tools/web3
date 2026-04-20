import { SlippageExceededError } from "../errors.js";

const MAX_BPS = 10_000;

export function toBps(decimal: number): number {
  return Math.round(decimal * MAX_BPS);
}

export function fromBps(bps: number): number {
  return bps / MAX_BPS;
}

export function applySlippage(amount: bigint, slippageBps: number): bigint {
  if (slippageBps < 0 || slippageBps > MAX_BPS) {
    throw new SlippageExceededError(slippageBps, MAX_BPS);
  }
  return (amount * BigInt(MAX_BPS - slippageBps)) / BigInt(MAX_BPS);
}
