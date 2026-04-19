# v1.8 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete tasks T4, T5, T2, T1, T7, T6 from the v1.8 roadmap — removing type hacks, enabling real smoke tests, rewriting tick math in bigint, adding security hardening, and wiring CI publish.

**Architecture:** Serial execution T4→T5→T2→T1→T7→T6. T4/T5/T2 are coupled (smoke files). T1/T7/T6 are independent after T2. T4 for aerodrome is split: uniswap-v3 smoke first (no T5 dep), then aerodrome smoke + T5 helpers together.

**Tech Stack:** TypeScript, viem, vitest, GitLab CI, cast (foundry) for on-chain queries.

---

## File Map

| File | Tasks |
|------|-------|
| `tests/smoke/uniswap-v3.smoke.test.ts` | T4, T2 |
| `tests/smoke/aerodrome.smoke.test.ts` | T4, T2 |
| `tests/smoke/_helpers.ts` | T5 |
| `src/constants/addresses.ts` | T5 |
| `src/math/ticks.ts` | T1 |
| `tests/unit/math/ticks.test.ts` | T1 |
| `src/utils/retry.ts` (create) | T7 |
| `tests/unit/utils/retry.test.ts` (create) | T7 |
| `src/protocols/uniswap-v3/mint.ts` | T7 |
| `src/protocols/uniswap-v3/decrease.ts` | T7 |
| `src/protocols/aerodrome/mint.ts` | T7 |
| `.gitlab-ci.yml` (no changes — infra only) | T6 |

---

## Task 1: T4 — Fix uniswap-v3 smoke test

**Files:**
- Modify: `tests/smoke/uniswap-v3.smoke.test.ts`

**Context:** The smoke test calls `uniswapV3.mint()` but the module exports `mintPosition`. Same mismatch for decrease/collect/burn. Parameters also differ: the test passes `deadlineSecs`, `liquidityBps`, and omits `chainId`/`recipient` — all hidden by `as any`. Fix: use correct exports and param shapes. `mintResult.liquidity` (from `PositionResult`) gives us the exact liquidity to pass to decrease.

- [ ] **Step 1: Write the corrected file**

Replace `tests/smoke/uniswap-v3.smoke.test.ts` with:

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add tests/smoke/uniswap-v3.smoke.test.ts
git commit -m "test(smoke): T4 — remove as any from uniswap-v3 smoke, use correct function names and param shapes"
```

---

## Task 2: T5 — Make `wethUsdcPool` optional + add aerodrome pool field

**Files:**
- Modify: `src/constants/addresses.ts`
- Modify: `tests/smoke/_helpers.ts`

**Context:** `wethUsdcPool` in Sepolia and Amoy points to WETH itself (invalid placeholder). Making it optional allows us to omit it for chains without a real pool. Also add `aerodromeWethUsdcPool` to `SmokeChainConfig.protocols` so the aerodrome smoke can reference the pool for `poolAddress` and `slot0` reads.

- [ ] **Step 1: Update `ChainAddresses` type and fix placeholder entries**

In `src/constants/addresses.ts`, change `wethUsdcPool: Address` to `wethUsdcPool?: Address` and remove the placeholder values for Sepolia (11155111) and Amoy (80002). The real Sepolia address will be resolved in Task 4.

```typescript
import type { Address } from "viem";

export type ProtocolAddresses = {
  npm: Address;
  factory?: Address;
};

export type AaveAddresses = {
  pool: Address;
};

export type ChainAddresses = {
  weth: Address;
  wethUsdcPool?: Address;  // optional — not all testnets have a live pool
  uniswapV3?: ProtocolAddresses;
  aerodrome?: ProtocolAddresses;
  aave?: AaveAddresses;
};

