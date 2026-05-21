import { parseEventLogs } from "viem";
import { NPM_ABI } from "../../abis/npm.js";
import { sendTxRequest } from "../../tx/send.js";
import {
  ProtocolNotSupportedError,
  ReceiptEventNotFoundError,
} from "../../errors.js";
import type { ChainContext } from "../../context.js";
import { planCollectFees } from "./plan.js";
import type { CollectOperationParams, CollectResult } from "./types.js";

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

  const { gasOptions } = params;

  const [collectTx] = planCollectFees({ ...params, npmAddress });
  const { txHash, receipt } = await sendTxRequest(ctx, collectTx!, gasOptions);

  const logs = parseEventLogs({
    abi: NPM_ABI,
    eventName: "Collect",
    logs: receipt.logs,
  });

  const event = logs[0];
  if (!event) throw new ReceiptEventNotFoundError("Collect", txHash);

  return {
    amount0: event.args.amount0,
    amount1: event.args.amount1,
    txHash,
    gasUsed: receipt.gasUsed,
  };
}
