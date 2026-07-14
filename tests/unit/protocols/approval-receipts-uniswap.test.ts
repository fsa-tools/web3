import { describe, it, expect, vi } from "vitest";
import type { Address } from "viem";
import { mintPosition } from "../../../src/protocols/uniswap-v3/mint.js";
import { swapExactInputSingle } from "../../../src/protocols/uniswap-v3/swap.js";
import type { ChainContext } from "../../../src/context.js";

const NPM: Address = "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1";
const SWAP_ROUTER: Address = "0x2626664c2603336E57B271c5C0b26F421741e481";
const QUOTER: Address = "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a";
const TOKEN0: Address = "0x4200000000000000000000000000000000000006";
const TOKEN1: Address = "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913";
const TOKEN_OUT: Address = "0x9999999999999999999999999999999999999999";
const OWNER: Address = "0x8F6D8D76C46BeC598f2084c530dCbE74453A36B0";
const Q96 = 2n ** 96n;

/** amountOut cotado pelo QuoterV2 — base do amountOutMinimum. */
const QUOTED_OUT = 2_000n;

type MockOptions = {
  /** allowance devolvida por readContract("allowance") — 0n forca approve. */
  allowance: bigint;
};

/**
 * Constroi um ChainContext mockado onde writeContract e
 * waitForTransactionReceipt devolvem hash/receipt IDENTIFICAVEIS por chamada,
 * para diferenciar receipts de approve dos da tx principal (mint/swap).
 */
function buildMockContext(options: MockOptions) {
  let writeCallCount = 0;
  let balanceOfCallCount = 0;

  const mintReceipt = {
    transactionHash: "0xmaintx",
    gasUsed: 200_000n,
    effectiveGasPrice: 1_000_000_000n,
    logs: [
      {
        address: NPM,
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
    readContract: vi.fn(async (p: { functionName: string }) => {
      if (p.functionName === "allowance") return options.allowance;
      if (p.functionName === "quoteExactInputSingle") {
        // [amountOut, sqrtPriceX96After, initializedTicksCrossed, gasEstimate]
        return [QUOTED_OUT, Q96, 1, 90_000n];
      }
      if (p.functionName === "balanceOf") {
        balanceOfCallCount += 1;
        // 1a leitura (antes do swap) = 0; 2a (depois) = 500
        return balanceOfCallCount === 1 ? 0n : 500n;
      }
      return 0n;
    }),
    waitForTransactionReceipt: vi.fn(async (p: { hash: `0x${string}` }) => {
      if (p.hash === "0xmaintx") return mintReceipt;
      return {
        transactionHash: p.hash,
        gasUsed: 50_000n,
        effectiveGasPrice: 1_000_000_000n,
        logs: [],
      };
    }),
  } as unknown as ChainContext["publicClient"];

  const walletClient = {
    account: { address: OWNER },
    writeContract: vi.fn(
      async (p: { functionName: string }): Promise<`0x${string}`> => {
        writeCallCount += 1;
        if (
          p.functionName === "mint" ||
          p.functionName === "exactInputSingle"
        ) {
          return "0xmaintx";
        }
        return `0xapprove${writeCallCount}` as `0x${string}`;
      },
    ),
    sendTransaction: vi.fn(async () => "0xmaintx" as `0x${string}`),
  } as unknown as ChainContext["walletClient"];

  const ctx = {
    publicClient,
    walletClient,
    addresses: {
      weth: TOKEN0,
      uniswapV3: {
        npm: NPM,
        factory: "0x0" as Address,
        swapRouter: SWAP_ROUTER,
        quoter: QUOTER,
      },
    },
  } as unknown as ChainContext;

  return { ctx };
}

describe("swapExactInputSingle — approvalReceipts", () => {
  it("com allowance 0, approvalReceipts tem 1 item e nao e o receipt do swap", async () => {
    const { ctx } = buildMockContext({ allowance: 0n });

    const result = await swapExactInputSingle(ctx, {
      tokenIn: TOKEN0,
      tokenOut: TOKEN_OUT,
      fee: 500,
      amountIn: 1_000n,
      slippageBps: 100,
    });

    expect(result.approvalReceipts).toHaveLength(1);
    expect(result.approvalReceipts[0]!.transactionHash).not.toBe(result.txHash);
  });

  it("com allowance suficiente, approvalReceipts e []", async () => {
    const { ctx } = buildMockContext({ allowance: 1_000_000n });

    const result = await swapExactInputSingle(ctx, {
      tokenIn: TOKEN0,
      tokenOut: TOKEN_OUT,
      fee: 500,
      amountIn: 1_000n,
      slippageBps: 100,
    });

    expect(result.approvalReceipts).toEqual([]);
  });
});

describe("mintPosition — approvalReceipts", () => {
  it("com allowance 0 nos dois tokens, approvalReceipts tem 2 itens na ordem [token0, token1]", async () => {
    const { ctx } = buildMockContext({ allowance: 0n });

    const result = await mintPosition(ctx, {
      token0: TOKEN0,
      token1: TOKEN1,
      fee: 100,
      tickLower: -200_000,
      tickUpper: -190_000,
      amount0Desired: 1_000_000_000_000_000n,
      amount1Desired: 1_000_000n,
      slippageBps: 100,
    });

    expect(result.approvalReceipts).toHaveLength(2);
    expect(result.approvalReceipts[0]!.transactionHash).toBe("0xapprove1");
    expect(result.approvalReceipts[1]!.transactionHash).toBe("0xapprove2");
  });

  it("com allowance suficiente nos dois tokens, approvalReceipts e []", async () => {
    const { ctx } = buildMockContext({ allowance: 1_000_000_000_000_000n });

    const result = await mintPosition(ctx, {
      token0: TOKEN0,
      token1: TOKEN1,
      fee: 100,
      tickLower: -200_000,
      tickUpper: -190_000,
      amount0Desired: 1_000_000_000_000_000n,
      amount1Desired: 1_000_000n,
      slippageBps: 100,
    });

    expect(result.approvalReceipts).toEqual([]);
  });
});
