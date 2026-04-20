// src/utils/pool.ts
import type { Abi, Address } from "viem";
import { POOL_SLOT0_ABI } from "../abis/pool.js";
import type { ChainContext } from "../context.js";

export type GetCurrentPriceParams = {
  poolAddress: Address;
  poolAbi?: Abi;
};

export type PriceResult = {
  tick: number;
  sqrtPriceX96: bigint;
};

export async function getCurrentPrice(
  ctx: ChainContext,
  params: GetCurrentPriceParams,
): Promise<PriceResult> {
  const abi = params.poolAbi ?? POOL_SLOT0_ABI;
  const result = (await ctx.publicClient.readContract({
    address: params.poolAddress,
    abi,
    functionName: "slot0",
  })) as [bigint, number, ...unknown[]];
  return {
    sqrtPriceX96: result[0],
    tick: result[1],
  };
}
