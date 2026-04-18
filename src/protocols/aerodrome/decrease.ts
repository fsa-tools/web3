import { AERODROME_NPM_ABI } from "../../abis/aerodrome-npm.js";
import { validateAddress } from "../../utils/address.js";
import type { AerodromeDecreaseParams, DecreaseResult } from "./types.js";

const DEFAULT_DEADLINE_SECONDS = 1200n;
const DECREASE_TOPIC =
  "0x26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b4";

export async function decreaseLiquidity(
  params: AerodromeDecreaseParams,
): Promise<DecreaseResult> {
  const {
    publicClient,
    walletClient,
    npmAddress,
    nftId,
    liquidity,
    gasOptions,
  } = params;

  validateAddress(npmAddress);

  const deadline =
    params.deadline ??
    BigInt(Math.floor(Date.now() / 1000)) + DEFAULT_DEADLINE_SECONDS;

  const txHash = await walletClient.writeContract({
    address: npmAddress,
    abi: AERODROME_NPM_ABI,
    functionName: "decreaseLiquidity",
    args: [
      {
        tokenId: nftId,
        liquidity,
        amount0Min: params.amount0Min ?? 0n,
        amount1Min: params.amount1Min ?? 0n,
        deadline,
      },
    ],
    ...(gasOptions ?? {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });

  const eventLog = receipt.logs.find((log) => log.topics[0] === DECREASE_TOPIC);

  let amount0 = 0n;
  let amount1 = 0n;

  if (eventLog) {
    const data = eventLog.data.slice(2);
    const WORD = 64;
    amount0 = BigInt("0x" + data.slice(WORD, WORD * 2));
    amount1 = BigInt("0x" + data.slice(WORD * 2, WORD * 3));
  }

  return { txHash, amount0, amount1, gasUsed: receipt.gasUsed };
}
