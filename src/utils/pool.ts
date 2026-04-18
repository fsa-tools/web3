import type { Abi, Address, PublicClient } from "viem";
import { POOL_SLOT0_ABI } from "../abis/pool.js";

export type GetCurrentPriceParams = {
  publicClient: PublicClient;
  poolAddress: Address;
  poolAbi?: Abi;
};

export type PriceResult = {
  tick: number;
  sqrtPriceX96: bigint;
};

export async function getCurrentPrice(
  params: GetCurrentPriceParams,
): Promise<PriceResult> {
  const abi = params.poolAbi ?? POOL_SLOT0_ABI;
  const result = (await params.publicClient.readContract({
    address: params.poolAddress,
    abi,
    functionName: "slot0",
  })) as [bigint, number, ...unknown[]];
  return {
    sqrtPriceX96: result[0],
    tick: result[1],
  };
}
