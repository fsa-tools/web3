import { AAVE_POOL_ABI } from "../../abis/aave-pool.js";
import type { ChainContext } from "../../context.js";
import { ProtocolNotSupportedError } from "../../errors.js";
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

  const { publicClient, walletClient } = ctx;
  const poolAddress = ctx.addresses.aave.pool;
  const recipient = params.to ?? walletClient.account.address;

  const hash = await walletClient.writeContract({
    address: poolAddress,
    abi: AAVE_POOL_ABI,
    functionName: "withdraw",
    args: [params.asset, params.amount, recipient],
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 2,
  });

  const eventLog = receipt.logs.find((log) => log.topics[0] === WITHDRAW_TOPIC);

  let withdrawnAmount = 0n;
  if (eventLog) {
    const data = eventLog.data.slice(2);
    withdrawnAmount = BigInt("0x" + data.slice(0, 64));
  }

  return { txHash: hash, amount: withdrawnAmount };
}
