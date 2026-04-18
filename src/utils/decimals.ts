import type { Address, PublicClient } from "viem";
import { ERC20_ABI } from "../abis/erc20.js";

export type GetTokenDecimalsParams = {
  publicClient: PublicClient;
  token: Address;
};

const decimalsCache = new Map<string, number>();

function cacheKey(chainId: number, token: Address): string {
  return `${chainId}:${token.toLowerCase()}`;
}

export async function getTokenDecimals(
  params: GetTokenDecimalsParams,
): Promise<number> {
  const chainId = params.publicClient.chain?.id;
  if (chainId === undefined) {
    throw new Error("publicClient must have a chain configured");
  }
  const key = cacheKey(chainId, params.token);
  const cached = decimalsCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const decimals = (await params.publicClient.readContract({
    address: params.token,
    abi: ERC20_ABI,
    functionName: "decimals",
  })) as number;
  decimalsCache.set(key, decimals);
  return decimals;
}

/** @internal — exposed only for test cache reset */
export function _resetCache(): void {
  decimalsCache.clear();
}
