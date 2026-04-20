import { AERODROME_NPM_ABI } from "../../abis/aerodrome-npm.js";
import type { AerodromeCollectParams, CollectResult } from "./types.js";

const MAX_UINT128 = 2n ** 128n - 1n;
const COLLECT_TOPIC =
  "0x40d0efd1a53d60ecbf40971b9daf7dc90178c3aadc7aab1765632738fa8b8f01";

export async function collectFees(
  params: AerodromeCollectParams,
): Promise<CollectResult> {
  const { publicClient, walletClient, npmAddress, nftId, gasOptions } = params;

  const txHash = await walletClient.writeContract({
    address: npmAddress,
    abi: AERODROME_NPM_ABI,
    functionName: "collect",
    args: [
      {
        tokenId: nftId,
        recipient: walletClient.account.address,
        amount0Max: MAX_UINT128,
        amount1Max: MAX_UINT128,
      },
    ],
    ...(gasOptions ?? {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 2,
  });

  const eventLog = receipt.logs.find((log) => log.topics[0] === COLLECT_TOPIC);

  let amount0 = 0n;
  let amount1 = 0n;

  if (eventLog) {
    const data = eventLog.data.slice(2);
    const WORD = 64;
    amount0 = BigInt("0x" + data.slice(0, WORD));
    amount1 = BigInt("0x" + data.slice(WORD, WORD * 2));
  }

  return { txHash, amount0, amount1, gasUsed: receipt.gasUsed };
}