export const ADDRESSES: Record<number, ChainAddresses> = {
  8453: {
    weth: "0x4200000000000000000000000000000000000006",
    wethUsdcPool: "0xd0b53D9277642d899DF5C87A3966A349A798F224",
    aerodrome: {
      npm: "0x827922686190790b37229fd06084350E74485b72",
    },
    uniswapV3: {
      npm: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
      factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    },
  },
  1: {
    weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    wethUsdcPool: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
    uniswapV3: {
      npm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    },
    aave: {
      pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
    },
  },
  10: {
    weth: "0x4200000000000000000000000000000000000006",
    wethUsdcPool: "0x85149247691df622eaF1a8Bd0CaFd40BC45154a9",
    uniswapV3: {
      npm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    },
    aave: {
      pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    },
  },
  42161: {
    weth: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    wethUsdcPool: "0xC6962004f452bE9203591991D15f6b388e09E8D0",
    uniswapV3: {
      npm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    },
    aave: {
      pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    },
  },
  137: {
    weth: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    wethUsdcPool: "0xB6e57ed85c4c9dbfEF2a68711e9d6f36c56e0FcB",
    uniswapV3: {
      npm: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
      factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    },
    aave: {
      pool: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
    },
  },
  11155111: {
    weth: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    // wethUsdcPool resolved in Task 4 — placeholder removed
    uniswapV3: {
      npm: "0x1238536071E1c677A632429e3655c799b22cDA52",
      factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
    },
    aave: {
      pool: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951",
    },
  },
  80002: {
    weth: "0x52eF3d68BaB452a294342DC3e5f464d7f610f72E",
    // wethUsdcPool omitted — Uniswap V3 Factory on Amoy has no WETH/USDC pool
    uniswapV3: {
      npm: "0x1238536071E1c677A632429e3655c799b22cDA52",
      factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
    },
    aave: {
      pool: "0x1758d4e6f68166C4B2d9d0F049F33dEB399Daa1F",
    },
  },
  84532: {
    weth: "0x4200000000000000000000000000000000000006",
    // wethUsdcPool for Base Sepolia resolved in Task 4 (if Aerodrome deployed)
  },
};
```

- [ ] **Step 2: Add `aerodromeWethUsdcPool` field to `SmokeChainConfig` in `_helpers.ts`**

```typescript
import type { Hex } from "viem";

export type SmokeChainConfig = {
  chainId: number;
  name: string;
  rpcEnvVar: string;
  pkEnvVar: string;
  faucetTokens: {
    weth?: `0x${string}`;
    usdc?: `0x${string}`;
  };
  aaveReserves?: {
    weth?: `0x${string}`;
    usdc?: `0x${string}`;
  };
  protocols: {
    uniswapV3Npm?: `0x${string}`;
    uniswapV3Factory?: `0x${string}`;
    aavePool?: `0x${string}`;
    aerodromeNpm?: `0x${string}`;
    aerodromeWethUsdcPool?: `0x${string}`;  // pool address for smoke slot0 reads
  };
};

export const SMOKE_CHAINS: Record<string, SmokeChainConfig> = {
  sepolia: {
    chainId: 11155111,
    name: "sepolia",
    rpcEnvVar: "SEPOLIA_RPC",
    pkEnvVar: "SMOKE_PK_SEPOLIA",
    faucetTokens: {
      weth: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
      usdc: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
    },
    aaveReserves: {
      usdc: "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8",
    },
    protocols: {
      uniswapV3Npm: "0x1238536071E1c677A632429e3655c799b22cDA52",
      uniswapV3Factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
      aavePool: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951",
    },
  },
  polygonAmoy: {
    chainId: 80002,
    name: "polygon-amoy",
    rpcEnvVar: "POLYGON_AMOY_RPC",
    pkEnvVar: "SMOKE_PK_POLYGON",
    faucetTokens: {
      weth: "0x52eF3d68BaB452a294342DC3e5f464d7f610f72E",
      usdc: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
    },
    protocols: {
      uniswapV3Npm: "0x1238536071E1c677A632429e3655c799b22cDA52",
      aavePool: "0x1758d4e6f68166C4B2d9d0F049F33dEB399Daa1F",
    },
  },
  // Aerodrome não tem deployment em Sepolia/Amoy — smoke requer Base Sepolia
  // baseSepolia added in Task 4 after verifying Aerodrome deployment
};

export function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env: ${key}`);
  return v;
}

export function loadChainEnv(
  cfg: SmokeChainConfig,
): { rpcUrl: string; pk: Hex } | null {
  const rpcUrl = process.env[cfg.rpcEnvVar];
  const pk = process.env[cfg.pkEnvVar];
  if (!rpcUrl || !pk) return null;
  return { rpcUrl, pk: pk as Hex };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add src/constants/addresses.ts tests/smoke/_helpers.ts
git commit -m "feat(addresses): T5 — make wethUsdcPool optional, remove testnet placeholders, add aerodromeWethUsdcPool field"
```

---

## Task 3: T4+T5 — Fix aerodrome smoke test types

**Files:**
- Modify: `tests/smoke/aerodrome.smoke.test.ts`

**Context:** `aerodrome.smoke.test.ts` uses `aerodrome.mint/decrease/collect/burn` which don't exist (the module exports `mintPosition`, `decreaseLiquidity`, `collectFees`, `burnPosition`). Additionally, `AerodromeMintParams` requires `npmAddress`, `poolAddress`, and `sqrtPriceX96` (read from pool's `slot0`). `AerodromeDecreaseParams` uses `nftId` (not `tokenId`) and requires actual `liquidity` bigint (not a percentage). The mint result uses `nftId` (not `tokenId`). All of this was hidden by `as any`.

After this task, the test will typecheck correctly. It will still skip at runtime until Task 4 adds the `baseSepolia` entry to SMOKE_CHAINS.

- [ ] **Step 1: Write the corrected file**

