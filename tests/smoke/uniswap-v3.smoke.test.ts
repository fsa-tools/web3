import { describe, it, expect } from "vitest";
import { createChainContext } from "../../src/context.js";
import { ensureAllowance, getBalance } from "../../src/utils/erc20.js";
import { getTokenDecimals } from "../../src/utils/decimals.js";
import {
  mintPosition,
  decreaseLiquidity,
  collectFees,
  burnPosition,
} from "../../src/protocols/uniswap-v3/index.js";
import { ADDRESSES } from "../../src/constants/addresses.js";
import { SMOKE_CHAINS, loadChainEnv } from "./_helpers.js";

const WETH_DEPOSIT_ABI = [
  {
    name: "deposit",
    type: "function",
    inputs: [],
    outputs: [],
    stateMutability: "payable",
  },
] as const;

for (const [_key, cfg] of Object.entries(SMOKE_CHAINS)) {
  const TICK_LOWER = -60_000;
  const TICK_UPPER = 60_000;
  const SLIPPAGE_BPS = 500;
  const DEADLINE_SECS = 600;
  const WETH_MIN_EXPONENT = 3;
  const TEST_TIMEOUT_MS = 180_000;

  const env = loadChainEnv(cfg);
  const chainAddrs = ADDRESSES[cfg.chainId];
  const canRun =
    env &&
    cfg.protocols.uniswapV3Npm &&
    cfg.faucetTokens.weth &&
    cfg.faucetTokens.usdc &&
    chainAddrs?.wethUsdcPool;

  describe.skipIf(!canRun)(`uniswap-v3 smoke lifecycle — ${cfg.name}`, () => {
    if (!canRun) return;
    const weth = cfg.faucetTokens.weth!;
    const usdc = cfg.faucetTokens.usdc!;

    it(
      `full lifecycle: mint → decrease 50% → collect → burn`,
      async () => {
        const ctx = createChainContext({
          chainId: cfg.chainId,
          rpcUrls: [env!.rpcUrl],
          privateKey: env!.pk,
          decimalsCache: new Map(),
        });
        const owner = ctx.walletClient!.account.address;
        const npm = cfg.protocols.uniswapV3Npm!;

        const [wethDec, usdcDec] = await Promise.all([
          getTokenDecimals(ctx, { token: weth }),
          getTokenDecimals(ctx, { token: usdc }),
        ]);
        const wethMin = 10n ** BigInt(wethDec - WETH_MIN_EXPONENT);
        const usdcMin = 10n ** BigInt(usdcDec);

        const wethBal = await getBalance({
          publicClient: ctx.publicClient,
          token: weth,
          owner,
        });
        if (wethBal < wethMin) {
          const wrapHash = await ctx.walletClient!.writeContract({
            address: weth,
            abi: WETH_DEPOSIT_ABI,
            functionName: "deposit",
            value: wethMin,
          });
          await ctx.publicClient.waitForTransactionReceipt({ hash: wrapHash });
        }

        const [wethBalFinal, usdcBal] = await Promise.all([
          getBalance({ publicClient: ctx.publicClient, token: weth, owner }),
          getBalance({ publicClient: ctx.publicClient, token: usdc, owner }),
        ]);
        if (wethBalFinal < wethMin || usdcBal < usdcMin) {
          console.warn(
            `Skipping ${cfg.name} — insufficient balance after wrap (weth=${wethBalFinal}, usdc=${usdcBal})`,
          );
          return;
        }

        await ensureAllowance({
          publicClient: ctx.publicClient,
          walletClient: ctx.walletClient!,
          token: weth,
          spender: npm,
          amount: wethMin,
        });
        await ensureAllowance({
          publicClient: ctx.publicClient,
          walletClient: ctx.walletClient!,
          token: usdc,
          spender: npm,
          amount: usdcMin,
        });

        const token0 = weth < usdc ? weth : usdc;
        const token1 = weth < usdc ? usdc : weth;
        const amount0Desired = weth < usdc ? wethMin : usdcMin;
        const amount1Desired = weth < usdc ? usdcMin : wethMin;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECS);

        const mintResult = await mintPosition(ctx, {
          token0,
          token1,
          fee: 500,
          tickLower: TICK_LOWER,
          tickUpper: TICK_UPPER,
          amount0Desired,
          amount1Desired,
          slippageBps: SLIPPAGE_BPS,
          deadline,
        });
        expect(mintResult.tokenId).toBeGreaterThan(0n);

        const halfLiquidity = mintResult.liquidity / 2n;
        const remainingLiquidity = mintResult.liquidity - halfLiquidity;

        const decResult = await decreaseLiquidity(ctx, {
          tokenId: mintResult.tokenId,
          liquidity: halfLiquidity,
          slippageBps: SLIPPAGE_BPS,
          deadline,
        });
        expect(decResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

        const collectResult1 = await collectFees(ctx, {
          tokenId: mintResult.tokenId,
          recipient: owner,
        });
        expect(collectResult1.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

        await decreaseLiquidity(ctx, {
          tokenId: mintResult.tokenId,
          liquidity: remainingLiquidity,
          slippageBps: SLIPPAGE_BPS,
          deadline,
        });

        const collectResult2 = await collectFees(ctx, {
          tokenId: mintResult.tokenId,
          recipient: owner,
        });
        expect(collectResult2.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

        const burnResult = await burnPosition(ctx, {
          tokenId: mintResult.tokenId,
        });
        expect(burnResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
