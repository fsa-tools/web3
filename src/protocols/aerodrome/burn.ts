import { AERODROME_NPM_ABI } from "../../abis/aerodrome-npm.js";
import type { ChainContext } from "../../context.js";
import type { BurnOperationParams, BurnResult } from "./types.js";

export async function burnPosition(
  ctx: ChainContext,
  params: BurnOperationParams,
): Promise<BurnResult> {
  if (!ctx.walletClient) {
    throw new Error("burnPosition requires walletClient in ChainContext");
  }
  const { publicClient, walletClient } = ctx;

  const txHash = await walletClient.writeContract({
    address: params.npmAddress,
    abi: AERODROME_NPM_ABI,
    functionName: "burn",
    args: [params.nftId],
    ...(params.gasOptions ?? {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 2,
  });

  return { txHash, gasUsed: receipt.gasUsed };
}
