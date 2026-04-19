import { describe, it, expect } from "vitest";
import { createClients } from "../../src/utils/client.js";
import { ensureAllowance, getBalance } from "../../src/utils/erc20.js";
import { getTokenDecimals } from "../../src/utils/decimals.js";
import {
  mintPosition,
  decreaseLiquidity,
  collectFees,
  burnPosition,
} from "../../src/protocols/uniswap-v3/index.js";
import { SMOKE_CHAINS, loadChainEnv } from "./_helpers.js";

for (const [_key, cfg] of Object.entries(SMOKE_CHAINS)) {
  const TICK_LOWER = -60_000;
  const TICK_UPPER = 60_000;
  const SLIPPAGE_BPS = 500;
  const DEADLINE_SECS = 600;
  const WETH_MIN_EXPONENT = 3; // 0.001 WETH minimum
  const TEST_TIMEOUT_MS = 180_000;

  const env = loadChainEnv(cfg);
  const canRun =
    env &&
    cfg.protocols.uniswapV3Npm &&
    cfg.faucetTokens.weth &&
    cfg.faucetTokens.usdc;
  describe.skipIf(!canRun)(`uniswap-v3 smoke lifecycle — ${cfg.name}`, () => {
    if (!canRun) return;
    const weth = cfg.faucetTokens.weth!;
    const usdc = cfg.faucetTokens.usdc!;

    it(
      `full lifecycle: mint → decrease 50% → collect → burn`,
      async () => {
        const { publicClient, walletClient } = createClients({
          chainId: cfg.chainId,
          rpcUrl: env!.rpcUrl,
          privateKey: env!.pk,
        });
        const owner = walletClient!.account.address;
        const npm = cfg.protocols.uniswapV3Npm!;

        const [wethDec, usdcDec] = await Promise.all([
          getTokenDecimals({ publicClient, token: weth }),
          getTokenDecimals({ publicClient, token: usdc }),
        ]);
        const [wethBal, usdcBal] = await Promise.all([
          getBalance({ publicClient, token: weth, owner }),
          getBalance({ publicClient, token: usdc, owner }),
        ]);
        const wethMin = 10n ** BigInt(wethDec - WETH_MIN_EXPONENT);
        const usdcMin = 10n ** BigInt(usdcDec);
        if (wethBal < wethMin || usdcBal < usdcMin) {
          console.warn(
            `Skipping ${cfg.name} — insufficient balance (weth=${wethBal}, usdc=${usdcBal})`,
          );
          return;
        }

        await ensureAllowance({
          publicClient,
          walletClient: walletClient!,
          token: weth,
          spender: npm,
          amount: wethMin,
        });
        await ensureAllowance({
          publicClient,
          walletClient: walletClient!,
          token: usdc,
          spender: npm,
          amount: usdcMin,
        });

        const token0 = weth < usdc ? weth : usdc;
        const token1 = weth < usdc ? usdc : weth;
        const amount0Desired = weth < usdc ? wethMin : usdcMin;
        const amount1Desired = weth < usdc ? usdcMin : wethMin;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECS);

        const mintResult = await mintPosition({
          publicClient,
          walletClient: walletClient!,
          chainId: cfg.chainId,
          token0,
          token1,
          fee: SLIPPAGE_BPS,
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

        const decResult = await decreaseLiquidity({
          publicClient,
          walletClient: walletClient!,
          chainId: cfg.chainId,
          tokenId: mintResult.tokenId,
          liquidity: halfLiquidity,
          slippageBps: SLIPPAGE_BPS,
          deadline,
          recipient: owner,
        });
        expect(decResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

        const collectResult1 = await collectFees({
          publicClient,
          walletClient: walletClient!,
          chainId: cfg.chainId,
          tokenId: mintResult.tokenId,
          recipient: owner,
        });
        expect(collectResult1.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

        await decreaseLiquidity({
          publicClient,
          walletClient: walletClient!,
          chainId: cfg.chainId,
          tokenId: mintResult.tokenId,
          liquidity: remainingLiquidity,
          slippageBps: SLIPPAGE_BPS,
          deadline,
          recipient: owner,
        });
        const collectResult2 = await collectFees({
          publicClient,
          walletClient: walletClient!,
          chainId: cfg.chainId,
          tokenId: mintResult.tokenId,
          recipient: owner,
        });
        expect(collectResult2.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

        const burnResult = await burnPosition({
          publicClient,
          walletClient: walletClient!,
          chainId: cfg.chainId,
          tokenId: mintResult.tokenId,
        });
        expect(burnResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
      },
      TEST_TIMEOUT_MS,
    );
  });
}
