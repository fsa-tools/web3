import { describe, it, expect } from "vitest";
import { decodeFunctionData, type Address } from "viem";
import {
  planDecreaseLiquidity,
  planCollectFees,
  planBurnPosition,
} from "../../../src/protocols/uniswap-v3/plan.js";
import { NPM_ABI } from "../../../src/abis/npm.js";

const NPM: Address = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
const OWNER: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";

describe("planDecreaseLiquidity", () => {
  it("devolve 1 tx com a calldata de decreaseLiquidity", () => {
    const txs = planDecreaseLiquidity({
      tokenId: 42n,
      liquidity: 5_000_000n,
      slippageBps: 50,
      npmAddress: NPM,
      deadline: 1_900_000_000n,
      amount0Min: 0n,
      amount1Min: 0n,
    });
    expect(txs).toHaveLength(1);
    const decoded = decodeFunctionData({ abi: NPM_ABI, data: txs[0]!.data });
    expect(decoded.functionName).toBe("decreaseLiquidity");
    const p = decoded.args![0] as Record<string, unknown>;
    expect(p["tokenId"]).toBe(42n);
    expect(p["liquidity"]).toBe(5_000_000n);
  });
});

describe("planCollectFees", () => {
  it("devolve 1 tx de collect com amountMax = uint128 max", () => {
    const txs = planCollectFees({
      tokenId: 42n,
      recipient: OWNER,
      npmAddress: NPM,
    });
    expect(txs).toHaveLength(1);
    const decoded = decodeFunctionData({ abi: NPM_ABI, data: txs[0]!.data });
    expect(decoded.functionName).toBe("collect");
    const p = decoded.args![0] as Record<string, unknown>;
    expect(p["recipient"]).toBe(OWNER);
    expect(p["amount0Max"]).toBe(2n ** 128n - 1n);
  });
});

describe("planBurnPosition", () => {
  it("devolve 1 tx de burn com o tokenId", () => {
    const txs = planBurnPosition({ tokenId: 42n, npmAddress: NPM });
    expect(txs).toHaveLength(1);
    const decoded = decodeFunctionData({ abi: NPM_ABI, data: txs[0]!.data });
    expect(decoded.functionName).toBe("burn");
    expect(decoded.args).toEqual([42n]);
  });
});
