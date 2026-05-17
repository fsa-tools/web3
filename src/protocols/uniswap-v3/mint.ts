import { parseEventLogs } from "viem";
import { NPM_ABI } from "../../abis/npm.js";
import { applySlippage } from "../../math/slippage.js";
import { validateAddress } from "../../utils/address.js";
import { ensureAllowance } from "../../utils/erc20.js";
import {
  ProtocolNotSupportedError,
  SlippageExceededError,
  ReceiptEventNotFoundError,
} from "../../errors.js";
import type { ChainContext } from "../../context.js";
import type { MintOperationParams, PositionResult } from "./types.js";

const DEFAULT_DEADLINE_OFFSET = 1200n;
const MAX_SLIPPAGE_BPS = 5_000;

export async function mintPosition(
  ctx: ChainContext,
  params: MintOperationParams,
): Promise<PositionResult> {
  if (!ctx.walletClient) {
    throw new Error("mintPosition requires walletClient in ChainContext");
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
  const {
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

  validateAddress(token0);
  validateAddress(token1);

  await ensureAllowance(ctx, {
    token: token0,
    spender: npmAddress,
    amount: amount0Desired,
  });
  await ensureAllowance(ctx, {
    token: token1,
    spender: npmAddress,
    amount: amount1Desired,
  });

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

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 2,
  });

  const logs = parseEventLogs({
    abi: NPM_ABI,
    eventName: "IncreaseLiquidity",
    logs: receipt.logs,
  });

  const event = logs[0];
  if (!event) throw new ReceiptEventNotFoundError("IncreaseLiquidity", hash);

  return {
    tokenId: event.args.tokenId,
    liquidity: event.args.liquidity,
    amount0: event.args.amount0,
    amount1: event.args.amount1,
    txHash: hash,
    gasUsed: receipt.gasUsed,
  };
}
