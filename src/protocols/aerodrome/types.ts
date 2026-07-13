import type { Address, Hash } from "viem";
import type { GasOptions } from "../../utils/gas.js";
import type { ApprovalMode } from "../../utils/erc20.js";

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
  // Mins explicitos vencem o slippageBps. Deriva-los do desired amarra o min ao
  // preco do momento em que os amounts foram calculados: como o pool consome os
  // tokens na proporcao do preco corrente, qualquer drift ate a TX ser minada
  // encolhe uma das pernas abaixo do seu min e o NPM reverte com PSC. Quem sabe
  // a banda de preco tolerada calcula os mins nela e passa aqui.
  amount0Min?: bigint;
  amount1Min?: bigint;
  deadline?: bigint;
  gasOptions?: GasOptions;
  approvalMode?: ApprovalMode;
};

export type DecreaseOperationParams = {
  npmAddress: Address;
  nftId: bigint;
  liquidity: bigint;
  amount0Min?: bigint;
  amount1Min?: bigint;
  slippageBps?: number;
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
  // effectiveGasPrice do receipt — evita o chamador rebuscar o receipt so pra
  // calcular o custo em USD (+1 RPC por trade).
  effectiveGasPrice: bigint;
};

export type DecreaseResult = {
  txHash: Hash;
  amount0: bigint;
  amount1: bigint;
  gasUsed: bigint;
  // effectiveGasPrice do receipt — evita o chamador rebuscar o receipt so pra
  // calcular o custo em USD (+1 RPC por trade).
  effectiveGasPrice: bigint;
};

export type CollectResult = {
  txHash: Hash;
  amount0: bigint;
  amount1: bigint;
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
  tickSpacing: number;
  amountIn: bigint;
  slippageBps: number;
  deadline?: bigint;
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
};

export type QuoteOperationParams = {
  tokenIn: Address;
  tokenOut: Address;
  tickSpacing: number;
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