Replace `tests/smoke/aerodrome.smoke.test.ts` with:

```typescript
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

    // Read actual liquidity from contract to compute 50%/100% splits
    const posData = await publicClient.readContract({
      address: npm,
      abi: AERODROME_NPM_ABI,
      functionName: "positions",
      args: [mint.nftId],
    });
    const fullLiquidity = posData.liquidity;
    const halfLiquidity = fullLiquidity / 2n;
    const remainingLiquidity = fullLiquidity - halfLiquidity;

    await decreaseLiquidity({
      publicClient,
      walletClient: walletClient!,
      npmAddress: npm,
      nftId: mint.nftId,
      liquidity: halfLiquidity,
      deadline,
    });
    await collectFees({
      publicClient,
      walletClient: walletClient!,
      npmAddress: npm,
      nftId: mint.nftId,
    });
    await decreaseLiquidity({
      publicClient,
      walletClient: walletClient!,
      npmAddress: npm,
      nftId: mint.nftId,
      liquidity: remainingLiquidity,
      deadline,
    });
    await collectFees({
      publicClient,
      walletClient: walletClient!,
      npmAddress: npm,
      nftId: mint.nftId,
    });
    const burn = await burnPosition({
      publicClient,
      walletClient: walletClient!,
      npmAddress: npm,
      nftId: mint.nftId,
    });
    expect(burn.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
  }, 180_000);
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add tests/smoke/aerodrome.smoke.test.ts
git commit -m "test(smoke): T4 — remove as any from aerodrome smoke, use correct function names and typed params"
```

---

## Task 4: T5 — Resolve real pool addresses

**Files:**
- Modify: `src/constants/addresses.ts`
- Modify: `tests/smoke/_helpers.ts`

**Context:** The Sepolia wethUsdcPool placeholder was removed in Task 2. Now we need the real address via the Uniswap V3 Factory's `getPool()`. For Amoy, factory call confirms no WETH/USDC pool exists (already omitted). For Base Sepolia (84532), check if Aerodrome is deployed.

- [ ] **Step 1: Query Sepolia Uniswap V3 factory for WETH/USDC pool**

Run each command until you get a non-zero address. Stop at the first hit.

```bash
# Fee tier 500 (most common for stablecoins)
cast call 0x0227628f3F023bb0B980b67D528571c95c6DaC1c \
  "getPool(address,address,uint24)(address)" \
  0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9 \
  0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8 \
  500 \
  --rpc-url $SEPOLIA_RPC

# Fee tier 3000
cast call 0x0227628f3F023bb0B980b67D528571c95c6DaC1c \
  "getPool(address,address,uint24)(address)" \
  0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9 \
  0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8 \
  3000 \
  --rpc-url $SEPOLIA_RPC

# Fee tier 10000
cast call 0x0227628f3F023bb0B980b67D528571c95c6DaC1c \
  "getPool(address,address,uint24)(address)" \
  0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9 \
  0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8 \
  10000 \
  --rpc-url $SEPOLIA_RPC
```

Expected: one of the calls returns a non-zero address like `0xXXXX...`. If ALL return `0x0000000000000000000000000000000000000000`, `wethUsdcPool` stays omitted for Sepolia (smoke will skip by gate, document in ROADMAP).

- [ ] **Step 2: Query Amoy Uniswap V3 factory (verification only)**

```bash
cast call 0x1F98431c8aD98523631AE4a59f267346ea31F984 \
  "getPool(address,address,uint24)(address)" \
  0x52eF3d68BaB452a294342DC3e5f464d7f610f72E \
  0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582 \
  500 \
  --rpc-url $POLYGON_AMOY_RPC
```

Expected: zero address (confirms placeholder removal was correct).

- [ ] **Step 3: Check Aerodrome NonfungiblePositionManager on Base Sepolia**

Aerodrome Finance does not have an official Base Sepolia deployment as of 2026. Verify:

```bash
# Check if the Base mainnet NPM address has code on Base Sepolia (it won't)
cast code 0x827922686190790b37229fd06084350E74485b72 \
  --rpc-url $BASE_SEPOLIA_RPC
```

Expected: `0x` (no code). If unexpectedly non-empty, use that address for `aerodromeNpm`.

- [ ] **Step 4a: If Sepolia pool found — update `src/constants/addresses.ts`**

In the Sepolia entry (chainId 11155111), add the discovered pool:

```typescript
  11155111: {
    weth: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
    wethUsdcPool: "<DISCOVERED_ADDRESS>",  // replace with actual result from Step 1
    uniswapV3: {
      npm: "0x1238536071E1c677A632429e3655c799b22cDA52",
      factory: "0x0227628f3F023bb0B980b67D528571c95c6DaC1c",
    },
    aave: {
      pool: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951",
    },
  },
```

- [ ] **Step 4b: If Aerodrome found on Base Sepolia — add to SMOKE_CHAINS and ADDRESSES**

