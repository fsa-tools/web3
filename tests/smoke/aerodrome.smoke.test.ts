import { describe, it, expect } from "vitest";
import { createClients } from "../../src/utils/client.js";
import { ensureAllowance } from "../../src/utils/erc20.js";
import * as aerodrome from "../../src/protocols/aerodrome/index.js";
import { SMOKE_CHAINS, loadChainEnv } from "./_helpers.js";

const cfg = SMOKE_CHAINS.baseSepolia;
const env = cfg ? loadChainEnv(cfg) : null;
const canRun =
  cfg &&
  env &&
  cfg.protocols.aerodromeNpm &&
  cfg.faucetTokens.weth &&
  cfg.faucetTokens.usdc;

describe.skipIf(!canRun)("aerodrome smoke lifecycle — base-sepolia", () => {
  if (!canRun) return;
  const weth = cfg.faucetTokens.weth!;
  const usdc = cfg.faucetTokens.usdc!;
  const npm = cfg.protocols.aerodromeNpm!;

  it("mint → decrease 50% → collect → burn", async () => {
    const { publicClient, walletClient } = createClients({
      chainId: cfg.chainId,
      rpcUrl: env!.rpcUrl,
      privateKey: env!.pk,
    });
    // Params reais idênticos em estrutura à Task 16; `as any` até sabermos a assinatura exata.
    await ensureAllowance({
      publicClient,
      walletClient: walletClient!,
      token: weth,
      spender: npm,
      amount: 10n ** 15n,
    });
    await ensureAllowance({
      publicClient,
      walletClient: walletClient!,
      token: usdc,
      spender: npm,
      amount: 10n ** 6n,
    });

    const mint = await aerodrome.mint({
      publicClient,
      walletClient: walletClient!,
      token0: weth < usdc ? weth : usdc,
      token1: weth < usdc ? usdc : weth,
      tickSpacing: 200,
      tickLower: -60_000,
      tickUpper: 60_000,
      amount0Desired: weth < usdc ? 10n ** 15n : 10n ** 6n,
      amount1Desired: weth < usdc ? 10n ** 6n : 10n ** 15n,
      slippageBps: 500,
      deadlineSecs: 600,
    } as any);
    expect(mint.tokenId).toBeGreaterThan(0n);

    await aerodrome.decrease({
      publicClient,
      walletClient: walletClient!,
      tokenId: mint.tokenId,
      liquidityBps: 5000,
      slippageBps: 500,
      deadlineSecs: 600,
    } as any);
    await aerodrome.collect({
      publicClient,
      walletClient: walletClient!,
      tokenId: mint.tokenId,
    } as any);
    await aerodrome.decrease({
      publicClient,
      walletClient: walletClient!,
      tokenId: mint.tokenId,
      liquidityBps: 10_000,
      slippageBps: 500,
      deadlineSecs: 600,
    } as any);
    await aerodrome.collect({
      publicClient,
      walletClient: walletClient!,
      tokenId: mint.tokenId,
    } as any);
    const burn = await aerodrome.burn({
      publicClient,
      walletClient: walletClient!,
      tokenId: mint.tokenId,
    } as any);
    expect(burn.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
  }, 180_000);
});
