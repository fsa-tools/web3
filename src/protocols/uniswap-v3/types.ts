import type {
  Address,
  Hash,
  WalletClient,
  PublicClient,
  Transport,
  Chain,
  Account,
} from "viem";
import type { GasOptions } from "../../utils/gas.js";

export type { GasOptions };

export type MintParams = {
  walletClient: WalletClient<Transport, Chain, Account>;
  publicClient: PublicClient;
  chainId: number;
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
};

export type DecreaseParams = {
  walletClient: WalletClient<Transport, Chain, Account>;
  publicClient: PublicClient;
  chainId: number;
  tokenId: bigint;
  liquidity: bigint;
  slippageBps: number;
  deadline?: bigint;
  recipient: Address;
  gasOptions?: GasOptions;
};

export type CollectParams = {
  walletClient: WalletClient<Transport, Chain, Account>;
  publicClient: PublicClient;
  chainId: number;
  tokenId: bigint;
  recipient: Address;
  gasOptions?: GasOptions;
};

export type BurnParams = {
  walletClient: WalletClient<Transport, Chain, Account>;
  publicClient: PublicClient;
  chainId: number;
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
