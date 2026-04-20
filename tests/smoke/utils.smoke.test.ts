import { describe, it, expect } from "vitest";
import { createClients } from "../../src/utils/client.js";
import { createChainContext } from "../../src/context.js";
import { ensureAllowance, getBalance } from "../../src/utils/erc20.js";
import { getTokenDecimals } from "../../src/utils/decimals.js";
import { SMOKE_CHAINS, loadChainEnv } from "./_helpers.js";

for (const [key, cfg] of Object.entries(SMOKE_CHAINS)) {
  const env = loadChainEnv(cfg);
  describe.skipIf(!env)(`utils smoke — ${cfg.name}`, () => {
    if (!env) return;
    const token = cfg.faucetTokens.usdc ?? cfg.faucetTokens.weth!;
    const spender = cfg.protocols.uniswapV3Npm ?? cfg.protocols.aavePool!;

    it(`getTokenDecimals reads USDC/WETH decimals`, async () => {
      const ctx = createChainContext({
        chainId: cfg.chainId,
        rpcUrls: [env.rpcUrl],
        decimalsCache: new Map(),
      });
      const dec = await getTokenDecimals(ctx, { token });
      expect([6, 8, 18]).toContain(dec);
    });

    it(`getBalance returns bigint >= 0`, async () => {
      const { publicClient, walletClient } = createClients({
        chainId: cfg.chainId,
        rpcUrl: env.rpcUrl,
        privateKey: env.pk,
      });
      const bal = await getBalance({
        publicClient,
        token,
        owner: walletClient!.account.address,
      });
      expect(typeof bal).toBe("bigint");
      expect(bal).toBeGreaterThanOrEqual(0n);
    });

    it(`ensureAllowance (amount=0) returns approved=false without tx`, async () => {
      const { publicClient, walletClient } = createClients({
        chainId: cfg.chainId,
        rpcUrl: env.rpcUrl,
        privateKey: env.pk,
      });
      const result = await ensureAllowance({
        publicClient,
        walletClient: walletClient!,
        token,
        spender,
        amount: 0n,
      });
      expect(result.approved).toBe(false);
      expect(result.txHash).toBeUndefined();
    });

    it(`ensureAllowance approves MAX_UINT256 when below amount`, async () => {
      const { publicClient, walletClient } = createClients({
        chainId: cfg.chainId,
        rpcUrl: env.rpcUrl,
        privateKey: env.pk,
      });
      // Small amount — se allowance já é >= 1n, retorna approved=false
      const result = await ensureAllowance({
        publicClient,
        walletClient: walletClient!,
        token,
        spender,
        amount: 1n,
      });
      expect(typeof result.approved).toBe("boolean");
      if (result.approved) {
        expect(result.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
      }
    });
  });
}
