import { describe, it, expect } from "vitest";
import { decodeFunctionData, type Address } from "viem";
import {
  planMint,
  planDecreaseLiquidity,
  planCollectFees,
  planBurnPosition,
} from "../../../../src/protocols/aerodrome/plan.js";
import { AERODROME_NPM_ABI } from "../../../../src/abis/aerodrome-npm.js";
import { ERC20_ABI } from "../../../../src/abis/erc20.js";

const NPM: Address = "0x827922686190790b37229fd06084350E74485b72";
const TOKEN0: Address = "0x4200000000000000000000000000000000000006";
const TOKEN1: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const OWNER: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";

const NFT_ID = 42n;

describe("planMint (aerodrome)", () => {
  const params = {
    npmAddress: NPM,
    poolAddress: "0x0000000000000000000000000000000000000001" as Address,
    token0: TOKEN0,
    token1: TOKEN1,
    tickSpacing: 100,
    tickLower: -200_000,
    tickUpper: -190_000,
    amount0Desired: 1_000_000_000_000_000_000n,
    amount1Desired: 2_000_000_000n,
    sqrtPriceX96: 0n,
    slippageBps: 100,
    recipient: OWNER,
    deadline: 1_900_000_000n,
  };

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

  it("a calldata de mint carrega tickSpacing, ticks, recipient, deadline e amount*Min com slippage", () => {
    const txs = planMint(params);
    const decoded = decodeFunctionData({
      abi: AERODROME_NPM_ABI,
      data: txs[2]!.data,
    });
    expect(decoded.functionName).toBe("mint");
    const mintParams = decoded.args![0] as Record<string, unknown>;
    expect(mintParams["tickSpacing"]).toBe(100);
    expect(mintParams["tickLower"]).toBe(-200_000);
    expect(mintParams["tickUpper"]).toBe(-190_000);
    expect(mintParams["recipient"]).toBe(OWNER);
    expect(mintParams["deadline"]).toBe(1_900_000_000n);
    // 100 bps de slippage → min = desired * 9900 / 10000
    expect(mintParams["amount0Min"]).toBe(990_000_000_000_000_000n);
    expect(mintParams["amount1Min"]).toBe(1_980_000_000n);
  });
});

describe("planDecreaseLiquidity (aerodrome)", () => {
  const params = {
    npmAddress: NPM,
    nftId: NFT_ID,
    liquidity: 500_000n,
    amount0Min: 100n,
    amount1Min: 200n,
    deadline: 1_900_000_000n,
  };

  it("devolve 1 TxRequest com to = NPM e value = 0n", () => {
    const txs = planDecreaseLiquidity(params);
    expect(txs).toHaveLength(1);
    expect(txs[0]!.to).toBe(NPM);
    expect(txs[0]!.value).toBe(0n);
  });

  it("calldata de decreaseLiquidity carrega tokenId, liquidity, amounts e deadline", () => {
    const txs = planDecreaseLiquidity(params);
    const decoded = decodeFunctionData({
      abi: AERODROME_NPM_ABI,
      data: txs[0]!.data,
    });
    expect(decoded.functionName).toBe("decreaseLiquidity");
    const args = decoded.args![0] as Record<string, unknown>;
    expect(args["tokenId"]).toBe(NFT_ID);
    expect(args["liquidity"]).toBe(500_000n);
    expect(args["amount0Min"]).toBe(100n);
    expect(args["amount1Min"]).toBe(200n);
    expect(args["deadline"]).toBe(1_900_000_000n);
  });
});

describe("planCollectFees (aerodrome)", () => {
  const params = {
    npmAddress: NPM,
    nftId: NFT_ID,
    recipient: OWNER,
  };

  it("devolve 1 TxRequest com to = NPM e value = 0n", () => {
    const txs = planCollectFees(params);
    expect(txs).toHaveLength(1);
    expect(txs[0]!.to).toBe(NPM);
    expect(txs[0]!.value).toBe(0n);
  });

  it("calldata de collect carrega tokenId, recipient e MAX_UINT128 nos amounts", () => {
    const txs = planCollectFees(params);
    const decoded = decodeFunctionData({
      abi: AERODROME_NPM_ABI,
      data: txs[0]!.data,
    });
    expect(decoded.functionName).toBe("collect");
    const args = decoded.args![0] as Record<string, unknown>;
    expect(args["tokenId"]).toBe(NFT_ID);
    expect(args["recipient"]).toBe(OWNER);
    expect(args["amount0Max"]).toBe(2n ** 128n - 1n);
    expect(args["amount1Max"]).toBe(2n ** 128n - 1n);
  });
});

describe("planBurnPosition (aerodrome)", () => {
  const params = {
    npmAddress: NPM,
    nftId: NFT_ID,
  };

  it("devolve 1 TxRequest com to = NPM e value = 0n", () => {
    const txs = planBurnPosition(params);
    expect(txs).toHaveLength(1);
    expect(txs[0]!.to).toBe(NPM);
    expect(txs[0]!.value).toBe(0n);
  });

  it("calldata de burn carrega nftId como tokenId", () => {
    const txs = planBurnPosition(params);
    const decoded = decodeFunctionData({
      abi: AERODROME_NPM_ABI,
      data: txs[0]!.data,
    });
    expect(decoded.functionName).toBe("burn");
    expect(decoded.args![0]).toBe(NFT_ID);
  });
});
