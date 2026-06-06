import { SWAP_ROUTER_ABI } from "../../abis/swap-router.js";
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

  const swapRouter = ctx.addresses.uniswapV3?.swapRouter;
  if (!swapRouter) {
    throw new ProtocolNotSupportedError(
      ctx.publicClient.chain?.id ?? 0,
      "uniswapV3",
    );
  }

  const {
    tokenIn,
    tokenOut,
    fee,
    amountIn,
    slippageBps,
    gasOptions,
    approvalMode,
  } = params;
  validateAddress(tokenIn);
  validateAddress(tokenOut);

  const { publicClient, walletClient } = ctx;
  const owner = walletClient.account.address;

  await ensureAllowance(ctx, {
    token: tokenIn,
    spender: swapRouter,
    amount: amountIn,
    approvalMode,
  });

  // amountOutMinimum sobre a cotação real do QuoterV2 — já inclui fee do pool
  // e price impact. O haircut de slippage cobre só o drift bloco-a-bloco.
  const { amountOut: expectedOut } = await quoteExactInputSingle(ctx, {
    tokenIn,
    tokenOut,
    fee,
    amountIn,
  });
  const amountOutMinimum = applySlippage(expectedOut, slippageBps);

  const balanceBefore = await getBalance(ctx, { token: tokenOut, owner });

  const hash = await walletClient.writeContract({
    address: swapRouter,
    abi: SWAP_ROUTER_ABI,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn,
        tokenOut,
        fee,
        recipient: owner,
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
