import type { Address, Hash } from "viem";
import type { GasOptions } from "../../utils/gas.js";
import type { ApprovalMode } from "../../utils/erc20.js";

export type { GasOptions };

export type MintOperationParams = {
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  amount0Desired: bigint;
  amount1Desired: bigint;
  slippageBps: number;
  deadline?: bigint;
  gasOptions?: GasOptions;
  approvalMode?: ApprovalMode;
};

export type DecreaseOperationParams = {
  tokenId: bigint;
  liquidity: bigint;
  slippageBps: number;
  deadline?: bigint;
  gasOptions?: GasOptions;
};

export type CollectOperationParams = {
  tokenId: bigint;
  recipient: Address;
  gasOptions?: GasOptions;
};

export type BurnOperationParams = {
  tokenId: bigint;
  gasOptions?: GasOptions;
};

export type PositionResult = {
  tokenId: bigint;
  liquidity: bigint;
  amount0: bigint;
  amount1: bigint;
  txHash: Hash;
  gasUsed: bigint;
};

export type DecreaseResult = {
  amount0: bigint;
  amount1: bigint;
  txHash: Hash;
  gasUsed: bigint;
};

export type CollectResult = {
  amount0: bigint;
  amount1: bigint;
  txHash: Hash;
  gasUsed: bigint;
};

export type BurnResult = {
  txHash: Hash;
  gasUsed: bigint;
};

export type SwapOperationParams = {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  amountIn: bigint;
  slippageBps: number;
  gasOptions?: GasOptions;
  approvalMode?: ApprovalMode;
};

export type SwapResult = {
  amountOut: bigint;
  txHash: Hash;
  gasUsed: bigint;
};

export type QuoteOperationParams = {
  tokenIn: Address;
  tokenOut: Address;
  fee: number;
  amountIn: bigint;
};

export type QuoteResult = {
  /** Output efetivo do swap — já descontados fee do pool e price impact. */
  amountOut: bigint;
  /** sqrtPriceX96 do pool após o swap simulado. */
  sqrtPriceX96After: bigint;
  initializedTicksCrossed: number;
  gasEstimate: bigint;
};
