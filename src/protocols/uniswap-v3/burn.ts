import { NPM_ABI } from "../../abis/npm.js";
import { ADDRESSES } from "../../constants/addresses.js";
import type { BurnParams, BurnResult } from "./types.js";

export async function burnPosition(params: BurnParams): Promise<BurnResult> {
  const { walletClient, publicClient, chainId, tokenId, gasOptions } = params;

  const chainAddrs = ADDRESSES[chainId];
  if (!chainAddrs?.uniswapV3) {
    throw new Error(`chainId ${chainId} is not supported for Uniswap V3`);
  }

  const npmAddress = chainAddrs.uniswapV3.npm;

  const hash = await walletClient.writeContract({
    address: npmAddress,
    abi: NPM_ABI,
    functionName: "burn",
    args: [tokenId],
    ...(gasOptions ?? {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 2,
  });

  return { txHash: hash, gasUsed: receipt.gasUsed };
}
