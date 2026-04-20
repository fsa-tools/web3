import { AAVE_POOL_ABI } from "../../abis/aave-pool.js";
import { ADDRESSES } from "../../constants/addresses.js";
import type { WithdrawParams, WithdrawResult } from "./types.js";

const WITHDRAW_TOPIC =
  "0x3115d1449a7b732c986cba18244e897a145df0b3b24bf8bc15765c1514000b06";

export async function withdraw(
  params: WithdrawParams,
): Promise<WithdrawResult> {
  const { publicClient, walletClient, chainId, asset, amount, to } = params;

  const chainAddrs = ADDRESSES[chainId];
  if (!chainAddrs?.aave) {
    throw new Error(`chainId ${chainId} is not supported for Aave`);
  }

  const poolAddress = chainAddrs.aave.pool;
  const recipient = to ?? walletClient.account.address;

  const hash = await walletClient.writeContract({
    address: poolAddress,
    abi: AAVE_POOL_ABI,
    functionName: "withdraw",
    args: [asset, amount, recipient],
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
