import { describe, it, expect } from "vitest";
import { decodeFunctionData, type Address, type Hex } from "viem";
import {
  planSupply,
  planRepay,
  planSupplyWithPermit,
  planRepayWithPermit,
} from "../../../../src/protocols/aave/plan.js";
import { AAVE_POOL_ABI } from "../../../../src/abis/aave-pool.js";
import { ADDRESSES } from "../../../../src/constants/addresses.js";

const ASSET: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const POOL: Address = ADDRESSES[8453]!.aave!.pool;
const WALLET: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";

const DEADLINE = 1_800_000_000n;
const R: Hex =
  "0x1111111111111111111111111111111111111111111111111111111111111111";
const S: Hex =
  "0x2222222222222222222222222222222222222222222222222222222222222222";

describe("planSupplyWithPermit", () => {
  it("devolve uma unica tx ao pool — sem approve separado", () => {
    const txs = planSupplyWithPermit({
      asset: ASSET,
      amount: 5_000_000n,
      poolAddress: POOL,
      onBehalfOf: WALLET,
      permit: { deadline: DEADLINE, v: 28, r: R, s: S },
    });
    expect(txs).toHaveLength(1);
    expect(txs[0]!.to).toBe(POOL);
    expect(txs[0]!.value).toBe(0n);
    expect(txs[0]!.label).toBe("supply to Aave V3 (permit)");
  });

  it("encoda Pool.supplyWithPermit(asset, amount, onBehalfOf, referralCode, deadline, v, r, s)", () => {
    const txs = planSupplyWithPermit({
      asset: ASSET,
      amount: 5_000_000n,
      poolAddress: POOL,
      onBehalfOf: WALLET,
      permit: { deadline: DEADLINE, v: 28, r: R, s: S },
    });
    const decoded = decodeFunctionData({
      abi: AAVE_POOL_ABI,
      data: txs[0]!.data,
    });
    expect(decoded.functionName).toBe("supplyWithPermit");
    expect(decoded.args).toEqual([
      ASSET,
      5_000_000n,
      WALLET,
      0,
      DEADLINE,
      28,
      R,
      S,
    ]);
  });
});

describe("planRepayWithPermit", () => {
  it("devolve uma unica tx ao pool — sem approve separado", () => {
    const txs = planRepayWithPermit({
      asset: ASSET,
      amount: 1_000_000n,
      interestRateMode: 2,
      poolAddress: POOL,
      onBehalfOf: WALLET,
      permit: { deadline: DEADLINE, v: 27, r: R, s: S },
    });
    expect(txs).toHaveLength(1);
    expect(txs[0]!.to).toBe(POOL);
    expect(txs[0]!.value).toBe(0n);
    expect(txs[0]!.label).toBe("repay to Aave V3 (permit)");
  });

  it("encoda Pool.repayWithPermit(asset, amount, interestRateMode, onBehalfOf, deadline, v, r, s)", () => {
    const txs = planRepayWithPermit({
      asset: ASSET,
      amount: 1_000_000n,
      interestRateMode: 2,
      poolAddress: POOL,
      onBehalfOf: WALLET,
      permit: { deadline: DEADLINE, v: 27, r: R, s: S },
    });
    const decoded = decodeFunctionData({
      abi: AAVE_POOL_ABI,
      data: txs[0]!.data,
    });
    expect(decoded.functionName).toBe("repayWithPermit");
    expect(decoded.args).toEqual([
      ASSET,
      1_000_000n,
      2n,
      WALLET,
      DEADLINE,
      27,
      R,
      S,
    ]);
  });

  it("propaga interestRateMode 1 (stable) como uint256", () => {
    const txs = planRepayWithPermit({
      asset: ASSET,
      amount: 1_000_000n,
      interestRateMode: 1,
      poolAddress: POOL,
      onBehalfOf: WALLET,
      permit: { deadline: DEADLINE, v: 27, r: R, s: S },
    });
    const decoded = decodeFunctionData({
      abi: AAVE_POOL_ABI,
      data: txs[0]!.data,
    });
    expect(decoded.args?.[2]).toBe(1n);
  });
});

describe("fallback explicito approve + acao", () => {
  const permit = { deadline: DEADLINE, v: 28, r: R, s: S } as const;
  const base = {
    asset: ASSET,
    amount: 5_000_000n,
    poolAddress: POOL,
    onBehalfOf: WALLET,
  } as const;

  it("supply: rota com permit tem 1 tx, rota de fallback tem 2 (approve + supply)", () => {
    // O caller escolhe a rota com `supportsPermit`; as duas chegam ao mesmo
    // pool, mas o fallback paga uma assinatura a mais.
    expect(planSupplyWithPermit({ ...base, permit })).toHaveLength(1);

    const fallback = planSupply(base);
    expect(fallback).toHaveLength(2);
    expect(fallback[0]!.to).toBe(ASSET);
    expect(fallback[1]!.to).toBe(POOL);
  });

  it("repay: rota com permit tem 1 tx, rota de fallback tem 2 (approve + repay)", () => {
    const repayBase = { ...base, amount: 1_000_000n, interestRateMode: 2 } as const;
    expect(planRepayWithPermit({ ...repayBase, permit })).toHaveLength(1);

    const fallback = planRepay(repayBase);
    expect(fallback).toHaveLength(2);
    expect(fallback[0]!.to).toBe(ASSET);
    expect(fallback[1]!.to).toBe(POOL);
  });
});
