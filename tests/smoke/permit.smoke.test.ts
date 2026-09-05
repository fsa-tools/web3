import { describe, it, expect } from "vitest";
import { supportsPermit, buildPermitTypedData } from "../../src/utils/permit.js";
import {
  PERMIT_READONLY_CHAINS,
  loadReadOnlyChainContext,
} from "./_helpers.js";
import { ADDRESSES } from "../../src/constants/addresses.js";

const AAVE_POOL_BASE = ADDRESSES[8453]!.aave!.pool;
const OWNER = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0" as const;
const DEADLINE = 1_800_000_000n;

for (const [_key, cfg] of Object.entries(PERMIT_READONLY_CHAINS)) {
  const canRun = loadReadOnlyChainContext(cfg) !== null;

  describe.skipIf(!canRun)(`permit detection smoke — ${cfg.name}`, () => {
    if (!canRun) return;

    it("USDC suporta permit (caso positivo)", async () => {
      const ctx = loadReadOnlyChainContext(cfg)!;
      await expect(
        supportsPermit(ctx, { token: cfg.tokens.usdc }),
      ).resolves.toBe(true);
    });

    it("WETH nao suporta permit (caso negativo canonico na Base)", async () => {
      const ctx = loadReadOnlyChainContext(cfg)!;
      await expect(
        supportsPermit(ctx, { token: cfg.tokens.weth }),
      ).resolves.toBe(false);
    });

    it("typed data do USDC reproduz o DOMAIN_SEPARATOR on-chain", async () => {
      const ctx = loadReadOnlyChainContext(cfg)!;
      // buildPermitTypedData lança PermitDomainMismatchError se o domínio
      // montado não bater com o separator do token — chegar aqui já é a prova.
      const typedData = await buildPermitTypedData(ctx, {
        token: cfg.tokens.usdc,
        owner: OWNER,
        spender: AAVE_POOL_BASE,
        value: 1_000_000n,
        deadline: DEADLINE,
      });
      // USDC na Base e FiatTokenV2_2 — dominio EIP-712 na version "2",
      // descoberta pelos candidatos, nao informada pelo chamador.
      expect(typedData.domain.version).toBe("2");
      expect(typedData.domain.name).toBe("USD Coin");
      expect(typedData.domain.chainId).toBe(cfg.chainId);
      expect(typedData.domain.verifyingContract).toBe(cfg.tokens.usdc);
      expect(typedData.primaryType).toBe("Permit");
    });
  });
}
