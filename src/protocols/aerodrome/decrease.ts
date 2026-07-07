import { AERODROME_NPM_ABI } from "../../abis/aerodrome-npm.js";
import { applySlippage } from "../../math/slippage.js";
import { validateAddress } from "../../utils/address.js";
import { withRetry } from "../../utils/retry.js";
import type { ChainContext } from "../../context.js";
import type { DecreaseOperationParams, DecreaseResult } from "./types.js";

const DEFAULT_DEADLINE_SECONDS = 1200n;
// AERODROME_NPM_ABI excludes event definitions — parse raw log data directly
const DECREASE_TOPIC =
  "0x26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b4";

export async function decreaseLiquidity(
  ctx: ChainContext,
  params: DecreaseOperationParams,
): Promise<DecreaseResult> {
  if (!ctx.walletClient) {
    throw new Error("decreaseLiquidity requires walletClient in ChainContext");
  }
  const { publicClient, walletClient } = ctx;

  validateAddress(params.npmAddress);

  const deadline =
    params.deadline ??
    BigInt(Math.floor(Date.now() / 1000)) + DEFAULT_DEADLINE_SECONDS;

  let derivedAmount0Min: bigint | undefined;
  let derivedAmount1Min: bigint | undefined;

  if (
    params.slippageBps !== undefined &&
    (params.amount0Min === undefined || params.amount1Min === undefined)
  ) {
    const { result } = await withRetry(() =>
      publicClient.simulateContract({
        address: params.npmAddress,
        abi: AERODROME_NPM_ABI,
        functionName: "decreaseLiquidity",
        args: [
          {
            tokenId: params.nftId,
            liquidity: params.liquidity,
            amount0Min: 0n,
            amount1Min: 0n,
            deadline,
          },
        ],
        account: walletClient.account,
      }),
    );
    const [estimatedAmount0, estimatedAmount1] = result;
    derivedAmount0Min = applySlippage(estimatedAmount0, params.slippageBps);
    derivedAmount1Min = applySlippage(estimatedAmount1, params.slippageBps);
  }

  const amount0Min = params.amount0Min ?? derivedAmount0Min ?? 0n;
  const amount1Min = params.amount1Min ?? derivedAmount1Min ?? 0n;

  const txHash = await walletClient.writeContract({
    address: params.npmAddress,
    abi: AERODROME_NPM_ABI,
    functionName: "decreaseLiquidity",
    args: [
      {
        tokenId: params.nftId,
        liquidity: params.liquidity,
        amount0Min,
        amount1Min,
        deadline,
      },
    ],
    ...(params.gasOptions ?? {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 2,
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
