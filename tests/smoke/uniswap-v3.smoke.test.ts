import { describe, it, expect } from "vitest";
import { createClients } from "../../src/utils/client.js";
import { ensureAllowance, getBalance } from "../../src/utils/erc20.js";
import { getTokenDecimals } from "../../src/utils/decimals.js";
import * as uniswapV3 from "../../src/protocols/uniswap-v3/index.js";
import { SMOKE_CHAINS, loadChainEnv } from "./_helpers.js";

for (const [_key, cfg] of Object.entries(SMOKE_CHAINS)) {
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
    const npm = cfg.protocols.uniswapV3Npm!;

    it(`full lifecycle: mint → decrease 50% → collect → burn`, async () => {
      const { publicClient, walletClient } = createClients({
        chainId: cfg.chainId,
        rpcUrl: env!.rpcUrl,
        privateKey: env!.pk,
      });

      // 1. Balance sanity
      const owner = walletClient!.account.address;
      const [wethDec, usdcDec] = await Promise.all([
        getTokenDecimals({ publicClient, token: weth }),
        getTokenDecimals({ publicClient, token: usdc }),
      ]);
      const [wethBal, usdcBal] = await Promise.all([
        getBalance({ publicClient, token: weth, owner }),
        getBalance({ publicClient, token: usdc, owner }),
      ]);
      const wethMin = 10n ** BigInt(wethDec - 3); // 0.001 WETH
      const usdcMin = 10n ** BigInt(usdcDec); // 1 USDC
      if (wethBal < wethMin || usdcBal < usdcMin) {
        console.warn(
          `Skipping ${cfg.name} — insufficient balance (weth=${wethBal}, usdc=${usdcBal})`,
        );
        return;
      }

      // 2. Approvals
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

      // 3. Mint — parâmetros exatos dependem da assinatura em src/protocols/uniswap-v3/mint.ts
      const mintResult = await uniswapV3.mint({
        publicClient,
        walletClient: walletClient!,
        token0: weth < usdc ? weth : usdc,
        token1: weth < usdc ? usdc : weth,
        fee: 500,
        tickLower: -60_000,
        tickUpper: 60_000,
        amount0Desired: weth < usdc ? wethMin : usdcMin,
        amount1Desired: weth < usdc ? usdcMin : wethMin,
        slippageBps: 500,
        deadlineSecs: 600,
      } as any);
      expect(mintResult.tokenId).toBeGreaterThan(0n);

      // 4. Decrease 50%
      const decResult = await uniswapV3.decrease({
        publicClient,
        walletClient: walletClient!,
        tokenId: mintResult.tokenId,
        liquidityBps: 5000,
        slippageBps: 500,
        deadlineSecs: 600,
      } as any);
      expect(decResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

      // 5. Collect
      const collectResult = await uniswapV3.collect({
        publicClient,
        walletClient: walletClient!,
        tokenId: mintResult.tokenId,
      } as any);
      expect(collectResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

      // 6. Decrease 100% + burn
      await uniswapV3.decrease({
        publicClient,
        walletClient: walletClient!,
        tokenId: mintResult.tokenId,
        liquidityBps: 10_000,
        slippageBps: 500,
        deadlineSecs: 600,
      } as any);
      await uniswapV3.collect({
        publicClient,
        walletClient: walletClient!,
        tokenId: mintResult.tokenId,
      } as any);
      const burnResult = await uniswapV3.burn({
        publicClient,
        walletClient: walletClient!,
        tokenId: mintResult.tokenId,
      } as any);
      expect(burnResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    }, 180_000);
  });
}
