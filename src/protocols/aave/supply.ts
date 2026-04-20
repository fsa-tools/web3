import { AAVE_POOL_ABI } from "../../abis/aave-pool.js";
import { ADDRESSES } from "../../constants/addresses.js";
import type { SupplyParams, SupplyResult } from "./types.js";

const REFERRAL_CODE = 0;

export async function supply(params: SupplyParams): Promise<SupplyResult> {
  const { publicClient, walletClient, chainId, asset, amount, onBehalfOf } =
    params;

  const chainAddrs = ADDRESSES[chainId];
  if (!chainAddrs?.aave) {
    throw new Error(`chainId ${chainId} is not supported for Aave`);
  }

  const poolAddress = chainAddrs.aave.pool;
  const recipient = onBehalfOf ?? walletClient.account.address;

  const hash = await walletClient.writeContract({
    address: poolAddress,
    abi: AAVE_POOL_ABI,
    functionName: "supply",
    args: [asset, amount, recipient, REFERRAL_CODE],
  });

  await publicClient.waitForTransactionReceipt({ hash, confirmations: 2 });

  return { txHash: hash };
}
