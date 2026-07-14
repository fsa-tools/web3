import type { Address, Hash, TransactionReceipt } from "viem";
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
  // Mins explicitos vencem o slippageBps — ver nota em aerodrome/types.ts (PSC).
  amount0Min?: bigint;
  amount1Min?: bigint;
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
  // effectiveGasPrice do receipt — evita o chamador rebuscar o receipt so pra
  // calcular o custo em USD (+1 RPC por trade).
  effectiveGasPrice: bigint;
  // receipts dos approves de token0/token1 disparados internamente — sem isso
  // o chamador subestima o gas gasto na entrada. Vazio quando allowance ja bastava.
  approvalReceipts: TransactionReceipt[];
};

export type DecreaseResult = {
  amount0: bigint;
  amount1: bigint;
  txHash: Hash;
  gasUsed: bigint;
  // effectiveGasPrice do receipt — evita o chamador rebuscar o receipt so pra
  // calcular o custo em USD (+1 RPC por trade).
  effectiveGasPrice: bigint;
};

export type CollectResult = {
  amount0: bigint;
  amount1: bigint;
  txHash: Hash;
  gasUsed: bigint;
  // effectiveGasPrice do receipt — evita o chamador rebuscar o receipt so pra
  // calcular o custo em USD (+1 RPC por trade).
  effectiveGasPrice: bigint;
};

export type BurnResult = {
  txHash: Hash;
  gasUsed: bigint;
  // effectiveGasPrice do receipt — evita o chamador rebuscar o receipt so pra
  // calcular o custo em USD (+1 RPC por trade).
  effectiveGasPrice: bigint;
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
  // effectiveGasPrice do receipt — evita o chamador rebuscar o receipt so pra
  // calcular o custo em USD (+1 RPC por trade).
  effectiveGasPrice: bigint;
  // receipt do approve de tokenIn disparado internamente — sem isso o chamador
  // subestima o gas gasto na entrada. Vazio quando allowance ja bastava.
  approvalReceipts: TransactionReceipt[];
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
