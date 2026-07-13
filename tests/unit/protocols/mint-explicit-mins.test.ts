import { describe, it, expect, vi } from "vitest";
import { decodeFunctionData, type Address } from "viem";
import { mintPosition as mintAerodrome } from "../../../src/protocols/aerodrome/mint.js";
import { planMint } from "../../../src/protocols/uniswap-v3/plan.js";
import { NPM_ABI } from "../../../src/abis/npm.js";
import type { ChainContext } from "../../../src/context.js";

const NPM_UNISWAP: Address = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
const NPM_AERODROME: Address = "0x827922686190790b37229fd06084350E74485b72";
const TOKEN0: Address = "0x4200000000000000000000000000000000000006";
const TOKEN1: Address = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const OWNER: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";

const AMOUNT0_DESIRED = 1_000_000_000_000_000_000n;
const AMOUNT1_DESIRED = 2_000_000_000n;

type MintArgs = Record<string, unknown>;

function buildMockContext(): {
  ctx: ChainContext;
  mintArgs: () => MintArgs;
} {
  const captured: MintArgs[] = [];
  const receipt = { gasUsed: 100_000n, logs: [] };

  const publicClient = {
    chain: { id: 8453 },
    readContract: vi.fn(async () => 0n),
    waitForTransactionReceipt: vi.fn(async () => receipt),
  } as unknown as ChainContext["publicClient"];

  const walletClient = {
    account: { address: OWNER },
    writeContract: vi.fn(
      async (p: { functionName: string; args: MintArgs[] }) => {
        if (p.functionName === "mint") captured.push(p.args[0]!);
        return "0xabc" as `0x${string}`;
      },
    ),
  } as unknown as ChainContext["walletClient"];

  return {
    ctx: { publicClient, walletClient, addresses: {} } as ChainContext,
    mintArgs: () => captured[0]!,
  };
}

const aerodromeParams = {
  npmAddress: NPM_AERODROME,
  poolAddress: NPM_AERODROME,
  token0: TOKEN0,
  token1: TOKEN1,
  tickSpacing: 100,
  tickLower: -200_000,
  tickUpper: -190_000,
  amount0Desired: AMOUNT0_DESIRED,
  amount1Desired: AMOUNT1_DESIRED,
  sqrtPriceX96: 0n,
  slippageBps: 50,
  deadline: 1_900_000_000n,
};

describe("mintPosition (aerodrome) — amount0Min/amount1Min explicitos", () => {
  it("usa os mins explicitos quando fornecidos, ignorando o slippageBps", async () => {
    const { ctx, mintArgs } = buildMockContext();

    await mintAerodrome(ctx, {
      ...aerodromeParams,
      amount0Min: 111n,
      amount1Min: 222n,
    });

    expect(mintArgs()["amount0Min"]).toBe(111n);
    expect(mintArgs()["amount1Min"]).toBe(222n);
  });

  it("aceita min = 0 explicito (nao confunde 0n com ausente)", async () => {
    const { ctx, mintArgs } = buildMockContext();

    await mintAerodrome(ctx, {
      ...aerodromeParams,
      amount0Min: 0n,
      amount1Min: 0n,
    });

    expect(mintArgs()["amount0Min"]).toBe(0n);
    expect(mintArgs()["amount1Min"]).toBe(0n);
  });

  it("deriva os mins do slippageBps quando nao fornecidos (comportamento atual)", async () => {
    const { ctx, mintArgs } = buildMockContext();

    await mintAerodrome(ctx, aerodromeParams);

    // 50 bps => desired * 9950 / 10000
    expect(mintArgs()["amount0Min"]).toBe(995_000_000_000_000_000n);
    expect(mintArgs()["amount1Min"]).toBe(1_990_000_000n);
  });

  it("deriva a perna faltante do slippage quando so um min e fornecido", async () => {
    const { ctx, mintArgs } = buildMockContext();

    await mintAerodrome(ctx, { ...aerodromeParams, amount0Min: 111n });

    expect(mintArgs()["amount0Min"]).toBe(111n);
    expect(mintArgs()["amount1Min"]).toBe(1_990_000_000n);
  });
});

const uniswapPlanParams = {
  token0: TOKEN0,
  token1: TOKEN1,
  fee: 500,
  tickLower: -200_000,
  tickUpper: -190_000,
  amount0Desired: AMOUNT0_DESIRED,
  amount1Desired: AMOUNT1_DESIRED,
  slippageBps: 50,
  npmAddress: NPM_UNISWAP,
  recipient: OWNER,
  deadline: 1_900_000_000n,
};

function decodeMint(data: `0x${string}`): MintArgs {
  const decoded = decodeFunctionData({ abi: NPM_ABI, data });
  return decoded.args![0] as MintArgs;
}

describe("planMint (uniswap-v3) — amount0Min/amount1Min explicitos", () => {
  it("usa os mins explicitos quando fornecidos, ignorando o slippageBps", () => {
    const txs = planMint({
      ...uniswapPlanParams,
      amount0Min: 111n,
      amount1Min: 222n,
    });

    const mintParams = decodeMint(txs[txs.length - 1]!.data);
    expect(mintParams["amount0Min"]).toBe(111n);
    expect(mintParams["amount1Min"]).toBe(222n);
  });

  it("deriva os mins do slippageBps quando nao fornecidos (comportamento atual)", () => {
    const txs = planMint(uniswapPlanParams);

    const mintParams = decodeMint(txs[txs.length - 1]!.data);
    expect(mintParams["amount0Min"]).toBe(995_000_000_000_000_000n);
    expect(mintParams["amount1Min"]).toBe(1_990_000_000n);
  });
});