Add to `tests/smoke/_helpers.ts` SMOKE_CHAINS:

```typescript
  baseSepolia: {
    chainId: 84532,
    name: "base-sepolia",
    rpcEnvVar: "BASE_SEPOLIA_RPC",
    pkEnvVar: "SMOKE_PK_BASE_SEPOLIA",
    faucetTokens: {
      weth: "0x4200000000000000000000000000000000000006",
      usdc: "<BASE_SEPOLIA_USDC_ADDRESS>",
    },
    protocols: {
      aerodromeNpm: "<AERODROME_NPM_ADDRESS>",
      aerodromeWethUsdcPool: "<AERODROME_WETH_USDC_POOL_ADDRESS>",
    },
  },
```

Add to `src/constants/addresses.ts` for chainId 84532:

```typescript
  84532: {
    weth: "0x4200000000000000000000000000000000000006",
    wethUsdcPool: "<AERODROME_WETH_USDC_POOL_ADDRESS>",
    aerodrome: {
      npm: "<AERODROME_NPM_ADDRESS>",
    },
  },
```

- [ ] **Step 4c: If Aerodrome NOT found on Base Sepolia — document in ROADMAP**

Open `docs/roadmap.md` (or equivalent roadmap file) and add under v1.8 task T2/Aerodrome:

```
Aerodrome NonfungiblePositionManager não está deployado em Base Sepolia (verificado 2026-04-19).
Smoke de Aerodrome skipa por design. Para habilitar: aguardar deploy oficial ou usar Base mainnet fork.
```

