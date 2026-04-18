import { describe, it, expect } from "vitest";
import { createClients } from "../../src/utils/client.js";
import { ensureAllowance, getBalance } from "../../src/utils/erc20.js";
import { getTokenDecimals } from "../../src/utils/decimals.js";
import * as aave from "../../src/protocols/aave/index.js";
import { SMOKE_CHAINS, loadChainEnv } from "./_helpers.js";

for (const [_key, cfg] of Object.entries(SMOKE_CHAINS)) {
  const env = loadChainEnv(cfg);
  const canRun = env && cfg.protocols.aavePool && cfg.faucetTokens.usdc;
  describe.skipIf(!canRun)(`aave smoke — ${cfg.name}`, () => {
    if (!canRun) return;
    const pool = cfg.protocols.aavePool!;
    const asset = cfg.faucetTokens.usdc!;

    it("supply 1 USDC → getUserAccountData → withdraw", async () => {
      const { publicClient, walletClient } = createClients({
        chainId: cfg.chainId,
        rpcUrl: env!.rpcUrl,
        privateKey: env!.pk,
      });
      const owner = walletClient!.account.address;
      const decimals = await getTokenDecimals({ publicClient, token: asset });
      const amount = 10n ** BigInt(decimals); // 1 USDC
      const bal = await getBalance({ publicClient, token: asset, owner });
      if (bal < amount) {
        console.warn(`Skipping aave ${cfg.name} — insufficient USDC`);
        return;
      }

      await ensureAllowance({
        publicClient,
        walletClient: walletClient!,
        token: asset,
        spender: pool,
        amount,
      });
      const supplyResult = await aave.supply({
        publicClient,
        walletClient: walletClient!,
        chainId: cfg.chainId,
        asset,
        amount,
      });
      expect(supplyResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);

      const acct = await aave.getUserAccountData({
        publicClient,
        chainId: cfg.chainId,
        user: owner,
      });
      expect(acct.totalCollateralBase).toBeGreaterThan(0n);

      const withdrawResult = await aave.withdraw({
        publicClient,
        walletClient: walletClient!,
        chainId: cfg.chainId,
        asset,
        amount,
      });
      expect(withdrawResult.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    }, 120_000);
  });
}
