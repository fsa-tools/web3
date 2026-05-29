import { describe, it, expect } from "vitest";
import { decodeFunctionData, type Address } from "viem";
import { planSwapExactInputSingle } from "../../../src/protocols/uniswap-v3/plan.js";
import { SWAP_ROUTER_ABI } from "../../../src/abis/swap-router.js";
import { ERC20_ABI } from "../../../src/abis/erc20.js";

const ROUTER: Address = "0x2626664c2603336E57B271c5C0b26F421741e481";
const TOKEN_IN: Address = "0x4200000000000000000000000000000000000006";
const TOKEN_OUT: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const RECIPIENT: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";

const params = {
  tokenIn: TOKEN_IN,
  tokenOut: TOKEN_OUT,
  fee: 500,
  amountIn: 1_000_000_000_000_000_000n,
  amountOutMinimum: 990_000_000n,
  routerAddress: ROUTER,
  recipient: RECIPIENT,
};

describe("planSwapExactInputSingle (uniswap-v3)", () => {
  it("devolve 2 TxRequest: approve tokenIn, swap", () => {
    const txs = planSwapExactInputSingle(params);
    expect(txs).toHaveLength(2);
    expect(txs[0]!.to).toBe(TOKEN_IN);
    expect(txs[1]!.to).toBe(ROUTER);
    expect(txs.every((t) => t.value === 0n)).toBe(true);
  });

  it("a calldata de approve aprova o router pelo amountIn", () => {
    const txs = planSwapExactInputSingle(params);
    const decoded = decodeFunctionData({ abi: ERC20_ABI, data: txs[0]!.data });
    expect(decoded.functionName).toBe("approve");
    expect(decoded.args).toEqual([ROUTER, params.amountIn]);
  });

  it("a calldata de swap carrega todos os campos corretos e sqrtPriceLimitX96 === 0n", () => {
    const txs = planSwapExactInputSingle(params);
    const decoded = decodeFunctionData({
      abi: SWAP_ROUTER_ABI,
      data: txs[1]!.data,
    });
    expect(decoded.functionName).toBe("exactInputSingle");
    const swapParams = decoded.args![0] as Record<string, unknown>;
    expect(swapParams["tokenIn"]).toBe(TOKEN_IN);
    expect(swapParams["tokenOut"]).toBe(TOKEN_OUT);
    expect(swapParams["fee"]).toBe(500);
    expect(swapParams["recipient"]).toBe(RECIPIENT);
    expect(swapParams["amountIn"]).toBe(params.amountIn);
    expect(swapParams["amountOutMinimum"]).toBe(params.amountOutMinimum);
    expect(swapParams["sqrtPriceLimitX96"]).toBe(0n);
  });
});
