import { describe, it, expect } from "vitest";
import { createChainContext } from "../../src/context.js";
import { ensureAllowance, getBalance } from "../../src/utils/erc20.js";
import { getTokenDecimals } from "../../src/utils/decimals.js";
import * as aave from "../../src/protocols/aave/index.js";
import { SMOKE_CHAINS, loadChainEnv } from "./_helpers.js";

for (const [_key, cfg] of Object.entries(SMOKE_CHAINS)) {
  const env = loadChainEnv(cfg);
  const canRun = env && cfg.protocols.aavePool && cfg.aaveReserves?.usdc;
  describe.skipIf(!canRun)(`aave smoke — ${cfg.name}`, () => {
    if (!canRun) return;
    const pool = cfg.protocols.aavePool!;
    const asset = cfg.aaveReserves!.usdc!;

    it("supply 1 USDC → getUserAccountData → withdraw", async () => {
      const ctx = createChainContext({
        chainId: cfg.chainId,
        rpcUrls: [env!.rpcUrl],
        privateKey: env!.pk,
        decimalsCache: new Map(),
      });
      const owner = ctx.walletClient!.account.address;
      const decimals = await getTokenDecimals(ctx, { token: asset });
      const amount = 10n ** BigInt(decimals); // 1 USDC
      const bal = await getBalance({
        publicClient: ctx.publicClient,
        token: asset,
        owner,
      });
      if (bal < amount) {
        console.warn(
          `Skipping aave ${cfg.name} — insufficient USDC on Aave reserve ${asset}. ` +
            `Aave V3 testnet reserves expose a public mint() — fund the wallet via block explorer before re-running.`,
        );
        return;
      }

      await ensureAllowance({
        publicClient: ctx.publicClient,
        walletClient: ctx.walletClient!,
        token: asset,
        spender: pool,
        amount,
      });
      const supplyResult = await aave.supply({
        publicClient: ctx.publicClient,
        walletClient: ctx.walletClient!,
        chainId: cfg.chainId,
        asset,
        amount,
      });
      expect(supplyResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

      const acct = await aave.getUserAccountData({
        publicClient: ctx.publicClient,
        chainId: cfg.chainId,
        user: owner,
      });
      expect(acct.totalCollateralBase).toBeGreaterThan(0n);

      const withdrawResult = await aave.withdraw({
        publicClient: ctx.publicClient,
        walletClient: ctx.walletClient!,
        chainId: cfg.chainId,
        asset,
        amount,
      });
      expect(withdrawResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    }, 120_000);
  });
}
