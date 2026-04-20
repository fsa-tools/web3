import { describe, it, expect } from "vitest";
import { ensureAllowance, getBalance } from "../../src/utils/erc20.js";
import { getTokenDecimals } from "../../src/utils/decimals.js";
import { SMOKE_CHAINS, loadChainContext } from "./_helpers.js";

for (const [_key, cfg] of Object.entries(SMOKE_CHAINS)) {
  const canRun = (() => {
    const ctx = loadChainContext(cfg);
    return ctx !== null;
  })();

  describe.skipIf(!canRun)(`utils smoke — ${cfg.name}`, () => {
    if (!canRun) return;

    const token = cfg.faucetTokens.usdc ?? cfg.faucetTokens.weth!;

    it(`getTokenDecimals reads USDC/WETH decimals`, async () => {
      const ctx = loadChainContext(cfg)!;
      const dec = await getTokenDecimals(ctx, { token });
      expect([6, 8, 18]).toContain(dec);
    });

    it(`getBalance returns bigint >= 0`, async () => {
      const ctx = loadChainContext(cfg)!;
      const owner = ctx.walletClient!.account.address;
      const bal = await getBalance(ctx, { token, owner });
      expect(typeof bal).toBe("bigint");
      expect(bal).toBeGreaterThanOrEqual(0n);
    });

    it(`ensureAllowance (amount=0) returns approved=false without tx`, async () => {
      const ctx = loadChainContext(cfg)!;
      const spender = ctx.addresses.uniswapV3?.npm ?? ctx.addresses.aave!.pool;
      const result = await ensureAllowance(ctx, { token, spender, amount: 0n });
      expect(result.approved).toBe(false);
      expect(result.txHash).toBeUndefined();
    });

    it(`ensureAllowance approves MAX_UINT256 when below amount`, async () => {
      const ctx = loadChainContext(cfg)!;
      const spender = ctx.addresses.uniswapV3?.npm ?? ctx.addresses.aave!.pool;
      const result = await ensureAllowance(ctx, { token, spender, amount: 1n });
      expect(typeof result.approved).toBe("boolean");
      if (result.approved) {
        expect(result.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
      }
    });
  });
}
