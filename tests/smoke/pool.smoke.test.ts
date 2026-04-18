import { describe, it, expect } from "vitest";
import { createClients } from "../../src/utils/client.js";
import { getPoolSlot0 } from "../../src/utils/pool.js";
import { SMOKE_CHAINS, loadChainEnv } from "./_helpers.js";

// Pool addresses canônicos em testnet (usar um pool Uniswap V3 ativo).
const POOLS: Record<string, `0x${string}`> = {
  // WETH/USDC 0.05% Arbitrum Sepolia (exemplo — confirmar ao rodar)
  "arbitrum-sepolia": "0x0000000000000000000000000000000000000000",
  "base-sepolia": "0x0000000000000000000000000000000000000000",
};

for (const [_key, cfg] of Object.entries(SMOKE_CHAINS)) {
  const env = loadChainEnv(cfg);
  const pool = POOLS[cfg.name];
  const canRun =
    env && pool && pool !== "0x0000000000000000000000000000000000000000";
  describe.skipIf(!canRun)(`pool smoke — ${cfg.name}`, () => {
    if (!canRun) return;

    it(`slot0 returns sqrtPriceX96 > 0`, async () => {
      const { publicClient } = createClients({
        chainId: cfg.chainId,
        rpcUrl: env!.rpcUrl,
      });
      const slot0 = await getPoolSlot0({ publicClient, pool });
      expect(slot0.sqrtPriceX96).toBeGreaterThan(0n);
      expect(typeof slot0.tick).toBe("number");
    });
  });
}
