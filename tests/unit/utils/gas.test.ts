import { describe, it, expect, vi } from "vitest";
import type { Abi, Address } from "viem";
import { getEthPriceUsd } from "../../../src/utils/gas.js";
import { POOL_SLOT0_ABI } from "../../../src/abis/pool.js";
import type { ChainContext } from "../../../src/context.js";

const Q96 = 2n ** 96n;

const WETH_MAINNET: Address = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
const USDC_MAINNET: Address = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const WETH_BASE: Address = "0x4200000000000000000000000000000000000006";
const USDC_BASE: Address = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const WETH_ARBITRUM: Address = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const POOL_MAINNET: Address = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";
const POOL_BASE: Address = "0xd0b53D9277642d899DF5C87A3966A349A798F224";
const POOL_ARBITRUM: Address = "0xC6962004f452bE9203591991D15f6b388e09E8D0";

const ETH_PRICE_USD = 1869;
const WETH_DECIMALS = 18;
const USDC_DECIMALS = 6;

/** priceRaw (token1/token0 em unidades cruas) → sqrtPriceX96 do slot0. */
function toSqrtPriceX96(priceRaw: number): bigint {
  return BigInt(Math.floor(Math.sqrt(priceRaw) * Number(Q96)));
}

/** Pool com WETH=token0 (Base): raw = USDC por WETH. */
function sqrtPriceWethToken0(ethPriceUsd: number): bigint {
  return toSqrtPriceX96(ethPriceUsd * 10 ** (USDC_DECIMALS - WETH_DECIMALS));
}

/** Pool com USDC=token0 (Ethereum mainnet): raw = WETH por USDC. */
function sqrtPriceWethToken1(ethPriceUsd: number): bigint {
  return toSqrtPriceX96(
    (1 / ethPriceUsd) * 10 ** (WETH_DECIMALS - USDC_DECIMALS),
  );
}

type ReadCall = { functionName: string; abi: Abi };
type MockContext = {
  ctx: ChainContext;
  reads: ReadCall[];
};

function buildMockContext(params: {
  weth: Address;
  token0: Address;
  sqrtPriceX96: bigint;
}): MockContext {
  const reads: ReadCall[] = [];
  const publicClient = {
    readContract: vi.fn(async (p: { functionName: string; abi: Abi }) => {
      reads.push({ functionName: p.functionName, abi: p.abi });
      if (p.functionName === "token0") return params.token0;
      return [params.sqrtPriceX96, 0, 0, 0, 0, 0, true];
    }),
  } as unknown as ChainContext["publicClient"];

  const ctx = {
    publicClient,
    addresses: { weth: params.weth },
  } as unknown as ChainContext;
  return { ctx, reads };
}

describe("getEthPriceUsd", () => {
  it("should return USD per ETH when WETH is token0 (Base orientation)", async () => {
    const { ctx } = buildMockContext({
      weth: WETH_BASE,
      token0: WETH_BASE,
      sqrtPriceX96: sqrtPriceWethToken0(ETH_PRICE_USD),
    });
    const price = await getEthPriceUsd(ctx, {
      wethUsdcPoolAddress: POOL_BASE,
    });
    expect(price).toBeCloseTo(ETH_PRICE_USD, 0);
  });

  it("should invert the price when WETH is token1 (Ethereum mainnet orientation)", async () => {
    const { ctx } = buildMockContext({
      weth: WETH_MAINNET,
      token0: USDC_MAINNET,
      sqrtPriceX96: sqrtPriceWethToken1(ETH_PRICE_USD),
    });
    const price = await getEthPriceUsd(ctx, {
      wethUsdcPoolAddress: POOL_MAINNET,
    });
    expect(price).toBeCloseTo(ETH_PRICE_USD, 0);
  });

  it("should compare token0 against WETH case-insensitively", async () => {
    const { ctx } = buildMockContext({
      weth: WETH_ARBITRUM.toLowerCase() as Address,
      token0: WETH_ARBITRUM,
      sqrtPriceX96: sqrtPriceWethToken0(ETH_PRICE_USD),
    });
    const price = await getEthPriceUsd(ctx, {
      wethUsdcPoolAddress: POOL_ARBITRUM,
    });
    expect(price).toBeCloseTo(ETH_PRICE_USD, 0);
  });

  it("should read token0 with an abi that declares it even when poolAbi only declares slot0", async () => {
    const { ctx, reads } = buildMockContext({
      weth: WETH_BASE,
      token0: USDC_BASE,
      sqrtPriceX96: sqrtPriceWethToken0(ETH_PRICE_USD),
    });
    await getEthPriceUsd(ctx, {
      wethUsdcPoolAddress: POOL_BASE,
      poolAbi: POOL_SLOT0_ABI as unknown as never,
    });
    const token0Read = reads.find((r) => r.functionName === "token0");
    expect(token0Read).toBeDefined();
    expect(
      token0Read!.abi.some(
        (entry) => entry.type === "function" && entry.name === "token0",
      ),
    ).toBe(true);
  });
});
