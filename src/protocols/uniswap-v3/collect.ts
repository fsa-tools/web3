import { parseEventLogs } from "viem";
import { NPM_ABI } from "../../abis/npm.js";
import {
  ProtocolNotSupportedError,
  ReceiptEventNotFoundError,
} from "../../errors.js";
import type { ChainContext } from "../../context.js";
import type { CollectOperationParams, CollectResult } from "./types.js";

const MAX_UINT128 = 2n ** 128n - 1n;

export async function collectFees(
  ctx: ChainContext,
  params: CollectOperationParams,
): Promise<CollectResult> {
  if (!ctx.walletClient) {
    throw new Error("collectFees requires walletClient in ChainContext");
  }

  const npmAddress = ctx.addresses.uniswapV3?.npm;
  if (!npmAddress) {
    throw new ProtocolNotSupportedError(
      ctx.publicClient.chain?.id ?? 0,
      "uniswapV3",
    );
  }

  const { publicClient, walletClient } = ctx;
  const { tokenId, recipient, gasOptions } = params;

  const hash = await walletClient.writeContract({
    address: npmAddress,
    abi: NPM_ABI,
    functionName: "collect",
    args: [
      {
        tokenId,
        recipient,
        amount0Max: MAX_UINT128,
        amount1Max: MAX_UINT128,
      },
    ],
    ...(gasOptions ?? {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 2,
  });

  const logs = parseEventLogs({
    abi: NPM_ABI,
    eventName: "Collect",
    logs: receipt.logs,
  });

  const event = logs[0];
  if (!event) throw new ReceiptEventNotFoundError("Collect", hash);

  return {
    amount0: event.args.amount0,
    amount1: event.args.amount1,
    txHash: hash,
    gasUsed: receipt.gasUsed,
  };
}
