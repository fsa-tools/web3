import { AERODROME_NPM_ABI } from "../../abis/aerodrome-npm.js";
import { applySlippage } from "../../math/slippage.js";
import { validateAddress } from "../../utils/address.js";
import type { AerodromeMintParams, PositionResult } from "./types.js";

const DEFAULT_DEADLINE_SECONDS = 1200n;
const INCREASE_LIQUIDITY_TOPIC =
  "0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f";

export async function mintPosition(
  params: AerodromeMintParams,
): Promise<PositionResult> {
  const {
    publicClient,
    walletClient,
    npmAddress,
    token0,
    token1,
    tickSpacing,
    tickLower,
    tickUpper,
    amount0Desired,
    amount1Desired,
    sqrtPriceX96,
    slippageBps,
    gasOptions,
  } = params;

  if (slippageBps < 0 || slippageBps > 5_000) {
    throw new Error("slippageBps exceeds maximum (5000 = 50%)");
  }

  validateAddress(npmAddress);
  validateAddress(token0);
  validateAddress(token1);

  const deadline =
    params.deadline ??
    BigInt(Math.floor(Date.now() / 1000)) + DEFAULT_DEADLINE_SECONDS;

  const amount0Min = applySlippage(amount0Desired, slippageBps);
  const amount1Min = applySlippage(amount1Desired, slippageBps);

  const txHash = await walletClient.writeContract({
    address: npmAddress,
    abi: AERODROME_NPM_ABI,
    functionName: "mint",
    args: [
      {
        token0,
        token1,
        tickSpacing,
        tickLower,
        tickUpper,
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        recipient: walletClient.account.address,
        deadline,
        sqrtPriceX96,
      },
    ],
    ...(gasOptions ?? {}),
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
