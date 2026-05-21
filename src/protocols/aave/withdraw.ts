import { sendTxRequest } from "../../tx/send.js";
import type { ChainContext } from "../../context.js";
import { ProtocolNotSupportedError } from "../../errors.js";
import { planWithdraw } from "./plan.js";
import type { WithdrawOperationParams, WithdrawResult } from "./types.js";

const WITHDRAW_TOPIC =
  "0x3115d1449a7b732c986cba18244e897a145df0b3b24bf8bc15765c1514000b06";

export async function withdraw(
  ctx: ChainContext,
  params: WithdrawOperationParams,
): Promise<WithdrawResult> {
  if (!ctx.walletClient) {
    throw new Error("withdraw requires walletClient in ChainContext");
  }
  if (!ctx.addresses.aave) {
    throw new ProtocolNotSupportedError(
      ctx.publicClient.chain?.id ?? 0,
      "aave",
    );
  }
  const poolAddress = ctx.addresses.aave.pool;
  const to = params.to ?? ctx.walletClient.account.address;

  const [withdrawTx] = planWithdraw({ ...params, poolAddress, to });
  const { txHash, receipt } = await sendTxRequest(ctx, withdrawTx!);

  const eventLog = receipt.logs.find((log) => log.topics[0] === WITHDRAW_TOPIC);
  let withdrawnAmount = 0n;
  if (eventLog) {
    withdrawnAmount = BigInt("0x" + eventLog.data.slice(2).slice(0, 64));
  }

  return { txHash, amount: withdrawnAmount };
}
