import { parseEventLogs } from "viem";
import { NPM_ABI } from "../../abis/npm.js";
import { ADDRESSES } from "../../constants/addresses.js";
import { applySlippage } from "../../math/slippage.js";
import { validateAddress } from "../../utils/address.js";
import type { MintParams, PositionResult } from "./types.js";

const DEFAULT_DEADLINE_OFFSET = 1200n;

export async function mintPosition(
  params: MintParams,
): Promise<PositionResult> {
  const {
    walletClient,
    publicClient,
    chainId,
    token0,
    token1,
    fee,
    tickLower,
    tickUpper,
    amount0Desired,
    amount1Desired,
    slippageBps,
    deadline,
    gasOptions,
  } = params;

  if (slippageBps < 0 || slippageBps > 10_000) {
    throw new Error(`slippageBps ${slippageBps} must be between 0 and 10000`);
  }

  const chainAddrs = ADDRESSES[chainId];
  if (!chainAddrs?.uniswapV3) {
    throw new Error(`chainId ${chainId} is not supported for Uniswap V3`);
  }

  validateAddress(token0);
  validateAddress(token1);

  const npmAddress = chainAddrs.uniswapV3.npm;
  const effectiveDeadline =
    deadline ?? BigInt(Math.floor(Date.now() / 1000)) + DEFAULT_DEADLINE_OFFSET;

  const amount0Min = applySlippage(amount0Desired, slippageBps);
  const amount1Min = applySlippage(amount1Desired, slippageBps);

  const hash = await walletClient.writeContract({
    address: npmAddress,
    abi: NPM_ABI,
    functionName: "mint",
    args: [
      {
        token0,
        token1,
        fee,
        tickLower,
        tickUpper,
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        recipient: walletClient.account.address,
        deadline: effectiveDeadline,
      },
    ],
    ...(gasOptions ?? {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  const logs = parseEventLogs({
    abi: NPM_ABI,
    eventName: "IncreaseLiquidity",
    logs: receipt.logs,
  });

  const event = logs[0];
  if (!event) throw new Error("IncreaseLiquidity event not found in receipt");

  return {
    tokenId: event.args.tokenId,
    liquidity: event.args.liquidity,
    amount0: event.args.amount0,
    amount1: event.args.amount1,
    txHash: hash,
    gasUsed: receipt.gasUsed,
  };
}
