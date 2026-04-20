import { parseEventLogs } from "viem";
import { NPM_ABI } from "../../abis/npm.js";
import { ADDRESSES } from "../../constants/addresses.js";
import type { CollectParams, CollectResult } from "./types.js";

const MAX_UINT128 = 2n ** 128n - 1n;

export async function collectFees(
  params: CollectParams,
): Promise<CollectResult> {
  const {
    walletClient,
    publicClient,
    chainId,
    tokenId,
    recipient,
    gasOptions,
  } = params;

  const chainAddrs = ADDRESSES[chainId];
  if (!chainAddrs?.uniswapV3) {
    throw new Error(`chainId ${chainId} is not supported for Uniswap V3`);
  }

  const npmAddress = chainAddrs.uniswapV3.npm;

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
  if (!event) throw new Error("Collect event not found in receipt");

  return {
    amount0: event.args.amount0,
    amount1: event.args.amount1,
    txHash: hash,
    gasUsed: receipt.gasUsed,
  };
}
