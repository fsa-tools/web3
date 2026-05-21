import { sendTxRequest } from "../../tx/send.js";
import { ProtocolNotSupportedError } from "../../errors.js";
import type { ChainContext } from "../../context.js";
import { planBurnPosition } from "./plan.js";
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

  const { gasOptions } = params;

  const [burnTx] = planBurnPosition({ ...params, npmAddress });
  const { txHash, receipt } = await sendTxRequest(ctx, burnTx!, gasOptions);

  return { txHash, gasUsed: receipt.gasUsed };
}
