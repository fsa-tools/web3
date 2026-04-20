import { parseEventLogs } from "viem";
import { NPM_ABI } from "../../abis/npm.js";
import { applySlippage } from "../../math/slippage.js";
import { withRetry } from "../../utils/retry.js";
import {
  ProtocolNotSupportedError,
  SlippageExceededError,
  ReceiptEventNotFoundError,
} from "../../errors.js";
import type { ChainContext } from "../../context.js";
import type { DecreaseOperationParams, DecreaseResult } from "./types.js";

const DEFAULT_DEADLINE_OFFSET = 1200n;
const MAX_SLIPPAGE_BPS = 5_000;

export async function decreaseLiquidity(
  ctx: ChainContext,
  params: DecreaseOperationParams,
): Promise<DecreaseResult> {
  if (!ctx.walletClient) {
    throw new Error("decreaseLiquidity requires walletClient in ChainContext");
  }

  if (params.slippageBps < 0 || params.slippageBps > MAX_SLIPPAGE_BPS) {
    throw new SlippageExceededError(params.slippageBps, MAX_SLIPPAGE_BPS);
  }

  const npmAddress = ctx.addresses.uniswapV3?.npm;
  if (!npmAddress) {
    throw new ProtocolNotSupportedError(
      ctx.publicClient.chain?.id ?? 0,
      "uniswapV3",
    );
  }

  const { publicClient, walletClient } = ctx;
  const { tokenId, liquidity, slippageBps, deadline, gasOptions } = params;

  const effectiveDeadline =
    deadline ?? BigInt(Math.floor(Date.now() / 1000)) + DEFAULT_DEADLINE_OFFSET;

  const { result } = await withRetry(() =>
    publicClient.simulateContract({
      address: npmAddress,
      abi: NPM_ABI,
      functionName: "decreaseLiquidity",
      args: [
        {
          tokenId,
          liquidity,
          amount0Min: 0n,
          amount1Min: 0n,
          deadline: effectiveDeadline,
        },
      ],
      account: walletClient.account,
    }),
  );

  const [estimatedAmount0, estimatedAmount1] = result;
  const amount0Min = applySlippage(estimatedAmount0, slippageBps);
  const amount1Min = applySlippage(estimatedAmount1, slippageBps);

  const hash = await walletClient.writeContract({
    address: npmAddress,
    abi: NPM_ABI,
    functionName: "decreaseLiquidity",
    args: [
      {
        tokenId,
        liquidity,
        amount0Min,
        amount1Min,
        deadline: effectiveDeadline,
      },
    ],
    ...(gasOptions ?? {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 2,
  });

  const logs = parseEventLogs({
    abi: NPM_ABI,
    eventName: "DecreaseLiquidity",
    logs: receipt.logs,
  });

  const event = logs[0];
  if (!event) throw new ReceiptEventNotFoundError("DecreaseLiquidity", hash);

  return {
    amount0: event.args.amount0,
    amount1: event.args.amount1,
    txHash: hash,
    gasUsed: receipt.gasUsed,
  };
}
