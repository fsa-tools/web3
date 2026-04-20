import { describe, it, expect } from "vitest";
import { ensureAllowance } from "../../src/utils/erc20.js";
import { getCurrentPrice } from "../../src/utils/pool.js";
import {
  mintPosition,
  decreaseLiquidity,
  collectFees,
  burnPosition,
} from "../../src/protocols/aerodrome/index.js";
import { AERODROME_NPM_ABI } from "../../src/abis/aerodrome-npm.js";
import { SMOKE_CHAINS, loadChainContext } from "./_helpers.js";

const cfg = SMOKE_CHAINS.baseSepolia;
const canRun = (() => {
  if (!cfg) return false;
  const ctx = loadChainContext(cfg);
  return (
    ctx &&
    ctx.addresses.aerodrome?.npm &&
    ctx.addresses.wethUsdcPool &&
    cfg.faucetTokens.weth &&
    cfg.faucetTokens.usdc
  );
})();

describe.skipIf(!canRun)("aerodrome smoke lifecycle — base-sepolia", () => {
  if (!canRun || !cfg) return;

  it("mint → decrease 50% → collect → burn", async () => {
    const ctx = loadChainContext(cfg)!;
    const weth = cfg.faucetTokens.weth!;
    const usdc = cfg.faucetTokens.usdc!;
    const npmAddress = ctx.addresses.aerodrome!.npm;
    const poolAddress = ctx.addresses.wethUsdcPool!;

    const { sqrtPriceX96 } = await getCurrentPrice(ctx, { poolAddress });

    const token0 = weth < usdc ? weth : usdc;
    const token1 = weth < usdc ? usdc : weth;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

    await ensureAllowance(ctx, {
      token: weth,
      spender: npmAddress,
      amount: 10n ** 15n,
    });
    await ensureAllowance(ctx, {
      token: usdc,
      spender: npmAddress,
      amount: 10n ** 6n,
    });

    const mint = await mintPosition(ctx, {
      npmAddress,
      poolAddress,
      token0,
      token1,
      tickSpacing: 200,
      tickLower: -60_000,
      tickUpper: 60_000,
      amount0Desired: weth < usdc ? 10n ** 15n : 10n ** 6n,
      amount1Desired: weth < usdc ? 10n ** 6n : 10n ** 15n,
      sqrtPriceX96,
      slippageBps: 500,
      deadline,
    });
    expect(mint.nftId).toBeGreaterThan(0n);

    const posData = await ctx.publicClient.readContract({
      address: npmAddress,
      abi: AERODROME_NPM_ABI,
      functionName: "positions",
      args: [mint.nftId],
    });
    const fullLiquidity = posData.liquidity;
    const halfLiquidity = fullLiquidity / 2n;
    const remainingLiquidity = fullLiquidity - halfLiquidity;

    const decrease1 = await decreaseLiquidity(ctx, {
      npmAddress,
      nftId: mint.nftId,
      liquidity: halfLiquidity,
      deadline,
    });
    expect(decrease1.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

    const collect1 = await collectFees(ctx, { npmAddress, nftId: mint.nftId });
    expect(collect1.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

    const decrease2 = await decreaseLiquidity(ctx, {
      npmAddress,
      nftId: mint.nftId,
      liquidity: remainingLiquidity,
      deadline,
    });
    expect(decrease2.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

    const collect2 = await collectFees(ctx, { npmAddress, nftId: mint.nftId });
    expect(collect2.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

    const burn = await burnPosition(ctx, { npmAddress, nftId: mint.nftId });
    expect(burn.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
  }, 180_000);
});
