import { describe, it, expect, vi } from "vitest";
import type { Address } from "viem";
import { mintPosition as mintUniswapV3 } from "../../../src/protocols/uniswap-v3/mint.js";
import { swapExactInputSingle as swapUniswapV3 } from "../../../src/protocols/uniswap-v3/swap.js";
import { mintPosition as mintAerodrome } from "../../../src/protocols/aerodrome/mint.js";
import { swapExactInputSingle as swapAerodrome } from "../../../src/protocols/aerodrome/swap.js";
import type { ChainContext } from "../../../src/context.js";

const MAX_UINT256 = 2n ** 256n - 1n;

const NPM_UNISWAP: Address = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
const NPM_AERODROME: Address = "0x827922686190790b37229fd06084350E74485b72";
const SWAP_ROUTER_UNISWAP: Address =
  "0x2626664c2603336E57B271c5C0b26F421741e481";
const SWAP_ROUTER_AERODROME: Address =
  "0xBE6D8f0d05cC4be24d5167a3eF062215bE6D18a5";
const QUOTER_UNISWAP: Address = "0x3d4e44Eb1374240CE5F1B136CFab3143afB7882c";
const QUOTER_AERODROME: Address = "0x254cF9E1E6e233aa1AC962CB9B05b2cfeAaE15b0";
const TOKEN0: Address = "0x4200000000000000000000000000000000000006";
const TOKEN1: Address = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const OWNER: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";

type ApproveCall = { address: Address; amount: bigint };

type MockContext = {
  ctx: ChainContext;
  approveCalls: () => ApproveCall[];
};

function buildMockContext(): MockContext {
  const rawApproveCalls: ApproveCall[] = [];

  const uniswapV3MintReceipt = {
    gasUsed: 100_000n,
    logs: [
      {
        address: NPM_UNISWAP,
        topics: [
          "0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f",
          "0x0000000000000000000000000000000000000000000000000000000000000001",
        ],
        data: "0x" + "00".repeat(128),
        eventName: "IncreaseLiquidity",
        args: { tokenId: 1n, liquidity: 1_000n, amount0: 1n, amount1: 2n },
      },
    ],
  };

  const publicClient = {
    chain: { id: 8453 },
    readContract: vi.fn(async () => 0n),
    simulateContract: vi.fn(async () => ({ result: undefined })),
    waitForTransactionReceipt: vi.fn(async () => uniswapV3MintReceipt),
  } as unknown as ChainContext["publicClient"];

  const walletClient = {
    account: { address: OWNER },
    writeContract: vi.fn(
      async (p: {
        address: Address;
        functionName: string;
        args?: unknown[];
      }) => {
        if (p.functionName === "approve" && Array.isArray(p.args)) {
          rawApproveCalls.push({
            address: p.address,
            amount: p.args[1] as bigint,
          });
        }
        return "0xabc" as `0x${string}`;
      },
    ),
    sendTransaction: vi.fn(async () => "0xdef" as `0x${string}`),
  } as unknown as ChainContext["walletClient"];

  const ctx = {
    publicClient,
    walletClient,
    addresses: {
      uniswapV3: {
        npm: NPM_UNISWAP,
        swapRouter: SWAP_ROUTER_UNISWAP,
        quoter: QUOTER_UNISWAP,
        factory: "0x0" as Address,
      },
      aerodrome: {
        swapRouter: SWAP_ROUTER_AERODROME,
        quoter: QUOTER_AERODROME,
      },
      weth: TOKEN0,
    },
  } as unknown as ChainContext;

  return { ctx, approveCalls: () => rawApproveCalls };
}

