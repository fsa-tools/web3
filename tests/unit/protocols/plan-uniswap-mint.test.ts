import { describe, it, expect } from "vitest";
import { decodeFunctionData, type Address } from "viem";
import { planMint } from "../../../src/protocols/uniswap-v3/plan.js";
import { NPM_ABI } from "../../../src/abis/npm.js";
import { ERC20_ABI } from "../../../src/abis/erc20.js";

const NPM: Address = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
const TOKEN0: Address = "0x4200000000000000000000000000000000000006";
const TOKEN1: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const OWNER: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";

const params = {
  token0: TOKEN0,
  token1: TOKEN1,
  fee: 500,
  tickLower: -200_000,
  tickUpper: -190_000,
  amount0Desired: 1_000_000_000_000_000_000n,
  amount1Desired: 2_000_000_000n,
  slippageBps: 100,
  npmAddress: NPM,
  recipient: OWNER,
  deadline: 1_900_000_000n,
};

describe("planMint (uniswap-v3)", () => {
  it("devolve 3 TxRequest: approve token0, approve token1, mint", () => {
    const txs = planMint(params);
    expect(txs).toHaveLength(3);
    expect(txs[0]!.to).toBe(TOKEN0);
    expect(txs[1]!.to).toBe(TOKEN1);
    expect(txs[2]!.to).toBe(NPM);
    expect(txs.every((t) => t.value === 0n)).toBe(true);
  });

  it("a calldata de approve aprova o NPM pelo amount desejado", () => {
    const txs = planMint(params);
    const decoded = decodeFunctionData({ abi: ERC20_ABI, data: txs[0]!.data });
    expect(decoded.functionName).toBe("approve");
    expect(decoded.args).toEqual([NPM, params.amount0Desired]);
  });

  it("a calldata de mint carrega ticks, recipient e amount*Min com slippage", () => {
    const txs = planMint(params);
    const decoded = decodeFunctionData({ abi: NPM_ABI, data: txs[2]!.data });
    expect(decoded.functionName).toBe("mint");
    const mintParams = decoded.args![0] as Record<string, unknown>;
    expect(mintParams["tickLower"]).toBe(-200_000);
    expect(mintParams["tickUpper"]).toBe(-190_000);
    expect(mintParams["recipient"]).toBe(OWNER);
    expect(mintParams["deadline"]).toBe(1_900_000_000n);
    // 100 bps de slippage → min = desired * 9900 / 10000
    expect(mintParams["amount0Min"]).toBe(990_000_000_000_000_000n);
    expect(mintParams["amount1Min"]).toBe(1_980_000_000n);
  });
});
