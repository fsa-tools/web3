import { parseEventLogs } from "viem";
import { NPM_ABI } from "../../abis/npm.js";
import { validateAddress } from "../../utils/address.js";
import { ensureAllowance } from "../../utils/erc20.js";
import { sendTxRequest } from "../../tx/send.js";
import {
  ProtocolNotSupportedError,
  SlippageExceededError,
  ReceiptEventNotFoundError,
} from "../../errors.js";
import type { ChainContext } from "../../context.js";
import { planMint } from "./plan.js";
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
  const { walletClient } = ctx;
  validateAddress(params.token0);
  validateAddress(params.token1);

  await ensureAllowance(ctx, {
    token: params.token0,
    spender: npmAddress,
    amount: params.amount0Desired,
  });
  await ensureAllowance(ctx, {
    token: params.token1,
    spender: npmAddress,
    amount: params.amount1Desired,
  });

  const effectiveDeadline =
    params.deadline ??
    BigInt(Math.floor(Date.now() / 1000)) + DEFAULT_DEADLINE_OFFSET;

  const txs = planMint({
    ...params,
    npmAddress,
    recipient: walletClient.account.address,
    deadline: effectiveDeadline,
  });
  const mintTx = txs[txs.length - 1]!;

  const { txHash, receipt } = await sendTxRequest(
    ctx,
    mintTx,
    params.gasOptions,
  );

  const logs = parseEventLogs({
    abi: NPM_ABI,
    eventName: "IncreaseLiquidity",
    logs: receipt.logs,
  });
  const event = logs[0];
  if (!event) throw new ReceiptEventNotFoundError("IncreaseLiquidity", txHash);

  return {
    tokenId: event.args.tokenId,
    liquidity: event.args.liquidity,
    amount0: event.args.amount0,
    amount1: event.args.amount1,
    txHash,
    gasUsed: receipt.gasUsed,
  };
}
