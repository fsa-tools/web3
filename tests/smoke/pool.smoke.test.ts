import { describe, it, expect } from "vitest";
import { getCurrentPrice } from "../../src/utils/pool.js";
import { SMOKE_CHAINS, loadChainContext } from "./_helpers.js";

// Pool addresses canônicos em testnet (usar um pool Uniswap V3 ativo).
const POOLS: Record<string, `0x${string}`> = {
  // WETH/USDC 0.05% Arbitrum Sepolia (exemplo — confirmar ao rodar)
  "arbitrum-sepolia": "0x0000000000000000000000000000000000000000",
  "base-sepolia": "0x0000000000000000000000000000000000000000",
};

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

for (const [_key, cfg] of Object.entries(SMOKE_CHAINS)) {
  const pool = POOLS[cfg.name];
  const canRun = (() => {
    const ctx = loadChainContext(cfg);
    return ctx && pool && pool !== ZERO_ADDRESS;
  })();

  describe.skipIf(!canRun)(`pool smoke — ${cfg.name}`, () => {
    if (!canRun) return;

    it(`getCurrentPrice returns sqrtPriceX96 > 0 and tick`, async () => {
      const ctx = loadChainContext(cfg)!;
      const result = await getCurrentPrice(ctx, { poolAddress: pool! });
      expect(result.sqrtPriceX96).toBeGreaterThan(0n);
      expect(typeof result.tick).toBe("number");
    });
  });
}
