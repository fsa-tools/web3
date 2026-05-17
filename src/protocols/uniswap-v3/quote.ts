import type { Address } from "viem";
import { QUOTER_V2_ABI } from "../../abis/quoter.js";
import type { ChainContext } from "../../context.js";
import { ProtocolNotSupportedError } from "../../errors.js";
import { validateAddress } from "../../utils/address.js";
import type { QuoteOperationParams, QuoteResult } from "./types.js";

/** QuoterV2 não aplica price limit — quote sobre o swap completo. */
const NO_PRICE_LIMIT = 0n;

/**
 * Cotação real de um swap single-hop via Uniswap QuoterV2.
 *
 * Diferente de `spotAmountOut` (estimativa marginal, sem price impact),
 * o QuoterV2 simula o swap completo on-chain e retorna o `amountOut`
 * efetivo — já descontados a fee do pool e o price impact. É a base
 * correta para derivar `amountOutMinimum`.
 */
export async function quoteExactInputSingle(
  ctx: ChainContext,
  params: QuoteOperationParams,
): Promise<QuoteResult> {
  const quoter = ctx.addresses.uniswapV3?.quoter;
  if (!quoter) {
    throw new ProtocolNotSupportedError(
      ctx.publicClient.chain?.id ?? 0,
      "uniswapV3.quoter",
    );
  }

  const tokenIn: Address = validateAddress(params.tokenIn);
  const tokenOut: Address = validateAddress(params.tokenOut);

  const [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate] =
    await ctx.publicClient.readContract({
      address: quoter,
      abi: QUOTER_V2_ABI,
      functionName: "quoteExactInputSingle",
      args: [
        {
          tokenIn,
          tokenOut,
          amountIn: params.amountIn,
          fee: params.fee,
          sqrtPriceLimitX96: NO_PRICE_LIMIT,
        },
      ],
    });

  return { amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate };
}
