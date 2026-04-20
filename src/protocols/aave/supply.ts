import { AAVE_POOL_ABI } from "../../abis/aave-pool.js";
import type { ChainContext } from "../../context.js";
import { ProtocolNotSupportedError } from "../../errors.js";
import type { SupplyOperationParams, SupplyResult } from "./types.js";

const REFERRAL_CODE = 0;

export async function supply(
  ctx: ChainContext,
  params: SupplyOperationParams,
): Promise<SupplyResult> {
  if (!ctx.walletClient) {
    throw new Error("supply requires walletClient in ChainContext");
  }
  if (!ctx.addresses.aave) {
    throw new ProtocolNotSupportedError(
      ctx.publicClient.chain?.id ?? 0,
      "aave",
    );
  }

  const { publicClient, walletClient } = ctx;
  const poolAddress = ctx.addresses.aave.pool;
  const recipient = params.onBehalfOf ?? walletClient.account.address;

  const hash = await walletClient.writeContract({
    address: poolAddress,
    abi: AAVE_POOL_ABI,
    functionName: "supply",
    args: [params.asset, params.amount, recipient, REFERRAL_CODE],
  });

  await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });

  return { txHash: hash };
}
