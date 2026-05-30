import { AERODROME_SWAP_ROUTER_ABI } from "../../abis/aerodrome-swap-router.js";
import { applySlippage } from "../../math/slippage.js";
import { validateAddress } from "../../utils/address.js";
import { ensureAllowance, getBalance } from "../../utils/erc20.js";
import {
  ProtocolNotSupportedError,
  SlippageExceededError,
} from "../../errors.js";
import type { ChainContext } from "../../context.js";
import { quoteExactInputSingle } from "./quote.js";
import type { SwapOperationParams, SwapResult } from "./types.js";

const MAX_SLIPPAGE_BPS = 5_000;
const NO_PRICE_LIMIT = 0n;
const DEFAULT_DEADLINE_SECONDS = 1200n;

export async function swapExactInputSingle(
  ctx: ChainContext,
  params: SwapOperationParams,
): Promise<SwapResult> {
  if (!ctx.walletClient) {
    throw new Error(
      "swapExactInputSingle requires walletClient in ChainContext",
    );
  }
  if (params.slippageBps < 0 || params.slippageBps > MAX_SLIPPAGE_BPS) {
    throw new SlippageExceededError(params.slippageBps, MAX_SLIPPAGE_BPS);
  }

  const swapRouter = ctx.addresses.aerodrome?.swapRouter;
  if (!swapRouter) {
    throw new ProtocolNotSupportedError(
      ctx.publicClient.chain?.id ?? 0,
      "aerodrome",
    );
  }

  const { tokenIn, tokenOut, tickSpacing, amountIn, slippageBps, gasOptions } =
    params;
  validateAddress(tokenIn);
  validateAddress(tokenOut);

  const { publicClient, walletClient } = ctx;
  const owner = walletClient.account.address;

  await ensureAllowance(ctx, {
    token: tokenIn,
    spender: swapRouter,
    amount: amountIn,
  });

  const deadline =
    params.deadline ??
    BigInt(Math.floor(Date.now() / 1000)) + DEFAULT_DEADLINE_SECONDS;

  // amountOutMinimum sobre a cotação real do Quoter — já inclui fee do pool
  // e price impact. O haircut de slippage cobre só o drift bloco-a-bloco.
  const { amountOut: expectedOut } = await quoteExactInputSingle(ctx, {
    tokenIn,
    tokenOut,
    tickSpacing,
    amountIn,
  });
  const amountOutMinimum = applySlippage(expectedOut, slippageBps);

  const balanceBefore = await getBalance(ctx, { token: tokenOut, owner });

  const hash = await walletClient.writeContract({
    address: swapRouter,
    abi: AERODROME_SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn,
        tokenOut,
        tickSpacing,
        recipient: owner,
        deadline,
        amountIn,
        amountOutMinimum,
        sqrtPriceLimitX96: NO_PRICE_LIMIT,
      },
    ],
    ...(gasOptions ?? {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash,
    confirmations: 2,
  });

  const balanceAfter = await getBalance(ctx, { token: tokenOut, owner });

  return {
    amountOut: balanceAfter - balanceBefore,
    txHash: hash,
    gasUsed: receipt.gasUsed,
  };
}
