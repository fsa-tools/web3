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

    it(`full lifecycle: mint → decrease 50% → collect → burn`, async () => {
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
      const wethMin = 10n ** BigInt(wethDec - 3);
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
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

      const mintResult = await mintPosition({
        publicClient,
        walletClient: walletClient!,
        chainId: cfg.chainId,
        token0,
        token1,
        fee: 500,
        tickLower: -60_000,
        tickUpper: 60_000,
        amount0Desired,
        amount1Desired,
        slippageBps: 500,
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
        slippageBps: 500,
        deadline,
        recipient: owner,
      });
      expect(decResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

      await collectFees({
        publicClient,
        walletClient: walletClient!,
        chainId: cfg.chainId,
        tokenId: mintResult.tokenId,
        recipient: owner,
      });

      await decreaseLiquidity({
        publicClient,
        walletClient: walletClient!,
        chainId: cfg.chainId,
        tokenId: mintResult.tokenId,
        liquidity: remainingLiquidity,
        slippageBps: 500,
        deadline,
        recipient: owner,
      });
      await collectFees({
        publicClient,
        walletClient: walletClient!,
        chainId: cfg.chainId,
        tokenId: mintResult.tokenId,
        recipient: owner,
      });
      const burnResult = await burnPosition({
        publicClient,
        walletClient: walletClient!,
        chainId: cfg.chainId,
        tokenId: mintResult.tokenId,
      });
      expect(burnResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    }, 180_000);
  });
}
