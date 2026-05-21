import { describe, it, expect } from "vitest";
import { decodeFunctionData, type Address } from "viem";
import { planSupply, planWithdraw } from "../../../src/protocols/aave/plan.js";
import { AAVE_POOL_ABI } from "../../../src/abis/aave-pool.js";
import { ERC20_ABI } from "../../../src/abis/erc20.js";

const POOL: Address = "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5";
const ASSET: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const OWNER: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";

describe("planSupply (aave)", () => {
  it("devolve [approve, supply] — approve do asset para o pool", () => {
    const txs = planSupply({
      asset: ASSET,
      amount: 5_000_000_000n,
      poolAddress: POOL,
      onBehalfOf: OWNER,
    });
    expect(txs).toHaveLength(2);
    expect(txs[0]!.to).toBe(ASSET);
    const approve = decodeFunctionData({ abi: ERC20_ABI, data: txs[0]!.data });
    expect(approve.functionName).toBe("approve");
    expect(approve.args).toEqual([POOL, 5_000_000_000n]);
  });

  it("a calldata de supply carrega asset, amount, onBehalfOf e referral 0", () => {
    const txs = planSupply({
      asset: ASSET,
      amount: 5_000_000_000n,
      poolAddress: POOL,
      onBehalfOf: OWNER,
    });
    expect(txs[1]!.to).toBe(POOL);
    const supply = decodeFunctionData({
      abi: AAVE_POOL_ABI,
      data: txs[1]!.data,
    });
    expect(supply.functionName).toBe("supply");
    expect(supply.args).toEqual([ASSET, 5_000_000_000n, OWNER, 0]);
  });
});

describe("planWithdraw (aave)", () => {
  it("devolve [withdraw] — sem approve (aToken não precisa)", () => {
    const txs = planWithdraw({
      asset: ASSET,
      amount: 3_000_000_000n,
      poolAddress: POOL,
      to: OWNER,
    });
    expect(txs).toHaveLength(1);
    const withdraw = decodeFunctionData({
      abi: AAVE_POOL_ABI,
      data: txs[0]!.data,
    });
    expect(withdraw.functionName).toBe("withdraw");
    expect(withdraw.args).toEqual([ASSET, 3_000_000_000n, OWNER]);
  });
});
