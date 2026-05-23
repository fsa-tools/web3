import { describe, it, expect } from "vitest";
import { decodeFunctionData } from "viem";
import { planRepay } from "../../../../src/protocols/aave/plan.js";
import { AAVE_POOL_ABI } from "../../../../src/abis/aave-pool.js";
import { ERC20_ABI } from "../../../../src/abis/erc20.js";

const ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const POOL = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5" as const;
const WALLET = "0x1111111111111111111111111111111111111111" as const;

describe("planRepay", () => {
  it("retorna [approve, repay] como TxRequest[]", () => {
    const txs = planRepay({
      asset: ASSET,
      amount: 1_000_000n,
      interestRateMode: 2,
      poolAddress: POOL,
      onBehalfOf: WALLET,
    });
    expect(txs).toHaveLength(2);
    expect(txs[0]!.label).toContain("approve");
    expect(txs[0]!.to.toLowerCase()).toBe(ASSET.toLowerCase());
    expect(txs[1]!.label).toBe("repay to Aave V3");
    expect(txs[1]!.to.toLowerCase()).toBe(POOL.toLowerCase());
    expect(txs[0]!.value).toBe(0n);
    expect(txs[1]!.value).toBe(0n);
  });

  it("encoda Pool.repay(asset, amount, interestRateMode, onBehalfOf) corretamente", () => {
    const txs = planRepay({
      asset: ASSET,
      amount: 1_000_000n,
      interestRateMode: 2,
      poolAddress: POOL,
      onBehalfOf: WALLET,
    });
    const decoded = decodeFunctionData({
      abi: AAVE_POOL_ABI,
      data: txs[1]!.data,
    });
    expect(decoded.functionName).toBe("repay");
    expect(decoded.args).toEqual([ASSET, 1_000_000n, 2n, WALLET]);
  });

  it("encoda ERC20.approve(pool, amount) na primeira tx", () => {
    const txs = planRepay({
      asset: ASSET,
      amount: 1_000_000n,
      interestRateMode: 1,
      poolAddress: POOL,
      onBehalfOf: WALLET,
    });
    const decoded = decodeFunctionData({
      abi: ERC20_ABI,
      data: txs[0]!.data,
    });
    expect(decoded.functionName).toBe("approve");
    expect(decoded.args).toEqual([POOL, 1_000_000n]);
  });
});
