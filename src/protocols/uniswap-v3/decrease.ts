import { parseEventLogs } from "viem";
import { NPM_ABI } from "../../abis/npm.js";
import { ADDRESSES } from "../../constants/addresses.js";
import { applySlippage } from "../../math/slippage.js";
import { withRetry } from "../../utils/retry.js";
import type { DecreaseParams, DecreaseResult } from "./types.js";

const DEFAULT_DEADLINE_OFFSET = 1200n;

export async function decreaseLiquidity(
  params: DecreaseParams,
): Promise<DecreaseResult> {
  const {
    walletClient,
    publicClient,
    chainId,
    tokenId,
    liquidity,
    slippageBps,
    deadline,
    recipient: _recipient,
    gasOptions,
  } = params;

  if (slippageBps < 0 || slippageBps > 5_000) {
    throw new Error("slippageBps exceeds maximum (5000 = 50%)");
  }

  const chainAddrs = ADDRESSES[chainId];
  if (!chainAddrs?.uniswapV3) {
    throw new Error(`chainId ${chainId} is not supported for Uniswap V3`);
  }

  const npmAddress = chainAddrs.uniswapV3.npm;
  const effectiveDeadline =
    deadline ?? BigInt(Math.floor(Date.now() / 1000)) + DEFAULT_DEADLINE_OFFSET;

  // Simular primeiro para obter estimates e aplicar slippage sobre valores reais
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

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  const logs = parseEventLogs({
    abi: NPM_ABI,
    eventName: "DecreaseLiquidity",
    logs: receipt.logs,
  });

  const event = logs[0];
  if (!event) throw new Error("DecreaseLiquidity event not found in receipt");

  return {
    amount0: event.args.amount0,
    amount1: event.args.amount1,
    txHash: hash,
    gasUsed: receipt.gasUsed,
  };
}
