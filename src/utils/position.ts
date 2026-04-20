// src/utils/position.ts
import type { Abi, Address } from "viem";
import { NPM_ABI } from "../abis/npm.js";
import type { ChainContext } from "../context.js";

const ZERO_ADDRESS: Address = "0x0000000000000000000000000000000000000000";

export type GetPositionParams = {
  npmAddress: Address;
  nftId: bigint;
  npmAbi?: Abi;
};

export type OnChainPosition = {
  exists: boolean;
  liquidity: bigint;
  token0: Address;
  token1: Address;
  tickLower: number;
  tickUpper: number;
};

export async function getOnChainPosition(
  ctx: ChainContext,
  params: GetPositionParams,
): Promise<OnChainPosition> {
  const abi = params.npmAbi ?? NPM_ABI;
  try {
    const result = (await ctx.publicClient.readContract({
      address: params.npmAddress,
      abi,
      functionName: "positions",
      args: [params.nftId],
    })) as [
      unknown,
      unknown,
      Address,
      Address,
      unknown,
      number,
      number,
      bigint,
      ...unknown[],
    ];
    return {
      exists: true,
      token0: result[2],
      token1: result[3],
      tickLower: result[5],
      tickUpper: result[6],
      liquidity: result[7],
    };
  } catch {
    return {
      exists: false,
      liquidity: 0n,
      token0: ZERO_ADDRESS,
      token1: ZERO_ADDRESS,
      tickLower: 0,
      tickUpper: 0,
    };
  }
}
