import { describe, it, expect } from "vitest";
import { decodeFunctionData, encodeFunctionResult } from "viem";
import type { Address } from "viem";
import { aaveAccountDataProbe } from "../../../../src/protocols/aave/probe.js";
import { AAVE_POOL_ABI } from "../../../../src/abis/aave-pool.js";
import { ProtocolNotSupportedError } from "../../../../src/errors.js";
import type { ChainContext } from "../../../../src/context.js";
import { ADDRESSES } from "../../../../src/constants/addresses.js";

const POOL: Address = ADDRESSES[8453]!.aave!.pool;
const USER: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";

function ctxWithAave(): ChainContext {
  return {
    publicClient: { chain: { id: 8453 } },
    addresses: { aave: { pool: POOL } },
  } as unknown as ChainContext;
}

describe("aaveAccountDataProbe", () => {
  it("monta calldata de getUserAccountData contra ctx.addresses.aave.pool", () => {
    const probe = aaveAccountDataProbe(ctxWithAave(), USER);

    expect(probe.label).toBe("aave-account-data");
    expect(probe.to).toBe(POOL);
    expect(
      decodeFunctionData({ abi: AAVE_POOL_ABI, data: probe.data }),
    ).toEqual({ functionName: "getUserAccountData", args: [USER] });
  });

  it("decodifica o retorno para o shape de AccountData", () => {
    const probe = aaveAccountDataProbe(ctxWithAave(), USER);
    const encoded = encodeFunctionResult({
      abi: AAVE_POOL_ABI,
      functionName: "getUserAccountData",
      result: [1000n, 200n, 300n, 8000n, 7500n, 15_000_000_000_000_000_000n],
    });

    expect(probe.decode(encoded)).toEqual({
      totalCollateralBase: 1000n,
      totalDebtBase: 200n,
      availableBorrowsBase: 300n,
      currentLiquidationThreshold: 8000n,
      ltv: 7500n,
      healthFactor: 15_000_000_000_000_000_000n,
    });
  });

  it("lança ProtocolNotSupportedError sem aave no ctx", () => {
    const ctx = {
      publicClient: { chain: { id: 8453 } },
      addresses: {},
    } as unknown as ChainContext;

    expect(() => aaveAccountDataProbe(ctx, USER)).toThrow(
      ProtocolNotSupportedError,
    );
  });
});