Leave `baseSepolia` out of `SMOKE_CHAINS` (aerodrome smoke skips by canRun gate).

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/constants/addresses.ts tests/smoke/_helpers.ts
# If ROADMAP updated:
# git add docs/roadmap.md
git commit -m "feat(addresses): T5 — resolve Sepolia wethUsdcPool, add baseSepolia config"
```

---

## Task 5: T2 — Enable real Uniswap V3 smoke + document Aerodrome status

**Files:**
- Modify: `tests/smoke/uniswap-v3.smoke.test.ts`

**Context:** The spec requires a `wethUsdcPool` gate — smoke should only run when a real pool address exists for the chain. Also, the wallet may have ETH but not WETH (Sepolia faucets give ETH). Add a wrap step: if WETH balance is insufficient, wrap enough ETH → WETH via WETH's `deposit()`.

- [ ] **Step 1: Add wethUsdcPool gate and WETH wrap step**

Update the `canRun` check and add a wrap-if-needed step inside the test. Replace the `canRun` assignment and the balance-check block in `tests/smoke/uniswap-v3.smoke.test.ts`:

```typescript
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
      const wethMin = 10n ** BigInt(wethDec - 3);
      const usdcMin = 10n ** BigInt(usdcDec);

      // Wrap ETH → WETH if insufficient WETH balance
      const wethBal = await getBalance({ publicClient, token: weth, owner });
      if (wethBal < wethMin) {
        const wrapHash = await walletClient!.writeContract({
          address: weth,
          abi: WETH_DEPOSIT_ABI,
          functionName: "deposit",
          value: wethMin,
        });
        await publicClient.waitForTransactionReceipt({ hash: wrapHash });
      }

      const [wethBalFinal, usdcBal] = await Promise.all([
        getBalance({ publicClient, token: weth, owner }),
        getBalance({ publicClient, token: usdc, owner }),
      ]);
      if (wethBalFinal < wethMin || usdcBal < usdcMin) {
        console.warn(
          `Skipping ${cfg.name} — insufficient balance after wrap (weth=${wethBalFinal}, usdc=${usdcBal})`,
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
```

- [ ] **Step 2: Add USDC faucet note**

Before running smoke, ensure the smoke wallet has USDC on Sepolia. Get from:
- https://faucet.circle.com/ (Circle USDC faucet — requires connecting wallet)
- Or Alchemy Sepolia faucet (gives test USDC)

This is a one-time manual step before running smoke.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 4: Run unit tests (should all pass, smoke skips without env)**

```bash
pnpm test
```

Expected: all unit tests pass. Smoke tests skip (no env vars in local run).

- [ ] **Step 5: Commit**

```bash
git add tests/smoke/uniswap-v3.smoke.test.ts
git commit -m "test(smoke): T2 — add wethUsdcPool gate, WETH wrap-if-needed, import ADDRESSES for gate check"
```

---

## Task 6: T1 — Canonical tick math in bigint

**Files:**
- Modify: `tests/unit/math/ticks.test.ts`
- Modify: `src/math/ticks.ts`

**Context:** `getSqrtRatioAtTick` uses float (`Math.sqrt(1.0001^tick) * 2^96`) which diverges at extreme ticks. The canonical implementation (from Uniswap v3-core `TickMath.sol`) uses bitwise fixed-point arithmetic in Q128.128, producing exact values. The existing tests have wrong expected values for MIN/MAX tick — they match the float output, not the Solidity reference.

Canonical values:
- `tick = 0` → `79228162514264337593543950336n` (unchanged, Q96 of 1.0)
- `tick = MIN_TICK` → `4295128739n`
- `tick = MAX_TICK` → `1461446703485210103287273052203988822378723970342n`

- [ ] **Step 1: Update test file with canonical expected values**

In `tests/unit/math/ticks.test.ts`, update the three failing expectations:

```typescript
    it("getSqrtRatioAtTick at MIN_TICK is smallest valid value", () => {
      expect(getSqrtRatioAtTick(MIN_TICK)).toBe(4295128739n);
    });

    it("getSqrtRatioAtTick at MAX_TICK is largest valid value", () => {
      expect(getSqrtRatioAtTick(MAX_TICK)).toBe(
        1461446703485210103287273052203988822378723970342n,
      );
    });
```

Also add `MIN_SQRT_RATIO` and `MAX_SQRT_RATIO` import checks:

```typescript
import {
  getSqrtRatioAtTick,
  roundToTickSpacing,
  ceilToTickSpacing,
  priceToTick,
  tickToPrice,
  feeToTickSpacing,
  percentToTickOffset,
  inversePriceToTick,
  formatSqrtPrice,
  MIN_TICK,
  MAX_TICK,
  MIN_SQRT_RATIO,
  MAX_SQRT_RATIO,
} from "../../../src/math/ticks.js";

// Add inside the getSqrtRatioAtTick describe block:
    it("MIN_SQRT_RATIO constant matches tick result", () => {
      expect(getSqrtRatioAtTick(MIN_TICK)).toBe(MIN_SQRT_RATIO);
    });

    it("MAX_SQRT_RATIO constant matches tick result", () => {
      expect(getSqrtRatioAtTick(MAX_TICK)).toBe(MAX_SQRT_RATIO);
    });
```

- [ ] **Step 2: Run tests — confirm MIN_TICK and MAX_TICK cases fail**

```bash
pnpm test tests/unit/math/ticks.test.ts
```

Expected: `getSqrtRatioAtTick at MIN_TICK` and `getSqrtRatioAtTick at MAX_TICK` FAIL (float vs canonical mismatch). The `tick = 0` test should still PASS.

- [ ] **Step 3: Rewrite `getSqrtRatioAtTick` in bigint**

In `src/math/ticks.ts`, replace the `Q96_NUM` constant and `getSqrtRatioAtTick` function, and add the two canonical constants:

```typescript
export const MIN_SQRT_RATIO = 4295128739n;
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n;

export function getSqrtRatioAtTick(tick: number): bigint {
  if (tick < MIN_TICK || tick > MAX_TICK) {
    throw new Error(`tick ${tick} out of range [${MIN_TICK}, ${MAX_TICK}]`);
  }
  const absTick = BigInt(tick < 0 ? -tick : tick);

  // Port of Uniswap v3-core TickMath.getSqrtRatioAtTick (Solidity → bigint)
  // Works in Q128.128 fixed-point, then converts to Q64.96
  let ratio =
    (absTick & 0x1n) !== 0n
      ? 0xfffcb933bd6fad37aa2d162d1a594001n
      : 0x100000000000000000000000000000000n;

  if ((absTick & 0x2n) !== 0n) ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
  if ((absTick & 0x4n) !== 0n) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
  if ((absTick & 0x8n) !== 0n) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
  if ((absTick & 0x10n) !== 0n) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
  if ((absTick & 0x20n) !== 0n) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
  if ((absTick & 0x40n) !== 0n) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
  if ((absTick & 0x80n) !== 0n) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
  if ((absTick & 0x100n) !== 0n) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
  if ((absTick & 0x200n) !== 0n) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
  if ((absTick & 0x400n) !== 0n) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
  if ((absTick & 0x800n) !== 0n) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
  if ((absTick & 0x1000n) !== 0n) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
  if ((absTick & 0x2000n) !== 0n) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
  if ((absTick & 0x4000n) !== 0n) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
  if ((absTick & 0x8000n) !== 0n) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
  if ((absTick & 0x10000n) !== 0n) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
  if ((absTick & 0x20000n) !== 0n) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
  if ((absTick & 0x40000n) !== 0n) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
  if ((absTick & 0x80000n) !== 0n) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;

  // For positive ticks, invert (uint256 max / ratio)
  if (tick > 0) {
    ratio = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffn / ratio;
  }

  // Q128.128 → Q64.96: shift right 32 bits, round up if any remainder
  return (ratio >> 32n) + ((ratio & 0xffffffffn) > 0n ? 1n : 0n);
}
```

Remove the old `const Q96_NUM = Number(2n ** 96n)` line (it's no longer used after this change).

- [ ] **Step 4: Run tests — all should pass**

```bash
pnpm test tests/unit/math/ticks.test.ts
```

Expected: all tests PASS, including MIN_TICK and MAX_TICK cases.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 6: Export new constants from index**

Check `src/math/index.ts` — if it re-exports from ticks, add `MIN_SQRT_RATIO` and `MAX_SQRT_RATIO` to the export list.

```bash
grep -n "ticks" /Users/fabiosiqueira/dev/projetos/trading/libs/fsa-web3/src/math/index.ts
```

If the file has a wildcard export (`export * from "./ticks.js"`), no change needed. If it has named exports, add:

```typescript
export { MIN_SQRT_RATIO, MAX_SQRT_RATIO } from "./ticks.js";
```

- [ ] **Step 7: Commit**

```bash
git add src/math/ticks.ts tests/unit/math/ticks.test.ts src/math/index.ts
git commit -m "feat(math): T1 — rewrite getSqrtRatioAtTick in bigint (port of TickMath.sol), add MIN/MAX_SQRT_RATIO constants"
```

---

## Task 7: T7 — `withRetry` with exponential backoff

**Files:**
- Create: `src/utils/retry.ts`
- Create: `tests/unit/utils/retry.test.ts`
- Modify: `src/protocols/uniswap-v3/decrease.ts`

**Context:** RPC calls that fail with timeout/5xx currently bubble up immediately. `withRetry` wraps any `() => Promise<T>` with exponential backoff (base 1s, max 30s, 3 attempts, jitter to avoid thundering herd). Apply to `publicClient.simulateContract` in uniswap-v3 decrease — the only protocol function with a critical read that precedes a write.

- [ ] **Step 1: Write failing test**

Create `tests/unit/utils/retry.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { withRetry } from "../../../src/utils/retry.js";

describe("withRetry", () => {
  it("returns result immediately on success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and succeeds on second attempt", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValue("ok");
    const result = await withRetry(fn, { base: 1, max: 10, attempts: 3 });
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws after all attempts exhausted", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("rpc down"));
    await expect(
      withRetry(fn, { base: 1, max: 10, attempts: 3 }),
    ).rejects.toThrow("rpc down");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("uses custom attempts count", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(
      withRetry(fn, { base: 1, max: 10, attempts: 2 }),
    ).rejects.toThrow("fail");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("returns typed result preserving generic T", async () => {
    const fn = vi.fn().mockResolvedValue(42n);
    const result = await withRetry(fn);
    expect(result).toBe(42n);
  });
});
```

- [ ] **Step 2: Run test to confirm failure**

```bash
pnpm test tests/unit/utils/retry.test.ts
```

Expected: FAIL — `Cannot find module '../../../src/utils/retry.js'`.

- [ ] **Step 3: Implement `withRetry`**

Create `src/utils/retry.ts`:

```typescript
const DEFAULT_BASE_MS = 1_000;
const DEFAULT_MAX_MS = 30_000;
const DEFAULT_ATTEMPTS = 3;

export type RetryOptions = {
  base?: number;
  max?: number;
  attempts?: number;
};

function computeDelay(attempt: number, base: number, max: number): number {
  const exponential = base * 2 ** attempt;
  const capped = Math.min(exponential, max);
  // full jitter: random in [0, capped]
  return Math.random() * capped;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const base = options.base ?? DEFAULT_BASE_MS;
  const max = options.max ?? DEFAULT_MAX_MS;
  const attempts = options.attempts ?? DEFAULT_ATTEMPTS;

  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        const delay = computeDelay(attempt, base, max);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
```

- [ ] **Step 4: Run tests — all should pass**

```bash
pnpm test tests/unit/utils/retry.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Apply `withRetry` to `simulateContract` in uniswap-v3 decrease**

In `src/protocols/uniswap-v3/decrease.ts`, import and wrap the `simulateContract` call:

```typescript
import { parseEventLogs } from "viem";
import { NPM_ABI } from "../../abis/npm.js";
import { ADDRESSES } from "../../constants/addresses.js";
import { applySlippage } from "../../math/slippage.js";
import { withRetry } from "../../utils/retry.js";
import type { DecreaseParams, DecreaseResult } from "./types.js";

const DEFAULT_DEADLINE_OFFSET = 1200n;

export async function decreaseLiquidity(
  params: DecreaseParams,
): Promise<DecreaseResult> {
  const {
    walletClient,
    publicClient,
    chainId,
    tokenId,
    liquidity,
    slippageBps,
    deadline,
    recipient: _recipient,
    gasOptions,
  } = params;

  if (slippageBps < 0 || slippageBps > 5_000) {
    throw new Error("slippageBps exceeds maximum (5000 = 50%)");
  }

  const chainAddrs = ADDRESSES[chainId];
  if (!chainAddrs?.uniswapV3) {
    throw new Error(`chainId ${chainId} is not supported for Uniswap V3`);
  }

  const npmAddress = chainAddrs.uniswapV3.npm;
  const effectiveDeadline =
    deadline ?? BigInt(Math.floor(Date.now() / 1000)) + DEFAULT_DEADLINE_OFFSET;

  const { result } = await withRetry(() =>
    publicClient.simulateContract({
      address: npmAddress,
      abi: NPM_ABI,
      functionName: "decreaseLiquidity",
      args: [
        {
          tokenId,
          liquidity,
          amount0Min: 0n,
          amount1Min: 0n,
          deadline: effectiveDeadline,
        },
      ],
      account: walletClient.account,
    }),
  );

  const [estimatedAmount0, estimatedAmount1] = result;
  const amount0Min = applySlippage(estimatedAmount0, slippageBps);
  const amount1Min = applySlippage(estimatedAmount1, slippageBps);

  const hash = await walletClient.writeContract({
    address: npmAddress,
    abi: NPM_ABI,
    functionName: "decreaseLiquidity",
    args: [
      {
        tokenId,
        liquidity,
        amount0Min,
        amount1Min,
        deadline: effectiveDeadline,
      },
    ],
    ...(gasOptions ?? {}),
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  const logs = parseEventLogs({
    abi: NPM_ABI,
    eventName: "DecreaseLiquidity",
    logs: receipt.logs,
  });

  const event = logs[0];
  if (!event) throw new Error("DecreaseLiquidity event not found in receipt");

  return {
    amount0: event.args.amount0,
    amount1: event.args.amount1,
    txHash: hash,
    gasUsed: receipt.gasUsed,
  };
}
```

- [ ] **Step 6: Export `withRetry` from utils index**

Check `src/utils/index.ts` and add the export if the file uses named exports:

```typescript
export { withRetry } from "./retry.js";
export type { RetryOptions } from "./retry.js";
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
pnpm tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 8: Run all unit tests**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/utils/retry.ts tests/unit/utils/retry.test.ts src/protocols/uniswap-v3/decrease.ts src/utils/index.ts
git commit -m "feat(utils): T7/R-03 — add withRetry with exponential backoff + jitter, apply to uniswap-v3 simulateContract"
```

---

## Task 8: T7 — Slippage upper bound (T-04)

**Files:**
- Modify: `src/protocols/uniswap-v3/mint.ts`
- Modify: `src/protocols/aerodrome/mint.ts`
- Modify: `tests/unit/math/slippage.test.ts`

**Context:** Entry points currently allow up to 10000 bps (100%). The spec caps at 5000 (50%) — anything higher is almost certainly a misconfiguration. `decrease.ts` was already updated in Task 7. Update `mint.ts` in both protocols and add tests that verify the new boundary.

- [ ] **Step 1: Add tests for the new boundary**

Add to `tests/unit/math/slippage.test.ts`:

```typescript
  it("applySlippage allows exactly 5000 bps (50%)", () => {
    expect(applySlippage(10_000n, 5_000)).toBe(5_000n);
  });

  it("applySlippage allows above 5000 up to 10000 (math utility has no 5000 cap)", () => {
    expect(applySlippage(10_000n, 6_000)).toBe(4_000n);
  });
```

Note: `applySlippage` in slippage.ts is a pure math utility that keeps its 10000 cap — the 5000 validation lives only at entry points (mint, decrease).

- [ ] **Step 2: Run tests — confirm they pass (math utility unchanged)**

```bash
pnpm test tests/unit/math/slippage.test.ts
```

Expected: PASS.

- [ ] **Step 3: Update uniswap-v3/mint.ts slippage validation**

In `src/protocols/uniswap-v3/mint.ts`, change line 29:

```typescript
  // Before:
  if (slippageBps < 0 || slippageBps > 10_000) {
    throw new Error(`slippageBps ${slippageBps} must be between 0 and 10000`);
  }

  // After:
  if (slippageBps < 0 || slippageBps > 5_000) {
    throw new Error("slippageBps exceeds maximum (5000 = 50%)");
  }
```

- [ ] **Step 4: Update aerodrome/mint.ts slippage validation**

In `src/protocols/aerodrome/mint.ts`, change line 29:

```typescript
  // Before:
  if (slippageBps < 0 || slippageBps > 10_000) {
    throw new Error(`slippageBps ${slippageBps} must be between 0 and 10000`);
  }

  // After:
  if (slippageBps < 0 || slippageBps > 5_000) {
    throw new Error("slippageBps exceeds maximum (5000 = 50%)");
  }
```

- [ ] **Step 5: Verify TypeScript compiles and tests pass**

```bash
pnpm tsc --noEmit && pnpm test
```

Expected: zero errors, all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/protocols/uniswap-v3/mint.ts src/protocols/aerodrome/mint.ts tests/unit/math/slippage.test.ts
git commit -m "feat(protocols): T7/T-04 — cap slippageBps at 5000 (50%) in uniswap-v3 and aerodrome mint entry points"
```

---

## Task 9: T7 — Deadline default verification (L-03)

**Files:**
- No code changes needed (deadline defaults already implemented)

**Context:** All write functions already inject `now + 1200s` when `deadline` is not provided. This task verifies the behavior and adds coverage.

- [ ] **Step 1: Verify deadline defaults exist in all protocol write functions**

Run the grep:

```bash
grep -n "DEFAULT_DEADLINE" \
  src/protocols/uniswap-v3/mint.ts \
  src/protocols/uniswap-v3/decrease.ts \
  src/protocols/aerodrome/mint.ts \
  src/protocols/aerodrome/decrease.ts
```

Expected output: 4 lines, one per file, each showing `DEFAULT_DEADLINE_OFFSET = 1200n` or `DEFAULT_DEADLINE_SECONDS = 1200n`.

- [ ] **Step 2: If any file is missing the default, add it**

Pattern to add (if missing):

```typescript
const DEFAULT_DEADLINE_OFFSET = 1200n;

// In the function body, before the contract call:
const effectiveDeadline =
  params.deadline ?? BigInt(Math.floor(Date.now() / 1000)) + DEFAULT_DEADLINE_OFFSET;
```

- [ ] **Step 3: If any changes were made, verify and commit**

```bash
pnpm tsc --noEmit && pnpm test
git add <changed files>
git commit -m "feat(protocols): T7/L-03 — ensure deadline default (now+1200s) in all write entry points"
```

If no changes needed: no commit required.

---

## Task 10: T6 — CI publish (VERDACCIO_TOKEN)

**Files:**
- No code changes — GitLab project settings only

**Context:** The `.gitlab-ci.yml` publish stage already has the correct script. It fails because `VERDACCIO_TOKEN` is not configured as a GitLab CI/CD variable. This is a one-time infra configuration.

- [ ] **Step 1: Add VERDACCIO_TOKEN to GitLab**

1. Open the project in GitLab: `https://<your-gitlab>/fsa/web3`
2. Go to **Settings → CI/CD → Variables**
3. Click **Add variable**
4. Fill in:
   - **Key:** `VERDACCIO_TOKEN`
   - **Value:** (obtain from Verdaccio admin at `http://avell.local:4873` — login, generate token via npm `npm token create --cidr-whitelist 0.0.0.0/0`)
   - **Type:** Variable
   - **Environments:** Protected (tags only)
   - **Visibility:** Masked
   - **Protected:** ✓ (only runs on protected tags)

- [ ] **Step 2: Create a test tag and verify publish stage**

```bash
git tag v1.8.0-rc.1
git push origin v1.8.0-rc.1
```

Then in GitLab: go to **CI/CD → Pipelines**, find the tag pipeline, verify the `publish` stage completes green.

- [ ] **Step 3: Verify package in Verdaccio**

```bash
npm view @fsa/web3@1.8.0-rc.1 --registry http://avell.local:4873
```

Expected: package metadata is returned.

- [ ] **Step 4: Delete the rc tag (cleanup)**

```bash
git push origin --delete v1.8.0-rc.1
git tag -d v1.8.0-rc.1
```

---

## Final Definition of Done Checklist

Run these validations before claiming v1.8 complete:

- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm test` — all unit tests pass
- [ ] No `as any` in `tests/smoke/uniswap-v3.smoke.test.ts` or `tests/smoke/aerodrome.smoke.test.ts`
- [ ] `wethUsdcPool` is `Address | undefined` in `ChainAddresses`
- [ ] Sepolia `wethUsdcPool` is a real pool address (or documented as unavailable)
- [ ] `_helpers.ts` has Aerodrome Sepolia/Amoy comment
- [ ] `getSqrtRatioAtTick(0)` = `79228162514264337593543950336n`
- [ ] `getSqrtRatioAtTick(MIN_TICK)` = `4295128739n`
- [ ] `getSqrtRatioAtTick(MAX_TICK)` = `1461446703485210103287273052203988822378723970342n`
- [ ] Smoke Uniswap V3 Sepolia: `1 passed` (run manually with env vars after T1+T2)
- [ ] Smoke Aerodrome Base Sepolia: `1 passed` OR documented as skipping by design
- [ ] `withRetry` exported from `src/utils/retry.ts` with 5 passing unit tests
- [ ] `slippageBps > 5000` throws in uniswap-v3 and aerodrome mint entry points
- [ ] All write functions have `now + 1200s` deadline default
- [ ] `VERDACCIO_TOKEN` added to GitLab; publish stage green on rc tag
- [ ] CHANGELOG and ROADMAP updated for v1.8 completion