describe("approvalMode propagation — uniswap-v3 mint", () => {
  it("(a) exact: aprova token0/token1 com amount === amount0Desired/amount1Desired", async () => {
    const { ctx, approveCalls } = buildMockContext();
    const amount0Desired = 1_000_000_000_000_000n;
    const amount1Desired = 1_000_000n;

    await mintUniswapV3(ctx, {
      token0: TOKEN0,
      token1: TOKEN1,
      fee: 100,
      tickLower: -200_000,
      tickUpper: -190_000,
      amount0Desired,
      amount1Desired,
      slippageBps: 100,
      approvalMode: "exact",
    });

    const approves = approveCalls();
    expect(approves).toHaveLength(2);
    expect(approves[0]!.address).toBe(TOKEN0);
    expect(approves[0]!.amount).toBe(amount0Desired);
    expect(approves[1]!.address).toBe(TOKEN1);
    expect(approves[1]!.amount).toBe(amount1Desired);
  });

  it("(b) sem approvalMode: aprova token0/token1 com MAX_UINT256 (default unlimited)", async () => {
    const { ctx, approveCalls } = buildMockContext();

    await mintUniswapV3(ctx, {
      token0: TOKEN0,
      token1: TOKEN1,
      fee: 100,
      tickLower: -200_000,
      tickUpper: -190_000,
      amount0Desired: 1_000_000_000_000_000n,
      amount1Desired: 1_000_000n,
      slippageBps: 100,
    });

    const approves = approveCalls();
    expect(approves).toHaveLength(2);
    expect(approves[0]!.amount).toBe(MAX_UINT256);
    expect(approves[1]!.amount).toBe(MAX_UINT256);
  });
});

describe("approvalMode propagation — uniswap-v3 swap", () => {
  it("(c) exact: aprova tokenIn com amount === amountIn", async () => {
    const { ctx, approveCalls } = buildMockContext();
    const amountIn = 5_000_000n;

    // quoteExactInputSingle usa publicClient.readContract — já está mockado para 0n,
    // mas o quoter retorna [amountOut, sqrtPriceX96After, ticks, gas]; precisa de array.
    // Sobrescreve readContract para retornar dados compatíveis com o quoter.
    (
      ctx.publicClient.readContract as ReturnType<typeof vi.fn>
    ).mockImplementation(async (p: { functionName: string }) => {
      if (p.functionName === "quoteExactInputSingle") {
        return [1_000_000n, 0n, 0, 0n];
      }
      // allowance
      return 0n;
    });

    try {
      await swapUniswapV3(ctx, {
        tokenIn: TOKEN0,
        tokenOut: TOKEN1,
        fee: 500,
        amountIn,
        slippageBps: 50,
        approvalMode: "exact",
      });
    } catch {
      // getBalance ou writeContract posterior pode lançar — só nos importamos com o approve
    }

    const approves = approveCalls().filter((c) => c.address === TOKEN0);
    expect(approves.length).toBeGreaterThanOrEqual(1);
    expect(approves[0]!.amount).toBe(amountIn);
  });
});

describe("approvalMode propagation — aerodrome mint", () => {
  it("(d) exact: aprova token0/token1 com amounts desired", async () => {
    const { ctx, approveCalls } = buildMockContext();
    const amount0Desired = 2_000_000_000_000_000n;
    const amount1Desired = 3_000_000n;

    try {
      await mintAerodrome(ctx, {
        npmAddress: NPM_AERODROME,
        token0: TOKEN0,
        token1: TOKEN1,
        tickSpacing: 1,
        tickLower: -200_000,
        tickUpper: -190_000,
        amount0Desired,
        amount1Desired,
        slippageBps: 100,
        sqrtPriceX96: 0n,
        approvalMode: "exact",
      });
    } catch {
      // parse de log pode lançar — só nos importamos com os approves
    }

    const approves = approveCalls();
    expect(approves).toHaveLength(2);
    expect(approves[0]!.address).toBe(TOKEN0);
    expect(approves[0]!.amount).toBe(amount0Desired);
    expect(approves[1]!.address).toBe(TOKEN1);
    expect(approves[1]!.amount).toBe(amount1Desired);
  });
});

describe("approvalMode propagation — aerodrome swap", () => {
  it("(e) exact: aprova tokenIn com amount === amountIn", async () => {
    const { ctx, approveCalls } = buildMockContext();
    const amountIn = 7_000_000n;

    (
      ctx.publicClient.readContract as ReturnType<typeof vi.fn>
    ).mockImplementation(async (p: { functionName: string }) => {
      if (p.functionName === "quoteExactInputSingle") {
        return [1_000_000n, 0n, 0, 0n];
      }
      return 0n;
    });

    try {
      await swapAerodrome(ctx, {
        tokenIn: TOKEN0,
        tokenOut: TOKEN1,
        tickSpacing: 1,
        amountIn,
        slippageBps: 50,
        approvalMode: "exact",
      });
    } catch {
      // getBalance ou writeContract posterior pode lançar
    }

    const approves = approveCalls().filter((c) => c.address === TOKEN0);
    expect(approves.length).toBeGreaterThanOrEqual(1);
    expect(approves[0]!.amount).toBe(amountIn);
  });
});
