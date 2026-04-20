import { AERODROME_NPM_ABI } from "../../abis/aerodrome-npm.js";
import { applySlippage } from "../../math/slippage.js";
import { validateAddress } from "../../utils/address.js";
import { SlippageExceededError } from "../../errors.js";
import type { ChainContext } from "../../context.js";
import type { MintOperationParams, PositionResult } from "./types.js";

const DEFAULT_DEADLINE_SECONDS = 1200n;
const INCREASE_LIQUIDITY_TOPIC =
  "0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f";
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

  validateAddress(params.npmAddress);
  validateAddress(params.token0);
  validateAddress(params.token1);

  const { publicClient, walletClient } = ctx;
  const deadline =
    params.deadline ??
    BigInt(Math.floor(Date.now() / 1000)) + DEFAULT_DEADLINE_SECONDS;

  const amount0Min = applySlippage(params.amount0Desired, params.slippageBps);
  const amount1Min = applySlippage(params.amount1Desired, params.slippageBps);

  const txHash = await walletClient.writeContract({
    address: params.npmAddress,
    abi: AERODROME_NPM_ABI,
    functionName: "mint",
    args: [
      {
        token0: params.token0,
        token1: params.token1,
        tickSpacing: params.tickSpacing,
        tickLower: params.tickLower,
        tickUpper: params.tickUpper,
        amount0Desired: params.amount0Desired,
        amount1Desired: params.amount1Desired,
        amount0Min,
        amount1Min,
        recipient: walletClient.account.address,
        deadline,
        sqrtPriceX96: params.sqrtPriceX96,
      },
    ],
    ...(params.gasOptions ?? {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 2,
  });

  const eventLog = receipt.logs.find(
    (log) => log.topics[0] === INCREASE_LIQUIDITY_TOPIC,
  );

  let nftId = 0n;
  let amount0 = 0n;
  let amount1 = 0n;

  if (eventLog) {
    nftId = BigInt(eventLog.topics[1] ?? "0");
    const data = eventLog.data.slice(2);
    const WORD = 64;
    amount0 = BigInt("0x" + data.slice(WORD, WORD * 2));
    amount1 = BigInt("0x" + data.slice(WORD * 2, WORD * 3));
  }

  return { txHash, nftId, amount0, amount1, gasUsed: receipt.gasUsed };
}
