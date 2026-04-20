import { NPM_ABI } from "../../abis/npm.js";
import { ProtocolNotSupportedError } from "../../errors.js";
import type { ChainContext } from "../../context.js";
import type { BurnOperationParams, BurnResult } from "./types.js";

export async function burnPosition(
  ctx: ChainContext,
  params: BurnOperationParams,
): Promise<BurnResult> {
  if (!ctx.walletClient) {
    throw new Error("burnPosition requires walletClient in ChainContext");
  }

  const npmAddress = ctx.addresses.uniswapV3?.npm;
  if (!npmAddress) {
    throw new ProtocolNotSupportedError(
      ctx.publicClient.chain?.id ?? 0,
      "uniswapV3",
    );
  }

  const { publicClient, walletClient } = ctx;
  const { tokenId, gasOptions } = params;

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
