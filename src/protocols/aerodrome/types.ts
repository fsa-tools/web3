import type { Address, Hash } from "viem";
import type { GasOptions } from "../../utils/gas.js";

export type MintOperationParams = {
  npmAddress: Address;
  poolAddress: Address;
  token0: Address;
  token1: Address;
  tickSpacing: number;
  tickLower: number;
  tickUpper: number;
  amount0Desired: bigint;
  amount1Desired: bigint;
  sqrtPriceX96: bigint;
  slippageBps: number;
  deadline?: bigint;
  gasOptions?: GasOptions;
};

export type DecreaseOperationParams = {
  npmAddress: Address;
  nftId: bigint;
  liquidity: bigint;
  amount0Min?: bigint;
  amount1Min?: bigint;
  deadline?: bigint;
  gasOptions?: GasOptions;
};

export type CollectOperationParams = {
  npmAddress: Address;
  nftId: bigint;
  gasOptions?: GasOptions;
};

export type BurnOperationParams = {
  npmAddress: Address;
  nftId: bigint;
  gasOptions?: GasOptions;
};

export type PositionResult = {
  txHash: Hash;
  nftId: bigint;
  amount0: bigint;
  amount1: bigint;
  gasUsed: bigint;
};

export type DecreaseResult = {
  txHash: Hash;
  amount0: bigint;
  amount1: bigint;
  gasUsed: bigint;
};

export type CollectResult = {
  txHash: Hash;
  amount0: bigint;
  amount1: bigint;
  gasUsed: bigint;
};

export type BurnResult = {
  txHash: Hash;
  gasUsed: bigint;
};
