import type { Address } from "viem";
import { ERC20_ABI } from "../abis/erc20.js";
import type { ChainContext } from "../context.js";

export type GetTokenDecimalsParams = {
  token: Address;
};

function cacheKey(chainId: number, token: Address): string {
  return `${chainId}:${token.toLowerCase()}`;
}

export async function getTokenDecimals(
  ctx: ChainContext,
  params: GetTokenDecimalsParams,
): Promise<number> {
  const chainId = ctx.publicClient.chain?.id;
  if (chainId === undefined) {
    throw new Error("publicClient must have a chain configured");
  }

  if (ctx.decimalsCache) {
    const key = cacheKey(chainId, params.token);
    const cached = ctx.decimalsCache.get(key);
    if (cached !== undefined) return cached;
  }

  const decimals = await ctx.publicClient.readContract({
    address: params.token,
    abi: ERC20_ABI,
    functionName: "decimals",
  });

  if (ctx.decimalsCache) {
    ctx.decimalsCache.set(cacheKey(chainId, params.token), decimals);
  }

  return decimals;
}
