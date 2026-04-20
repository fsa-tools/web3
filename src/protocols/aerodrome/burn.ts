import { AERODROME_NPM_ABI } from "../../abis/aerodrome-npm.js";
import type { AerodromeBurnParams, BurnResult } from "./types.js";

export async function burnPosition(
  params: AerodromeBurnParams,
): Promise<BurnResult> {
  const { publicClient, walletClient, npmAddress, nftId, gasOptions } = params;

  const txHash = await walletClient.writeContract({
    address: npmAddress,
    abi: AERODROME_NPM_ABI,
    functionName: "burn",
    args: [nftId],
    ...(gasOptions ?? {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 2,
  });

  return { txHash, gasUsed: receipt.gasUsed };
}
