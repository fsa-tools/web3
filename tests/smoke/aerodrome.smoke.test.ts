import { describe, it, expect } from "vitest";
import { createClients } from "../../src/utils/client.js";
import { ensureAllowance } from "../../src/utils/erc20.js";
import {
  mintPosition,
  decreaseLiquidity,
  collectFees,
  burnPosition,
} from "../../src/protocols/aerodrome/index.js";
import { AERODROME_NPM_ABI } from "../../src/abis/aerodrome-npm.js";
import { POOL_SLOT0_ABI } from "../../src/abis/pool.js";
import { SMOKE_CHAINS, loadChainEnv } from "./_helpers.js";

const cfg = SMOKE_CHAINS.baseSepolia;
const env = cfg ? loadChainEnv(cfg) : null;
const canRun =
  cfg &&
  env &&
  cfg.protocols.aerodromeNpm &&
  cfg.protocols.aerodromeWethUsdcPool &&
  cfg.faucetTokens.weth &&
  cfg.faucetTokens.usdc;

describe.skipIf(!canRun)("aerodrome smoke lifecycle — base-sepolia", () => {
  if (!canRun) return;
  const weth = cfg.faucetTokens.weth!;
  const usdc = cfg.faucetTokens.usdc!;
  const npm = cfg.protocols.aerodromeNpm!;
  const poolAddress = cfg.protocols.aerodromeWethUsdcPool!;

  it("mint → decrease 50% → collect → burn", async () => {
    const { publicClient, walletClient } = createClients({
      chainId: cfg.chainId,
      rpcUrl: env!.rpcUrl,
      privateKey: env!.pk,
    });

    const slot0 = await publicClient.readContract({
      address: poolAddress,
      abi: POOL_SLOT0_ABI,
      functionName: "slot0",
    });
    const sqrtPriceX96 = slot0.sqrtPriceX96;

    const token0 = weth < usdc ? weth : usdc;
    const token1 = weth < usdc ? usdc : weth;
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

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

    const mint = await mintPosition({
      publicClient,
      walletClient: walletClient!,
      npmAddress: npm,
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

    const posData = await publicClient.readContract({
      address: npm,
      abi: AERODROME_NPM_ABI,
      functionName: "positions",
      args: [mint.nftId],
    });
    const fullLiquidity = posData.liquidity;
    const halfLiquidity = fullLiquidity / 2n;
    const remainingLiquidity = fullLiquidity - halfLiquidity;

    const decrease1 = await decreaseLiquidity({
      publicClient,
      walletClient: walletClient!,
      npmAddress: npm,
      nftId: mint.nftId,
      liquidity: halfLiquidity,
      deadline,
    });
    expect(decrease1.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

    const collect1 = await collectFees({
      publicClient,
      walletClient: walletClient!,
      npmAddress: npm,
      nftId: mint.nftId,
    });
    expect(collect1.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

    const decrease2 = await decreaseLiquidity({
      publicClient,
      walletClient: walletClient!,
      npmAddress: npm,
      nftId: mint.nftId,
      liquidity: remainingLiquidity,
      deadline,
    });
    expect(decrease2.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

    const collect2 = await collectFees({
      publicClient,
      walletClient: walletClient!,
      npmAddress: npm,
      nftId: mint.nftId,
    });
    expect(collect2.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

    const burn = await burnPosition({
      publicClient,
      walletClient: walletClient!,
      npmAddress: npm,
      nftId: mint.nftId,
    });
    expect(burn.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
  }, 180_000);
});
