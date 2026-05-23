import { describe, it, expect } from "vitest";
import { ensureAllowance, getBalance } from "../../src/utils/erc20.js";
import { getTokenDecimals } from "../../src/utils/decimals.js";
import * as aave from "../../src/protocols/aave/index.js";
import { SMOKE_CHAINS, loadChainContext } from "./_helpers.js";

for (const [_key, cfg] of Object.entries(SMOKE_CHAINS)) {
  const canRun = (() => {
    const ctx = loadChainContext(cfg);
    return ctx && ctx.addresses.aave && cfg.aaveReserves?.usdc;
  })();

  describe.skipIf(!canRun)(`aave smoke — ${cfg.name}`, () => {
    if (!canRun) return;

    it("supply 1 USDC → getUserAccountData → withdraw", async () => {
      const ctx = loadChainContext(cfg)!;
      const pool = ctx.addresses.aave!.pool;
      const asset = cfg.aaveReserves!.usdc!;
      const owner = ctx.walletClient!.account.address;

      const decimals = await getTokenDecimals(ctx, { token: asset });
      const amount = 10n ** BigInt(decimals); // 1 USDC

      const bal = await getBalance(ctx, { token: asset, owner });
      if (bal < amount) {
        console.warn(
          `Skipping aave ${cfg.name} — insufficient USDC on Aave reserve ${asset}. ` +
            `Aave V3 testnet reserves expose a public mint() — fund the wallet via block explorer before re-running.`,
        );
        return;
      }

      await ensureAllowance(ctx, { token: asset, spender: pool, amount });

      const supplyResult = await aave.supply(ctx, { asset, amount });
      expect(supplyResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

      const acct = await aave.getUserAccountData(ctx, { user: owner });
      expect(acct.totalCollateralBase).toBeGreaterThan(0n);

      const withdrawResult = await aave.withdraw(ctx, { asset, amount });
      expect(withdrawResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    }, 120_000);

    it("planRepay produz [approve, Pool.repay] com encoding válido", () => {
      const ctx = loadChainContext(cfg)!;
      const pool = ctx.addresses.aave!.pool;
      const asset = cfg.aaveReserves!.usdc!;
      const owner = ctx.walletClient!.account.address;

      const txs = aave.planRepay({
        asset,
        amount: 1_000_000n,
        interestRateMode: 2,
        poolAddress: pool,
        onBehalfOf: owner,
      });
      expect(txs).toHaveLength(2);
      expect(txs[0]!.to.toLowerCase()).toBe(asset.toLowerCase());
      expect(txs[1]!.to.toLowerCase()).toBe(pool.toLowerCase());
      expect(txs[1]!.data.length).toBeGreaterThan(10);
    });
  });
}
